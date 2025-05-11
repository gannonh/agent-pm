/**
 * @fileoverview Consolidated task management tool for AgentPM.
 * This tool combines the functionality of apm_get_tasks, apm_get_task, and apm_next_task
 * into a single tool with different actions.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readTasksFile } from '../utils/file-utils.js';
import { calculateTaskSummary } from '../utils/tool-utils.js';
import { getProjectRoot, schemas, validateParams } from '../validation/index.js';
import { handleError, type MCPErrorResponse } from '../errors/handler.js';
import { MCPNotFoundError, MCPValidationError } from '../errors/index.js';
import type { Task } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { create_success_payload } from '../utils/response.js';

// No unused interfaces needed

/**
 * Registers the task tool with the MCP server.
 * This tool provides a unified interface for task management operations.
 *
 * @param server - The MCP server instance to register the tool with
 *
 * The tool handles:
 * - get_all: Get all tasks, optionally filtering by status
 * - get_single: Get detailed information about a specific task
 * - get_next: Find the next task to work on based on dependencies and status
 * - filter_by_status: Get tasks with a specific status
 * - filter_by_priority: Get tasks with a specific priority
 *
 * Parameters:
 * - action: The specific action to perform (required)
 * - projectRoot: Root directory of the project (required)
 * - Action-specific parameters (id, status, priority, etc.)
 */
export function registerTaskTool(server: McpServer): void {
  // Define the schema for the task tool parameters
  const taskSchema = z.object({
    action: z
      .enum(['get_all', 'get_single', 'get_next', 'filter_by_status', 'filter_by_priority'])
      .describe(
        'The specific action to perform: get_all, get_single, get_next, filter_by_status, filter_by_priority'
      ),
    projectRoot: schemas.projectRoot,
    file: schemas.file,
    // Action-specific parameters
    id: schemas.taskId.optional().describe('Task ID (required for get_single action)'),
    status: schemas.status.describe(
      'Filter tasks by status (for get_all and filter_by_status actions)'
    ),
    priority: schemas.taskPriority
      .optional()
      .describe('Filter tasks by priority level (for get_next and filter_by_priority actions)'),
    withSubtasks: schemas.withSubtasks.describe('Include subtasks in the response'),
    containsText: schemas.containsText.describe(
      'Filter tasks containing specific text (for get_next action)'
    ),
  });

  // Create a type for the parameters based on the schema
  type TaskParams = z.infer<typeof taskSchema>;

  // Register the tool with the server
  server.tool(
    'apm_task',
    'Manage and query tasks in the project',
    taskSchema.shape,
    async (
      params: TaskParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters using our validation utilities
        const validatedParams = validateParams(params, taskSchema);
        const { action, projectRoot: rawProjectRoot, file } = validatedParams;

        // Get the project root (from params or environment variable)
        const projectRoot = getProjectRoot(rawProjectRoot);

        // Read tasks from file
        const tasksData = await readTasksFile(projectRoot, file);
        const taskList = tasksData?.tasks || [];

        // Log the action being performed
        logger.debug('Performing task action:', { action, params: validatedParams });

        // Perform the requested action
        switch (action) {
          case 'get_all':
            return handleGetAll(validatedParams, taskList, projectRoot);
          case 'get_single':
            return handleGetSingle(validatedParams, taskList, projectRoot);
          case 'get_next':
            return handleGetNext(validatedParams, taskList, projectRoot);
          case 'filter_by_status':
            return handleFilterByStatus(validatedParams, taskList, projectRoot);
          case 'filter_by_priority':
            return handleFilterByPriority(validatedParams, taskList, projectRoot);
          default:
            throw new MCPValidationError(`Invalid action: ${action}`, {
              action: [
                `Action must be one of: get_all, get_single, get_next, filter_by_status, filter_by_priority`,
              ],
            });
        }
      } catch (error) {
        // Handle errors
        return handleError(error, { toolName: 'apm_task', params });
      }
    }
  );
}

/**
 * Handles the get_all action
 * @param params Tool parameters
 * @param taskList List of tasks
 * @param projectRoot Project root directory
 * @returns MCP response
 */
