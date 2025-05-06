import fs from 'fs/promises';
import path from 'path';
import { TasksData, Task } from '../types/index.js';
import { logger } from './logger.js';
import Config, { PROJECT_ROOT } from '../../config.js';

/**
 * Checks if a file exists at the given path
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
 * Reads a JSON file and returns its parsed content
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Gets the artifacts file path with fallback to default location
 */
export function getTasksFilePath(projectRoot: string, file?: string | null): string {
  // Log for debugging
  logger.debug('getTasksFilePath called with:', {
    projectRoot,
    file,
    envProjectRoot: PROJECT_ROOT,
  });

  // If projectRoot is undefined, try to use the environment variable
  if (!projectRoot) {
    projectRoot = Config.getProjectRoot();
    logger.debug('Using environment PROJECT_ROOT:', { projectRoot });

    if (!projectRoot) {
      throw new Error(
        'Project root is required. Either provide it in the request or set the PROJECT_ROOT environment variable.'
      );
    }
  }

  // Handle null values from MCP Inspector
  if (file && file !== null) {
    return path.isAbsolute(file) ? file : path.join(projectRoot, file);
  }

  // Use the Config module to get the artifacts file path
  return Config.getArtifactsFile(projectRoot);
}

/**
 * Writes tasks data to a file
 */
export async function writeTasksFile(
  tasksData: TasksData | null,
  projectRoot: string,
  file?: string | null
): Promise<boolean> {
  if (!tasksData) {
    logger.error('Cannot write null tasks data');
    return false;
  }
  try {
    // Log for debugging
    logger.debug('writeTasksFile called with:', {
      projectRoot,
      file,
      taskCount: tasksData?.tasks?.length || 0,
    });

    // If projectRoot is undefined, try to use the environment variable
    if (!projectRoot) {
      projectRoot = Config.getProjectRoot();
      logger.debug('Using environment PROJECT_ROOT in writeTasksFile:', { projectRoot });

      if (!projectRoot) {
        throw new Error(
          'Project root is required. Either provide it in the request or set the PROJECT_ROOT environment variable.'
        );
      }
    }

    // Get the file path using the Config module or custom path
    const filePath = file
      ? getTasksFilePath(projectRoot, file)
      : Config.getArtifactsFile(projectRoot);
    logger.debug('Writing to artifacts file:', { filePath });

    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`Error creating directory ${dirPath}:`, error);
      return false;
    }

    // Write the file
    await fs.writeFile(filePath, JSON.stringify(tasksData, null, 2), 'utf-8');
    logger.debug('Successfully wrote artifacts file:', { filePath });
    return true;
  } catch (error) {
    logger.error('Error writing artifacts file:', error);
    return false;
  }
}

/**
 * Reads the artifacts data from the specified location
 */
export async function readTasksFile(
  projectRoot: string,
  file?: string | null
): Promise<TasksData | null> {
  try {
    // Log for debugging
    logger.debug('readTasksFile called with:', {
      projectRoot,
      file,
      envProjectRoot: PROJECT_ROOT,
    });

    // If projectRoot is undefined, try to use the environment variable
    if (!projectRoot) {
      projectRoot = Config.getProjectRoot();
      logger.debug('Using environment PROJECT_ROOT in readTasksFile:', { projectRoot });

      if (!projectRoot) {
        throw new Error(
          'Project root is required. Either provide it in the request or set the PROJECT_ROOT environment variable.'
        );
      }
    }

    // Get the file path using the Config module or custom path
    const filePath = file
      ? getTasksFilePath(projectRoot, file)
      : Config.getArtifactsFile(projectRoot);
    logger.debug('Artifacts file path:', { filePath });

    if (await fileExists(filePath)) {
      const data = await readJsonFile<TasksData>(filePath);
      logger.debug('Artifacts data loaded:', { taskCount: data?.tasks?.length || 0 });
      return data;
    }

    logger.debug('No artifacts file found:', { filePath });
    return null;
  } catch (error) {
    logger.error('Error reading artifacts file:', error);
    return null;
  }
}

