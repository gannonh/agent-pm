/**
 * @fileoverview File system utilities for reading and writing files.
 * Provides a set of wrapper functions around Node.js fs/promises with enhanced error handling,
 * data validation, and type safety. Includes utilities for JSON and text file operations.
 *
 * @module core/utils/fs
 */
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { FileSystemError } from '../../types/errors.js';
import { ErrorCode } from '../../types/errors.js';
import { ensureDirectoryExists } from './path.js';

/**
 * Reads and parses a JSON file with optional schema validation.
 * Automatically handles common file system errors and JSON parsing errors.
 *
 * @template T - The expected type of the parsed JSON data
 * @param {string} filePath - Path to the JSON file
 * @param {z.ZodType<T>} [schema] - Optional Zod schema for validation
 * @returns {Promise<T>} Parsed and optionally validated JSON data
 * @throws {FileSystemError} If the file cannot be read, parsed, or fails validation
 *
 * @example
 * ```ts
 * const data = await readJsonFile<Config>('config.json', ConfigSchema);
 * ```
 */
export async function readJsonFile<T>(filePath: string, schema?: z.ZodType<T>): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsedData = JSON.parse(data) as T;

    if (schema) {
      try {
        return schema.parse(parsedData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new FileSystemError(
            `Invalid data format in ${filePath}: ${error.message}`,
            ErrorCode.VALIDATION_ERROR,
            error.format()
          );
        }
        throw error;
      }
    }

    return parsedData;
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new FileSystemError(
        `Invalid JSON in ${filePath}: ${error.message}`,
        ErrorCode.INVALID_FORMAT,
        error
      );
    }

    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileSystemError(`File not found: ${filePath}`, ErrorCode.NOT_FOUND, error);
    }

    throw new FileSystemError(
      `Error reading file ${filePath}: ${(error as Error).message}`,
      ErrorCode.FILE_READ_ERROR,
      error
    );
  }
}

/**
 * Writes data to a JSON file with optional schema validation and pretty printing.
 * Creates the target directory if it doesn't exist.
 *
 * @template T - The type of data to write
 * @param {string} filePath - Path to the JSON file
 * @param {T} data - Data to write
 * @param {z.ZodType<T>} [schema] - Optional Zod schema for validation
 * @param {boolean} [pretty=true] - Whether to pretty-print the JSON
 * @throws {FileSystemError} If the file cannot be written or data fails validation
 *
 * @example
 * ```ts
 * await writeJsonFile('config.json', config, ConfigSchema, true);
 * ```
 */
export async function writeJsonFile<T>(
  filePath: string,
  data: T,
  schema?: z.ZodType<T>,
  pretty = true
): Promise<void> {
  try {
    // Validate data if schema is provided
    if (schema) {
      try {
        schema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new FileSystemError(
            `Invalid data format for ${filePath}: ${error.message}`,
            ErrorCode.VALIDATION_ERROR,
            error.format()
          );
        }
        throw error;
      }
    }

    // Ensure the directory exists
    await ensureDirectoryExists(path.dirname(filePath));

    // Convert data to JSON string
    const jsonString = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

    // Write to file
    await fs.writeFile(filePath, jsonString, 'utf-8');
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    throw new FileSystemError(
      `Error writing to file ${filePath}: ${(error as Error).message}`,
      ErrorCode.FILE_WRITE_ERROR,
      error
    );
  }
}

/**
 * Checks if a file exists at the specified path.
 * Uses fs.access() internally for efficient existence checking.
 *
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if the file exists, false otherwise
 *
 * @example
 * ```ts
 * if (await fileExists('config.json')) {
 *   // Handle existing file
 * }
 * ```
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a text file with UTF-8 encoding.
 * Provides enhanced error handling for common file system errors.
 *
 * @param {string} filePath - Path to the text file
 * @returns {Promise<string>} File contents as a string
 * @throws {FileSystemError} If the file cannot be read
 *
 * @example
 * ```ts
 * const content = await readTextFile('README.md');
 * ```
 */
export async function readTextFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileSystemError(`File not found: ${filePath}`, ErrorCode.NOT_FOUND, error);
    }

    throw new FileSystemError(
      `Error reading file ${filePath}: ${(error as Error).message}`,
      ErrorCode.FILE_READ_ERROR,
      error
    );
  }
}

