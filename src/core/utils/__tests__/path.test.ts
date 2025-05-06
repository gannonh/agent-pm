import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileSystemError } from '../../../types/errors.js';

// Mock dependencies BEFORE importing the module under test
vi.mock('fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    default: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockImplementation(async (filePath) => {
        if (filePath === '/mock/project/package.json' || filePath === '/mock/package.json') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      }),
      constants: { F_OK: 0 },
    },
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockImplementation(async (filePath) => {
      if (filePath === '/mock/project/package.json' || filePath === '/mock/package.json') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    }),
    constants: { F_OK: 0 },
  };
});

vi.mock('path', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    default: {
      join: vi.fn((...args) => args.join('/')),
      resolve: vi.fn((...args) => args.join('/')),
      dirname: vi.fn((p) => {
        if (p === '/mock/project/src') return '/mock/project';
        if (p === '/mock/cwd') return '/mock';
        if (p === '/mock') return '/';
        return p.split('/').slice(0, -1).join('/');
      }),
      relative: vi.fn((from, to) => to.replace(from, '')),
    },
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => {
      if (p === '/mock/project/src') return '/mock/project';
      if (p === '/mock/cwd') return '/mock';
      if (p === '/mock') return '/';
      return p.split('/').slice(0, -1).join('/');
    }),
    relative: vi.fn((from, to) => to.replace(from, '')),
  };
});

// Mock Config module
vi.mock('../../../config.js', () => {
  const mockConfig = {
    getArtifactsDir: vi.fn().mockImplementation((projectRoot) => `${projectRoot}/apm-artifacts`),
    getArtifactsFile: vi
      .fn()
      .mockImplementation((projectRoot) => `${projectRoot}/apm-artifacts/artifacts.json`),
    getArtifactFilePath: vi
      .fn()
      .mockImplementation(
        (taskId, projectRoot) => `${projectRoot}/apm-artifacts/task_${taskId}.md`
      ),
    getTaskMasterDir: vi.fn().mockImplementation((projectRoot) => `${projectRoot}/tasks`),
    getTaskMasterFile: vi
      .fn()
      .mockImplementation((projectRoot) => `${projectRoot}/tasks/tasks.json`),
    getTaskMasterFilePath: vi
      .fn()
      .mockImplementation(
        (taskId, projectRoot) => `${projectRoot}/tasks/task_${String(taskId).padStart(3, '0')}.txt`
      ),
  };
  return {
    default: mockConfig,
    ARTIFACTS_DIR: 'apm-artifacts',
  };
});

// Save original process.cwd
const originalCwd = process.cwd;

// Setup before each test
beforeEach(() => {
  vi.resetModules();
  process.cwd = vi.fn().mockReturnValue('/mock/cwd');
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
  process.cwd = originalCwd;
});

// Import dependencies AFTER mocking
import fs from 'fs/promises';
import path from 'path';

// Import the module under test AFTER all mocks are set up
import * as pathUtils from '../path.js';

