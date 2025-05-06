import { describe, it, expect } from 'vitest';
import { Task } from '../../../types/task.js';
import { hasSubtasks } from '../../../types/utils.js';

describe('Task Utility Functions', () => {
  describe('hasSubtasks', () => {
    it('should return true for a task with subtasks', () => {
      const task: Task = {
        id: '1',
        title: 'Task with subtasks',
        description: 'This task has subtasks',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
        subtasks: [
          {
            id: '1.1',
            title: 'Subtask 1',
            description: 'This is subtask 1',
            status: 'pending',
            dependencies: [],
          },
        ],
      };

      expect(hasSubtasks(task)).toBe(true);

      // Type narrowing should work
      if (hasSubtasks(task)) {
        expect(task.subtasks.length).toBeGreaterThan(0);
        expect(task.subtasks[0].id).toBe('1.1');
      }
    });

    it('should return false for a task without subtasks', () => {
      const task: Task = {
        id: '1',
        title: 'Task without subtasks',
        description: 'This task has no subtasks',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
      };

      expect(hasSubtasks(task)).toBe(false);
    });

    it('should return false for a task with empty subtasks array', () => {
      const task: Task = {
        id: '1',
        title: 'Task with empty subtasks array',
        description: 'This task has an empty subtasks array',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
        subtasks: [],
      };

      expect(hasSubtasks(task)).toBe(false);
    });
  });

  // Type tests - these verify TypeScript types through runtime examples
  describe('Type Tests', () => {
    it('should allow creating a task with CreateTaskInput', () => {
      // Import the type
      type CreateTaskInput = import('../../../types/utils.js').CreateTaskInput;

      // Create a valid input object that satisfies the type
      const input: CreateTaskInput = {
        title: 'New Task',
        description: 'Task description',
        priority: 'medium',
        dependencies: [],
        details: 'Implementation details',
        testStrategy: 'Test strategy',
      };

      // Create a function that uses the type
      const createTask = (input: CreateTaskInput): Task => {
        return {
          id: '1',
          status: input.status || 'pending',
          ...input,
        };
      };

      // Test the function with the input
      const task = createTask(input);

      // Verify the result
      expect(task.id).toBe('1');
      expect(task.title).toBe('New Task');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
    });

    it('should allow updating a task with UpdateTaskInput', () => {
      // Import the type
      type UpdateTaskInput = import('../../../types/utils.js').UpdateTaskInput;

      // Create a valid input object that satisfies the type
      const input: UpdateTaskInput = {
        title: 'Updated Title',
        status: 'in-progress',
      };

      // Create a function that uses the type
      const updateTask = (id: string, input: UpdateTaskInput): Task => {
        const originalTask: Task = {
          id,
          title: 'Original Title',
          description: 'Original Description',
          status: 'pending',
          priority: 'medium',
          dependencies: [],
        };

        return {
          ...originalTask,
          ...input,
        };
      };

      // Test the function with the input
      const updatedTask = updateTask('1', input);

      // Verify the result
      expect(updatedTask.id).toBe('1');
      expect(updatedTask.title).toBe('Updated Title');
      expect(updatedTask.status).toBe('in-progress');
      expect(updatedTask.description).toBe('Original Description');
    });

    it('should allow filtering tasks with TaskFilterOptions', () => {
      // Import the type
      type TaskFilterOptions = import('../../../types/utils.js').TaskFilterOptions;

      // Create a valid filter options object that satisfies the type
      const filterOptions: TaskFilterOptions = {
        status: 'pending',
        priority: 'high',
      };

      // Create a function that uses the type
      const filterTasks = (options: TaskFilterOptions): Task[] => {
        const tasks: Task[] = [
          {
            id: '1',
            title: 'Task 1',
            description: 'Test task 1',
            status: 'pending',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Task 2',
            description: 'Test task 2',
            status: 'done',
            priority: 'medium',
            dependencies: [],
          },
        ];

        return tasks.filter((task) => {
          if (options.status && task.status !== options.status) return false;
          if (options.priority && task.priority !== options.priority) return false;
          if (
            options.search &&
            !task.title.includes(options.search) &&
            !task.description.includes(options.search)
          )
            return false;
          return true;
        });
      };

      // Test the function with the filter options
      const filteredTasks = filterTasks(filterOptions);

      // Verify the result
      expect(filteredTasks.length).toBe(1);
      expect(filteredTasks[0].id).toBe('1');
    });

    it('should allow querying tasks with TaskQueryOptions', () => {
      // Import the types
      type TaskQueryOptions = import('../../../types/utils.js').TaskQueryOptions;
      type TaskQueryResult = import('../../../types/utils.js').TaskQueryResult;

      // Create a valid query options object that satisfies the type
      const queryOptions: TaskQueryOptions = {
        filter: {
          status: 'pending',
          priority: 'high',
        },
        sort: {
          field: 'priority',
          direction: 'desc',
        },
        pagination: {
          page: 1,
          pageSize: 10,
        },
      };

      // Create a function that uses the type
      const queryTasks = (options: TaskQueryOptions): TaskQueryResult => {
        const tasks: Task[] = [
          {
            id: '1',
            title: 'Task 1',
            description: 'Test task 1',
            status: 'pending',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Task 2',
            description: 'Test task 2',
            status: 'done',
            priority: 'medium',
            dependencies: [],
          },
        ];

        // Apply filters
        let filteredTasks = tasks;
        if (options.filter) {
          if (options.filter.status) {
            filteredTasks = filteredTasks.filter((task) => task.status === options.filter?.status);
          }
          if (options.filter.priority) {
            filteredTasks = filteredTasks.filter(
              (task) => task.priority === options.filter?.priority
            );
          }
        }

        // Apply sorting
        if (options.sort) {
          filteredTasks.sort((a, b) => {
            const field = options.sort?.field || 'id';
            const direction = options.sort?.direction || 'asc';

            if (field === 'dependencyCount') {
              const aDeps = a.dependencies.length;
              const bDeps = b.dependencies.length;
              return direction === 'asc' ? aDeps - bDeps : bDeps - aDeps;
            }

            const aValue = a[field as keyof Task];
            const bValue = b[field as keyof Task];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
              return direction === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
            }

            return 0;
          });
        }

        // Apply pagination
        const page = options.pagination?.page || 1;
        const pageSize = options.pagination?.pageSize || 10;
        const startIndex = (page - 1) * pageSize;
        const paginatedTasks = filteredTasks.slice(startIndex, startIndex + pageSize);

        return {
          tasks: paginatedTasks,
          total: filteredTasks.length,
          page,
          pageSize,
          totalPages: Math.ceil(filteredTasks.length / pageSize),
        };
      };

      // Test the function with the query options
      const result = queryTasks(queryOptions);

      // Verify the result
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('1');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });
  });
});
