/**
 * Shared type definitions for the AgentPM MCP implementation
 */

/**
 * Standardized tool response format for consistency
 */
export interface ToolResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Create a new tool response object
 */
export function createToolResponse<T>(
  success: boolean,
  message: string,
  data?: T,
  error?: string
): ToolResponse<T> {
  return { success, message, data, error };
}

/**
 * Task interface definition for task management
 */
export interface Task {
  id: string;
  title: string;
  status: string;
  description?: string;
  details?: string;
  priority?: string;
  dependencies?: string[];
  subtasks?: Task[];
  testStrategy?: string;
  type?: 'task' | 'milestone' | 'feature' | 'phase' | 'subtask'; // Task categorization
  phaseId?: string; // Reference to parent phase (if task belongs to a phase)
  childTasks?: string[]; // References to task IDs that belong to this phase/milestone/feature
  [key: string]: unknown; // For any other properties
}

/**
 * Create a new task object
 */
export function createTask(id: string, title: string, status: string): Task {
  return { id, title, status };
}

/**
 * TasksData interface for the tasks.json file structure
 */
export interface TasksData {
  tasks: Task[];
  metadata?: {
    projectName?: string;
    projectVersion?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Create a new tasks data object
 */
export function createTasksData(tasks: Task[]): TasksData {
  return { tasks };
}

/**
 * Task summary statistics interface
 */
export interface TaskSummary {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  taskCompletionPercentage: number;
}

/**
 * Create a new task summary object
 */
export function createTaskSummary(
  totalTasks: number,
  completedTasks: number,
  pendingTasks: number,
  inProgressTasks: number
): TaskSummary {
  const taskCompletionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    inProgressTasks,
    taskCompletionPercentage,
  };
}
