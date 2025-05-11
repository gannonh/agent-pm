/**
 * @fileoverview Consolidated tool for managing task dependencies
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readTasksFile, writeTasksFile, generateTaskFiles } from '../../utils/file-utils.js';
import { logger } from '../../utils/logger.js';
import { schemas } from '../../utils/schemas.js';
import { createMcpResponse } from '../../utils/response.js';
import type { MCPErrorResponse } from '../../errors/handler.js';
import { findTaskById, validateDependencies } from './utils.js';
import { updateProjectBriefAfterTaskModification } from '../../../core/services/project-brief-regenerator.js';
import type { TasksData } from '../../types/index.js';
import { ARTIFACTS_DIR, ARTIFACTS_FILE } from '../../../config.js';

/**
 * Register the dependencies tool with the MCP server
 * @param server The MCP server instance
 */
export function registerDependenciesTool(server: McpServer): void {
  // Define the schema for the dependencies tool
  const dependenciesSchema = z.object({
    action: z.enum(['add', 'remove', 'validate', 'fix']),
    projectRoot: schemas.projectRoot,
    id: z.string().optional(),
    dependsOn: z.string().optional(),
    file: z.string().optional().default(''),
  });

  // Define the type for the dependencies tool parameters
  type DependenciesParams = z.infer<typeof dependenciesSchema>;

  // Register the tool with the MCP server
  server.tool(
    'apm_dependencies',
    'Manage task dependencies',
    dependenciesSchema.shape,
    async (params: DependenciesParams) => {
      try {
        // Extract parameters
        const { action, projectRoot, id, dependsOn, file } = params;

        // Log the action
        logger.debug('Performing dependencies action:', {
          action,
          params,
        });

        // Read the tasks file
        const tasksData = await readTasksFile(projectRoot, file);

        // Check if tasks data is null
        if (!tasksData) {
          throw new Error('Failed to read tasks data');
        }

        // Execute the appropriate action
        switch (action) {
          case 'add':
            return await handleAddDependency(projectRoot, tasksData, id, dependsOn, file);
          case 'remove':
            return await handleRemoveDependency(projectRoot, tasksData, id, dependsOn, file);
          case 'validate':
            return await handleValidateDependencies(projectRoot, tasksData, file);
          case 'fix':
            return await handleFixDependencies(projectRoot, tasksData, file);
          default:
            throw new Error(`Invalid action: ${action}`);
        }
      } catch (error) {
        logger.error('Error in dependencies tool:', error);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'An unknown error occurred',
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Handle the add dependency action
 * @param projectRoot The project root directory
 * @param tasksData The tasks data
 * @param id The ID of the task that will depend on another
 * @param dependsOn The ID of the task that will be depended on
 * @param file The tasks file path
 * @returns The MCP response
 */
async function handleAddDependency(
  projectRoot: string,
  tasksData: TasksData,
  id?: string,
  dependsOn?: string,
  file?: string
): Promise<MCPErrorResponse> {
  // Validate required parameters
  if (!id) {
    throw new Error('Missing required parameter: id');
  }
  if (!dependsOn) {
    throw new Error('Missing required parameter: dependsOn');
  }

  // Find the task that will depend on another
  const task = findTaskById(tasksData.tasks, id);
  if (!task) {
    throw new Error(`Task with ID ${id} not found`);
  }

  // Find the task that will be depended on
  const dependencyTask = findTaskById(tasksData.tasks, dependsOn);
  if (!dependencyTask) {
    throw new Error(`Task with ID ${dependsOn} not found`);
  }

  // Check if the dependency already exists
  if (task.dependencies && task.dependencies.includes(dependsOn)) {
    return createMcpResponse({
      data: {
        task,
        dependencyTask,
        tasksPath: `${projectRoot}/${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`,
      },
      message: `Task ${id} already depends on task ${dependsOn}`,
    });
  }

  // Add the dependency
  if (!task.dependencies) {
    task.dependencies = [];
  }
  task.dependencies.push(dependsOn);

  // Validate dependencies to ensure no circular references
  try {
    validateDependencies(tasksData.tasks);
  } catch (error) {
    // If validation fails, remove the dependency and throw an error
    task.dependencies = task.dependencies.filter((dep: string) => dep !== dependsOn);
    throw error;
  }

  // Update the tasks file
  if (!tasksData.metadata) {
    tasksData.metadata = {};
  }
  tasksData.metadata.updated = new Date().toISOString();
  await writeTasksFile(tasksData, projectRoot, file);

  // Generate task files
  await generateTaskFiles(tasksData, projectRoot);

  // Update the project brief markdown file
  try {
    logger.debug('Updating project brief after adding dependency');
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

  // Return the response
  return createMcpResponse({
    data: {
      task,
      dependencyTask,
      tasksPath: `${projectRoot}/${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`,
    },
    message: `Added dependency: Task ${id} now depends on task ${dependsOn}`,
    sessionId: `session-${Math.random().toString(36).substring(2, 15)}`,
    context: {
      taskId: id,
      dependsOn,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Handle the remove dependency action
 * @param projectRoot The project root directory
 * @param tasksData The tasks data
 * @param id The ID of the task that depends on another
 * @param dependsOn The ID of the task that is depended on
 * @param file The tasks file path
 * @returns The MCP response
 */
async function handleRemoveDependency(
  projectRoot: string,
  tasksData: TasksData,
  id?: string,
  dependsOn?: string,
  file?: string
): Promise<MCPErrorResponse> {
  // Validate required parameters
  if (!id) {
    throw new Error('Missing required parameter: id');
  }
  if (!dependsOn) {
    throw new Error('Missing required parameter: dependsOn');
  }

  // Find the task that depends on another
  const task = findTaskById(tasksData.tasks, id);
  if (!task) {
    throw new Error(`Task with ID ${id} not found`);
  }

  // Check if the dependency exists
  if (!task.dependencies || !task.dependencies.includes(dependsOn)) {
    return createMcpResponse({
      data: {
        task,
        tasksPath: `${projectRoot}/${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`,
      },
      message: `Task ${id} does not depend on task ${dependsOn}`,
    });
  }

  // Remove the dependency
  task.dependencies = task.dependencies.filter((dep: string) => dep !== dependsOn);

  // Update the tasks file
  if (!tasksData.metadata) {
    tasksData.metadata = {};
  }
  tasksData.metadata.updated = new Date().toISOString();
  await writeTasksFile(tasksData, projectRoot, file);

  // Generate task files
  await generateTaskFiles(tasksData, projectRoot);

  // Update the project brief markdown file
  try {
    logger.debug('Updating project brief after removing dependency');
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

  // Return the response
  return createMcpResponse({
    data: {
      task,
      tasksPath: `${projectRoot}/${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`,
    },
    message: `Removed dependency: Task ${id} no longer depends on task ${dependsOn}`,
    sessionId: `session-${Math.random().toString(36).substring(2, 15)}`,
    context: {
      taskId: id,
      dependsOn,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Handle the validate dependencies action
 * @param projectRoot The project root directory
 * @param tasksData The tasks data
 * @param file The tasks file path
 * @returns The MCP response
 */
async function handleValidateDependencies(
  projectRoot: string,
  tasksData: TasksData,
  _file?: string
): Promise<MCPErrorResponse> {
  // Initialize validation results
  const validationResults = {
    circularDependencies: [] as { taskId: string; path: string[] }[],
    missingDependencies: [] as { taskId: string; missingDependencies: string[] }[],
    valid: true,
  };

  // Check for circular dependencies
  try {
    validateDependencies(tasksData.tasks);
  } catch (error) {
    validationResults.valid = false;
    if (error instanceof Error) {
      // Parse the error message to extract the circular dependency path
      const match = error.message.match(/Circular dependency detected: (.*)/);
      if (match && match[1]) {
        const path = match[1].split(' -> ');
        validationResults.circularDependencies.push({
          taskId: path[0],
          path,
        });
      }
    }
  }

  // Check for missing dependencies
  for (const task of tasksData.tasks) {
    if (task.dependencies && task.dependencies.length > 0) {
      const missingDeps = task.dependencies.filter(
        (depId: string) => !findTaskById(tasksData.tasks, depId)
      );
      if (missingDeps.length > 0) {
        validationResults.valid = false;
        validationResults.missingDependencies.push({
          taskId: task.id,
          missingDependencies: missingDeps,
        });
      }
    }
  }

  // Return the response
  return createMcpResponse({
    data: {
      validationResults,
      tasksPath: `${projectRoot}/${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`,
    },
    message: validationResults.valid ? 'All dependencies are valid' : 'Dependency issues detected',
    sessionId: `session-${Math.random().toString(36).substring(2, 15)}`,
    context: {
      timestamp: new Date().toISOString(),
      validationResults,
    },
  });
}

/**
 * Handle the fix dependencies action
 * @param projectRoot The project root directory
 * @param tasksData The tasks data
 * @param file The tasks file path
 * @returns The MCP response
 */
async function handleFixDependencies(
  projectRoot: string,
  tasksData: TasksData,
  file?: string
): Promise<MCPErrorResponse> {
  // Initialize fix results
  const fixResults = {
    circularDependenciesFixed: [] as { taskId: string; removedDependencies: string[] }[],
    missingDependenciesFixed: [] as { taskId: string; removedDependencies: string[] }[],
    fixesApplied: false,
  };

  // Fix missing dependencies
  for (const task of tasksData.tasks) {
    if (task.dependencies && task.dependencies.length > 0) {
      const missingDeps = task.dependencies.filter(
        (depId: string) => !findTaskById(tasksData.tasks, depId)
      );
      if (missingDeps.length > 0) {
        fixResults.fixesApplied = true;
        fixResults.missingDependenciesFixed.push({
          taskId: task.id,
          removedDependencies: missingDeps,
        });
        task.dependencies = task.dependencies.filter(
          (depId: string) => !missingDeps.includes(depId)
        );
      }
    }
  }

  // Fix circular dependencies
  let circularDependencyFixed = false;
  do {
    circularDependencyFixed = false;
    try {
      validateDependencies(tasksData.tasks);
      // If no error is thrown, there are no circular dependencies
      break;
    } catch (error) {
      if (error instanceof Error) {
        // Parse the error message to extract the circular dependency path
        const match = error.message.match(/Circular dependency detected: (.*)/);
        if (match && match[1]) {
          const path = match[1].split(' -> ');

          // Handle the case where the path only contains one element (self-reference)
          if (path.length === 1) {
            const taskId = path[0];
            const task = findTaskById(tasksData.tasks, taskId);
            if (task && task.dependencies) {
              // Find dependencies that create a cycle (in this case, any that reference self or parent)
              const cyclicDeps = task.dependencies.filter((depId: string) => {
                // If this is a subtask, check if it depends on itself or another subtask that depends on it
                if (taskId.includes('.')) {
                  const [parentId, subtaskId] = taskId.split('.');
                  // Check if it depends on itself
                  if (String(depId) === subtaskId || String(depId) === taskId) {
                    return true;
                  }
                  // Check if it depends on another subtask that depends on it
                  const otherSubtask = findTaskById(tasksData.tasks, `${parentId}.${depId}`);
                  if (
                    otherSubtask &&
                    otherSubtask.dependencies &&
                    otherSubtask.dependencies.includes(subtaskId)
                  ) {
                    return true;
                  }
                }
                return false;
              });

              if (cyclicDeps.length > 0) {
                fixResults.fixesApplied = true;
                circularDependencyFixed = true;
                task.dependencies = task.dependencies.filter(
                  (depId: string) => !cyclicDeps.includes(depId)
                );
                fixResults.circularDependenciesFixed.push({
                  taskId,
                  removedDependencies: cyclicDeps,
                });
              }
            }
          } else {
            // Handle the normal case with a path of at least two elements
            const lastTaskId = path[path.length - 2];
            const dependencyToRemove = path[path.length - 1];
            const task = findTaskById(tasksData.tasks, lastTaskId);
            if (task && task.dependencies) {
              fixResults.fixesApplied = true;
              circularDependencyFixed = true;
              task.dependencies = task.dependencies.filter(
                (depId: string) => depId !== dependencyToRemove
              );
              fixResults.circularDependenciesFixed.push({
                taskId: lastTaskId,
                removedDependencies: [dependencyToRemove],
              });
            }
          }
        }
      }
    }
  } while (circularDependencyFixed);

  // If fixes were applied, update the tasks file
  if (fixResults.fixesApplied) {
    if (!tasksData.metadata) {
      tasksData.metadata = {};
    }
    tasksData.metadata.updated = new Date().toISOString();
    await writeTasksFile(tasksData, projectRoot, file);
    await generateTaskFiles(tasksData, projectRoot);

    // Update the project brief markdown file
    try {
      logger.debug('Updating project brief after fixing dependencies');
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

  // Return the response
  return createMcpResponse({
    data: {
      fixResults,
      tasksPath: `${projectRoot}/${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`,
    },
    message: fixResults.fixesApplied ? 'Dependency issues fixed' : 'No dependency issues to fix',
    sessionId: `session-${Math.random().toString(36).substring(2, 15)}`,
    context: {
      timestamp: new Date().toISOString(),
      fixResults,
    },
  });
}
