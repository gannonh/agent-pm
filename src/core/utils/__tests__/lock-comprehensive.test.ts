import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { FileSystemError, ErrorCode } from '../../../types/errors.js';

// Mock dependencies before importing the module under test
vi.mock('fs/promises');
vi.mock('path');
vi.mock('../../../core/utils/fs.js', () => ({
  fileExists: vi.fn(),
}));
vi.mock('../../../core/utils/path.js', () => ({
  ensureDirectoryExists: vi.fn().mockResolvedValue(undefined),
}));

// Import the module under test after mocking dependencies
import { acquireLock, releaseLock, withFileLock, cleanupLocks } from '../lock.js';
import { fileExists } from '../fs.js';
import { ensureDirectoryExists } from '../path.js';
import { logger } from '../../../mcp/utils/logger.js';

describe('Lock Utilities - Comprehensive Tests', () => {
  // Mock file handle for testing
  const mockFileHandle = {
    fd: 123,
    writeFile: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(path.dirname).mockReturnValue('/path/to');
  });

  afterEach(async () => {
    // Clean up any locks that might have been created
    await cleanupLocks();
  });

  describe('acquireLock', () => {
    it('should acquire a lock successfully', async () => {
      const filePath = '/path/to/file.json';
      const lockFilePath = `${filePath}.lock`;

      vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);

      await acquireLock(filePath);

      expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to');
      expect(fs.open).toHaveBeenCalledWith(lockFilePath, 'wx');
      expect(mockFileHandle.writeFile).toHaveBeenCalledWith(`${process.pid}`);
    });

    it('should return immediately if lock is already held by this process', async () => {
      const filePath = '/path/to/file.json';

      // First call to acquire the lock
      vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);
      await acquireLock(filePath);

      // Reset mocks to verify they aren't called again
      vi.clearAllMocks();

      // Second call should return immediately
      await acquireLock(filePath);

      expect(fs.open).not.toHaveBeenCalled();
      expect(mockFileHandle.writeFile).not.toHaveBeenCalled();
    });

    it('should wait and retry if lock file exists and process is running', async () => {
      const filePath = '/path/to/file.json';
      const lockFilePath = `${filePath}.lock`;

      // Mock process.kill to simulate process is running
      const originalKill = process.kill;
      process.kill = vi.fn().mockImplementation(() => true);

      // First attempt fails, lock exists
      vi.mocked(fs.open).mockRejectedValueOnce(new Error('File exists'));
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('1234'); // Mock PID

      // Second attempt succeeds
      vi.mocked(fs.open).mockResolvedValueOnce(mockFileHandle as unknown as fs.FileHandle);

      // Use a shorter timeout for testing
      const promise = acquireLock(filePath, 1000, 10);

      await promise;

      expect(fs.open).toHaveBeenCalledTimes(2);
      expect(fs.open).toHaveBeenCalledWith(lockFilePath, 'wx');
      expect(fs.readFile).toHaveBeenCalledWith(lockFilePath, 'utf-8');
      expect(process.kill).toHaveBeenCalledWith(1234, 0);

      // Restore original process.kill
      process.kill = originalKill;
    });

    it('should remove stale lock if process is not running', async () => {
      const filePath = '/path/to/file.json';
      const lockFilePath = `${filePath}.lock`;

      // Mock process.kill to simulate process is not running
      const originalKill = process.kill;
      process.kill = vi.fn().mockImplementation(() => {
        throw new Error('Process not found');
      });

      // First attempt fails, lock exists
      vi.mocked(fs.open).mockRejectedValueOnce(new Error('File exists'));
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('1234'); // Mock PID

      // Second attempt succeeds
      vi.mocked(fs.open).mockResolvedValueOnce(mockFileHandle as unknown as fs.FileHandle);

      await acquireLock(filePath);

      expect(fs.unlink).toHaveBeenCalledWith(lockFilePath);
      expect(fs.open).toHaveBeenCalledTimes(2);

      // Restore original process.kill
      process.kill = originalKill;
    });

    it('should throw LOCK_TIMEOUT error if timeout is exceeded', async () => {
      const filePath = '/path/to/file.json';

      // Mock process.kill to simulate process is running
      const originalKill = process.kill;
      process.kill = vi.fn().mockImplementation(() => true);

      // All attempts fail, lock exists
      vi.mocked(fs.open).mockRejectedValue(new Error('File exists'));
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('1234'); // Mock PID

      // Use a very short timeout for testing
      await expect(acquireLock(filePath, 10, 5)).rejects.toThrow(FileSystemError);
      await expect(acquireLock(filePath, 10, 5)).rejects.toMatchObject({
        code: ErrorCode.LOCK_TIMEOUT,
      });

      // Restore original process.kill
      process.kill = originalKill;
    });

    it('should retry immediately if lock file does not exist', async () => {
      const filePath = '/path/to/file.json';

      // First attempt fails, but lock doesn't exist
      vi.mocked(fs.open).mockRejectedValueOnce(new Error('Unknown error'));
      vi.mocked(fileExists).mockResolvedValueOnce(false);

      // Second attempt succeeds
      vi.mocked(fs.open).mockResolvedValueOnce(mockFileHandle as unknown as fs.FileHandle);

      await acquireLock(filePath);

      expect(fs.open).toHaveBeenCalledTimes(2);
      expect(fileExists).toHaveBeenCalledTimes(1);
    });

    it('should handle errors reading the lock file', async () => {
      const filePath = '/path/to/file.json';

      // First attempt fails, lock exists
      vi.mocked(fs.open).mockRejectedValueOnce(new Error('File exists'));
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read error'));

      // Second attempt succeeds
      vi.mocked(fs.open).mockResolvedValueOnce(mockFileHandle as unknown as fs.FileHandle);

      // Use a shorter timeout for testing
      await acquireLock(filePath, 1000, 10);

      expect(fs.open).toHaveBeenCalledTimes(2);
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should throw LOCK_ERROR for unexpected errors', async () => {
      const filePath = '/path/to/file.json';

      // Mock a serious error
      vi.mocked(ensureDirectoryExists).mockRejectedValue(new Error('Permission denied'));

      await expect(acquireLock(filePath)).rejects.toThrow(FileSystemError);
      await expect(acquireLock(filePath)).rejects.toMatchObject({
        code: ErrorCode.LOCK_ERROR,
      });
    });
  });

  describe('releaseLock', () => {
    it('should release a lock successfully', async () => {
      const filePath = '/path/to/file.json';
      const lockFilePath = `${filePath}.lock`;

      // First acquire a lock
      vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);
      await acquireLock(filePath);

      // Reset mocks to verify release calls
      vi.clearAllMocks();

      await releaseLock(filePath);

      expect(mockFileHandle.close).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledWith(lockFilePath);
    });

    it('should do nothing if lock is not held by this process', async () => {
      const filePath = '/path/to/file.json';

      await releaseLock(filePath);

      expect(mockFileHandle.close).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should throw LOCK_ERROR if release fails', async () => {
      const filePath = '/path/to/file.json';

      // First acquire a lock
      vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);
      await acquireLock(filePath);

      // Mock an error during release
      vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

      await expect(releaseLock(filePath)).rejects.toThrow(FileSystemError);
      await expect(releaseLock(filePath)).rejects.toMatchObject({
        code: ErrorCode.LOCK_ERROR,
      });
    });
  });

  describe('withFileLock', () => {
    it('should acquire lock, execute function, and release lock', async () => {
      const filePath = '/path/to/file.json';
      const mockFn = vi.fn().mockResolvedValue('result');

      vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);

      const result = await withFileLock(filePath, mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
      expect(mockFileHandle.close).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should release lock even if function throws', async () => {
      const filePath = '/path/to/file.json';
      const mockError = new Error('Function error');
      const mockFn = vi.fn().mockRejectedValue(mockError);

      vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);

      await expect(withFileLock(filePath, mockFn)).rejects.toThrow(mockError);

      expect(mockFn).toHaveBeenCalled();
      expect(mockFileHandle.close).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('cleanupLocks', () => {
    it('should clean up all held locks', async () => {
      const filePath1 = '/path/to/file1.json';
      const filePath2 = '/path/to/file2.json';

      // Acquire two locks
      vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);
      await acquireLock(filePath1);
      await acquireLock(filePath2);

      // Reset mocks to verify cleanup calls
      vi.clearAllMocks();

      await cleanupLocks();

      expect(mockFileHandle.close).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should continue cleanup even if some locks fail to release', async () => {
      const filePath1 = '/path/to/file1.json';
      const filePath2 = '/path/to/file2.json';

      // Acquire two locks
      vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);
      await acquireLock(filePath1);
      await acquireLock(filePath2);

      // Mock logger.error to avoid test output pollution
      vi.spyOn(logger, 'error').mockImplementation(vi.fn());

      // Mock an error for the first lock
      mockFileHandle.close.mockRejectedValueOnce(new Error('Close error'));

      await cleanupLocks();

      // Should have tried to close both locks
      expect(mockFileHandle.close).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledTimes(1); // Only one succeeds
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // Test the process.exit handler indirectly
  describe('process exit handler', () => {
    it('should attempt to clean up locks synchronously', () => {
      // This is a limited test since we can't easily test the exit handler
      // We're just verifying the handler is registered
      const listeners = process.listeners('exit');
      expect(listeners.length).toBeGreaterThan(0);
    });
  });
});