async function handleGetAll(
  params: z.infer<ReturnType<typeof z.object>>,
  taskList: Task[],
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { status, withSubtasks } = params;

  // Create a copy of the tasks to avoid modifying the original data
  let filteredTasks = [...taskList] as Task[];

  // Define valid statuses for filtering
  const validStatuses = ['pending', 'in-progress', 'done', 'deferred', 'cancelled'];

  // Only filter if status is a non-empty string
  if (
    status &&
    typeof status === 'string' &&
    status.trim() !== '' &&
    validStatuses.includes(status) &&
    filteredTasks.length > 0
  ) {
    logger.debug('Filtering tasks by status:', { status });
    filteredTasks = filteredTasks.filter((task) => task.status === status);
    logger.debug('Filtered tasks count:', { count: filteredTasks.length });
  } else {
    logger.debug('No status filter applied, returning all tasks');
  }

  // Handle subtasks based on the withSubtasks parameter
  if (!withSubtasks) {
    // If withSubtasks is false, remove subtasks from the response
    filteredTasks = filteredTasks.map((task) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { subtasks, ...taskWithoutSubtasks } = task;
      return taskWithoutSubtasks as Task;
    });
  }

  // Calculate summary metrics
  const summary = calculateTaskSummary(filteredTasks);

  // Return the filtered tasks and summary in a structured response
  const taskCount = filteredTasks.length;
  const statusText = status ? `with status '${status}'` : 'across all statuses';
  const message = `Found ${taskCount} tasks ${statusText}`;

  // Use type assertions to fix unsafe assignments
  return create_success_payload(
    {
      tasks: filteredTasks,
      stats: summary,
      filter: status ? String(status) : 'all',
    },
    message,
    {
      context: {
        lastQuery: {
          action: 'get_all',
          status: status ? String(status) : undefined,
          withSubtasks: withSubtasks ? Boolean(withSubtasks) : undefined,
        },
        projectRoot,
        timestamp: new Date().toISOString(),
      },
    }
  );
}

/**
 * Handles the get_single action
 * @param params Tool parameters
 * @param taskList List of tasks
 * @param projectRoot Project root directory
 * @returns MCP response
 */
export async function handleGetSingle(
  params: z.infer<ReturnType<typeof z.object>>,
  taskList: Task[],
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { id } = params;

  // Validate that ID is provided
  if (!id) {
    throw new MCPValidationError('Task ID is required for get_single action', {
      id: ['Task ID is required'],
    });
  }

  // Find the specific task by ID
  let foundTask: Task | undefined;

  // Implementation based on TaskQueryService.getTaskById
  // Check if it's a subtask (format: parentId.subtaskId)
  const idStr = String(id);
  if (idStr.includes('.')) {
    const [parentId, subtaskIndex] = idStr.split('.');

    // Find parent task - convert to string for comparison
    const parentTask = taskList.find((task) => String(task.id) === parentId);
    if (parentTask && parentTask.subtasks && parentTask.subtasks.length > 0) {
      // Find the subtask with the exact ID
      foundTask = parentTask.subtasks.find((subtask) => subtask.id === id);

      // If not found by ID, try to get subtask by index (assuming 1-based indexing in the ID)
      if (!foundTask) {
        const index = parseInt(subtaskIndex) - 1;
        if (index >= 0 && index < parentTask.subtasks.length) {
          const subtask = parentTask.subtasks[index];
          // Convert subtask to Task type by adding required fields if missing
          foundTask = {
            ...subtask,
            // Ensure required Task properties are present
            priority:
              (subtask as unknown as { priority?: string }).priority ||
              parentTask.priority ||
              'medium',
            dependencies: subtask.dependencies || [],
          };
        }
      }
    }
  } else {
    // Find a top-level task
    foundTask = taskList.find((task) => String(task.id) === String(id));
  }

  // If the task is not found, throw an error
  if (!foundTask) {
    throw new MCPNotFoundError(`Task with ID ${id} not found`, { id: String(id) });
  }

  // Return the found task in a structured response
  return create_success_payload(
    {
      task: foundTask,
    },
    `Found task: ${foundTask.title}`,
    {
      context: {
        lastQuery: {
          action: 'get_single',
          id: String(id),
        },
        projectRoot,
        timestamp: new Date().toISOString(),
      },
      agentInstructions: `If the task lacks subtasks, consider using 'apm_task_modify' with action: 'expand' to generate them. If the task or sub-task lacks implementation details, use 'apm_task_modify' with action: 'update' to add details. In the case of both 'expand' and 'update' actions, you can enable additional resarch details from Perplexity AI by setting 'research' to true. For complex tasks, consider using 'apm_complexity_node' to analyze if further breakdown is needed. When you begin work on a task, use 'apm_task_modify' with action: 'update_status' and status: 'in-progress'. Prior to writing code for this task, consider using the Context7 tools to retrieve relevant documentation. First use 'context7_library_id' to search for libraries or technologies mentioned in the task, then use 'context7_library_docs' to retrieve specific documentation that will help complete the task.`,
    }
  );
}

