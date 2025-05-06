/**
 * Handler for the create action
 */
import { z } from 'zod';
import { generateTaskFiles, readTasksFile, writeTasksFile } from '../../../utils/file-utils.js';
import { schemas, validateParams } from '../../../validation/index.js';
import { MCPError } from '../../../errors/index.js';
import { create_success_payload } from '../../../utils/response.js';
import { ErrorCode } from '../../../../types/errors.js';
import Config, { PRODUCT_BRIEF_FILE } from '../../../../config.js';
import { createNewTask, getNextTaskId, validateDependencies } from '../utils/task-utils.js';
import { generateMarkdown } from '../../../../core/services/project-brief-markdown.js';
import { logger } from '../../../utils/logger.js';
import { Task, TasksData } from '../../../types/index.js';

/**
 * Handles the create action (from apm_add_task)
 * @param params Tool parameters
 * @param projectRoot Project root directory
 * @returns MCP response
 */
export async function handleCreate(
  params: Record<string, unknown>,
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Define the schema for create action parameters
  const createSchema = z.object({
    projectRoot: schemas.projectRoot,
    file: schemas.file,
    title: z.string().min(1, 'Title is required').optional().describe('Task title'),
    description: z
      .string()
      .min(1, 'Description is required')
      .optional()
      .describe('Task description'),
    priority: schemas.taskPriority.default('medium').describe('Task priority (high, medium, low)'),
    dependencies: z
      .string()
      .optional()
      .describe('Comma-separated list of task IDs this task depends on'),
    details: z.string().optional().describe('Implementation details'),
    testStrategy: z.string().optional().describe('Test strategy'),
  });

  // Validate parameters
  const validatedParams = validateParams(params, createSchema);
  const { file, title, description, priority, dependencies, details, testStrategy } =
    validatedParams;

  // Read tasks from file
  const tasksData = await readTasksFile(projectRoot, file);
  if (!tasksData) {
    // Create a new tasks data structure if none exists
    const newTasksData: TasksData = {
      tasks: [] as Task[],
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        projectName: 'AgentPM Project',
        projectDescription: 'Created by AgentPM',
        // Add any additional properties as needed
      },
    };

    // Create the new task
    const newTask = createNewTask(
      '1', // First task gets ID 1
      title || 'New Task',
      description || 'Task created by AgentPM',
      typeof priority === 'string' ? priority : 'medium',
      dependencies,
      details,
      testStrategy
    );

    newTasksData.tasks.push(newTask);

    // Write the tasks data to file
    const success = await writeTasksFile(newTasksData, projectRoot, file);
    if (!success) {
      throw new MCPError('Failed to write tasks data to file', ErrorCode.FILE_WRITE_ERROR);
    }

    // Generate task files
    await generateTaskFiles(newTasksData, projectRoot);

    // Regenerate project brief markdown to include the new task
    try {
      // Convert TasksData to the format expected by generateMarkdown
      const formattedTasksData = {
        tasks: newTasksData.tasks.map((task) => ({
          id: String(task.id),
          title: task.title || '',
          description: task.description || '',
          status: task.status || 'pending',
          priority: task.priority,
          subtasks: task.subtasks?.map((subtask: Task) => ({
            id: String(subtask.id),
            title: subtask.title || '',
            status: subtask.status || 'pending',
            description: subtask.description,
          })),
        })),
        metadata: newTasksData.metadata,
      };

      // Check if there's a project brief file in the resources directory
      const fs = await import('fs/promises');
      const path = await import('path');

      const artifactsDir = Config.getArtifactsDir(projectRoot);
      const resourcesDir = path.join(artifactsDir, 'resources', 'project-brief');
      const markdownPath = path.join(artifactsDir, PRODUCT_BRIEF_FILE);

      try {
        // Check if the resources directory exists
        await fs.access(resourcesDir);

        // List all files in the resources directory
        const files = await fs.readdir(resourcesDir);

        // Find the first .json file (project brief)
        const projectBriefFile = files.find((file) => file.endsWith('.json'));

        if (projectBriefFile) {
          // Found a project brief file, use it to regenerate the markdown
          const projectBriefUri = `project-brief://${projectBriefFile.replace('.json', '')}`;
          logger.debug('Found project brief file, regenerating markdown', { projectBriefUri });

          // Update the tasks data metadata with the project brief URI
          newTasksData.metadata = {
            ...newTasksData.metadata,
            projectBriefUri: projectBriefUri,
          };

          // Write the updated tasks data back to the file
          await writeTasksFile(newTasksData, projectRoot, file);

          // Generate the markdown
          const markdownPath = await generateMarkdown(projectBriefUri, formattedTasksData);
          logger.debug('Project brief markdown regenerated', { markdownPath });
        } else {
          // No project brief file found, fall back to updating the markdown file directly
          await updateMarkdownDirectly();
        }
      } catch (error) {
        // Resources directory doesn't exist or other error, fall back to updating the markdown file directly
        logger.debug('Could not access project brief resources directory', { error });
        await updateMarkdownDirectly();
      }

      // Helper function to update the markdown file directly
      async function updateMarkdownDirectly() {
        try {
          // Check if the markdown file exists
          await fs.access(markdownPath);

          // File exists, so let's update it
          logger.debug('Project brief markdown file exists, updating it directly', {
            markdownPath,
          });

          // Read the existing file to get the project brief content
          const existingMarkdown = await fs.readFile(markdownPath, 'utf-8');

          // Extract the project brief content (everything before the Development Roadmap section)
          const roadmapSectionIndex = existingMarkdown.indexOf('## Development Roadmap');
          if (roadmapSectionIndex !== -1) {
            const projectBriefContent = existingMarkdown.substring(0, roadmapSectionIndex);

            // Generate the tasks section
            let tasksSection = '## Development Roadmap\n\n';

            // Add all tasks
            for (const task of formattedTasksData.tasks) {
              tasksSection += `### ${task.id}: ${task.title}\n\n`;
              tasksSection += `**Description:** ${task.description}\n\n`;
              tasksSection += `**Priority:** ${task.priority}\n\n`;
              tasksSection += `**Status:** ${task.status || 'pending'}\n\n`;

              if (task.subtasks && task.subtasks.length > 0) {
                tasksSection += `**Subtasks:**\n\n`;
                for (const subtask of task.subtasks) {
                  tasksSection += `- ${subtask.id}: ${subtask.title} (${subtask.status || 'pending'})\n`;
                }
                tasksSection += '\n';
              }
            }

            // Combine the project brief content with the updated tasks section
            const updatedMarkdown = projectBriefContent + tasksSection;

            // Write the updated markdown file
            await fs.writeFile(markdownPath, updatedMarkdown, 'utf-8');

            logger.debug('Project brief markdown updated directly', { markdownPath });
          } else {
            logger.debug(
              'Could not find Development Roadmap section in project brief markdown, skipping update'
            );
          }
        } catch (error) {
          // File doesn't exist or other error
          logger.debug('Project brief markdown file does not exist or could not be accessed', {
            error,
          });
        }
      }
    } catch (error) {
      // Log the error but don't fail the operation
      logger.error('Error regenerating project brief markdown', { error });
    }

    // Return success response
    return create_success_payload(
      {
        task: newTask,
        tasksPath: file || Config.getArtifactsFile(projectRoot),
      },
      `Created new task: ${title}`,
      {
        context: {
          taskId: newTask.id,
          timestamp: new Date().toISOString(),
        },
      }
    );
  }

  // Get the tasks array
  const tasks = tasksData.tasks || [];

  // Generate a new task ID (max ID + 1)
  const newId = getNextTaskId(tasks);

  // Parse dependencies
  const dependencyIds = dependencies
    ? dependencies
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  // Validate dependencies
  validateDependencies(dependencyIds, tasks);

  // Create the new task
  const newTask = createNewTask(
    newId,
    title || 'New Task',
    description || 'Task created by AgentPM',
    typeof priority === 'string' ? priority : 'medium',
    dependencies,
    details,
    testStrategy
  );

  // Add the new task to the tasks array
  tasks.push(newTask);

  // Update the metadata
  if (tasksData.metadata) {
    tasksData.metadata.updated = new Date().toISOString();
  }

  // Write the tasks data to file
  const success = await writeTasksFile(tasksData, projectRoot, file);
  if (!success) {
    throw new MCPError('Failed to write tasks data to file', ErrorCode.FILE_WRITE_ERROR);
  }

  // Generate task files
  await generateTaskFiles(tasksData, projectRoot);

  // Regenerate project brief markdown to include the new task
  try {
    // Check if there's a project brief URI in the tasks data
    const projectBriefUri = tasksData.metadata?.projectBriefUri as string | undefined;

    // Convert TasksData to the format expected by generateMarkdown
    const formattedTasksData = {
      tasks: tasksData.tasks.map((task) => ({
        id: String(task.id),
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'pending',
        priority: task.priority,
        subtasks: task.subtasks?.map((subtask: Task) => ({
          id: String(subtask.id),
          title: subtask.title || '',
          status: subtask.status || 'pending',
          description: subtask.description,
        })),
      })),
      metadata: tasksData.metadata,
    };

    if (projectBriefUri) {
      // If we have a project brief URI, use it to regenerate the markdown
      logger.debug('Regenerating project brief markdown using URI', { projectBriefUri });
      const markdownPath = await generateMarkdown(projectBriefUri, formattedTasksData);
      logger.debug('Project brief markdown regenerated', { markdownPath });
    } else {
      // If no URI, try to find a project brief file in the resources directory
      const fs = await import('fs/promises');
      const path = await import('path');

      const artifactsDir = Config.getArtifactsDir(projectRoot);
      const resourcesDir = path.join(artifactsDir, 'resources', 'project-brief');
      const markdownPath = path.join(artifactsDir, PRODUCT_BRIEF_FILE);

      try {
        // Check if the resources directory exists
        await fs.access(resourcesDir);

        // List all files in the resources directory
        const files = await fs.readdir(resourcesDir);

        // Find the first .json file (project brief)
        const projectBriefFile = files.find((file) => file.endsWith('.json'));

        if (projectBriefFile) {
          // Found a project brief file, use it to regenerate the markdown
          const projectBriefUri = `project-brief://${projectBriefFile.replace('.json', '')}`;
          logger.debug('Found project brief file, regenerating markdown', { projectBriefUri });

          // Update the tasks data metadata with the project brief URI
          tasksData.metadata = {
            ...tasksData.metadata,
            projectBriefUri: projectBriefUri,
          };

          // Write the updated tasks data back to the file
          await writeTasksFile(tasksData, projectRoot, file);

          // Generate the markdown
          const markdownPath = await generateMarkdown(projectBriefUri, formattedTasksData);
          logger.debug('Project brief markdown regenerated', { markdownPath });
        } else {
          // No project brief file found, fall back to updating the markdown file directly
          await updateMarkdownDirectly();
        }
      } catch (error) {
        // Resources directory doesn't exist or other error, fall back to updating the markdown file directly
        logger.debug('Could not access project brief resources directory', { error });
        await updateMarkdownDirectly();
      }

      // Helper function to update the markdown file directly
      async function updateMarkdownDirectly() {
        try {
          // Check if the markdown file exists
          await fs.access(markdownPath);

          // File exists, so let's update it
          logger.debug('Project brief markdown file exists, updating it directly', {
            markdownPath,
          });

          // Read the existing file to get the project brief content
          const existingMarkdown = await fs.readFile(markdownPath, 'utf-8');

          // Extract the project brief content (everything before the Development Roadmap section)
          const roadmapSectionIndex = existingMarkdown.indexOf('## Development Roadmap');
          if (roadmapSectionIndex !== -1) {
            const projectBriefContent = existingMarkdown.substring(0, roadmapSectionIndex);

            // Generate the tasks section
            let tasksSection = '## Development Roadmap\n\n';

            // Add all tasks
            for (const task of formattedTasksData.tasks) {
              tasksSection += `### ${task.id}: ${task.title}\n\n`;
              tasksSection += `**Description:** ${task.description}\n\n`;
              tasksSection += `**Priority:** ${task.priority}\n\n`;
              tasksSection += `**Status:** ${task.status || 'pending'}\n\n`;

              if (task.subtasks && task.subtasks.length > 0) {
                tasksSection += `**Subtasks:**\n\n`;
                for (const subtask of task.subtasks) {
                  tasksSection += `- ${subtask.id}: ${subtask.title} (${subtask.status || 'pending'})\n`;
                }
                tasksSection += '\n';
              }
            }

            // Combine the project brief content with the updated tasks section
            const updatedMarkdown = projectBriefContent + tasksSection;

            // Write the updated markdown file
            await fs.writeFile(markdownPath, updatedMarkdown, 'utf-8');

            logger.debug('Project brief markdown updated directly', { markdownPath });
          } else {
            logger.debug(
              'Could not find Development Roadmap section in project brief markdown, skipping update'
            );
          }
        } catch (error) {
          // File doesn't exist or other error
          logger.debug('Project brief markdown file does not exist or could not be accessed', {
            error,
          });
        }
      }
    }
  } catch (error) {
    // Log the error but don't fail the operation
    logger.error('Error regenerating project brief markdown', { error });
  }

  // Return success response
  return create_success_payload(
    {
      task: newTask,
      tasksPath: file || Config.getArtifactsFile(projectRoot),
    },
    `Created new task: ${title}`,
    {
      context: {
        taskId: newTask.id,
        timestamp: new Date().toISOString(),
      },
    }
  );
}