describe('Path Utilities', () => {
  describe('ensureDirectoryExists', () => {
    it('should create a directory if it does not exist', async () => {
      // Use a path that won't cause actual filesystem errors
      const mockDirPath = '/mock-dir';

      // Reset the mock to avoid previous test interference
      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);

      await pathUtils.ensureDirectoryExists(mockDirPath);

      expect(fs.mkdir).toHaveBeenCalledWith(mockDirPath, { recursive: true });
    });

    it('should throw a FileSystemError if the directory cannot be created', async () => {
      const mockDirPath = '/mock-dir';
      const error = new Error('Permission denied');

      // Setup mock to throw error
      vi.spyOn(fs, 'mkdir').mockRejectedValue(error);

      await expect(pathUtils.ensureDirectoryExists(mockDirPath)).rejects.toThrow(FileSystemError);
      await expect(pathUtils.ensureDirectoryExists(mockDirPath)).rejects.toThrow(
        'Error creating directory'
      );
    });
  });

  describe('findProjectRoot', () => {
    it('should find the project root directory', async () => {
      const mockStartDir = '/mock/project/src';
      const mockProjectRoot = '/mock/project';

      // Setup path.dirname mock
      vi.spyOn(path, 'dirname').mockImplementation((p) => {
        if (p === '/mock/project/src') return '/mock/project';
        if (p === '/mock/project') return '/mock';
        return p.split('/').slice(0, -1).join('/');
      });

      // Setup path.join mock
      vi.spyOn(path, 'join').mockImplementation((dir, file) => {
        if (file === 'package.json') {
          return `${dir}/package.json`;
        }
        return `${dir}/${file}`;
      });

      // Setup fs.access mock
      vi.spyOn(fs, 'access').mockImplementation(async (filePath) => {
        if (filePath === '/mock/project/package.json') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await pathUtils.findProjectRoot(mockStartDir);

      expect(result).toBe(mockProjectRoot);
    });

    it('should use the current working directory if no start directory is provided', async () => {
      const mockProjectRoot = '/mock';

      // Setup path.dirname mock
      vi.spyOn(path, 'dirname').mockImplementation((p) => {
        if (p === '/mock/cwd') return '/mock';
        if (p === '/mock') return '/';
        return p.split('/').slice(0, -1).join('/');
      });

      // Setup path.join mock
      vi.spyOn(path, 'join').mockImplementation((dir, file) => {
        if (file === 'package.json') {
          return `${dir}/package.json`;
        }
        return `${dir}/${file}`;
      });

      // Setup fs.access mock
      vi.spyOn(fs, 'access').mockImplementation(async (filePath) => {
        if (filePath === '/mock/package.json') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await pathUtils.findProjectRoot();

      expect(process.cwd).toHaveBeenCalled();
      expect(result).toBe(mockProjectRoot);
    });

    it('should throw a FileSystemError if the project root cannot be found', async () => {
      const mockStartDir = '/mock/not/a/project';

      // Setup path.dirname mock
      vi.spyOn(path, 'dirname').mockImplementation((p) => {
        if (p === '/mock/not/a/project') return '/mock/not/a';
        if (p === '/mock/not/a') return '/mock/not';
        if (p === '/mock/not') return '/mock';
        if (p === '/mock') return '/';
        return '/';
      });

      // Setup path.join mock
      vi.spyOn(path, 'join').mockImplementation((dir, file) => {
        if (file === 'package.json') {
          return `${dir}/package.json`;
        }
        return `${dir}/${file}`;
      });

      // Setup fs.access mock to always reject
      vi.spyOn(fs, 'access').mockRejectedValue(new Error('File not found'));

      await expect(pathUtils.findProjectRoot(mockStartDir)).rejects.toThrow(FileSystemError);
      await expect(pathUtils.findProjectRoot(mockStartDir)).rejects.toThrow(
        'Could not find project root directory'
      );
    });
  });

  describe('resolveProjectPath', () => {
    it('should resolve a path relative to the project root', async () => {
      const mockRelativePath = 'src/index.ts';
      const mockProjectRoot = '/mock/project';
      const mockAbsolutePath = '/mock/project/src/index.ts';

      // Mock path.resolve
      vi.spyOn(path, 'resolve').mockReturnValue(mockAbsolutePath);

      // Execute the function with explicit project root
      const result = await pathUtils.resolveProjectPath(mockRelativePath, mockProjectRoot);

      // Verify the result
      expect(path.resolve).toHaveBeenCalledWith(mockProjectRoot, mockRelativePath);
      expect(result).toBe(mockAbsolutePath);
    });

    it('should use the provided project root if available', async () => {
      const mockRelativePath = 'src/index.ts';
      const mockProjectRoot = '/mock/project';
      const mockAbsolutePath = '/mock/project/src/index.ts';

      // Mock path.resolve
      vi.spyOn(path, 'resolve').mockImplementation(() => mockAbsolutePath);

      const result = await pathUtils.resolveProjectPath(mockRelativePath, mockProjectRoot);

      expect(path.resolve).toHaveBeenCalledWith(mockProjectRoot, mockRelativePath);
      expect(result).toBe(mockAbsolutePath);
    });
  });

  describe('findTasksJsonPath', () => {
    it('should find the artifacts.json file path with explicit project root', async () => {
      const mockProjectRoot = '/mock/project';
      const mockTasksJsonPath = '/mock/project/apm-artifacts/artifacts.json';

      // Import Config after mocking
      const { default: Config } = await import('../../../config.js');

      // Reset the mock to avoid previous test interference
      vi.mocked(Config.getArtifactsFile).mockClear();

      // Mock Config.getArtifactsFile
      vi.mocked(Config.getArtifactsFile).mockReturnValue(mockTasksJsonPath);

      const result = await pathUtils.findTasksJsonPath(mockProjectRoot);

      expect(Config.getArtifactsFile).toHaveBeenCalledWith(mockProjectRoot);
      expect(result).toBe(mockTasksJsonPath);
    });

    // Removed test for config parameter since it's no longer used

    it('should use the provided project root if available', async () => {
      const mockProjectRoot = '/mock/project';
      const mockTasksJsonPath = '/mock/project/apm-artifacts/artifacts.json';

      // Import Config after mocking
      const { default: Config } = await import('../../../config.js');

      // Reset the mock to avoid previous test interference
      vi.mocked(Config.getArtifactsFile).mockClear();

      // Mock Config.getArtifactsFile
      vi.mocked(Config.getArtifactsFile).mockReturnValue(mockTasksJsonPath);

      const result = await pathUtils.findTasksJsonPath(mockProjectRoot);

      expect(Config.getArtifactsFile).toHaveBeenCalledWith(mockProjectRoot);
      expect(result).toBe(mockTasksJsonPath);
    });
  });

  describe('findComplexityReportPath', () => {
    it('should find the complexity report file path', async () => {
      const mockProjectRoot = '/mock/project';
      const mockReportPath =
        '/mock/project/apm-artifacts/resources/reports/task-complexity-report.json';

      // Mock path.resolve
      vi.spyOn(path, 'resolve').mockReturnValue(mockReportPath);

      const result = await pathUtils.findComplexityReportPath(undefined, mockProjectRoot);

      expect(path.resolve).toHaveBeenCalledWith(
        mockProjectRoot,
        'apm-artifacts/resources/reports/task-complexity-report.json'
      );
      expect(result).toBe(mockReportPath);
    });

    it('should use the provided custom report path if available', async () => {
      const mockProjectRoot = '/mock/project';
      const customReportPath = 'custom/report.json';
      const mockReportPath = '/mock/project/custom/report.json';

      // Mock path.resolve
      vi.spyOn(path, 'resolve').mockReturnValue(mockReportPath);

      const result = await pathUtils.findComplexityReportPath(customReportPath, mockProjectRoot);

      expect(path.resolve).toHaveBeenCalledWith(mockProjectRoot, customReportPath);
      expect(result).toBe(mockReportPath);
    });
  });

  describe('getTasksDirectoryPath', () => {
    it('should get the tasks directory path', async () => {
      const mockProjectRoot = '/mock/project';
      const mockTasksDir = '/mock/project/apm-artifacts';

      // Import Config after mocking
      const { default: Config } = await import('../../../config.js');

      // Reset the mock to avoid previous test interference
      vi.mocked(Config.getArtifactsDir).mockClear();

      // Mock Config.getArtifactsDir
      vi.mocked(Config.getArtifactsDir).mockReturnValue(mockTasksDir);

      const result = await pathUtils.getTasksDirectoryPath(mockProjectRoot);

      expect(Config.getArtifactsDir).toHaveBeenCalledWith(mockProjectRoot);
      expect(result).toBe(mockTasksDir);
    });
  });

  describe('getScriptsDirectoryPath', () => {
    it('should get the scripts directory path', async () => {
      const mockProjectRoot = '/mock/project';
      const mockScriptsDir = '/mock/project/scripts';

      // Mock path.resolve
      vi.spyOn(path, 'resolve').mockReturnValue(mockScriptsDir);

      const result = await pathUtils.getScriptsDirectoryPath(mockProjectRoot);

      expect(result).toBe(mockScriptsDir);
    });
  });

  describe('getBackupDirectoryPath', () => {
    it('should get the backup directory path', async () => {
      const mockProjectRoot = '/mock/project';
      const mockBackupDir = '/mock/project/backups';

      // Mock path.resolve
      vi.spyOn(path, 'resolve').mockReturnValue(mockBackupDir);

      const result = await pathUtils.getBackupDirectoryPath(mockProjectRoot);

      expect(result).toBe(mockBackupDir);
    });
  });

  describe('getTaskFilePath', () => {
    it('should get the path for a specific task file', async () => {
      const mockTaskId = '123';
      const mockProjectRoot = '/mock/project';
      const mockTaskFilePath = '/mock/project/apm-artifacts/task_123.md';

      // Import Config after mocking
      const { default: Config } = await import('../../../config.js');

      // Reset the mock to avoid previous test interference
      vi.mocked(Config.getArtifactFilePath).mockClear();

      // Mock Config.getArtifactFilePath
      vi.mocked(Config.getArtifactFilePath).mockReturnValue(mockTaskFilePath);

      const result = await pathUtils.getTaskFilePath(mockTaskId, mockProjectRoot);

      expect(Config.getArtifactFilePath).toHaveBeenCalledWith(mockTaskId, mockProjectRoot);
      expect(result).toBe(mockTaskFilePath);
    });
  });

  describe('isPathWithinProject', () => {
    it('should return true if the path is within the project directory', async () => {
      const mockFilePath = '/mock/project/src/index.ts';
      const mockProjectRoot = '/mock/project';

      // Mock path.resolve
      vi.spyOn(path, 'resolve').mockReturnValue(mockFilePath);

      const result = await pathUtils.isPathWithinProject(mockFilePath, mockProjectRoot);

      expect(result).toBe(true);
    });

    it('should return false if the path is not within the project directory', async () => {
      const mockFilePath = '/other/project/src/index.ts';
      const mockProjectRoot = '/mock/project';

      // Mock path.resolve
      vi.spyOn(path, 'resolve').mockReturnValue(mockFilePath);

      const result = await pathUtils.isPathWithinProject(mockFilePath, mockProjectRoot);

      expect(result).toBe(false);
    });
  });

  describe('getRelativePathFromRoot', () => {
    it('should get a relative path from the project root', async () => {
      const mockAbsolutePath = '/mock/project/src/index.ts';
      const mockProjectRoot = '/mock/project';
      const mockRelativePath = 'src/index.ts';

      // Mock path.relative
      vi.spyOn(path, 'relative').mockReturnValue(mockRelativePath);

      const result = await pathUtils.getRelativePathFromRoot(mockAbsolutePath, mockProjectRoot);

      expect(result).toBe(mockRelativePath);
    });
  });
});
