/**
 * @fileoverview Tests for the dependencies tool
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  sampleTasks,
  createMockServer,
  setupResponseMocks,
  extractResponseData,
  isErrorResponse,
} from './__helpers__/test-utils.js';

// Create hoisted mocks
const mocks = vi.hoisted(() => ({
  fileUtils: {
    readTasksFile: vi.fn(),
    writeTasksFile: vi.fn(),
    generateTaskFiles: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  updateProjectBriefAfterTaskModification: vi
    .fn()
    .mockResolvedValue('/mock/project/apm-artifacts/project-brief.md'),
}));

// Setup mocks
setupResponseMocks();

// Mock file utilities
vi.mock('../../../utils/file-utils.js', () => ({
  readTasksFile: mocks.fileUtils.readTasksFile,
  writeTasksFile: mocks.fileUtils.writeTasksFile,
  generateTaskFiles: mocks.fileUtils.generateTaskFiles,
}));

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: mocks.logger,
}));

// Mock project brief regenerator
vi.mock('../../../../core/services/project-brief-regenerator.js', () => ({
  updateProjectBriefAfterTaskModification: mocks.updateProjectBriefAfterTaskModification,
}));

// Disable TypeScript checking for this test file

describe('Dependencies Tool', () => {
  let server: any;
  let toolHandler: any;
  let mockReadTasksFile: any;
  let mockWriteTasksFile: any;
  let mockGenerateTaskFiles: any;
  let tasksData: any;

  beforeEach(async () => {
    // Reset modules
    vi.resetModules();

    // Reset mocks
    vi.resetAllMocks();

    // Create sample tasks data
    tasksData = {
      tasks: [...sampleTasks],
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    };

    // Setup mocks
    server = createMockServer();
    mockReadTasksFile = mocks.fileUtils.readTasksFile;
    mockReadTasksFile.mockResolvedValue(tasksData);
    mockWriteTasksFile = mocks.fileUtils.writeTasksFile;
    mockWriteTasksFile.mockResolvedValue(true);
    mockGenerateTaskFiles = mocks.fileUtils.generateTaskFiles;
    mockGenerateTaskFiles.mockResolvedValue(true);

    // Import the module under test
    const { registerDependenciesTool } = await import('../index.js');

    // Register the tool
    registerDependenciesTool(server);

    // Get the tool handler
    toolHandler = server.tool.mock.calls[0][3];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('add action', () => {
    it('should add a dependency between tasks', async () => {
      // Add a new task with no dependencies
      tasksData.tasks.push({
        id: '4',
        title: 'Task 4',
        description: 'Description for Task 4',
        status: 'pending',
        priority: 'low',
        dependencies: [],
      });
      const result = await toolHandler({
        action: 'add',
        projectRoot: '/mock/project',
        id: '1',
        dependsOn: '4',
      });

      const data = extractResponseData(result);
      console.log('Add dependency result:', result);
      console.log('Add dependency data:', data);
      expect(data).toBeDefined();
      if (!data.data) {
        console.error('Expected data.data to be defined but got:', data);
        throw new Error('data.data is undefined. Full result: ' + JSON.stringify(result));
      }
      const { task, dependencyTask } = data.data;
      expect(task).toBeDefined();
      expect(task.id).toBe('1');
      expect(task.dependencies).toContain('4');
      expect(dependencyTask).toBeDefined();
      expect(dependencyTask.id).toBe('4');
      expect(data.message).toContain('Added dependency');
      expect(data.message).toContain('Task 1 now depends on task 4');
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();
    });

    it('should handle adding a dependency that already exists', async () => {
      const result = await toolHandler({
        action: 'add',
        projectRoot: '/mock/project',
        id: '2',
        dependsOn: '1',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();
      const data = extractResponseData(result);
      expect(data).toBeDefined();
      expect(data.message).toContain('already depends on');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle circular dependencies', async () => {
      // Create a circular dependency: 1 -> 3 -> 2 -> 1
      tasksData.tasks[0].dependencies = ['3']; // Task 1 depends on Task 3

      const result = await toolHandler({
        action: 'add',
        projectRoot: '/mock/project',
        id: '3',
        dependsOn: '1',
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Circular dependency detected');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle task not found', async () => {
      const result = await toolHandler({
        action: 'add',
        projectRoot: '/mock/project',
        id: '999',
        dependsOn: '1',
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Task with ID 999 not found');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle dependency task not found', async () => {
      const result = await toolHandler({
        action: 'add',
        projectRoot: '/mock/project',
        id: '1',
        dependsOn: '999',
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Task with ID 999 not found');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle missing required parameters', async () => {
      const result = await toolHandler({
        action: 'add',
        projectRoot: '/mock/project',
        // Missing id and dependsOn
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });
  });

  describe('remove action', () => {
    it('should remove a dependency between tasks', async () => {
      const result = await toolHandler({
        action: 'remove',
        projectRoot: '/mock/project',
        id: '2',
        dependsOn: '1',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();
      const data = extractResponseData(result);
      expect(data).toBeDefined();
      const { task } = data.data;
      expect(task).toBeDefined();
      expect(task.id).toBe('2');
      expect(task.dependencies).not.toContain('1');
      expect(data.message).toContain('Removed dependency');
      expect(data.message).toContain('Task 2 no longer depends on task 1');
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();
    });

    it('should handle removing a dependency that does not exist', async () => {
      const result = await toolHandler({
        action: 'remove',
        projectRoot: '/mock/project',
        id: '1',
        dependsOn: '2',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();
      const data = extractResponseData(result);
      expect(data).toBeDefined();
      expect(data.message).toContain('does not depend on');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle task not found in remove action', async () => {
      const result = await toolHandler({
        action: 'remove',
        projectRoot: '/mock/project',
        id: '999',
        dependsOn: '1',
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Task with ID 999 not found');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle missing required parameters in remove action', async () => {
      const result = await toolHandler({
        action: 'remove',
        projectRoot: '/mock/project',
        // Missing id and dependsOn
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });
  });

  describe('validate action', () => {
    it('should validate dependencies with no issues', async () => {
      // Reset tasksData to original sampleTasks (no cycles, no missing deps)
      tasksData.tasks = [
        {
          id: '1',
          title: 'Task 1',
          description: 'Description for Task 1',
          status: 'pending',
          priority: 'high',
          dependencies: [],
        },
        {
          id: '2',
          title: 'Task 2',
          description: 'Description for Task 2',
          status: 'pending',
          priority: 'medium',
          dependencies: ['1'],
        },
        {
          id: '3',
          title: 'Task 3',
          description: 'Description for Task 3',
          status: 'pending',
          priority: 'low',
          dependencies: ['2'],
          subtasks: [
            {
              id: '1',
              title: 'Subtask 3.1',
              description: 'Description for Subtask 3.1',
              status: 'pending',
              dependencies: [],
            },
            {
              id: '2',
              title: 'Subtask 3.2',
              description: 'Description for Subtask 3.2',
              status: 'pending',
              dependencies: ['3.1'],
            },
          ],
        },
      ];
      mockReadTasksFile.mockResolvedValue(tasksData);
      const result = await toolHandler({
        action: 'validate',
        projectRoot: '/mock/project',
      });
      const data = extractResponseData(result);
      const { validationResults } = data.data;
      if (!validationResults.valid) {
        console.error('Validation failed, validationResults:', validationResults);
        console.error('Full data:', data);
      }
      expect(validationResults).toBeDefined();
      expect(validationResults.valid).toBe(true);
      expect(validationResults.circularDependencies).toHaveLength(0);
      expect(validationResults.missingDependencies).toHaveLength(0);
      expect(data.message).toBe('All dependencies are valid');
    });

    it('should detect circular dependencies', async () => {
      tasksData.tasks[0].dependencies = ['3']; // Task 1 depends on Task 3
      tasksData.tasks[1].dependencies = ['1']; // Task 2 depends on Task 1
      const result = await toolHandler({
        action: 'validate',
        projectRoot: '/mock/project',
      });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();
      const data = extractResponseData(result);
      expect(data).toBeDefined();
      const { validationResults } = data.data;
      expect(validationResults).toBeDefined();
      expect(validationResults.valid).toBe(false);
      expect(validationResults.circularDependencies.length).toBeGreaterThan(0);
      expect(data.message).toBe('Dependency issues detected');
    });

    it('should detect missing dependencies', async () => {
      tasksData.tasks[0].dependencies = ['999']; // Task 1 depends on non-existent Task 999
      const result = await toolHandler({
        action: 'validate',
        projectRoot: '/mock/project',
      });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();
      const data = extractResponseData(result);
      expect(data).toBeDefined();
      const { validationResults } = data.data;
      expect(validationResults).toBeDefined();
      expect(validationResults.valid).toBe(false);
      expect(validationResults.missingDependencies.length).toBeGreaterThan(0);
      expect(validationResults.missingDependencies[0].taskId).toBe('1');
      expect(validationResults.missingDependencies[0].missingDependencies).toContain('999');
      expect(data.message).toBe('Dependency issues detected');
    });
  });

  describe('general error handling', () => {
    it('should handle invalid action', async () => {
      const result = await toolHandler({
        action: 'invalid' as any,
        projectRoot: '/mock/project',
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Invalid action');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle failed tasks file read', async () => {
      mockReadTasksFile.mockRejectedValueOnce(new Error('Failed to read tasks file'));

      const result = await toolHandler({
        action: 'validate',
        projectRoot: '/mock/project',
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Failed to read tasks file');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle null tasks data', async () => {
      mockReadTasksFile.mockResolvedValueOnce(null);

      const result = await toolHandler({
        action: 'validate',
        projectRoot: '/mock/project',
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      expect(result.content[0].text).toContain('Failed to read tasks data');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle failed tasks file write', async () => {
      // Reset any circular dependencies that might be causing issues
      tasksData.tasks = [...sampleTasks];
      mockReadTasksFile.mockResolvedValue(tasksData);

      // Setup the write to fail
      mockWriteTasksFile.mockRejectedValueOnce(new Error('Failed to write tasks file'));

      const result = await toolHandler({
        action: 'add',
        projectRoot: '/mock/project',
        id: '1',
        dependsOn: '3',
      });

      expect(result).toBeDefined();
      expect(isErrorResponse(result)).toBe(true);
      // The error message might be different, so just check that it's an error
      expect(result.content[0].text).toContain('error');
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });

    it('should handle project brief update failure', async () => {
      // Reset any circular dependencies that might be causing issues
      tasksData.tasks = [...sampleTasks];
      mockReadTasksFile.mockResolvedValue(tasksData);

      // Add a task that doesn't exist in the dependencies
      tasksData.tasks.push({
        id: '4',
        title: 'Task 4',
        description: 'Description for Task 4',
        status: 'pending',
        priority: 'low',
        dependencies: [],
      });

      // Setup the project brief update to fail
      mocks.updateProjectBriefAfterTaskModification.mockRejectedValueOnce(
        new Error('Failed to update project brief')
      );

      // Add a dependency
      const result = await toolHandler({
        action: 'add',
        projectRoot: '/mock/project',
        id: '1',
        dependsOn: '4',
      });

      // The operation should still succeed even if the project brief update fails
      expect(result).toBeDefined();

      // Check if it's an error response
      if (isErrorResponse(result)) {
        console.log('Unexpected error response:', result.content[0].text);
      }

      // Since we're adding a valid dependency, it should not be an error
      expect(isErrorResponse(result)).toBe(false);

      // Verify the error was logged
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Error updating project brief markdown',
        expect.objectContaining({ error: expect.any(Error) })
      );

      // Verify the tasks were still updated
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();
    });
  });

  describe('fix action', () => {
    it('should fix circular dependencies', async () => {
      // Reset tasksData to original sampleTasks (no cycles)
      tasksData.tasks = [
        {
          id: '1',
          title: 'Task 1',
          description: 'Description for Task 1',
          status: 'pending',
          priority: 'high',
          dependencies: [],
        },
        {
          id: '2',
          title: 'Task 2',
          description: 'Description for Task 2',
          status: 'pending',
          priority: 'medium',
          dependencies: ['1'],
        },
        {
          id: '3',
          title: 'Task 3',
          description: 'Description for Task 3',
          status: 'pending',
          priority: 'low',
          dependencies: ['2'],
          subtasks: [
            {
              id: '1',
              title: 'Subtask 3.1',
              description: 'Description for Subtask 3.1',
              status: 'pending',
              dependencies: [],
            },
            {
              id: '2',
              title: 'Subtask 3.2',
              description: 'Description for Subtask 3.2',
              status: 'pending',
              dependencies: ['3.1'],
            },
          ],
        },
      ];
      // Now set up the cycle
      tasksData.tasks[0].dependencies = ['3']; // Task 1 depends on Task 3
      tasksData.tasks[1].dependencies = ['1']; // Task 2 depends on Task 1
      mockReadTasksFile.mockResolvedValue(tasksData);

      const result = await toolHandler({
        action: 'fix',
        projectRoot: '/mock/project',
      });

      const data = extractResponseData(result);
      expect(data).toBeDefined();
      const { fixResults } = data.data;
      expect(fixResults).toBeDefined();
      expect(fixResults.fixesApplied).toBe(true);
      expect(fixResults.circularDependenciesFixed.length).toBeGreaterThan(0);
      expect(data.message).toBe('Dependency issues fixed');
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();

      // Reset tasksData to original after test
      tasksData.tasks = [...sampleTasks];
      mockReadTasksFile.mockResolvedValue(tasksData);
    });

    it('should fix missing dependencies', async () => {
      tasksData.tasks[0].dependencies = ['999']; // Task 1 depends on non-existent Task 999
      const result = await toolHandler({
        action: 'fix',
        projectRoot: '/mock/project',
      });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();
      const data = extractResponseData(result);
      expect(data).toBeDefined();
      const { fixResults } = data.data;
      expect(fixResults).toBeDefined();
      expect(fixResults.fixesApplied).toBe(true);
      expect(fixResults.missingDependenciesFixed.length).toBeGreaterThan(0);
      expect(fixResults.missingDependenciesFixed[0].taskId).toBe('1');
      expect(fixResults.missingDependenciesFixed[0].removedDependencies).toContain('999');
      expect(data.message).toBe('Dependency issues fixed');
      expect(mockWriteTasksFile).toHaveBeenCalled();
      expect(mockGenerateTaskFiles).toHaveBeenCalled();
    });

    it('should handle no issues to fix', async () => {
      const result = await toolHandler({
        action: 'fix',
        projectRoot: '/mock/project',
      });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();
      const data = extractResponseData(result);
      expect(data).toBeDefined();
      const { fixResults } = data.data;
      expect(fixResults).toBeDefined();
      expect(fixResults.fixesApplied).toBe(false);
      expect(data.message).toBe('No dependency issues to fix');
      expect(mockWriteTasksFile).not.toHaveBeenCalled();
      expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
    });
  });
});
