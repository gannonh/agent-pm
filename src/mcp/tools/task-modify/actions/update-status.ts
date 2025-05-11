/**
 * Handler for the update_status action
 */
import { z } from 'zod';
import { generateTaskFiles, readTasksFile, writeTasksFile } from '../../../utils/file-utils.js';
import { schemas, validateParams } from '../../../validation/index.js';
import { MCPError, MCPNotFoundError } from '../../../errors/index.js';
import { create_success_payload } from '../../../utils/response.js';
import { ErrorCode } from '../../../../types/errors.js';
import config, { PRODUCT_BRIEF_FILE } from '../../../../config.js';
import { logger } from '../../../utils/logger.js';
import { generateMarkdown } from '../../../../core/services/project-brief-markdown.js';

/**
 * Handles the update_status action (from apm_set_task_status)
 * @param params Tool parameters
 * @param projectRoot Project root directory
 * @returns MCP response
 */
export async function handleUpdateStatus(
  params: Record<string, unknown>,
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Define the schema for update_status action parameters
  const updateStatusSchema = z.object({
    projectRoot: schemas.projectRoot,
    id: z
      .string()
      .min(1, 'Task ID is required')
      .describe(
        "Task ID or subtask ID (e.g., '15', '15.2'). Can be comma-separated for multiple updates."
      ),
    status: schemas.taskStatus,
    file: schemas.file,
  });

  // Validate parameters
  const validatedParams = validateParams(params, updateStatusSchema);
  const { id, status, file } = validatedParams;

  // Ensure status is a string
  const statusString = status as string;

  // Read tasks from file
  const tasksData = await readTasksFile(projectRoot, file);
  const taskList = tasksData?.tasks || [];

  // Initialize arrays to track results
  const updatedTasks = [];
  const errors = [];

  // Process each task ID
  const taskIds = id.split(',').map((id) => id.trim());
  for (const taskId of taskIds) {
    try {
      logger.debug('Processing task ID:', { taskId });
      logger.debug('Task list:', { tasks: taskList.map((t) => ({ id: t.id, type: typeof t.id })) });

      // Check if the ID is a subtask ID (format: parentId.subtaskId)
      if (taskId.includes('.')) {
        // Parse the parent ID and subtask index
        const [parentId, subtaskIndex] = taskId.split('.');
        const subtaskIndexNumber = parseInt(subtaskIndex, 10) - 1; // Convert to 0-based index

        // Find the parent task
        const parentTask = taskList.find((task) => String(task.id) === parentId);
        if (!parentTask) {
          errors.push({ id: taskId, error: `Parent task with ID ${parentId} not found` });
          continue;
        }

        // Check if the parent task has subtasks
        if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
          errors.push({ id: taskId, error: `Parent task with ID ${parentId} has no subtasks` });
          continue;
        }

        // Check if the subtask index is valid
        if (subtaskIndexNumber < 0 || subtaskIndexNumber >= parentTask.subtasks.length) {
          errors.push({
            id: taskId,
            error: `Subtask with index ${subtaskIndex} not found in parent task ${parentId}`,
          });
          continue;
        }

        // Update the subtask status
        parentTask.subtasks[subtaskIndexNumber].status = statusString;
        updatedTasks.push({ id: taskId, status });
      } else {
        // Find the task
        const task = taskList.find((t) => String(t.id) === taskId);
        logger.debug('Task found:', task);

        if (!task) {
          errors.push({ id: taskId, error: `Task with ID ${taskId} not found` });
          continue;
        }

        // Update the task status
        task.status = statusString;
        updatedTasks.push({ id: taskId, status });
      }
    } catch (error) {
      errors.push({
        id: taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // If no tasks were updated, throw an error
  if (updatedTasks.length === 0) {
    if (errors.length > 0) {
      throw new MCPNotFoundError(
        `Failed to update status for any tasks: ${JSON.stringify(errors)}`
      );
    } else {
      throw new MCPNotFoundError(`No tasks found with ID(s): ${id}`);
    }
  }

  // Update the metadata
  if (tasksData?.metadata) {
    tasksData.metadata.updated = new Date().toISOString();
  }

  // Write the tasks data to file
  const success = await writeTasksFile(tasksData, projectRoot, file);
  if (!success) {
    throw new MCPError('Failed to write tasks data to file', ErrorCode.FILE_WRITE_ERROR);
  }

  // Generate task files
  await generateTaskFiles(tasksData, projectRoot);

  // Regenerate project brief markdown to include the updated task status
  try {
    // Make sure tasksData is not null
    if (!tasksData) {
      logger.error('Cannot regenerate project brief markdown: tasksData is null');
      return create_success_payload(
        {
          updatedTasks,
          errors: errors.length > 0 ? errors : undefined,
          tasksPath: file || config.getArtifactsFile(projectRoot),
        },
        `Updated status of ${updatedTasks.length} task(s) to '${statusString}'${
          errors.length > 0 ? ` with ${errors.length} error(s)` : ''
        }`,
        {
          context: {
            taskIds: id,
            status: statusString,
            timestamp: new Date().toISOString(),
          },
        }
      );
    }

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

      const artifactsDir = config.getArtifactsDir(projectRoot);
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
            projectBriefUri,
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
      async function updateMarkdownDirectly(): Promise<void> {
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
              tasksSection += `**Status:** ${task.status}\n\n`;

              if (task.subtasks && task.subtasks.length > 0) {
                tasksSection += `**Subtasks:**\n\n`;
                for (const subtask of task.subtasks) {
                  tasksSection += `- ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
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
      updatedTasks,
      errors: errors.length > 0 ? errors : undefined,
      tasksPath: file || config.getArtifactsFile(projectRoot),
    },
    `Updated status of ${updatedTasks.length} task(s) to '${statusString}'${
      errors.length > 0 ? ` with ${errors.length} error(s)` : ''
    }`,
    {
      context: {
        taskIds: id,
        status: statusString,
        timestamp: new Date().toISOString(),
      },
    }
  );
}
