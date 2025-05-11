/**
 * @fileoverview Path utilities for file and directory operations.
 * Provides functions for working with file paths, finding project roots,
 * ensuring directory existence, and managing backup directories.
 * Includes utilities for path resolution and directory creation.
 *
 * @module core/utils/path
 */
import fs from 'fs/promises';
import path from 'path';
import { FileSystemError, ErrorCode } from '../../types/errors.js';
import Config, { ARTIFACTS_DIR } from '../../config.js';

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath Path to the directory
 * @throws FileSystemError if the directory cannot be created
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new FileSystemError(
      `Error creating directory ${dirPath}: ${(error as Error).message}`,
      ErrorCode.DIRECTORY_CREATE_ERROR,
      error
    );
  }
}

/**
 * Find the project root directory
 * @param startDir Starting directory (default: current working directory)
 * @returns Absolute path to the project root directory
 * @throws FileSystemError if the project root cannot be found
 */
export async function findProjectRoot(startDir: string = process.cwd()): Promise<string> {
  let currentDir = startDir;

  // Maximum depth to search to avoid infinite loops
  const maxDepth = 10;
  let depth = 0;

  while (depth < maxDepth) {
    try {
      // Check for package.json as an indicator of project root
      await fs.access(path.join(currentDir, 'package.json'));
      return currentDir;
    } catch {
      // Go up one directory
      const parentDir = path.dirname(currentDir);

      // If we're already at the root, we can't go up further
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
      depth++;
    }
  }

  throw new FileSystemError('Could not find project root directory', ErrorCode.NOT_FOUND);
}

/**
 * Resolve a path relative to the project root
 * @param relativePath Path relative to the project root
 * @param projectRoot Optional project root directory (will be detected if not provided)
 * @returns Absolute path
 */
export async function resolveProjectPath(
  relativePath: string,
  projectRoot?: string
): Promise<string> {
  const root = projectRoot || (await findProjectRoot());
  return path.resolve(root, relativePath);
}

/**
 * Find the artifacts.json file path
 * @param projectRoot Optional project root directory
 * @returns Absolute path to the artifacts.json file
 */
export async function findTasksJsonPath(projectRoot?: string): Promise<string> {
  const root = projectRoot || (await findProjectRoot());

  // Use the Config module to get the artifacts file path
  return Config.getArtifactsFile(root);
}

/**
 * Find the complexity report file path
 * @param reportPath Optional custom report file path
 * @param projectRoot Optional project root directory
 * @returns Absolute path to the complexity report file
 */
export async function findComplexityReportPath(
  reportPath?: string,
  projectRoot?: string
): Promise<string> {
  const root = projectRoot || (await findProjectRoot());
  // Default to a standard location in the artifacts directory
  const reportFile =
    reportPath || path.join(ARTIFACTS_DIR, 'resources', 'reports', 'task-complexity-report.json');
  return path.resolve(root, reportFile);
}

/**
 * Get the artifacts directory path
 * @param projectRoot Optional project root directory
 * @returns Absolute path to the artifacts directory
 */
export async function getTasksDirectoryPath(projectRoot?: string): Promise<string> {
  const root = projectRoot || (await findProjectRoot());

  // Use the Config module to get the artifacts directory path
  return Config.getArtifactsDir(root);
}

/**
 * Get the scripts directory path
 * @param projectRoot Optional project root directory
 * @returns Absolute path to the scripts directory
 */
export async function getScriptsDirectoryPath(projectRoot?: string): Promise<string> {
  const root = projectRoot || (await findProjectRoot());
  // Use a standard location for scripts
  return path.resolve(root, 'scripts');
}

/**
 * Get the backup directory path
 * @param projectRoot Optional project root directory
 * @returns Absolute path to the backup directory
 */
export async function getBackupDirectoryPath(projectRoot?: string): Promise<string> {
  const root = projectRoot || (await findProjectRoot());
  // Use a standard location for backups
  return path.resolve(root, 'backups');
}

/**
 * Get the path for a specific artifact file
 * @param taskId Task ID
 * @param projectRoot Optional project root directory
 * @returns Absolute path to the artifact file
 */
export async function getTaskFilePath(taskId: string, projectRoot?: string): Promise<string> {
  const root = projectRoot || (await findProjectRoot());

  // Use the Config module to get the artifact file path
  return Config.getArtifactFilePath(taskId, root);
}

/**
 * Check if a path is within the project directory
 * @param filePath Path to check
 * @param projectRoot Optional project root directory
 * @returns True if the path is within the project directory
 */
export async function isPathWithinProject(
  filePath: string,
  projectRoot?: string
): Promise<boolean> {
  const root = projectRoot || (await findProjectRoot());
  const absolutePath = path.resolve(filePath);
  return absolutePath.startsWith(root);
}

/**
 * Get a relative path from the project root
 * @param absolutePath Absolute path
 * @param projectRoot Optional project root directory
 * @returns Path relative to the project root
 */
export async function getRelativePathFromRoot(
  absolutePath: string,
  projectRoot?: string
): Promise<string> {
  const root = projectRoot || (await findProjectRoot());
  return path.relative(root, absolutePath);
}
