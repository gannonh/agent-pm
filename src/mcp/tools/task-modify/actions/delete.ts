/**
 * Handler for the delete action
 */
import { z } from 'zod';
import { generateTaskFiles, readTasksFile, writeTasksFile } from '../../../utils/file-utils.js';
import { schemas, validateParams } from '../../../validation/index.js';
import { MCPError, MCPNotFoundError, MCPValidationError } from '../../../errors/index.js';
import { create_success_payload, create_error_payload } from '../../../utils/response.js';
import { ErrorCode } from '../../../../types/errors.js';
import Config from '../../../../config.js';
import { findDependentTasks, removeDependencyReferences } from '../utils/task-utils.js';
import { updateProjectBriefAfterTaskModification } from '../../../../core/services/project-brief-regenerator.js';
import { logger } from '../../../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Handles the delete action (from apm_remove_task)
 * @param params Tool parameters
 * @param projectRoot Project root directory
 * @returns MCP response
 */
export async function handleDelete(
  params: Record<string, unknown>,
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Define the schema for delete action parameters
  const deleteSchema = z.object({
    projectRoot: schemas.projectRoot,
    id: z.string().min(1, 'Task ID is required').describe('ID of the task to remove'),
    confirm: z.boolean().optional().default(false).describe('Whether to skip confirmation prompt'),
    file: schemas.file,
  });

  // Validate parameters
  const validatedParams = validateParams(params, deleteSchema);
  const { id, confirm, file } = validatedParams;

  // Check if the ID is a subtask ID (format: parentId.subtaskId)
  if (id.includes('.')) {
    throw new MCPValidationError(
      'Cannot remove a subtask with delete action. Use remove_subtask instead.',
      {
        id: ['To remove a subtask, use the remove_subtask action instead.'],
      }
    );
  }

  // Read tasks from file
  const tasksData = await readTasksFile(projectRoot, file);
  if (!tasksData || !tasksData.tasks || tasksData.tasks.length === 0) {
    throw new MCPNotFoundError('Tasks file not found or is empty');
  }

  // Find the task to remove
  const taskIndex = tasksData.tasks.findIndex((task) => String(task.id) === id);
  if (taskIndex === -1) {
    throw new MCPNotFoundError(`Task with ID ${id} not found`);
  }

  // Get the task to remove
  const taskToRemove = tasksData.tasks[taskIndex];

  // Check if any other tasks depend on this task
  const dependentTasks = findDependentTasks(tasksData.tasks, id);

  // If there are dependent tasks and confirm is false, return an error
  if (dependentTasks.length > 0 && !confirm) {
    return create_error_payload(
      {
        taskToRemove,
        dependentTasks,
        tasksPath: file || Config.getArtifactsFile(projectRoot),
      },
      `Task ${id} is a dependency for ${dependentTasks.length} other task(s). Use confirm=true to remove anyway.`,
      {
        context: {
          taskId: id,
          dependentTaskIds: dependentTasks.map((task) => task.id),
          timestamp: new Date().toISOString(),
        },
      }
    );
  }

  // Remove the task from the tasks array
  tasksData.tasks.splice(taskIndex, 1);

  // Remove references to the task from other tasks' dependencies
  removeDependencyReferences(tasksData.tasks, id);

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

  // Update the project brief markdown file
  try {
    logger.debug('Updating project brief after deleting task');
    const markdownPath = await updateProjectBriefAfterTaskModification(projectRoot);
    if (markdownPath) {
      logger.debug('Project brief markdown updated successfully', { markdownPath });
    } else {
      logger.debug('No project brief markdown file to update');
    }
  } catch (error) {
    // Log the error but don't fail the operation
    logger.error('Error updating project brief markdown', { error });
  }

  // Remove the task file
  try {
    const artifactsDir = Config.getArtifactsDir(projectRoot);
    const taskFilePath = path.join(artifactsDir, `task_${id.padStart(3, '0')}.md`);

    // Check if the file exists
    await fs.access(taskFilePath).catch(() => {
      // File doesn't exist, log and continue
      logger.debug(`Task file ${taskFilePath} does not exist, skipping deletion`);
      return null;
    });

    // Delete the file
    await fs
      .unlink(taskFilePath)
      .then(() => {
        logger.debug(`Deleted task file ${taskFilePath}`);
      })
      .catch((error: unknown) => {
        logger.error(`Error deleting task file ${taskFilePath}`, { error });
      });
  } catch (error) {
    // Log the error but don't fail the operation
    logger.error('Error removing task file', { error });
  }

  // Return success response
  return create_success_payload(
    {
      removedTask: taskToRemove,
      dependentTasks: dependentTasks.length > 0 ? dependentTasks : undefined,
      tasksPath: file || Config.getArtifactsFile(projectRoot),
    },
    `Removed task ${id}${
      dependentTasks.length > 0 ? ` and updated ${dependentTasks.length} dependent task(s)` : ''
    }`,
    {
      context: {
        taskId: id,
        dependentTaskIds: dependentTasks.map((task) => task.id),
        timestamp: new Date().toISOString(),
      },
    }
  );
}
