import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCode, FileSystemError } from '../../../types/errors.js';
import type { Dirent } from 'fs';

// The mock definition needs to be before any imports of the module
// Using inline functions to avoid hoisting issues
vi.mock('path', () => {
  return {
    basename: vi.fn((path) => {
      if (typeof path === 'string') {
        const parts = path.split('/');
        return parts[parts.length - 1];
      }
      return '';
    }),
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...parts) => parts.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
    relative: vi.fn(),
    parse: vi.fn(),
    extname: vi.fn(),
    default: {
      basename: vi.fn(),
      join: vi.fn(),
      resolve: vi.fn(),
      dirname: vi.fn(),
      relative: vi.fn(),
      parse: vi.fn(),
      extname: vi.fn(),
    },
  };
});

vi.mock('../../../core/utils/path.js', () => {
  return {
    ensureDirectoryExists: vi.fn().mockResolvedValue(undefined),
    findProjectRoot: vi.fn().mockResolvedValue('/mock/project'),
    getBackupDirectoryPath: vi.fn().mockResolvedValue('/path/to/file.json.backups'),
    resolveProjectPath: vi.fn(),
  };
});

vi.mock('../../../core/utils/fs.js', () => {
  return {
    fileExists: vi.fn().mockResolvedValue(true),
    copyFile: vi.fn().mockResolvedValue(undefined),
    readJsonFile: vi.fn(),
    writeJsonFile: vi.fn(),
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  };
});

// Add missing error codes for testing using Object.assign to avoid readonly property errors
Object.assign(ErrorCode, {
  BACKUP_ERROR: 'BACKUP_ERROR',
  DIRECTORY_READ_ERROR: 'DIRECTORY_READ_ERROR',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  RESTORE_ERROR: 'RESTORE_ERROR',
});

vi.mock('fs/promises', () => {
  // Helper function to create mock dirents (kept for future use)
  // const createDirentMock = (name: string): Dirent =>
  //   ({
  //     name,
  //     isFile: () => true,
  //     isDirectory: () => false,
  //     isBlockDevice: () => false,
  //     isCharacterDevice: () => false,
  //     isSymbolicLink: () => false,
  //     isFIFO: () => false,
  //     isSocket: () => false,
  //   }) as unknown as Dirent;

  const fsMock = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockImplementation((path: string) => {
      console.log(`Mock readdir called with path: ${path}`);
      // Return string[] by default which matches fs.readdir behavior with no withFileTypes option
      if (path === '/path/to/file.json.backups') {
        const files = [
          'file.json.2023-01-01T00-00-00-000Z.bak',
          'file.json.2023-01-02T00-00-00-000Z.bak',
          'file.json.2023-01-03T00-00-00-000Z.bak',
          'not-a-backup-file.txt',
        ];
        console.log(`Returning files: ${JSON.stringify(files)}`);
        return Promise.resolve(files);
      }
      console.log(`Path not matched, returning empty array`);
      return Promise.resolve([]);
    }),
    unlink: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({
      isFile: () => true,
      mtime: new Date(),
    }),
    readFile: vi.fn().mockResolvedValue('{"key":"value"}'),
    copyFile: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    constants: { F_OK: 0 },
    access: vi.fn().mockResolvedValue(undefined),
  };

  return {
    ...fsMock,
    default: fsMock,
  };
});

// Import dependencies AFTER all mocks
import fs from 'fs/promises';
import path from 'path';
import * as fsUtils from '../fs.js';
import * as pathUtils from '../path.js';

// Import module under test
import { createBackup, listBackups, restoreFromBackup, cleanupBackups } from '../backup.js';

