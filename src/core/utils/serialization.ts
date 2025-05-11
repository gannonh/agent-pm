/**
 * @fileoverview Serialization utilities for data conversion and validation.
 * Provides functions for safely converting between different data formats,
 * with support for schema validation and error handling. Includes utilities
 * for JSON serialization, string conversion, and type checking.
 *
 * @module core/utils/serialization
 */
import type { Task, Subtask, TasksData } from '../../types/task.js';
import { taskSchema, subtaskSchema, tasksDataSchema } from '../../types/validation.js';
import { FileSystemError, ErrorCode, ValidationError } from '../../types/errors.js';
import { z } from 'zod';

/**
 * Serialize a task to a markdown string
 * @param task Task to serialize
 * @returns Markdown string representation of the task
 */
export function serializeTaskToMarkdown(task: Task): string {
  let markdown = `# Task ${task.id}: ${task.title}\n\n`;
  markdown += `**Status:** ${task.status}\n`;
  markdown += `**Priority:** ${task.priority}\n`;

  if (task.dependencies.length > 0) {
    markdown += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
  }

  markdown += `\n## Description\n\n${task.description}\n`;

  if (task.details) {
    markdown += `\n## Implementation Details\n\n${task.details}\n`;
  }

  if (task.testStrategy) {
    markdown += `\n## Test Strategy\n\n${task.testStrategy}\n`;
  }

  if (task.subtasks && task.subtasks.length > 0) {
    markdown += `\n## Subtasks\n\n`;

    for (const subtask of task.subtasks) {
      markdown += `### ${subtask.id}: ${subtask.title}\n\n`;
      markdown += `**Status:** ${subtask.status}\n`;

      if (subtask.dependencies && subtask.dependencies.length > 0) {
        markdown += `**Dependencies:** ${subtask.dependencies.join(', ')}\n`;
      }

      markdown += `\n${subtask.description}\n\n`;

      if (subtask.details) {
        markdown += `**Implementation Details:**\n\n${subtask.details}\n\n`;
      }
    }
  }

  return markdown;
}

/**
 * Parse a markdown string to extract a task
 * Note: This is a simple parser and may not handle all markdown formats
 * @param markdown Markdown string to parse
 * @returns Parsed task
 * @throws FileSystemError if the markdown cannot be parsed
 */
