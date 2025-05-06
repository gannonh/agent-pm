import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mock dependencies before importing the module under test
vi.mock('fs/promises', () => {
  return {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    default: {
      access: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

// Mock Config module
vi.mock('../../../config.js', () => ({
  default: {
    getProjectRoot: vi.fn().mockReturnValue('/project/root'),
    getArtifactsDir: vi.fn().mockReturnValue('/project/root/apm-artifacts'),
    getArtifactsFile: vi.fn().mockReturnValue('/project/root/apm-artifacts/artifacts.json'),
    getTaskMasterDir: vi.fn().mockReturnValue('/project/root/tasks'),
    getTaskMasterFile: vi.fn().mockReturnValue('/project/root/tasks/tasks.json'),
    getArtifactFilePath: vi
      .fn()
      .mockImplementation(
        (id) => `/project/root/apm-artifacts/task_${String(id).padStart(3, '0')}.md`
      ),
    getTaskMasterFilePath: vi
      .fn()
      .mockImplementation((id) => `/project/root/tasks/task_${String(id).padStart(3, '0')}.txt`),
  },
  Config: {
    getProjectRoot: vi.fn().mockReturnValue('/project/root'),
    getArtifactsDir: vi.fn().mockReturnValue('/project/root/apm-artifacts'),
    getArtifactsFile: vi.fn().mockReturnValue('/project/root/apm-artifacts/artifacts.json'),
    getTaskMasterDir: vi.fn().mockReturnValue('/project/root/tasks'),
    getTaskMasterFile: vi.fn().mockReturnValue('/project/root/tasks/tasks.json'),
    getArtifactFilePath: vi
      .fn()
      .mockImplementation(
        (id) => `/project/root/apm-artifacts/task_${String(id).padStart(3, '0')}.md`
      ),
    getTaskMasterFilePath: vi
      .fn()
      .mockImplementation((id) => `/project/root/tasks/task_${String(id).padStart(3, '0')}.txt`),
  },
  // Add the PROJECT_ROOT constant
  PROJECT_ROOT: '/env/project/root',
  // Add DEBUG flag
  DEBUG: false,
}));

// Import the module under test after mocking dependencies
import fs from 'fs/promises';
import {
  fileExists,
  readJsonFile,
  getTasksFilePath,
  readTasksFile,
  writeTasksFile,
  generateTaskFiles,
} from '../file-utils.js';
import { logger } from '../logger.js';
import Config from '../../../config.js';

describe('file-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence logger.error during tests
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await fileExists('/path/to/existing/file.json');

      expect(fs.access).toHaveBeenCalledWith('/path/to/existing/file.json');
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const result = await fileExists('/path/to/non-existent/file.json');

      expect(fs.access).toHaveBeenCalledWith('/path/to/non-existent/file.json');
      expect(result).toBe(false);
    });
  });

  describe('readJsonFile', () => {
    it('should read and parse JSON file correctly', async () => {
      const mockJsonContent = '{"key": "value"}';
      vi.mocked(fs.readFile).mockResolvedValue(mockJsonContent);

      const result = await readJsonFile('/path/to/file.json');

      expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.json', 'utf-8');
      expect(result).toEqual({ key: 'value' });
    });

    it('should throw error if file cannot be read', async () => {
      const mockError = new Error('Cannot read file');
      vi.mocked(fs.readFile).mockRejectedValue(mockError);

      await expect(readJsonFile('/path/to/file.json')).rejects.toThrow(mockError);
    });

    it('should throw error if content is not valid JSON', async () => {
      const invalidJson = '{key: value}'; // Missing quotes
      vi.mocked(fs.readFile).mockResolvedValue(invalidJson);

      await expect(readJsonFile('/path/to/file.json')).rejects.toThrow(SyntaxError);
    });
  });

  describe('getTasksFilePath', () => {
    it('should return the provided file path if it is absolute', () => {
      const absolutePath = path.isAbsolute('/absolute/path/to/tasks.json')
        ? '/absolute/path/to/tasks.json'
        : 'C:\\absolute\\path\\to\\tasks.json'; // Windows alternative

      const result = getTasksFilePath('/project/root', absolutePath);

      expect(result).toBe(absolutePath);
    });

    it('should join project root with relative file path', () => {
      const result = getTasksFilePath('/project/root', 'relative/path/to/tasks.json');

      expect(result).toBe('/project/root/relative/path/to/tasks.json');
    });

    it('should use Config.getArtifactsFile if no file path is provided', () => {
      const result = getTasksFilePath('/project/root');

      expect(Config.getArtifactsFile).toHaveBeenCalledWith('/project/root');
      expect(result).toBe('/project/root/apm-artifacts/artifacts.json');
    });

    it('should handle null file parameter', () => {
      const result = getTasksFilePath('/project/root', null);

      expect(Config.getArtifactsFile).toHaveBeenCalledWith('/project/root');
      expect(result).toBe('/project/root/apm-artifacts/artifacts.json');
    });

    it('should use environment variable if project root is not provided', () => {
      // Mock process.env.PROJECT_ROOT
      const originalEnv = process.env.PROJECT_ROOT;
      process.env.PROJECT_ROOT = '/env/project/root';

      // Mock Config.getProjectRoot to return the env value
      vi.mocked(Config.getProjectRoot).mockReturnValueOnce('/env/project/root');

      const _result = getTasksFilePath('');

      expect(Config.getProjectRoot).toHaveBeenCalled();
      expect(Config.getArtifactsFile).toHaveBeenCalledWith('/env/project/root');

      // Restore original env
      process.env.PROJECT_ROOT = originalEnv;
    });

    it('should throw error if project root is not provided and not in environment', () => {
      // Mock Config.getProjectRoot to return empty string
      vi.mocked(Config.getProjectRoot).mockReturnValueOnce('');

      expect(() => getTasksFilePath('')).toThrow(
        'Project root is required. Either provide it in the request or set the PROJECT_ROOT environment variable.'
      );
    });
  });

  describe('readTasksFile', () => {
    it('should read artifacts file successfully', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockTasksData));

      const result = await readTasksFile('/project/root');

      expect(Config.getArtifactsFile).toHaveBeenCalledWith('/project/root');
      expect(fs.access).toHaveBeenCalledWith('/project/root/apm-artifacts/artifacts.json');
      expect(result).toEqual(mockTasksData);
    });

    it('should return null and log error if reading fails', async () => {
      const mockError = new Error('Read error');

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(mockError);

      const result = await readTasksFile('/project/root');

      expect(logger.error).toHaveBeenCalledWith('Error reading artifacts file:', mockError);
      expect(result).toBeNull();
    });

    it('should use custom file path if provided', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task' }],
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockTasksData));

      await readTasksFile('/project/root', 'custom/path/tasks.json');

      // Check that the correct path was used
      expect(fs.access).toHaveBeenCalledWith('/project/root/custom/path/tasks.json');
    });

    it('should use environment variable if project root is not provided', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };

      // Mock Config.getProjectRoot to return a value
      vi.mocked(Config.getProjectRoot).mockReturnValueOnce('/env/project/root');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockTasksData));

      const result = await readTasksFile('');

      expect(Config.getProjectRoot).toHaveBeenCalled();
      expect(result).toEqual(mockTasksData);
    });

    it('should return null if project root is not provided and not in environment', async () => {
      // Mock Config.getProjectRoot to return empty string
      vi.mocked(Config.getProjectRoot).mockReturnValueOnce('');

      const result = await readTasksFile('');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error reading artifacts file:',
        expect.objectContaining({
          message: expect.stringContaining('Project root is required'),
        })
      );
    });

    it('should handle null file parameter', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockTasksData));

      await readTasksFile('/project/root', null);

      expect(Config.getArtifactsFile).toHaveBeenCalledWith('/project/root');
    });

    it('should skip Task Master fallback if paths are the same', async () => {
      // Mock Config to return the same path for both artifacts and Task Master
      vi.mocked(Config.getArtifactsFile).mockReturnValueOnce('/project/root/same/path.json');

      // Mock access to fail
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const result = await readTasksFile('/project/root');

      // Should only try to access the file once
      expect(fs.access).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });

  describe('writeTasksFile', () => {
    it('should write tasks data to the artifacts file', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeTasksFile(mockTasksData, '/project/root');

      expect(Config.getArtifactsFile).toHaveBeenCalledWith('/project/root');
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/project/root/apm-artifacts/artifacts.json',
        JSON.stringify(mockTasksData, null, 2),
        'utf-8'
      );
      expect(result).toBe(true);
    });

    it('should use custom file path if provided', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeTasksFile(mockTasksData, '/project/root', 'custom/path/tasks.json');

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/project/root/custom/path/tasks.json',
        JSON.stringify(mockTasksData, null, 2),
        'utf-8'
      );
      expect(result).toBe(true);
    });

    it('should return false and log error if writing fails', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };
      const mockError = new Error('Write error');

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(mockError);

      const result = await writeTasksFile(mockTasksData, '/project/root');

      expect(logger.error).toHaveBeenCalledWith('Error writing artifacts file:', mockError);
      expect(result).toBe(false);
    });

    it('should return false if tasksData is null', async () => {
      const result = await writeTasksFile(null, '/project/root');

      expect(logger.error).toHaveBeenCalledWith('Cannot write null tasks data');
      expect(result).toBe(false);
    });

    it('should use environment variable if project root is not provided', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };

      // Mock Config.getProjectRoot to return a value
      vi.mocked(Config.getProjectRoot).mockReturnValueOnce('/env/project/root');
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await writeTasksFile(mockTasksData, '');

      expect(Config.getProjectRoot).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if project root is not provided and not in environment', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };

      // Mock Config.getProjectRoot to return empty string
      vi.mocked(Config.getProjectRoot).mockReturnValueOnce('');

      const result = await writeTasksFile(mockTasksData, '');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error writing artifacts file:',
        expect.objectContaining({
          message: expect.stringContaining('Project root is required'),
        })
      );
    });

    it('should return false if directory creation fails', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
      };
      const mockError = new Error('Directory creation error');

      vi.mocked(fs.mkdir).mockRejectedValue(mockError);

      const result = await writeTasksFile(mockTasksData, '/project/root');

      expect(logger.error).toHaveBeenCalledWith(
        `Error creating directory /project/root/apm-artifacts:`,
        mockError
      );
      expect(result).toBe(false);
    });
  });

  describe('generateTaskFiles', () => {
    it('should generate individual task files for each task', async () => {
      const mockTasksData = {
        tasks: [
          { id: '1', title: 'Task 1', description: 'Description 1', status: 'pending' },
          { id: '2', title: 'Task 2', description: 'Description 2', status: 'pending' },
        ],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await generateTaskFiles(mockTasksData, '/project/root');

      expect(Config.getArtifactsDir).toHaveBeenCalledWith('/project/root');
      expect(fs.mkdir).toHaveBeenCalledWith('/project/root/apm-artifacts', { recursive: true });
      expect(Config.getArtifactFilePath).toHaveBeenCalledWith('1', '/project/root');
      expect(Config.getArtifactFilePath).toHaveBeenCalledWith('2', '/project/root');
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    it('should return false and log error if directory creation fails', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Task 1', status: 'pending' }],
      };
      const mockError = new Error('Directory creation error');

      vi.mocked(fs.mkdir).mockRejectedValue(mockError);

      const result = await generateTaskFiles(mockTasksData, '/project/root');

      expect(logger.error).toHaveBeenCalledWith(
        'Error creating directory /project/root/apm-artifacts:',
        mockError
      );
      expect(result).toBe(false);
    });

    it('should return false and log error if file writing fails', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Task 1', status: 'pending' }],
      };
      const mockError = new Error('File writing error');

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(mockError);

      const result = await generateTaskFiles(mockTasksData, '/project/root');

      expect(logger.error).toHaveBeenCalledWith('Error generating task files:', mockError);
      expect(result).toBe(false);
    });

    it('should return false if tasksData is null', async () => {
      const result = await generateTaskFiles(null, '/project/root');

      expect(logger.error).toHaveBeenCalledWith('Cannot generate task files from null tasks data');
      expect(result).toBe(false);
    });

    it('should use environment variable if project root is not provided', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Task 1', status: 'pending' }],
      };

      // Mock Config.getProjectRoot to return a value
      vi.mocked(Config.getProjectRoot).mockReturnValueOnce('/env/project/root');
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await generateTaskFiles(mockTasksData, '');

      expect(Config.getProjectRoot).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if project root is not provided and not in environment', async () => {
      const mockTasksData = {
        tasks: [{ id: '1', title: 'Task 1', status: 'pending' }],
      };

      // Mock Config.getProjectRoot to return empty string
      vi.mocked(Config.getProjectRoot).mockReturnValueOnce('');

      const result = await generateTaskFiles(mockTasksData, '');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error generating task files:',
        expect.objectContaining({
          message: expect.stringContaining('Project root is required'),
        })
      );
    });

    it('should generate markdown with all task fields', async () => {
      const mockTasksData = {
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'Description 1',
            status: 'pending',
            dependencies: ['2', '3'],
            priority: 'high',
            details: 'Implementation details',
            testStrategy: 'Test strategy',
            subtasks: [
              {
                id: '1.1',
                title: 'Subtask 1.1',
                description: 'Subtask description',
                status: 'pending',
                details: 'Subtask details',
              },
            ],
          },
        ],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await generateTaskFiles(mockTasksData, '/project/root');

      // Check that writeFile was called with markdown content containing all fields
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('# Task 1: Task 1'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('## Description'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('## Dependencies'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('## Priority: high'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('## Implementation Details'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('## Test Strategy'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('## Subtasks'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('### 1.1. Subtask 1.1'),
        'utf-8'
      );

      expect(result).toBe(true);
    });

    it('should handle tasks with minimal fields', async () => {
      const mockTasksData = {
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            status: 'pending', // Add required status field
            // No other fields
          },
        ],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await generateTaskFiles(mockTasksData, '/project/root');

      // Check that writeFile was called with markdown content containing minimal fields
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('# Task 1: Task 1'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('## Status: ⏱️ Pending'),
        'utf-8'
      );

      // Should not contain optional sections
      const writeFileArgs = vi.mocked(fs.writeFile).mock.calls[0][1];
      expect(writeFileArgs).not.toContain('## Dependencies');
      expect(writeFileArgs).not.toContain('## Priority');
      expect(writeFileArgs).not.toContain('## Implementation Details');
      expect(writeFileArgs).not.toContain('## Test Strategy');
      expect(writeFileArgs).not.toContain('## Subtasks');

      expect(result).toBe(true);
    });
  });
});
