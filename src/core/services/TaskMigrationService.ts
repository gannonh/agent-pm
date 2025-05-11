import type { Task, TasksData, TaskStatus } from '../../types/task.d.ts';
import type {
  ITaskMigrationService,
  PartialTasksData,
  PartialTask,
} from '../interfaces/ITaskMigrationService.js';

/**
 * Implementation of the task migration service
 */
export class TaskMigrationService implements ITaskMigrationService {
  private nextTaskId: number = 1;

  /**
   * Check if tasks data needs migration
   * @param tasksData Tasks data to check
   * @returns True if the tasks data needs migration, false otherwise
   */
  needsDataMigration(tasksData: unknown): boolean {
    // Check if the tasks data is an object
    if (!tasksData || typeof tasksData !== 'object') {
      return true;
    }

    const data = tasksData as PartialTasksData;

    // Check if the tasks data has a tasks array
    if (!Array.isArray(data.tasks)) {
      return true;
    }

    // Check if the tasks data has metadata
    if (!data.metadata || typeof data.metadata !== 'object') {
      return true;
    }

    // Check if the metadata has a version
    if (!data.metadata.version || typeof data.metadata.version !== 'string') {
      return true;
    }

    // Check if the metadata has created and updated timestamps
    if (!data.metadata.created || typeof data.metadata.created !== 'string') {
      return true;
    }

    if (!data.metadata.updated || typeof data.metadata.updated !== 'string') {
      return true;
    }

    // Check if the metadata has a project name
    if (!data.metadata.projectName || typeof data.metadata.projectName !== 'string') {
      return true;
    }

    return false;
  }

  /**
   * Migrate tasks data to the current format
   * @param tasksData Tasks data to migrate
   * @returns Migrated tasks data
   */
  migrateTasksData(tasksData: unknown): TasksData {
    // Reset the next task ID
    this.nextTaskId = 1;

    // If the tasks data is not an object, create a new one
    if (!tasksData || typeof tasksData !== 'object') {
      return {
        tasks: [],
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          projectName: 'Task Master Project',
        },
      };
    }

    const data = tasksData as PartialTasksData;

    // Migrate the tasks
    const tasks: Task[] = Array.isArray(data.tasks)
      ? data.tasks.map((task) => this.migrateTask(task))
      : [];

    // Migrate the metadata
    const metadata = {
      version: '1.0.0',
      created: data.metadata?.created || new Date().toISOString(),
      updated: data.metadata?.updated || new Date().toISOString(),
      projectName: data.metadata?.projectName || 'Task Master Project',
    };

    return {
      tasks,
      metadata,
    };
  }

  /**
   * Migrate a task to the current format
   * @param task Task to migrate
   * @returns Migrated task
   */
  migrateTask(task: unknown): Task {
    // If the task is not an object, create a new one
    if (!task || typeof task !== 'object') {
      return {
        id: this.generateTaskId(),
        title: 'Untitled Task',
        description: 'No description provided',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      };
    }

    const partialTask = task as PartialTask;

    // Ensure all required fields are present
    const migratedTask: Task = {
      id: partialTask.id || this.generateTaskId(),
      title: partialTask.title || 'Untitled Task',
      description: partialTask.description || 'No description provided',
      status: (partialTask.status as TaskStatus) || 'pending',
      priority: (partialTask.priority as 'high' | 'medium' | 'low') || 'medium',
      dependencies: Array.isArray(partialTask.dependencies)
        ? partialTask.dependencies.map((dep) => String(dep))
        : [],
    };

    // Add optional fields if present
    if (partialTask.details) {
      migratedTask.details = partialTask.details;
    }

    if (partialTask.testStrategy) {
      migratedTask.testStrategy = partialTask.testStrategy;
    }

    // Migrate subtasks if present
    if (Array.isArray(partialTask.subtasks) && partialTask.subtasks.length > 0) {
      migratedTask.subtasks = partialTask.subtasks.map((subtask) => this.migrateTask(subtask));
    }

    return migratedTask;
  }

  /**
   * Generate a new task ID
   * @returns A new unique task ID
   */
  private generateTaskId(): string {
    return (this.nextTaskId++).toString();
  }
}
