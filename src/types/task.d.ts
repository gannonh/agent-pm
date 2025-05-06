/**
 * Task status options
 */
export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'deferred' | 'cancelled';

/**
 * Task priority levels
 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * Subtask interface
 */
export interface Subtask {
  id: string; // Format: "parentId.subtaskNumber" (e.g., "1.2")
  title: string;
  description: string;
  details?: string;
  status: TaskStatus;
  dependencies?: string[]; // IDs of other subtasks this depends on
}

/**
 * Task interface
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  details?: string;
  testStrategy?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[]; // IDs of other tasks this depends on
  subtasks?: Subtask[];
}

/**
 * Tasks collection interface
 */
export interface TasksData {
  tasks: Task[];
  metadata: {
    version: string;
    created: string;
    updated: string;
    projectName?: string;
    projectDescription?: string;
  };
}

/**
 * Task complexity analysis result
 */
export interface TaskComplexityAnalysis {
  taskId: string;
  title: string;
  complexity: number; // 1-10 scale
  recommendedSubtasks: number;
  expansionPrompt: string;
  expansionCommand: string;
}

/**
 * Complexity analysis report
 */
export interface ComplexityReport {
  tasks: TaskComplexityAnalysis[];
  metadata: {
    generated: string;
    threshold: number;
    totalTasks: number;
    averageComplexity: number | null;
  };
}