export function parseTaskFromMarkdown(markdown: string): Task {
  try {
    const lines = markdown.split('\n');

    // Extract task ID and title from the first line
    const titleMatch = lines[0].match(/^# Task (\d+): (.+)$/);
    if (!titleMatch) {
      throw new Error('Invalid task title format');
    }

    const id = titleMatch[1];
    const title = titleMatch[2];

    // Extract status and priority
    const statusMatch = lines
      .find((line) => line.startsWith('**Status:**'))
      ?.match(/^\*\*Status:\*\* (.+)$/);
    const priorityMatch = lines
      .find((line) => line.startsWith('**Priority:**'))
      ?.match(/^\*\*Priority:\*\* (.+)$/);

    if (!statusMatch || !priorityMatch) {
      throw new Error('Missing status or priority');
    }

    const status = statusMatch[1] as Task['status'];
    const priority = priorityMatch[1] as Task['priority'];

    // Extract dependencies
    const dependenciesMatch = lines
      .find((line) => line.startsWith('**Dependencies:**'))
      ?.match(/^\*\*Dependencies:\*\* (.+)$/);
    const dependencies = dependenciesMatch ? dependenciesMatch[1].split(', ') : [];

    // Extract description
    const descriptionStartIndex = lines.findIndex((line) => line === '## Description') + 1;
    if (descriptionStartIndex <= 0) {
      throw new Error('Missing description section');
    }

    let descriptionEndIndex = lines.findIndex(
      (line, index) => index > descriptionStartIndex && line.startsWith('## ')
    );
    if (descriptionEndIndex === -1) {
      descriptionEndIndex = lines.length;
    }

    const description = lines.slice(descriptionStartIndex, descriptionEndIndex).join('\n').trim();

    // Extract details
    let details: string | undefined;
    const detailsStartIndex = lines.findIndex((line) => line === '## Implementation Details') + 1;
    if (detailsStartIndex > 0) {
      let detailsEndIndex = lines.findIndex(
        (line, index) => index > detailsStartIndex && line.startsWith('## ')
      );
      if (detailsEndIndex === -1) {
        detailsEndIndex = lines.length;
      }

      details = lines.slice(detailsStartIndex, detailsEndIndex).join('\n').trim();
    }

    // Extract test strategy
    let testStrategy: string | undefined;
    const testStrategyStartIndex = lines.findIndex((line) => line === '## Test Strategy') + 1;
    if (testStrategyStartIndex > 0) {
      let testStrategyEndIndex = lines.findIndex(
        (line, index) => index > testStrategyStartIndex && line.startsWith('## ')
      );
      if (testStrategyEndIndex === -1) {
        testStrategyEndIndex = lines.length;
      }

      testStrategy = lines.slice(testStrategyStartIndex, testStrategyEndIndex).join('\n').trim();
    }

    // Extract subtasks
    const subtasks: Subtask[] = [];
    const subtasksStartIndex = lines.findIndex((line) => line === '## Subtasks') + 1;
    if (subtasksStartIndex > 0) {
      let currentSubtask: Partial<Subtask> | null = null;
      let currentSubtaskDetails = '';

      for (let i = subtasksStartIndex; i < lines.length; i++) {
        const line = lines[i];

        // New subtask
        const subtaskMatch = line.match(/^### ([\d.]+): (.+)$/);
        if (subtaskMatch) {
          // Save the previous subtask if there is one
          if (
            currentSubtask &&
            currentSubtask.id &&
            currentSubtask.title &&
            currentSubtask.description
          ) {
            if (currentSubtaskDetails.trim()) {
              currentSubtask.details = currentSubtaskDetails.trim();
            }

            subtasks.push(currentSubtask as Subtask);
          }

          // Start a new subtask
          currentSubtask = {
            id: subtaskMatch[1],
            title: subtaskMatch[2],
            status: 'pending',
            description: '',
            dependencies: [],
          };
          currentSubtaskDetails = '';
          continue;
        }

        if (!currentSubtask) {
          continue;
        }

        // Subtask status
        const subtaskStatusMatch = line.match(/^\*\*Status:\*\* (.+)$/);
        if (subtaskStatusMatch) {
          currentSubtask.status = subtaskStatusMatch[1] as Subtask['status'];
          continue;
        }

        // Subtask dependencies
        const subtaskDependenciesMatch = line.match(/^\*\*Dependencies:\*\* (.+)$/);
        if (subtaskDependenciesMatch) {
          currentSubtask.dependencies = subtaskDependenciesMatch[1].split(', ');
          continue;
        }

        // Subtask details
        const subtaskDetailsMatch = line.match(/^\*\*Implementation Details:\*\*$/);
        if (subtaskDetailsMatch) {
          // The next lines until a blank line or a new section are the details
          let j = i + 1;
          while (j < lines.length && !lines[j].startsWith('###') && !lines[j].startsWith('**')) {
            currentSubtaskDetails += lines[j] + '\n';
            j++;
          }
          i = j - 1; // Skip the details lines
          continue;
        }

        // Subtask description (everything else)
        if (line.trim() && !line.startsWith('**')) {
          currentSubtask.description += line + '\n';
        }
      }

      // Save the last subtask if there is one
      if (
        currentSubtask &&
        currentSubtask.id &&
        currentSubtask.title &&
        currentSubtask.description
      ) {
        if (currentSubtaskDetails.trim()) {
          currentSubtask.details = currentSubtaskDetails.trim();
        }

        subtasks.push(currentSubtask as Subtask);
      }
    }

    // Create the task object
    const task: Task = {
      id,
      title,
      description,
      status,
      priority,
      dependencies,
      ...(details && { details }),
      ...(testStrategy && { testStrategy }),
      ...(subtasks.length > 0 && { subtasks }),
    };

    // Validate the task
    return taskSchema.parse(task);
  } catch (error) {
    throw new FileSystemError(
      `Error parsing task from markdown: ${(error as Error).message}`,
      ErrorCode.PARSING_ERROR,
      error
    );
  }
}

/**
 * Validate a task using Zod schema
 * @param task Task to validate
 * @returns Validated task
 * @throws FileSystemError if the task is invalid
 */
export function validateTask(task: Task): Task {
  try {
    return taskSchema.parse(task);
  } catch (error) {
    throw new FileSystemError(
      `Invalid task: ${(error as Error).message}`,
      ErrorCode.VALIDATION_ERROR,
      error
    );
  }
}

/**
 * Validate a subtask using Zod schema
 * @param subtask Subtask to validate
 * @returns Validated subtask
 * @throws FileSystemError if the subtask is invalid
 */
export function validateSubtask(subtask: Subtask): Subtask {
  try {
    return subtaskSchema.parse(subtask);
  } catch (error) {
    throw new FileSystemError(
      `Invalid subtask: ${(error as Error).message}`,
      ErrorCode.VALIDATION_ERROR,
      error
    );
  }
}

/**
 * Validate tasks data using Zod schema
 * @param tasksData Tasks data to validate
 * @returns Validated tasks data
 * @throws FileSystemError if the tasks data is invalid
 */
export function validateTasksData(tasksData: TasksData): TasksData {
  try {
    return tasksDataSchema.parse(tasksData);
  } catch (error) {
    throw new FileSystemError(
      `Invalid tasks data: ${(error as Error).message}`,
      ErrorCode.VALIDATION_ERROR,
      error
    );
  }
}

/**
 * Safely serializes data to a JSON string with error handling.
 * Handles circular references and special JavaScript values.
 *
 * @template T - The type of data to serialize
 * @param {T} data - Data to serialize to JSON
 * @param {z.ZodType<T>} [schema] - Optional Zod schema for validation
 * @param {boolean} [pretty=false] - Whether to pretty-print the output
 * @returns {string} JSON string representation of the data
 * @throws {ValidationError} If serialization fails or validation fails
 *
 * @example
 * ```ts
 * const json = safeStringify({ key: 'value' }, DataSchema, true);
 * ```
 */
export function safeStringify<T>(data: T, schema?: z.ZodType<T>, pretty = false): string {
  try {
    if (schema) {
      schema.parse(data);
    }
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Data validation failed: ${error.message}`,
        ErrorCode.VALIDATION_ERROR
      );
    }
    throw new ValidationError(
      `Failed to serialize data: ${(error as Error).message}`,
      ErrorCode.VALIDATION_ERROR
    );
  }
}

/**
 * Safely parses a JSON string to a typed object with validation.
 * Provides detailed error messages for invalid JSON or schema violations.
 *
 * @template T - The expected type of the parsed data
 * @param {string} jsonString - JSON string to parse
 * @param {z.ZodType<T>} [schema] - Optional Zod schema for validation
 * @returns {T} Parsed and validated data
 * @throws {ValidationError} If parsing fails or validation fails
 *
 * @example
 * ```ts
 * const data = safeParse<Config>('{"port": 3000}', ConfigSchema);
 * ```
 */
export function safeParse<T>(jsonString: string, schema?: z.ZodType<T>): T {
  try {
    const parsed = JSON.parse(jsonString) as T;
    if (schema) {
      return schema.parse(parsed);
    }
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Data validation failed: ${error.message}`,
        ErrorCode.VALIDATION_ERROR
      );
    }
    if (error instanceof SyntaxError) {
      throw new ValidationError(`Invalid JSON format: ${error.message}`, ErrorCode.INVALID_FORMAT);
    }
    throw new ValidationError(
      `Failed to parse data: ${(error as Error).message}`,
      ErrorCode.VALIDATION_ERROR
    );
  }
}

/**
 * Converts a value to a string representation safely.
 * Handles special cases like undefined, null, and objects.
 *
 * @param {unknown} value - Value to convert to string
 * @returns {string} String representation of the value
 * @throws {ValidationError} If the value cannot be converted to string
 *
 * @example
 * ```ts
 * const str = safeToString(someValue);
 * ```
 */
export function safeToString(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
  if (isPlainObject(value) || Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      throw new ValidationError(
        `Failed to convert object to string: ${(error as Error).message}`,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }
  return String(value);
}

/**
 * Checks if a value is a plain object (not null, array, or other types).
 * Used for type checking before serialization operations.
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if the value is a plain object
 *
 * @example
 * ```ts
 * if (isPlainObject(value)) {
 *   // Handle object case
 * }
 * ```
 */
export function isPlainObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  );
}

/**
 * Checks if a value is a valid JSON string.
 * Attempts to parse the string and returns true if successful.
 *
 * @param {string} value - String to check
 * @returns {boolean} True if the string is valid JSON
 *
 * @example
 * ```ts
 * if (isValidJson('{"key": "value"}')) {
 *   // Handle valid JSON
 * }
 * ```
 */
export function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
