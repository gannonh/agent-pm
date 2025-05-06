/**
 * @fileoverview Consolidated task modification tool for AgentPM.
 * This tool combines the functionality of multiple task modification tools
 * into a single tool with different actions.
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getProjectRoot, schemas, validateParams } from '../../validation/index.js';
import { handleError, MCPErrorResponse } from '../../errors/handler.js';
import { MCPValidationError } from '../../errors/index.js';
import { logger } from '../../utils/logger.js';

// Import action handlers
import { handleCreate } from './actions/create.js';
import { handleUpdate } from './actions/update.js';
import { handleUpdateStatus } from './actions/update-status.js';
import { handleDelete } from './actions/delete.js';
import { handleAddSubtask } from './actions/add-subtask.js';
import { handleRemoveSubtask } from './actions/remove-subtask.js';
import { handleClearSubtasks } from './actions/clear-subtasks.js';
import { handleExpand } from './actions/expand.js';
import { handleExpandAll } from './actions/expand-all.js';

// Export utility functions for use by action handlers
export {
  getNextTaskId,
  createNewTask,
  validateDependencies,
  findDependentTasks,
  removeDependencyReferences,
} from './utils/task-utils.js';

/**
 * Registers the task_modify tool with the MCP server.
 * This tool provides a unified interface for task modification operations.
 *
 * @param server - The MCP server instance to register the tool with
 *
 * The tool handles:
 * - create: Add a new task
 * - update: Update a task's details
 * - update_status: Change a task's status
 * - delete: Remove a task
 * - add_subtask: Add a subtask to a task
 * - remove_subtask: Remove a subtask from a task
 * - clear_subtasks: Remove all subtasks from a task
 * - expand: Break down a task into subtasks
 * - expand_all: Expand all pending tasks
 *
 * Parameters:
 * - action: The specific action to perform (required)
 * - projectRoot: Root directory of the project (required)
 * - Action-specific parameters
 */
export function registerTaskModifyTool(server: McpServer): void {
  // Define the schema for the task_modify tool parameters
  const taskModifySchema = z.object({
    action: z
      .enum([
        'create',
        'update',
        'update_status',
        'delete',
        'add_subtask',
        'remove_subtask',
        'clear_subtasks',
        'expand',
        'expand_all',
      ])
      .describe(
        'The specific action to perform: create, update, update_status, delete, add_subtask, remove_subtask, clear_subtasks, expand, expand_all'
      ),
    projectRoot: schemas.projectRoot,
    file: schemas.file,
    // Common parameters used by multiple actions
    id: schemas.taskId
      .optional()
      .describe('Task ID (required for most actions except create and expand_all)'),

    // Action-specific parameters for update_status
    status: z
      .enum(['pending', 'in-progress', 'done', 'deferred', 'cancelled'])
      .optional()
      .describe('Task status (for update_status action)'),

    // Action-specific parameters for create
    title: z.string().optional().describe('Task title (for create action)'),
    description: z.string().optional().describe('Task description (for create action)'),
    priority: z
      .enum(['high', 'medium', 'low'])
      .optional()
      .describe('Task priority (for create action)'),
    dependencies: z
      .string()
      .optional()
      .describe('Comma-separated list of task IDs this task depends on (for create action)'),
    details: z.string().optional().describe('Implementation details (for create action)'),
    testStrategy: z.string().optional().describe('Test strategy (for create action)'),

    // Action-specific parameters for update
    prompt: z
      .string()
      .min(1)
      .optional()
      .describe('New information or context to incorporate into the task (for update action)'),
    research: z
      .boolean()
      .optional()
      .default(false)
      .describe('Use Perplexity AI for research-backed updates (for update action)'),
    researchOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Only perform research and return results without updating the task (for update action)'
      ),

    // Action-specific parameters for expand/expand_all
    num: z
      .number()
      .optional()
      .describe('Number of subtasks to generate (for expand/expand_all actions)'),
    force: z
      .boolean()
      .optional()
      .describe(
        'Force the operation even if it would overwrite existing data (for expand/expand_all actions)'
      ),
    threshold: z
      .number()
      .optional()
      .describe('Minimum complexity score to expand tasks (for expand_all action)'),

    // Action-specific parameters for add_subtask
    taskId: z
      .string()
      .optional()
      .describe('Existing task ID to convert to subtask (for add_subtask action)'),
    skipGenerate: z
      .boolean()
      .optional()
      .describe('Skip regenerating task files (for add_subtask/remove_subtask actions)'),

    // Action-specific parameters for clear_subtasks
    all: z
      .boolean()
      .optional()
      .describe('Clear subtasks from all tasks (for clear_subtasks action)'),

    // Action-specific parameters for delete
    confirm: z
      .boolean()
      .optional()
      .describe('Whether to skip confirmation prompt (for delete action)'),
  });

  // Create a type for the parameters based on the schema
  type TaskModifyParams = z.infer<typeof taskModifySchema>;

  // Register the tool with the server
  server.tool(
    'apm_task_modify',
    'Create, update, and delete tasks and subtasks',
    taskModifySchema.shape,
    async (
      params: TaskModifyParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters using our validation utilities
        const validatedParams = validateParams(params, taskModifySchema);
        const { action, projectRoot: rawProjectRoot, file: _file } = validatedParams;

        // Get the project root (from params or environment variable)
        const projectRoot = getProjectRoot(rawProjectRoot);

        // Log the action being performed
        logger.debug('Performing task_modify action:', { action, params: validatedParams });

        // Perform the requested action
        switch (action) {
          case 'create':
            return handleCreate(validatedParams, projectRoot);
          case 'update':
            return handleUpdate(validatedParams, projectRoot);
          case 'update_status':
            return handleUpdateStatus(validatedParams, projectRoot);
          case 'delete':
            return handleDelete(validatedParams, projectRoot);
          case 'add_subtask':
            return handleAddSubtask(validatedParams, projectRoot);
          case 'remove_subtask':
            return handleRemoveSubtask(validatedParams, projectRoot);
          case 'clear_subtasks':
            return handleClearSubtasks(validatedParams, projectRoot);
          case 'expand':
            return handleExpand(validatedParams, projectRoot);
          case 'expand_all':
            return handleExpandAll(validatedParams, projectRoot);
          default:
            throw new MCPValidationError(`Invalid action: ${action}`, {
              action: [
                `Action must be one of: create, update, update_status, delete, add_subtask, remove_subtask, clear_subtasks, expand, expand_all`,
              ],
            });
        }
      } catch (error) {
        // Handle errors
        return handleError(error, { toolName: 'apm_task_modify', params });
      }
    }
  );
}
