/**
 * Handler for the clear_subtasks action
 */
import { z } from 'zod';
import { generateTaskFiles, readTasksFile, writeTasksFile } from '../../../utils/file-utils.js';
import { schemas, validateParams } from '../../../validation/index.js';
import { MCPError, MCPNotFoundError, MCPValidationError } from '../../../errors/index.js';
import { create_success_payload } from '../../../utils/response.js';
import { ErrorCode } from '../../../../types/errors.js';
import Config from '../../../../config.js';
import { updateProjectBriefAfterTaskModification } from '../../../../core/services/project-brief-regenerator.js';
import { logger } from '../../../utils/logger.js';

/**
 * Handles the clear_subtasks action (from apm_clear_subtasks)
 * @param params Tool parameters
 * @param projectRoot Project root directory
 * @returns MCP response
 */
export async function handleClearSubtasks(
  params: Record<string, unknown>,
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Define the schema for clear_subtasks action parameters
  const clearSubtasksSchema = z.object({
    projectRoot: schemas.projectRoot,
    id: z.string().optional().describe('Task IDs (comma-separated) to clear subtasks from'),
    all: z.boolean().optional().default(false).describe('Clear subtasks from all tasks'),
    file: schemas.file,
  });

  // Validate parameters
  const validatedParams = validateParams(params, clearSubtasksSchema);
  const { id, all, file } = validatedParams;

  // Read tasks from file
  const tasksData = await readTasksFile(projectRoot, file);
  if (!tasksData || !tasksData.tasks || tasksData.tasks.length === 0) {
    throw new MCPNotFoundError('Tasks file not found or is empty');
  }

  // Check if either id or all is provided
  if (!id && !all) {
    throw new MCPValidationError('Either id or all parameter must be provided', {
      id: ['Provide task IDs or set all=true'],
      all: ['Set to true or provide task IDs'],
    });
  }

  // Initialize arrays to track results
  const updatedTasks = [];
  const errors = [];

  if (all) {
    // Clear subtasks from all tasks
    for (const task of tasksData.tasks) {
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks = [];
        updatedTasks.push(task);
      }
    }
  } else if (id) {
    // Clear subtasks from specific tasks
    const taskIds = id.split(',').map((taskId) => taskId.trim());

    for (const taskId of taskIds) {
      try {
        // Find the task
        const task = tasksData.tasks.find((t) => String(t.id) === taskId);
        if (!task) {
          errors.push({ id: taskId, error: `Task with ID ${taskId} not found` });
          continue;
        }

        // Check if the task has subtasks
        if (!task.subtasks || task.subtasks.length === 0) {
          errors.push({ id: taskId, error: `Task with ID ${taskId} has no subtasks` });
          continue;
        }

        // Clear the subtasks
        task.subtasks = [];
        updatedTasks.push(task);
      } catch (error) {
        errors.push({
          id: taskId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
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

  // Generate task files
  await generateTaskFiles(tasksData, projectRoot);

  // Update the project brief markdown file
  try {
    logger.debug('Updating project brief after clearing subtasks');
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

  // Return success response
  return create_success_payload(
    {
      updatedTasks,
      errors: errors.length > 0 ? errors : undefined,
      tasksPath: file || Config.getArtifactsFile(projectRoot),
    },
    all
      ? `Cleared subtasks from all tasks (${updatedTasks.length} updated)`
      : `Cleared subtasks from ${updatedTasks.length} task(s)${
          errors.length > 0 ? ` with ${errors.length} error(s)` : ''
        }`,
    {
      context: {
        taskIds: all ? 'all' : id,
        updatedTaskIds: updatedTasks.map((task) => task.id),
        timestamp: new Date().toISOString(),
      },
    }
  );
}