/**
 * Handles the get_next action
 * @param params Tool parameters
 * @param taskList List of tasks
 * @param projectRoot Project root directory
 * @returns MCP response
 */
export async function handleGetNext(
  params: z.infer<ReturnType<typeof z.object>>,
  taskList: Task[],
  _projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { priority, containsText } = params;

  // Find the next task to work on
  // Implementation based on TaskQueryService.findNextTask

  // Filter out completed tasks
  let availableTasks = taskList.filter((task) => task.status !== 'done');

  // Filter tasks by priority if specified
  if (priority) {
    availableTasks = availableTasks.filter((task) => task.priority === priority);
  }

  // Filter tasks by text content if specified
  if (containsText && typeof containsText === 'string') {
    const searchText = containsText.toLowerCase();
    availableTasks = availableTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchText) ||
        (task.description && task.description.toLowerCase().includes(searchText))
    );
  }

  // Filter tasks that have all dependencies satisfied
  const readyTasks = availableTasks.filter((task) => {
    // If the task has no dependencies, it's ready
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    // Check if all dependencies are completed
    return task.dependencies.every((depId) => {
      const dependency = taskList.find((t) => String(t.id) === String(depId));
      return dependency && dependency.status === 'done';
    });
  });

  // If no tasks are ready, return undefined
  let nextTask: Task | undefined = undefined;

  if (readyTasks.length > 0) {
    // Sort tasks by priority (high > medium > low)
    const priorityOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
      // Default priority if not specified
      undefined: 3,
    };

    const sortedTasks = [...readyTasks].sort((a, b) => {
      // First sort by priority
      const aPriority = a.priority || 'medium';
      const bPriority = b.priority || 'medium';
      const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // If priorities are the same, sort by ID (assuming numeric IDs)
      return parseInt(String(a.id), 10) - parseInt(String(b.id), 10);
    });

    // Get the highest priority task
    nextTask = sortedTasks[0];
  }

  // Return the result
  return create_success_payload(
    {
      nextTask,
      allTasks: taskList,
    },
    nextTask ? `Found next task: ${nextTask.title}` : 'No ready tasks found',
    {
      context: {
        lastQuery: {
          action: 'get_next',
          priority: priority ? String(priority) : undefined,
          containsText: containsText ? String(containsText) : undefined,
        },
        taskCount: taskList.length,
        readyTaskCount: readyTasks.length,
      },
      // Add agent instructions to automatically mark the task as in-progress when work begins
      // and to use Context7 tools to retrieve relevant documentation
      agentInstructions: nextTask
        ? `If the task lacks subtasks, consider using 'apm_task_modify' with action: 'expand' to generate them. If the task or sub-task lacks implementation details, use 'apm_task_modify' with action: 'update' to add details. In the case of both 'expand' and 'update' actions, you can enable additional research details from Perplexity AI by setting 'research' to true. When the user indicates they want to work on this task (using phrases like "begin", "start", "work on", etc.), automatically mark the task as "in-progress" by calling apm_task_modify with action: 'update_status', id: '${nextTask.id}', and status: 'in-progress'. Then inform the user that the task has been marked as in-progress.

After marking the task as in-progress, consider using the Context7 tools to retrieve relevant documentation that will help complete the task:
1. Use 'context7_library_id' to search for libraries or technologies mentioned in the task
2. Use 'context7_library_docs' with the retrieved library ID to get specific documentation
3. Share relevant parts of the documentation with the user to help them complete the task`
        : undefined,
    }
  );
}

