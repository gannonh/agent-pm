/**
 * Handler for the remove_subtask action
 */
import { z } from 'zod';
import { generateTaskFiles, readTasksFile, writeTasksFile } from '../../../utils/file-utils.js';
import { schemas, validateParams } from '../../../validation/index.js';
import { MCPError, MCPNotFoundError, MCPValidationError } from '../../../errors/index.js';
import { create_success_payload } from '../../../utils/response.js';
import { ErrorCode } from '../../../../types/errors.js';
import Config from '../../../../config.js';
import { getNextTaskId } from '../utils/task-utils.js';
import { updateProjectBriefAfterTaskModification } from '../../../../core/services/project-brief-regenerator.js';
import { logger } from '../../../utils/logger.js';

/**
 * Handles the remove_subtask action (from apm_remove_subtask)
 * @param params Tool parameters
 * @param projectRoot Project root directory
 * @returns MCP response
 */
export async function handleRemoveSubtask(
  params: Record<string, unknown>,
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Define the schema for remove_subtask action parameters
  const removeSubtaskSchema = z.object({
    projectRoot: schemas.projectRoot,
    id: z
      .string()
      .min(1, 'Task ID is required')
      .describe(
        'ID of the subtask to remove (e.g., "5.2") or parent task ID when using taskId parameter'
      ),
    taskId: z
      .string()
      .optional()
      .describe('Subtask ID within the parent task (when not using dot notation)'),
    convert: z
      .boolean()
      .optional()
      .default(false)
      .describe('Convert the subtask to a standalone task'),
    skipGenerate: z.boolean().optional().default(false).describe('Skip regenerating task files'),
    file: schemas.file,
  });

  // Validate parameters
  const validatedParams = validateParams(params, removeSubtaskSchema);
  const { id, taskId, convert, skipGenerate, file } = validatedParams;

  // Read tasks from file
  const tasksData = await readTasksFile(projectRoot, file);
  if (!tasksData || !tasksData.tasks || tasksData.tasks.length === 0) {
    throw new MCPNotFoundError('Tasks file not found or is empty');
  }

  let parentId: string;
  let subtaskIndex: string;
  let subtaskIndexNumber: number;

  // Handle both formats: either id="parentId.subtaskId" or id="parentId" with taskId="subtaskId"
  if (id.includes('.')) {
    // Format: parentId.subtaskId
    [parentId, subtaskIndex] = id.split('.');
    subtaskIndexNumber = parseInt(subtaskIndex, 10) - 1; // Convert to 0-based index
  } else if (taskId) {
    // Format: id=parentId, taskId=subtaskId
    parentId = id;
    subtaskIndex = taskId;
    subtaskIndexNumber = parseInt(subtaskIndex, 10) - 1; // Convert to 0-based index
  } else {
    // Neither format provided
    throw new MCPValidationError('Invalid subtask ID format. Expected format: parentId.subtaskId', {
      id: [
        'Subtask ID must be in the format parentId.subtaskId (e.g., "5.2") or provide both id and taskId parameters',
      ],
    });
  }

  // Find the parent task
  const parentTask = tasksData.tasks.find((task) => String(task.id) === parentId);
  if (!parentTask) {
    throw new MCPNotFoundError(`Parent task with ID ${parentId} not found`);
  }

  // Check if the parent task has subtasks
  if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
    throw new MCPNotFoundError(`Parent task with ID ${parentId} has no subtasks`);
  }

  // Check if the subtask index is valid
  if (subtaskIndexNumber < 0 || subtaskIndexNumber >= parentTask.subtasks.length) {
    throw new MCPNotFoundError(
      `Subtask with index ${subtaskIndex} not found in parent task ${parentId}`
    );
  }

  // Get the subtask to remove
  const subtask = parentTask.subtasks[subtaskIndexNumber];

  // If convert is true, create a new standalone task from the subtask
  if (convert) {
    // Create a new task from the subtask
    const newTask = {
      id: getNextTaskId(tasksData.tasks),
      title: subtask.title,
      description: subtask.description,
      status: subtask.status || 'pending',
      priority: 'medium', // Default priority
      dependencies: subtask.dependencies || [],
      details: subtask.details || '',
      testStrategy: '',
      subtasks: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    // Add the new task to the tasks array
    tasksData.tasks.push(newTask);
  }

  // Remove the subtask from the parent task
  parentTask.subtasks.splice(subtaskIndexNumber, 1);

  // Update the IDs of the remaining subtasks to maintain sequential numbering
  parentTask.subtasks.forEach((s, i) => {
    s.id = String(i + 1);
  });

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
    // Generate task files
    const filesGenerated = await generateTaskFiles(tasksData, projectRoot);
    if (!filesGenerated) {
      logger.error('Failed to generate task files');
    } else {
      logger.debug('Task files generated successfully');
    }

    // Update the project brief markdown file
    try {
      logger.debug('Updating project brief after removing subtask');
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
  }

  // Create the full subtask ID for the response message
  const fullSubtaskId = id.includes('.') ? id : `${parentId}.${subtaskIndex}`;

  // Return success response
  return create_success_payload(
    {
      parentTask,
      removedSubtask: subtask,
      tasksPath: file || Config.getArtifactsFile(projectRoot),
    },
    convert
      ? `Converted subtask ${fullSubtaskId} to standalone task`
      : `Removed subtask ${fullSubtaskId} from task ${parentId}`,
    {
      context: {
        parentTaskId: parentId,
        subtaskId: fullSubtaskId,
        timestamp: new Date().toISOString(),
        converted: convert,
      },
    }
  );
}
