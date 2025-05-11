import type { Task, Subtask, TaskStatus } from './task.js';

/**
 * Type guard to check if a task has subtasks
 */
export function hasSubtasks(task: Task): task is Task & { subtasks: Subtask[] } {
  return Array.isArray(task.subtasks) && task.subtasks.length > 0;
}

/**
 * Type for task creation input
 */
export type CreateTaskInput = Omit<Task, 'id' | 'status'> & {
  status?: TaskStatus;
};

/**
 * Type for subtask creation input
 */
export type CreateSubtaskInput = Omit<Subtask, 'id' | 'status'> & {
  status?: TaskStatus;
  parentTaskId: string;
};

/**
 * Type for task update input
 */
export type UpdateTaskInput = Partial<Omit<Task, 'id'>>;

/**
 * Type for subtask update input
 */
export type UpdateSubtaskInput = Partial<Omit<Subtask, 'id'>>;

/**
 * Type for task filter options
 */
export interface TaskFilterOptions {
  status?: TaskStatus;
  priority?: string;
  search?: string;
  title?: string;
  description?: string;
  dependsOn?: string;
  hasDependencies?: boolean;
  hasSubtasks?: boolean;
  ids?: string[];
}

/**
 * Type for task sort options
 */
export interface TaskSortOptions {
  field: keyof Task | 'dependencyCount';
  direction: 'asc' | 'desc';
}

/**
 * Type for pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * Type for task query options
 */
export interface TaskQueryOptions {
  filter?: TaskFilterOptions;
  sort?: TaskSortOptions;
  pagination?: PaginationOptions;
}

/**
 * Type for task query result
 */
export interface TaskQueryResult {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Type for dependency graph
 */
export type DependencyGraph = Map<string, Set<string>>;

/**
 * Type for task with computed properties
 */
export interface TaskWithComputedProps extends Task {
  isBlocked: boolean;
  blockingTasks: string[];
  dependencyCount: number;
  subtaskCount: number;
  completedSubtaskCount: number;
  progress: number;
}

/**
 * Type for task event
 */
export type TaskEventType =
  | 'task-created'
  | 'task-updated'
  | 'task-deleted'
  | 'subtask-created'
  | 'subtask-updated'
  | 'subtask-deleted'
  | 'status-changed'
  | 'dependency-added'
  | 'dependency-removed';

/**
 * Type for task event
 */
export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  subtaskId?: string;
  data?: unknown;
  timestamp: string;
}
