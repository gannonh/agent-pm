/**
 * Handler for the add_subtask action
 */
import { z } from 'zod';
import { generateTaskFiles, readTasksFile, writeTasksFile } from '../../../utils/file-utils.js';
import { schemas, validateParams } from '../../../validation/index.js';
import { MCPError, MCPNotFoundError, MCPValidationError } from '../../../errors/index.js';
import { create_success_payload } from '../../../utils/response.js';
import { ErrorCode } from '../../../../types/errors.js';
import Config, { PRODUCT_BRIEF_FILE } from '../../../../config.js';
import { findDependentTasks } from '../utils/task-utils.js';
import { generateMarkdown } from '../../../../core/services/project-brief-markdown.js';
import { logger } from '../../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Interface for subtask properties
 */
interface Subtask {
  id: string;
  title: string;
  status?: string;
  description?: string;
  details?: string;
  dependencies?: string[];
}

/**
 * Handles the add_subtask action (from apm_add_subtask)
 * @param params Tool parameters
 * @param projectRoot Project root directory
 * @returns MCP response
 */
export async function handleAddSubtask(
  params: Record<string, unknown>,
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Define the schema for add_subtask action parameters
  const addSubtaskSchema = z.object({
    projectRoot: schemas.projectRoot,
    id: z.string().min(1, 'Parent task ID is required').describe('ID of the parent task'),
    title: z.string().optional().describe('Title for the new subtask'),
    description: z.string().optional().describe('Description for the new subtask'),
    details: z.string().optional().describe('Implementation details for the new subtask'),
    dependencies: z
      .string()
      .optional()
      .describe('Comma-separated list of dependency IDs for the new subtask'),
    status: z
      .enum(['pending', 'in-progress', 'done', 'deferred', 'cancelled'])
      .optional()
      .default('pending')
      .describe('Status for the new subtask (default: pending)'),
    taskId: z.string().optional().describe('Existing task ID to convert to subtask'),
    skipGenerate: z.boolean().optional().default(false).describe('Skip regenerating task files'),
    file: schemas.file,
  });

  // Validate parameters
  const validatedParams = validateParams(params, addSubtaskSchema);
  const { id, title, description, details, dependencies, status, taskId, skipGenerate, file } =
    validatedParams;

  // Read tasks from file
  const tasksData = await readTasksFile(projectRoot, file);
  if (!tasksData || !tasksData.tasks || tasksData.tasks.length === 0) {
    throw new MCPNotFoundError('Tasks file not found or is empty');
  }

  // Find the parent task
  const parentTask = tasksData.tasks.find((task) => String(task.id) === id);
  if (!parentTask) {
    throw new MCPNotFoundError(`Parent task with ID ${id} not found`);
  }

  // Initialize subtasks array if it doesn't exist
  if (!parentTask.subtasks) {
    parentTask.subtasks = [];
  }

  let newSubtask;

  // Check if we're converting an existing task to a subtask
  if (taskId) {
    // Find the task to convert
    const taskToConvert = tasksData.tasks.find((task) => String(task.id) === taskId);
    if (!taskToConvert) {
      throw new MCPNotFoundError(`Task with ID ${taskId} not found`);
    }

    // Check if any other tasks depend on this task
    const dependentTasks = findDependentTasks(tasksData.tasks, taskId);
    if (dependentTasks.length > 0) {
      throw new MCPValidationError(
        `Cannot convert task ${taskId} to subtask because ${dependentTasks.length} other task(s) depend on it`,
        {
          taskId: [`Task ${taskId} is a dependency for other tasks`],
        }
      );
    }

    // Create a new subtask from the existing task
    newSubtask = {
      id: `${parentTask.subtasks.length + 1}`,
      title: taskToConvert.title,
      description: taskToConvert.description,
      status: taskToConvert.status || 'pending',
      details: taskToConvert.details || '',
      dependencies: taskToConvert.dependencies || [],
    };

    // Add the subtask to the parent task
    parentTask.subtasks.push(newSubtask);

    // Remove the original task
    const taskIndex = tasksData.tasks.findIndex((task) => String(task.id) === taskId);
    if (taskIndex !== -1) {
      tasksData.tasks.splice(taskIndex, 1);

      // Delete the task file
      try {
        const taskFilePath = Config.getArtifactFilePath(taskId, projectRoot);
        await fs.unlink(taskFilePath);
        logger.debug(`Deleted task file for converted task: ${taskFilePath}`);
      } catch (error) {
        // Log the error but don't fail the operation
        logger.error(`Error deleting task file for converted task ${taskId}:`, error);
      }
    }
  } else {
    // Create a new subtask
    newSubtask = {
      id: `${parentTask.subtasks.length + 1}`,
      title: title || 'New Subtask',
      description: description || 'Subtask created by AgentPM',
      status: status || 'pending',
      details: details || '',
      dependencies: dependencies
        ? dependencies
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
    };

    // Add the subtask to the parent task
    parentTask.subtasks.push(newSubtask);
  }

  // Update the metadata
  if (tasksData.metadata) {
    tasksData.metadata.updated = new Date().toISOString();
  }

  // Write the tasks data to file
  const success = await writeTasksFile(tasksData, projectRoot, file);
  if (!success) {
    throw new MCPError('Failed to write tasks data to file', ErrorCode.FILE_WRITE_ERROR);
  }

  // Generate task files if not skipped
  if (!skipGenerate) {
    await generateTaskFiles(tasksData, projectRoot);

    // Regenerate project brief markdown to include the new subtask
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
          subtasks: task.subtasks?.map((subtask) => ({
            id: String((subtask as Subtask).id),
            title: (subtask as Subtask).title || '',
            status: (subtask as Subtask).status || 'pending',
            description: (subtask as Subtask).description,
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
  }

  // Return success response
  return create_success_payload(
    {
      parentTask,
      subtask: newSubtask,
      tasksPath: file || Config.getArtifactsFile(projectRoot),
    },
    taskId ? `Converted task ${taskId} to subtask of task ${id}` : `Added subtask to task ${id}`,
    {
      context: {
        parentTaskId: id,
        subtaskId: `${id}.${newSubtask.id}`,
        timestamp: new Date().toISOString(),
      },
    }
  );
}