/**
 * Handles the filter_by_status action
 * @param params Tool parameters
 * @param taskList List of tasks
 * @param projectRoot Project root directory
 * @returns MCP response
 */
async function handleFilterByStatus(
  params: z.infer<ReturnType<typeof z.object>>,
  taskList: Task[],
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { status, withSubtasks } = params;

  // Validate that status is provided
  if (!status || typeof status !== 'string' || status.trim() === '') {
    throw new MCPValidationError('Status is required for filter_by_status action', {
      status: ['Status is required'],
    });
  }

  // Create a copy of the tasks to avoid modifying the original data
  let filteredTasks = [...taskList] as Task[];

  // Filter tasks by status
  filteredTasks = filteredTasks.filter((task) => task.status === status);

  // Handle subtasks based on the withSubtasks parameter
  if (!withSubtasks) {
    // If withSubtasks is false, remove subtasks from the response
    filteredTasks = filteredTasks.map((task) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { subtasks, ...taskWithoutSubtasks } = task;
      return taskWithoutSubtasks as Task;
    });
  }

  // Calculate summary metrics
  const summary = calculateTaskSummary(filteredTasks);

  // Return the filtered tasks and summary in a structured response
  const taskCount = filteredTasks.length;
  const message = `Found ${taskCount} tasks with status '${status}'`;

  return create_success_payload(
    {
      tasks: filteredTasks,
      stats: summary,
      filter: status,
    },
    message,
    {
      context: {
        lastQuery: {
          action: 'filter_by_status',
          status: String(status),
          withSubtasks: withSubtasks ? Boolean(withSubtasks) : undefined,
        },
        projectRoot,
        timestamp: new Date().toISOString(),
      },
    }
  );
}

/**
 * Handles the filter_by_priority action
 * @param params Tool parameters
 * @param taskList List of tasks
 * @param projectRoot Project root directory
 * @returns MCP response
 */
async function handleFilterByPriority(
  params: z.infer<ReturnType<typeof z.object>>,
  taskList: Task[],
  projectRoot: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { priority, withSubtasks } = params;

  // Validate that priority is provided
  if (!priority || typeof priority !== 'string' || priority.trim() === '') {
    throw new MCPValidationError('Priority is required for filter_by_priority action', {
      priority: ['Priority is required'],
    });
  }

  // Create a copy of the tasks to avoid modifying the original data
  let filteredTasks = [...taskList] as Task[];

  // Filter tasks by priority
  filteredTasks = filteredTasks.filter((task) => task.priority === priority);

  // Handle subtasks based on the withSubtasks parameter
  if (!withSubtasks) {
    // If withSubtasks is false, remove subtasks from the response
    filteredTasks = filteredTasks.map((task) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { subtasks, ...taskWithoutSubtasks } = task;
      return taskWithoutSubtasks as Task;
    });
  }

  // Calculate summary metrics
  const summary = calculateTaskSummary(filteredTasks);

  // Return the filtered tasks and summary in a structured response
  const taskCount = filteredTasks.length;
  const message = `Found ${taskCount} tasks with priority '${priority}'`;

  return create_success_payload(
    {
      tasks: filteredTasks,
      stats: summary,
      filter: priority,
    },
    message,
    {
      context: {
        lastQuery: {
          action: 'filter_by_priority',
          priority: String(priority),
          withSubtasks: withSubtasks ? Boolean(withSubtasks) : undefined,
        },
        projectRoot,
        timestamp: new Date().toISOString(),
      },
    }
  );
}
