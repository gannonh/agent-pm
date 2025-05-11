import { EventEmitter } from 'events';
import type { Task, TasksData, TaskStatus } from '../types/task.d.ts';
import type { TaskFilterOptions, TaskQueryOptions, TaskQueryResult } from '../types/utils.js';
import type { AppConfig } from '../types/config.js';
import { FileSystemError, ErrorCode } from '../types/errors.js';

import type { ITaskRepository } from './interfaces/ITaskRepository.js';
import type { ITaskValidator } from './interfaces/ITaskValidator.js';
import type { ITaskDependencyManager } from './interfaces/ITaskDependencyManager.js';
import type { ITaskFileManager } from './interfaces/ITaskFileManager.js';
import type { ITaskQueryService } from './interfaces/ITaskQueryService.js';
import type { ITaskMigrationService } from './interfaces/ITaskMigrationService.js';
import type { ITransactionManager } from './interfaces/ITransactionManager.js';

import { TaskRepository } from './repositories/TaskRepository.js';
import { TaskValidator } from './validators/TaskValidator.js';
import { TaskDependencyManager } from './managers/TaskDependencyManager.js';
import { TaskFileManager } from './managers/TaskFileManager.js';
import { TaskQueryService } from './services/TaskQueryService.js';
import { TaskMigrationService } from './services/TaskMigrationService.js';
import { TransactionManager } from './managers/TransactionManager.js';

/**
 * Events emitted by the TaskManager
 */
export enum TaskManagerEvent {
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_DELETED = 'task:deleted',
  TASK_STATUS_CHANGED = 'task:status-changed',
  DEPENDENCY_ADDED = 'dependency:added',
  DEPENDENCY_REMOVED = 'dependency:removed',
  TASKS_SAVED = 'tasks:saved',
  TASKS_LOADED = 'tasks:loaded',
  TRANSACTION_STARTED = 'transaction:started',
  TRANSACTION_COMMITTED = 'transaction:committed',
  TRANSACTION_ROLLBACK = 'transaction:rollback',
  ERROR = 'error',
}

/**
 * TaskManager class for managing tasks with CRUD operations
 */
export class TaskManager extends EventEmitter {
  private repository: ITaskRepository;
  private validator: ITaskValidator;
  private dependencyManager: ITaskDependencyManager;
  private fileManager: ITaskFileManager;
  private queryService: ITaskQueryService;
  private migrationService: ITaskMigrationService;
  private transactionManager: ITransactionManager;

  private config?: Partial<AppConfig>;
  private projectRoot?: string;
  private autoSave: boolean;
  private tasksFilePath?: string;
  private saveTimeout?: NodeJS.Timeout;

  /**
   * Create a new TaskManager
   * @param config Application configuration
   * @param projectRoot Project root directory
   * @param autoSave Whether to automatically save changes to the file
   * @param repository Task repository
   * @param validator Task validator
   * @param dependencyManager Task dependency manager
   * @param fileManager Task file manager
   * @param queryService Task query service
   * @param migrationService Task migration service
   * @param transactionManager Transaction manager
   */
  constructor(
    config?: Partial<AppConfig>,
    projectRoot?: string,
    autoSave: boolean = true,
    repository?: ITaskRepository,
    validator?: ITaskValidator,
    dependencyManager?: ITaskDependencyManager,
    fileManager?: ITaskFileManager,
    queryService?: ITaskQueryService,
    migrationService?: ITaskMigrationService,
    transactionManager?: ITransactionManager
  ) {
    super();
    this.config = config;
    this.projectRoot = projectRoot;
    this.autoSave = autoSave;

    // Initialize components
    this.repository = repository || new TaskRepository();
    this.validator = validator || new TaskValidator();
    this.fileManager = fileManager || new TaskFileManager(config, projectRoot);
    this.dependencyManager = dependencyManager || new TaskDependencyManager(this.repository);
    this.queryService = queryService || new TaskQueryService(this.repository);
    this.migrationService = migrationService || new TaskMigrationService();
    this.transactionManager = transactionManager || new TransactionManager();
  }

