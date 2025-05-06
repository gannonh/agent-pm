/**
 * @fileoverview File locking utilities for concurrent access control.
 * Provides mechanisms to acquire and release file locks, preventing concurrent
 * access to files by multiple processes. Includes automatic cleanup of stale locks
 * and process exit handling.
 *
 * @module core/utils/lock
 */
import fs, { FileHandle } from 'fs/promises';
import path from 'path';
import { fileExists } from './fs.js';
import { ensureDirectoryExists } from './path.js';
import { FileSystemError } from '../../types/errors.js';
import { ErrorCode } from '../../types/errors.js';
import { logger } from '../../mcp/utils/logger.js';

/**
 * Extended FileHandle interface that includes closeSync method
 * which may be available at runtime but not in TypeScript definitions
 */
interface FileHandleWithSync extends FileHandle {
  closeSync?: () => void;
}

/**
 * Interface for Node.js fs binding
 */
interface FSBinding {
  unlink?: (path: string) => void;
}

/**
 * Map to track locks held by the current process.
 * Used for cleanup and preventing duplicate locks.
 * @internal
 */
const heldLocks = new Map<string, { fd: FileHandle; path: string }>();

/**
 * Acquires an exclusive lock on a file.
 * Creates a lock file and writes the current process ID to it.
 * Automatically cleans up stale locks from crashed processes.
 *
 * @param {string} filePath - Path to the file to lock
 * @param {number} [timeout=5000] - Maximum time to wait for lock in milliseconds
 * @param {number} [retryInterval=100] - Time between lock attempts in milliseconds
 * @returns {Promise<void>} Resolves when the lock is acquired
 * @throws {FileSystemError} If the lock cannot be acquired within the timeout
 *
 * @example
 * ```ts
 * await acquireLock('data.json', 10000);
 * try {
 *   // Perform file operations
 * } finally {
 *   await releaseLock('data.json');
 * }
 * ```
 */
export async function acquireLock(
  filePath: string,
  timeout = 5000,
  retryInterval = 100
): Promise<void> {
  const lockFilePath = `${filePath}.lock`;
  const startTime = Date.now();

  // Check if we already hold this lock
  if (heldLocks.has(lockFilePath)) {
    return;
  }

  try {
    // Ensure the directory exists
    await ensureDirectoryExists(path.dirname(lockFilePath));

    while (true) {
      try {
        // Try to create the lock file exclusively
        const fileHandle = await fs.open(lockFilePath, 'wx');

        // Write the process ID to the lock file
        await fileHandle.writeFile(`${process.pid}`);

        // Store the lock in our map
        heldLocks.set(lockFilePath, { fd: fileHandle, path: lockFilePath });

        return;
      } catch (_error) {
        // We don't need the error details here, just handle the failure case
        // Check if we've timed out
        if (Date.now() - startTime > timeout) {
          throw new FileSystemError(
            `Timeout acquiring lock for ${filePath}`,
            ErrorCode.LOCK_TIMEOUT
          );
        }

        // Check if the lock file exists
        if (await fileExists(lockFilePath)) {
          try {
            // Read the lock file to get the process ID
            const lockData = await fs.readFile(lockFilePath, 'utf-8');
            const lockPid = parseInt(lockData.trim(), 10);

            // Check if the process that holds the lock is still running
            try {
              // On Unix-like systems, sending signal 0 checks if the process exists
              process.kill(lockPid, 0);

              // Process exists, wait and retry
              await new Promise((resolve) => setTimeout(resolve, retryInterval));
            } catch (_processError) {
              // Process doesn't exist, remove the stale lock
              await fs.unlink(lockFilePath);
            }
          } catch (_readError) {
            // Error reading the lock file, wait and retry
            await new Promise((resolve) => setTimeout(resolve, retryInterval));
          }
        } else {
          // Lock file doesn't exist, retry immediately
          continue;
        }
      }
    }
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      `Error acquiring lock for ${filePath}: ${(error as Error).message}`,
      ErrorCode.LOCK_ERROR,
      error
    );
  }
}

/**
 * Releases a previously acquired lock on a file.
 * Closes the lock file handle and deletes the lock file.
 * Only releases locks held by the current process.
 *
 * @param {string} filePath - Path to the file to unlock
 * @throws {FileSystemError} If the lock cannot be released
 *
 * @example
 * ```ts
 * await releaseLock('data.json');
 * ```
 */