describe('Backup Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Update pathUtils mock implementation for each test
    vi.mocked(pathUtils.getBackupDirectoryPath).mockResolvedValue('/path/to/file.json.backups');

    // Setup fsUtils mocks
    vi.mocked(fsUtils.fileExists).mockResolvedValue(true);
    vi.mocked(fsUtils.copyFile).mockResolvedValue(undefined);

    // Setup path mock
    vi.mocked(path.basename).mockImplementation((filePath) => {
      if (typeof filePath === 'string') {
        const parts = filePath.split('/');
        return parts[parts.length - 1];
      }
      return '';
    });

    // Setup path.join to properly construct paths
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));

    // No need to update fs.readdir here since it's already setup in the mock
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listBackups', () => {
    it('should list all backup files for a given file path', async () => {
      const filePath = '/path/to/file.json';
      const backupDirPath = `/path/to/file.json.backups`;

      // Mock fs.readdir directly for this test
      const mockFiles = [
        'file.json.2023-01-01T00-00-00-000Z.bak',
        'file.json.2023-01-02T00-00-00-000Z.bak',
        'file.json.2023-01-03T00-00-00-000Z.bak',
        'not-a-backup-file.txt',
      ];

      // Mock response with explicit array
      vi.mocked(fs.readdir).mockReset();
      vi.mocked(fs.readdir).mockResolvedValueOnce(mockFiles as unknown as Dirent[]);

      const backups = await listBackups(filePath);

      expect(pathUtils.getBackupDirectoryPath).toHaveBeenCalled();
      expect(fs.readdir).toHaveBeenCalledWith(backupDirPath);
      expect(backups).toHaveLength(3);
      expect(backups).toEqual([
        `${backupDirPath}/file.json.2023-01-03T00-00-00-000Z.bak`,
        `${backupDirPath}/file.json.2023-01-02T00-00-00-000Z.bak`,
        `${backupDirPath}/file.json.2023-01-01T00-00-00-000Z.bak`,
      ]);
    });

    it('should handle missing backup directory', async () => {
      const filePath = '/path/to/file.json';

      // Mock fileExists to return false (backup dir doesn't exist)
      vi.mocked(fsUtils.fileExists).mockResolvedValueOnce(false);

      const backups = await listBackups(filePath);

      expect(pathUtils.getBackupDirectoryPath).toHaveBeenCalled();
      expect(backups).toEqual([]);
    });

    it('should rethrow other errors', async () => {
      const filePath = '/path/to/file.json';
      const error = new Error('Some other error');

      // Mock readdir to throw a different error
      vi.mocked(fs.readdir).mockRejectedValueOnce(error);

      await expect(listBackups(filePath)).rejects.toThrow(FileSystemError);
    });
  });

  describe('createBackup', () => {
    it('should create a backup of the file', async () => {
      const filePath = '/path/to/file.json';
      const backupDirPath = `/path/to/file.json.backups`;

      // Mock Date.now and toISOString for consistent timestamps
      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => {
        return Object.assign(mockDate, {
          toISOString: () => '2023-01-01T00-00-00-000Z',
        });
      });

      const backupPath = await createBackup(filePath);

      expect(pathUtils.getBackupDirectoryPath).toHaveBeenCalled();
      expect(pathUtils.ensureDirectoryExists).toHaveBeenCalledWith(backupDirPath);
      expect(fsUtils.fileExists).toHaveBeenCalledWith(filePath);
      expect(fsUtils.copyFile).toHaveBeenCalledWith(
        filePath,
        `${backupDirPath}/file.json.2023-01-01T00-00-00-000Z.bak`
      );
      expect(backupPath).toBe(`${backupDirPath}/file.json.2023-01-01T00-00-00-000Z.bak`);
    });

    it('should throw FileSystemError if source file does not exist', async () => {
      const filePath = '/path/to/file.json';

      // Mock fileExists to return false
      vi.mocked(fsUtils.fileExists).mockResolvedValueOnce(false);

      await expect(createBackup(filePath)).rejects.toThrow(FileSystemError);
      await expect(createBackup(filePath)).rejects.toMatchObject({
        code: ErrorCode.BACKUP_ERROR,
      });
    });

    it('should convert other errors to FileSystemError', async () => {
      const filePath = '/path/to/file.json';
      const error = new Error('Copy failed');

      // Mock copyFile to throw an error
      vi.mocked(fsUtils.copyFile).mockRejectedValueOnce(error);

      await expect(createBackup(filePath)).rejects.toThrow(FileSystemError);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore a backup file', async () => {
      const filePath = '/path/to/file.json';
      const backupPath = '/path/to/file.json.backups/file.json.2023-01-01T00-00-00-000Z.bak';

      // Mock Date for this test
      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => {
        return Object.assign(mockDate, {
          toISOString: () => '2023-01-01T00-00-00-000Z',
        });
      });

      // Mock fileExists to return true for the backup file and false for the target file
      vi.mocked(fsUtils.fileExists).mockImplementation(async (path) => {
        if (path === backupPath) {
          return true;
        }
        return false;
      });

      await restoreFromBackup(backupPath, filePath);

      expect(fsUtils.fileExists).toHaveBeenCalledWith(backupPath);
      expect(fsUtils.copyFile).toHaveBeenCalledWith(backupPath, filePath);
    });

    it('should throw FileSystemError if backup file does not exist', async () => {
      const filePath = '/path/to/file.json';
      const backupPath = '/path/to/file.json.backups/file.json.2023-01-01T00-00-00-000Z.bak';

      // Mock fileExists to return false
      vi.mocked(fsUtils.fileExists).mockResolvedValueOnce(false);

      await expect(restoreFromBackup(backupPath, filePath)).rejects.toThrow(FileSystemError);
      await expect(restoreFromBackup(backupPath, filePath)).rejects.toMatchObject({
        code: ErrorCode.BACKUP_ERROR,
      });
    });
  });

  describe('cleanupBackups', () => {
    it('should delete all backup files except the most recent ones', async () => {
      const filePath = '/path/to/file.json';
      const backupDirPath = `/path/to/file.json.backups`;

      // Update readdir for this specific test
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        'file.json.2023-01-05T00-00-00-000Z.bak',
        'file.json.2023-01-04T00-00-00-000Z.bak',
        'file.json.2023-01-03T00-00-00-000Z.bak',
        'file.json.2023-01-02T00-00-00-000Z.bak',
        'file.json.2023-01-01T00-00-00-000Z.bak',
      ] as unknown as Dirent[]);

      await cleanupBackups(filePath, 3);

      // Should delete the oldest 2 backups
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledWith(
        `${backupDirPath}/file.json.2023-01-02T00-00-00-000Z.bak`
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        `${backupDirPath}/file.json.2023-01-01T00-00-00-000Z.bak`
      );
    });

    it('should not delete any files if the number of backups is less than or equal to maxBackups', async () => {
      const filePath = '/path/to/file.json';

      // Update readdir for this specific test
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        'file.json.2023-01-02T00-00-00-000Z.bak',
        'file.json.2023-01-01T00-00-00-000Z.bak',
      ] as unknown as Dirent[]);

      await cleanupBackups(filePath, 3);

      // Should not delete any backups
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });
});
