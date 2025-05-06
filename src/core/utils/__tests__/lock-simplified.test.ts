import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Importing FileSystemError for potential future use

import { FileSystemError } from '../../../types/errors.js';
import type { FileHandle } from 'fs/promises';

// Create a mock FileHandle factory function to ensure proper typing
function createMockFileHandle(): FileHandle {
  return {
    fd: 123,
    appendFile: vi.fn(),
    chown: vi.fn(),
    chmod: vi.fn(),
    datasync: vi.fn(),
    sync: vi.fn(),
    read: vi.fn(),
    readableWebStream: vi.fn(),
    readableHighWaterMark: 0,
    readableLength: 0,
    readFile: vi.fn(),
    stat: vi.fn(),
    truncate: vi.fn(),
    utimes: vi.fn(),
    write: vi.fn(),
    writev: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    [Symbol.asyncDispose]: vi.fn(),
    createReadStream: vi.fn(),
    createWriteStream: vi.fn(),
  } as unknown as FileHandle;
}

// Mock path module
vi.mock('path', () => {
  // Create mocks inside the factory function to avoid hoisting issues
  const pathMock = {
    dirname: vi.fn().mockReturnValue('/path/to'),
    join: vi.fn(),
    resolve: vi.fn(),
    basename: vi.fn(),
  };

  return {
    ...pathMock,
    default: pathMock,
  };
});

// Mock path.js utilities first since they may be imported by other mocks
vi.mock('../../../src/core/utils/path.js', () => ({
  ensureDirectoryExists: vi.fn().mockResolvedValue(undefined),
  findProjectRoot: vi.fn(),
  getBackupDirectoryPath: vi.fn(),
  resolveProjectPath: vi.fn(),
}));

// Mock fs.js utilities
vi.mock('../../../src/core/utils/fs.js', () => ({
  fileExists: vi.fn().mockResolvedValue(true),
  copyFile: vi.fn(),
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  deleteFile: vi.fn(),
}));

// Mock fs module with default export
vi.mock('fs/promises', () => {
  // Create mocks inside the factory function to avoid hoisting issues
  const fsMock = {
    open: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    constants: {
      F_OK: 0,
    },
  };

  return {
    default: fsMock,
    ...fsMock,
  };
});

// Import dependencies AFTER mocking
import fs from 'fs/promises';
import path from 'path';
import * as fsUtils from '../fs.js';
import * as pathUtils from '../path.js';

// Import the module under test AFTER all mocks are set up
import { acquireLock } from '../lock.js';

describe('Lock Utilities (Simplified)', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Setup function mocks
    const fileHandle = createMockFileHandle();
    vi.spyOn(fs, 'open')
      .mockRejectedValueOnce(new Error('File exists'))
      .mockResolvedValueOnce(fileHandle);
    vi.spyOn(fs, 'readFile').mockResolvedValue('12345');
    vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);
    vi.spyOn(fsUtils, 'fileExists').mockResolvedValue(true);
    vi.spyOn(pathUtils, 'ensureDirectoryExists').mockResolvedValue(undefined);

    // Setup path mocks
    vi.spyOn(path, 'dirname').mockReturnValue('/path/to');

    // Mock setTimeout to execute callback immediately
    vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback();
      return {} as NodeJS.Timeout;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should wait and retry if the lock file exists and the process is still running', async () => {
      const mockFilePath = '/path/to/file.json';
      const mockLockFilePath = '/path/to/file.json.lock';
      const mockPid = 12345;

      // Mock process.kill to indicate the process is running
      vi.spyOn(process, 'kill').mockImplementation(() => true);

      // Mock fs.readFile to return a PID
      vi.spyOn(fs, 'readFile').mockResolvedValue(`${mockPid}`);

      await acquireLock(mockFilePath, 1000, 100);

      expect(pathUtils.ensureDirectoryExists).toHaveBeenCalled();
      expect(fs.open).toHaveBeenCalledTimes(2);
      expect(fsUtils.fileExists).toHaveBeenCalledWith(mockLockFilePath);
      expect(fs.readFile).toHaveBeenCalledWith(mockLockFilePath, 'utf-8');
      expect(process.kill).toHaveBeenCalledWith(mockPid, 0);
      expect(setTimeout).toHaveBeenCalled();
    });
  });
});