/**
 * Generates individual task files from tasks data
 */
export async function generateTaskFiles(
  tasksData: TasksData | null,
  projectRoot: string
): Promise<boolean> {
  if (!tasksData) {
    logger.error('Cannot generate task files from null tasks data');
    return false;
  }
  try {
    // Log for debugging
    logger.debug('generateTaskFiles called with:', {
      projectRoot,
      taskCount: tasksData?.tasks?.length || 0,
    });

    // If projectRoot is undefined, try to use the environment variable
    if (!projectRoot) {
      projectRoot = Config.getProjectRoot();
      logger.debug('Using environment PROJECT_ROOT in generateTaskFiles:', { projectRoot });

      if (!projectRoot) {
        throw new Error(
          'Project root is required. Either provide it in the request or set the PROJECT_ROOT environment variable.'
        );
      }
    }

    // Ensure the artifacts directory exists
    const artifactsDir = Config.getArtifactsDir(projectRoot);
    try {
      await fs.mkdir(artifactsDir, { recursive: true });
    } catch (error) {
      logger.error(`Error creating directory ${artifactsDir}:`, error);
      return false;
    }

    // Generate a file for each task
    const tasks = tasksData?.tasks || [];
    for (const task of tasks) {
      const taskId = task.id;
      const taskFilePath = Config.getArtifactFilePath(taskId, projectRoot);

      // Generate task content in Markdown format
      const content = generateTaskMarkdown(task);

      // Write the task file
      await fs.writeFile(taskFilePath, content, 'utf-8');
      logger.debug(`Generated task file: ${taskFilePath}`);
    }

    return true;
  } catch (error) {
    logger.error('Error generating task files:', error);
    return false;
  }
}

/**
 * Get emoji for task status
 */
function getStatusEmoji(status: string | undefined): string {
  switch (status) {
    case 'done':
      return '✅ Done';
    case 'in-progress':
      return '🔄 In Progress';
    case 'review':
      return '👀 Review';
    case 'blocked':
      return '🚫 Blocked';
    case 'deferred':
      return '⏳ Deferred';
    case 'cancelled':
      return '❌ Cancelled';
    default:
      return '⏱️ Pending';
  }
}

/**
 * Generates Markdown content for a task
 */
function generateTaskMarkdown(task: Task): string {
  const {
    id,
    title,
    description,
    status,
    dependencies,
    priority,
    details,
    testStrategy,
    subtasks,
  } = task;

  let markdown = `# Task ${id}: ${title}\n\n`;

  if (description) {
    markdown += `## Description\n\n${description}\n\n`;
  }

  markdown += `## Status: ${getStatusEmoji(status)}\n\n`;

  if (dependencies && dependencies.length > 0) {
    markdown += `## Dependencies\n\n`;
    for (const dep of dependencies) {
      markdown += `- Task ${dep}\n`;
    }
    markdown += '\n';
  }

  if (priority) {
    markdown += `## Priority: ${priority}\n\n`;
  }

  if (details) {
    markdown += `## Implementation Details\n\n${details}\n\n`;
  }

  if (testStrategy) {
    markdown += `## Test Strategy\n\n${testStrategy}\n\n`;
  }

  if (subtasks && subtasks.length > 0) {
    markdown += `## Subtasks\n\n`;
    for (const subtask of subtasks) {
      markdown += `### ${subtask.id}. ${subtask.title}\n\n`;
      if (subtask.description) {
        markdown += `${subtask.description}\n\n`;
      }
      if (subtask.status) {
        markdown += `Status: ${getStatusEmoji(subtask.status)}\n\n`;
      }
      if (subtask.details) {
        markdown += `${subtask.details}\n\n`;
      }
    }
  }

  return markdown;
}