export async function releaseLock(filePath: string): Promise<void> {
  const lockFilePath = `${filePath}.lock`;

  // Check if we hold this lock
  const lock = heldLocks.get(lockFilePath);
  if (!lock) {
    return;
  }

  try {
    // Close the file handle if it has a close method
    if (lock.fd && typeof lock.fd.close === 'function') {
      await lock.fd.close();
    }

    // Remove the lock file
    await fs.unlink(lockFilePath);

    // Remove the lock from our map
    heldLocks.delete(lockFilePath);
  } catch (error) {
    throw new FileSystemError(
      `Error releasing lock for ${filePath}: ${(error as Error).message}`,
      ErrorCode.LOCK_ERROR,
      error
    );
  }
}

/**
 * Executes a function while holding a lock on a file.
 * Automatically acquires the lock before execution and releases it afterward.
 * Ensures the lock is released even if the function throws an error.
 *
 * @template T - The return type of the function
 * @param {string} filePath - Path to the file to lock
 * @param {() => Promise<T>} fn - Async function to execute while holding the lock
 * @param {number} [timeout=5000] - Maximum time to wait for lock in milliseconds
 * @returns {Promise<T>} The result of the executed function
 *
 * @example
 * ```ts
 * const result = await withFileLock('data.json', async () => {
 *   const data = await readJsonFile('data.json');
 *   // Modify data
 *   await writeJsonFile('data.json', data);
 *   return data;
 * });
 * ```
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  timeout = 5000
): Promise<T> {
  await acquireLock(filePath, timeout);
  try {
    return await fn();
  } finally {
    await releaseLock(filePath);
  }
}

/**
 * Cleans up any locks held by the current process.
 * Should be called when the process exits normally.
 * Attempts to close file handles and remove lock files.
 *
 * @returns {Promise<void>} Resolves when cleanup is complete
 *
 * @example
 * ```ts
 * process.on('beforeExit', () => {
 *   await cleanupLocks();
 * });
 * ```
 */
export async function cleanupLocks(): Promise<void> {
  for (const [lockPath, lock] of heldLocks.entries()) {
    try {
      if (lock.fd && typeof lock.fd.close === 'function') {
        await lock.fd.close();
      }
      await fs.unlink(lock.path);
      heldLocks.delete(lockPath);
    } catch (error) {
      logger.error(`Error cleaning up lock ${lock.path}:`, error);
    }
  }
}

// Register cleanup handler for process exit
process.on('exit', () => {
  // We can't use async functions in exit handlers, so we need to use sync methods
  for (const [lockPath, lock] of heldLocks.entries()) {
    try {
      // Try to close the file handle
      // Note: FileHandle doesn't have closeSync in the type definition
      // but we'll try to use it if it exists at runtime
      const fileHandle = lock.fd as FileHandleWithSync;
      if (lock.fd && typeof fileHandle.closeSync === 'function') {
        fileHandle.closeSync();
      } else if (lock.fd && typeof lock.fd.close === 'function') {
        // Fallback to close, which might not work in exit handlers
        try {
          lock.fd.close();
        } catch {
          // Ignore errors during exit
        }
      }
      // Note: We need to use the synchronous version of unlink for cleanup during exit
      // This is a best-effort cleanup
      try {
        // Use the Node.js fs module for synchronous operations
        // We need to use a dynamic import here to avoid the linting error
        // We can't use dynamic import in a synchronous context like process.exit handler
        // So we use a less ideal but working solution with a direct fs access
        // Use a safer approach with try/catch
        try {
          // Use a safer approach with type assertions
          // We need to disable multiple ESLint rules for this low-level Node.js API access
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          const processObj = globalThis.process as any;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (processObj && typeof processObj.binding === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const fsBinding = processObj.binding('fs') as FSBinding;
            if (fsBinding && typeof fsBinding.unlink === 'function') {
              fsBinding.unlink(lock.path);
            }
          }
        } catch {
          // Ignore errors during exit
        }
      } catch {
        // Ignore errors during exit
      }
      heldLocks.delete(lockPath);
    } catch (error) {
      logger.error(`Error cleaning up lock ${lock.path}:`, error);
    }
  }
});