/**
 * Writes text content to a file with UTF-8 encoding.
 * Creates the target directory if it doesn't exist.
 *
 * @param {string} filePath - Path to the text file
 * @param {string} content - Text content to write
 * @throws {FileSystemError} If the file cannot be written
 *
 * @example
 * ```ts
 * await writeTextFile('README.md', '# Project Documentation');
 * ```
 */
export async function writeTextFile(filePath: string, content: string): Promise<void> {
  try {
    // Ensure the directory exists
    await ensureDirectoryExists(path.dirname(filePath));

    // Write to file
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new FileSystemError(
      `Error writing to file ${filePath}: ${(error as Error).message}`,
      ErrorCode.FILE_WRITE_ERROR,
      error
    );
  }
}

/**
 * Deletes a file if it exists.
 * Silently succeeds if the file doesn't exist.
 *
 * @param {string} filePath - Path to the file
 * @throws {FileSystemError} If the file exists but cannot be deleted
 *
 * @example
 * ```ts
 * await deleteFile('temp.txt');
 * ```
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, which is fine for deletion
      return;
    }

    throw new FileSystemError(
      `Error deleting file ${filePath}: ${(error as Error).message}`,
      ErrorCode.FILE_DELETE_ERROR,
      error
    );
  }
}

/**
 * Lists files in a directory with optional pattern matching.
 * Only returns files (not directories) and supports simple glob patterns.
 *
 * @param {string} dirPath - Path to the directory
 * @param {string} [pattern] - Optional glob pattern to filter files
 * @returns {Promise<string[]>} Array of file paths
 * @throws {FileSystemError} If the directory cannot be read
 *
 * @example
 * ```ts
 * const jsonFiles = await listFiles('config', '*.json');
 * ```
 */
export async function listFiles(dirPath: string, pattern?: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(dirPath, entry.name));

    if (pattern) {
      // Simple pattern matching (can be enhanced with actual glob support)
      const regex = new RegExp(pattern.replace('*', '.*'));
      return files.filter((file) => regex.test(path.basename(file)));
    }

    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileSystemError(`Directory not found: ${dirPath}`, ErrorCode.NOT_FOUND, error);
    }

    throw new FileSystemError(
      `Error listing files in ${dirPath}: ${(error as Error).message}`,
      ErrorCode.DIRECTORY_READ_ERROR,
      error
    );
  }
}

/**
 * Copies a file from one location to another.
 * Creates the destination directory if it doesn't exist.
 *
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @throws {FileSystemError} If the file cannot be copied
 *
 * @example
 * ```ts
 * await copyFile('config.json', 'backup/config.json');
 * ```
 */
export async function copyFile(sourcePath: string, destPath: string): Promise<void> {
  try {
    // Ensure the destination directory exists
    await ensureDirectoryExists(path.dirname(destPath));

    // Copy the file
    await fs.copyFile(sourcePath, destPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileSystemError(`Source file not found: ${sourcePath}`, ErrorCode.NOT_FOUND, error);
    }

    throw new FileSystemError(
      `Error copying file from ${sourcePath} to ${destPath}: ${(error as Error).message}`,
      ErrorCode.FILE_COPY_ERROR,
      error
    );
  }
}

/**
 * Moves a file from one location to another.
 * Creates the destination directory if it doesn't exist.
 * Uses fs.rename() internally for atomic moves when possible.
 *
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @throws {FileSystemError} If the file cannot be moved
 *
 * @example
 * ```ts
 * await moveFile('temp/config.json', 'config/config.json');
 * ```
 */
export async function moveFile(sourcePath: string, destPath: string): Promise<void> {
  try {
    // Ensure the destination directory exists
    await ensureDirectoryExists(path.dirname(destPath));

    // Move the file
    await fs.rename(sourcePath, destPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileSystemError(`Source file not found: ${sourcePath}`, ErrorCode.NOT_FOUND, error);
    }

    throw new FileSystemError(
      `Error moving file from ${sourcePath} to ${destPath}: ${(error as Error).message}`,
      ErrorCode.FILE_MOVE_ERROR,
      error
    );
  }
}