  /**
   * Initialize the TaskManager
   * This loads tasks from the default file if it exists
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    try {
      // Get the tasks file path
      this.tasksFilePath = await this.fileManager.findTasksFilePath();

      // Check if the tasks file exists
      if (await this.fileManager.tasksFileExists(this.tasksFilePath)) {
        // Load tasks from the file
        await this.loadFromFile(this.tasksFilePath);
      }
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Create a new task
   * @param taskData Task data
   * @returns The created task
   * @throws Error if the task ID already exists or if the task data is invalid
   */
  async createTask(taskData: Omit<Task, 'id'> & { id?: string }): Promise<Task> {
    try {
      // Generate a new ID if not provided
      const id = taskData.id || this.generateTaskId();

      // Check if the task ID already exists
      if (this.repository.hasTask(id)) {
        throw new FileSystemError(`Task with ID ${id} already exists`, ErrorCode.ALREADY_EXISTS);
      }

      // Set default values for required fields
      const status = taskData.status || 'pending';

      // Create the task object
      const task: Task = {
        id,
        title: taskData.title,
        description: taskData.description,
        status,
        priority: taskData.priority || 'medium',
        dependencies: taskData.dependencies || [],
        ...(taskData.details && { details: taskData.details }),
        ...(taskData.testStrategy && { testStrategy: taskData.testStrategy }),
        ...(taskData.subtasks && { subtasks: taskData.subtasks }),
      };

      // Validate the task
      const validatedTask = this.validator.validateTask(task);

      // Add the task to the repository
      this.repository.addTask(validatedTask);

      // Auto-save if enabled
      if (this.autoSave && this.tasksFilePath) {
        await this.saveToFile(this.tasksFilePath);
      }

      // Track change in transaction if one is in progress
      if (this.transactionManager.isTransactionInProgress()) {
        this.transactionManager.recordChange('create', validatedTask);
      }

      // Emit event
      this.emit(TaskManagerEvent.TASK_CREATED, validatedTask);

      return validatedTask;
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Get a task by ID
   * @param id Task ID
   * @returns The task, or undefined if not found
   */
  getTask(id: string): Task | undefined {
    return this.repository.getTask(id);
  }

  /**
   * Get all tasks
   * @returns Array of all tasks
   */
  getAllTasks(): Task[] {
    return this.repository.getAllTasks();
  }

  /**
   * Update a task
   * @param id Task ID
   * @param updatedData Updated task data
   * @returns The updated task
   * @throws Error if the task does not exist or if the updated data is invalid
   */
  async updateTask(id: string, updatedData: Partial<Task>): Promise<Task> {
    try {
      // Check if the task exists
      const existingTask = this.repository.getTask(id);
      if (!existingTask) {
        throw new FileSystemError(`Task with ID ${id} not found`, ErrorCode.NOT_FOUND);
      }

      // Check if the status is being changed
      const statusChanged =
        updatedData.status !== undefined && updatedData.status !== existingTask.status;

      // If status is being changed, validate the transition
      if (statusChanged) {
        this.validator.validateStatusTransition(existingTask.status, updatedData.status!);
      }

      // Create the updated task
      const updatedTask = {
        ...existingTask,
        ...updatedData,
      };

      // Validate the updated task
      const validatedTask = this.validator.validateTask(updatedTask);

      // Update the task in the repository
      this.repository.updateTask(id, validatedTask);

      // Auto-save if enabled
      if (this.autoSave && this.tasksFilePath) {
        await this.saveToFile(this.tasksFilePath);
      }

      // Track change in transaction if one is in progress
      if (this.transactionManager.isTransactionInProgress()) {
        this.transactionManager.recordChange('update', validatedTask, {
          previousTask: existingTask,
        });
      }

      // Emit events
      this.emit(TaskManagerEvent.TASK_UPDATED, validatedTask);

      if (statusChanged) {
        this.emit(
          TaskManagerEvent.TASK_STATUS_CHANGED,
          validatedTask,
          existingTask.status,
          validatedTask.status
        );
      }

      return validatedTask;
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Update a task's status
   * @param id Task ID
   * @param newStatus New status
   * @returns The updated task
   * @throws Error if the task does not exist, if the status is invalid, or if the transition is not allowed
   */
  async updateTaskStatus(id: string, newStatus: TaskStatus): Promise<Task> {
    try {
      // Check if the task exists
      const existingTask = this.repository.getTask(id);
      if (!existingTask) {
        throw new FileSystemError(`Task with ID ${id} not found`, ErrorCode.NOT_FOUND);
      }

      // If the status is not changing, return the existing task
      if (existingTask.status === newStatus) {
        return existingTask;
      }

      // Validate the status transition
      this.validator.validateStatusTransition(existingTask.status, newStatus);

      // Update the task
      return this.updateTask(id, { status: newStatus });
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Delete a task
   * @param id Task ID
   * @param force Whether to force deletion even if other tasks depend on this one
   * @returns True if the task was deleted, false if it didn't exist
   */
  async deleteTask(id: string, force = false): Promise<boolean> {
    try {
      // Check if the task exists
      const existingTask = this.repository.getTask(id);
      if (!existingTask) {
        throw new FileSystemError(`Task with ID ${id} not found`, ErrorCode.NOT_FOUND);
      }

      // Check if any other tasks depend on this one
      if (!force) {
        const dependentTasks = this.dependencyManager.findDependentTasks(id);
        if (dependentTasks.length > 0) {
          throw new FileSystemError(
            `Cannot delete task ${id} because it is a dependency for other tasks`,
            ErrorCode.OPERATION_NOT_PERMITTED
          );
        }
      }

      // Remove the task from all dependencies
      this.dependencyManager.removeFromAllDependencies(id);

      // Delete the task from the repository
      const result = this.repository.deleteTask(id);

      // Auto-save if enabled
      if (result && this.autoSave && this.tasksFilePath) {
        await this.saveToFile(this.tasksFilePath);
      }

      // Track change in transaction if one is in progress
      if (this.transactionManager.isTransactionInProgress()) {
        this.transactionManager.recordChange('delete', existingTask);
      }

      // Emit event
      this.emit(TaskManagerEvent.TASK_DELETED, existingTask);

      return result;
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Add a dependency to a task
   * @param taskId Task ID
   * @param dependencyId Dependency ID
   * @returns The updated task
   * @throws Error if the task or dependency does not exist, or if adding the dependency would create a circular dependency
   */
  async addDependency(taskId: string, dependencyId: string): Promise<Task> {
    try {
      const updatedTask = await this.dependencyManager.addDependency(taskId, dependencyId);

      // Auto-save if enabled
      if (this.autoSave && this.tasksFilePath) {
        await this.saveToFile(this.tasksFilePath);
      }

      // Track change in transaction if one is in progress
      if (this.transactionManager.isTransactionInProgress()) {
        this.transactionManager.recordChange('add-dependency', updatedTask, { dependencyId });
      }

      // Emit event
      this.emit(TaskManagerEvent.DEPENDENCY_ADDED, taskId, dependencyId);

      return updatedTask;
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Remove a dependency from a task
   * @param taskId Task ID
   * @param dependencyId Dependency ID
   * @returns The updated task
   * @throws Error if the task does not exist
   */
  async removeDependency(taskId: string, dependencyId: string): Promise<Task> {
    try {
      const updatedTask = await this.dependencyManager.removeDependency(taskId, dependencyId);

      // Auto-save if enabled
      if (this.autoSave && this.tasksFilePath) {
        await this.saveToFile(this.tasksFilePath);
      }

      // Track change in transaction if one is in progress
      if (this.transactionManager.isTransactionInProgress()) {
        this.transactionManager.recordChange('remove-dependency', updatedTask, { dependencyId });
      }

      // Emit event
      this.emit(TaskManagerEvent.DEPENDENCY_REMOVED, taskId, dependencyId);

      return updatedTask;
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Filter tasks based on criteria
   * @param filter Filter criteria
   * @returns Array of tasks that match the filter
   */
  filterTasks(filter: TaskFilterOptions): Task[] {
    return this.queryService.filterTasks(filter);
  }

  /**
   * Query tasks with advanced options
   * @param options Query options
   * @returns Query result with tasks and pagination info
   */
  queryTasks(options: TaskQueryOptions): TaskQueryResult {
    return this.queryService.queryTasks(options);
  }

  /**
   * Get tasks by status
   * @param status Status to filter by (optional)
   * @returns Array of tasks with the specified status, or all tasks if no status is provided
   */
  getTasksByStatus(status?: TaskStatus): Task[] {
    return this.queryService.getTasksByStatus(status);
  }

  /**
   * Get pending tasks
   * @returns Array of tasks with 'pending' status
   */
  getPendingTasks(): Task[] {
    return this.queryService.getPendingTasks();
  }

  /**
   * Get completed tasks
   * @returns Array of tasks with 'done' status
   */
  getCompletedTasks(): Task[] {
    return this.queryService.getCompletedTasks();
  }

  /**
   * Get in-progress tasks
   * @returns Array of tasks with 'in-progress' status
   */
  getInProgressTasks(): Task[] {
    return this.queryService.getInProgressTasks();
  }

  /**
   * Get high priority tasks
   * @returns Array of tasks with 'high' priority
   */
  getHighPriorityTasks(): Task[] {
    return this.queryService.getHighPriorityTasks();
  }

  /**
   * Get tasks with no dependencies
   * @returns Array of tasks that don't depend on any other tasks
   */
  getIndependentTasks(): Task[] {
    return this.queryService.getIndependentTasks();
  }

  /**
   * Get tasks that are ready to work on (pending with all dependencies completed)
   * @returns Array of tasks that are ready to work on
   */
  getReadyTasks(): Task[] {
    return this.queryService.getReadyTasks();
  }

  /**
   * Find the next task to work on based on dependencies, status, and priority
   * @param options Optional filtering options
   * @returns The next task to work on, or undefined if no suitable task is found
   */
  findNextTask(options?: { priority?: string; containsText?: string }): Task | undefined {
    return this.queryService.findNextTask(options);
  }

  /**
   * Get a task by ID, supporting both regular tasks and subtasks
   * @param id Task ID (can be in format 'parentId.subtaskId' for subtasks)
   * @returns The task or subtask if found, undefined otherwise
   */
  getTaskById(id: string): Task | undefined {
    const tasks = this.repository.getAllTasks();
    return this.queryService.getTaskById(id, tasks);
  }

  /**
   * Get filtered tasks with optional status filtering and subtask handling
   * @param options Filter options
   * @returns Filtered tasks
   */
  getFilteredTasks(options?: { status?: string; withSubtasks?: boolean }): Task[] {
    const tasks = this.repository.getAllTasks();
    return this.queryService.getFilteredTasks(tasks, options);
  }

  /**
   * Save tasks to a file
   * @param filePath Path to the file
   * @param keepBackups Number of backup files to keep (default: 5)
   * @returns Promise that resolves when the save is complete
   */
  async saveToFile(filePath: string, keepBackups = 5): Promise<void> {
    try {
      // Create the tasks data object
      const tasksData: TasksData = {
        tasks: this.repository.getAllTasks(),
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          projectName: this.config?.project?.name || 'Task Master Project',
        },
      };

      // Save the tasks data to the file
      await this.fileManager.saveToFile(filePath, tasksData, keepBackups);

      // Emit event
      this.emit(TaskManagerEvent.TASKS_SAVED, filePath);
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Load tasks from a file
   * @param filePath Path to the file
   * @returns Promise that resolves when the load is complete
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      // Load the tasks data from the file
      const tasksData = await this.fileManager.loadFromFile(filePath);

      // Check if data needs migration
      const needsMigration = this.migrationService.needsDataMigration(tasksData);

      // Migrate data if needed
      const migratedData = needsMigration
        ? this.migrationService.migrateTasksData(tasksData)
        : tasksData;

      // Clear existing tasks
      this.repository.clear();

      // Add the tasks to the repository
      for (const task of migratedData.tasks) {
        this.repository.addTask(task);
      }

      // Emit event
      this.emit(TaskManagerEvent.TASKS_LOADED, filePath, migratedData.tasks);
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Begin a transaction
   * @returns Promise that resolves when the transaction is started
   * @throws Error if a transaction is already in progress
   */
  async beginTransaction(): Promise<void> {
    try {
      this.transactionManager.beginTransaction();
      this.emit(TaskManagerEvent.TRANSACTION_STARTED);
      return Promise.resolve();
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Commit a transaction
   * @returns Promise that resolves when the transaction is committed
   * @throws Error if no transaction is in progress
   */
  async commitTransaction(): Promise<void> {
    try {
      const changes = this.transactionManager.commitTransaction();

      // Emit a transaction event with all changes
      if (changes.length > 0) {
        this.emit(TaskManagerEvent.TRANSACTION_COMMITTED, changes);
      }

      // Save changes to disk if auto-save is enabled
      if (this.autoSave && this.tasksFilePath) {
        await this.saveToFile(this.tasksFilePath);
      }
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Roll back a transaction
   * @returns Promise that resolves when the transaction is rolled back
   * @throws Error if no transaction is in progress
   */
  async rollbackTransaction(): Promise<void> {
    try {
      this.transactionManager.rollbackTransaction();

      // If we have a tasks file path, reload the tasks from disk
      if (this.tasksFilePath && (await this.fileManager.tasksFileExists(this.tasksFilePath))) {
        await this.loadFromFile(this.tasksFilePath);
      } else {
        // Otherwise, just clear the tasks
        this.repository.clear();
      }

      // Emit a rollback event
      this.emit(TaskManagerEvent.TRANSACTION_ROLLBACK);
      return Promise.resolve();
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Update multiple tasks in a single operation
   * @param updates Array of task update objects
   * @returns Array of updated tasks
   */
  async batchUpdateTasks(updates: Array<{ id: string } & Partial<Task>>): Promise<Task[]> {
    try {
      // Begin a transaction
      await this.beginTransaction();

      try {
        // Update all tasks
        const updatedTasks: Task[] = [];
        for (const update of updates) {
          const updatedTask = await this.updateTask(update.id, update);
          updatedTasks.push(updatedTask);
        }

        // Commit the transaction
        await this.commitTransaction();

        return updatedTasks;
      } catch (error) {
        // Roll back the transaction if an error occurs
        await this.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Delete multiple tasks in a single operation
   * @param ids Array of task IDs to delete
   * @param force Whether to force deletion even if other tasks depend on these
   * @returns True if all tasks were deleted successfully
   */
  async batchDeleteTasks(ids: string[], force = false): Promise<boolean> {
    try {
      // Begin a transaction
      await this.beginTransaction();

      try {
        // Delete all tasks
        for (const id of ids) {
          await this.deleteTask(id, force);
        }

        // Commit the transaction
        await this.commitTransaction();

        return true;
      } catch (error) {
        // Roll back the transaction if an error occurs
        await this.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      this.emit(TaskManagerEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * Generate a new task ID
   * @returns A new unique task ID
   */
  private generateTaskId(): string {
    // Get the highest existing ID
    const existingIds = this.repository.getAllTasks().map((task) => parseInt(task.id, 10));
    const highestId = existingIds.length > 0 ? Math.max(...existingIds) : 0;

    // Return the next ID
    return (highestId + 1).toString();
  }
}
