/**
 * @fileoverview Validation utilities for MCP tools.
 * Provides common Zod schemas and validation functions for MCP tool parameters.
 */
import { z } from 'zod';
import path from 'path';
import { MCPValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { PROJECT_ROOT } from '../../config.js';

/**
 * Common schema definitions for MCP tools
 */
export const schemas = {
  /**
   * Project root directory path (optional if PROJECT_ROOT env var is set, must be absolute)
   * Using nullish() to handle null values from MCP Inspector
   */
  projectRoot: z
    .string({
      required_error:
        'Project root is required. Either provide it in the request or set the PROJECT_ROOT environment variable.',
      invalid_type_error: 'Project root must be a string',
    })
    .optional()
    .default(() => PROJECT_ROOT)
    .describe('The directory of the project. Can be set via PROJECT_ROOT environment variable.'),

  /**
   * Optional file path (relative or absolute)
   * Using optional() for better MCP Inspector compatibility
   */
  file: z
    .string()
    .optional()
    .default('')
    .describe('Path to the tasks file (relative to project root or absolute)'),

  /**
   * Task ID (required, non-empty string)
   */
  taskId: z
    .string()
    .min(1, 'Task ID is required')
    .describe("ID of the task or subtask (e.g., '15', '15.2')"),

  /**
   * Task status (enum of valid statuses)
   */
  taskStatus: z
    .preprocess(
      (val) => (val === null ? undefined : val),
      z.enum(['pending', 'in-progress', 'done', 'deferred', 'cancelled'])
    )
    .describe("Task status (e.g., 'pending', 'done', 'in-progress')"),

  /**
   * Task priority (enum of valid priorities)
   */
  taskPriority: z
    .preprocess(
      (val) => (val === null ? undefined : val),
      z.enum(['high', 'medium', 'low']).optional()
    )
    .describe('Task priority level'),

  /**
   * Optional task status filter
   * Using enum for better MCP Inspector compatibility
   */
  status: z
    .preprocess(
      (val) => (val === null ? undefined : val),
      z.enum(['pending', 'in-progress', 'done', 'deferred', 'cancelled', '']).optional()
    )
    .describe("Filter tasks by status (e.g., 'pending', 'done')"),

  /**
   * Optional flag to include subtasks
   * Using optional() for better MCP Inspector compatibility
   */
  withSubtasks: z
    .preprocess((val) => (val === null ? undefined : val), z.boolean().optional().default(false))
    .describe('Include subtasks in the response'),

  /**
   * Optional text filter
   * Using optional() for better MCP Inspector compatibility
   */
  containsText: z
    .preprocess((val) => (val === null ? undefined : val), z.string().optional().default(''))
    .describe('Filter tasks containing specific text in title or description'),

  /**
   * Operation ID for async operations
   */
  operationId: z.string().min(1, 'Operation ID is required').describe('The ID of the operation'),

  /**
   * Prompt text for AI operations
   */
  prompt: z.string().min(1, 'Prompt is required').describe('Text prompt for the operation'),

  /**
   * Boolean flag for research-backed operations
   * Using preprocess to handle null values from MCP Inspector
   */
  research: z
    .preprocess((val) => (val === null ? undefined : val), z.boolean().optional().default(false))
    .describe('Use Perplexity AI for research-backed updates'),

  /**
   * Boolean flag to indicate research-only mode (no task update)
   * Using preprocess to handle null values from MCP Inspector
   */
  researchOnly: z
    .preprocess((val) => (val === null ? undefined : val), z.boolean().optional().default(false))
    .describe('Only perform research and return results without updating the task'),

  /**
   * Number of items to generate
   * Using nullish() to handle null values from MCP Inspector
   */
  num: z.number().int().positive().nullish().describe('Number of items to generate'),

  /**
   * Force flag for operations that might overwrite existing data
   * Using nullish() to handle null values from MCP Inspector
   */
  force: z
    .boolean()
    .nullish()
    .default(false)
    .describe('Force the operation even if it would overwrite existing data'),

  /**
   * Skip generate flag for operations that would normally regenerate files
   * Using nullish() to handle null values from MCP Inspector
   */
  skipGenerate: z
    .boolean()
    .nullish()
    .default(false)
    .describe('Skip regenerating files after the operation'),

  /**
   * Comma-separated list of task IDs
   * Using nullish() to handle null values from MCP Inspector
   */
  dependencies: z
    .string()
    .nullish()
    .default('')
    .describe('Comma-separated list of task IDs this task depends on'),

  /**
   * Task title
   * Using nullish() to handle null values from MCP Inspector
   */
  title: z.string().min(1, 'Title is required').nullish().describe('Task title'),

  /**
   * Task description
   * Using nullish() to handle null values from MCP Inspector
   */
  description: z.string().min(1, 'Description is required').nullish().describe('Task description'),

  /**
   * Task implementation details
   * Using nullish() to handle null values from MCP Inspector
   */
  details: z.string().nullish().default('').describe('Implementation details'),

  /**
   * Task test strategy
   * Using nullish() to handle null values from MCP Inspector
   */
  testStrategy: z.string().nullish().default('').describe('Test strategy'),
};

/**
 * Validates parameters against a Zod schema
 * @param params Parameters to validate
 * @param schema Zod schema to validate against
 * @returns Validated parameters
 * @throws MCPValidationError if validation fails
 */
export function validateParams<T>(params: unknown, schema: z.ZodType<T>): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MCPValidationError('Invalid parameters', formatZodError(error));
    }
    throw error;
  }
}

/**
 * Formats a Zod validation error into a more readable format
 * @param error Zod validation error
 * @returns Formatted validation error
 */
export function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {};

  for (const issue of error.errors) {
    const path = issue.path.join('.');
    const key = path || '_';

    if (!formattedErrors[key]) {
      formattedErrors[key] = [];
    }

    formattedErrors[key].push(issue.message);
  }

  return formattedErrors;
}

/**
 * Creates a Zod schema for a task ID or comma-separated list of task IDs
 * @param description Schema description
 * @param isRequired Whether the parameter is required
 * @returns Zod schema for task ID(s)
 */
export function createTaskIdSchema(description: string, isRequired = true): z.ZodType {
  const schema = z.string().min(1, 'Task ID is required').describe(description);

  // Use nullish() to handle null values from MCP Inspector
  return isRequired ? schema : schema.nullish();
}

/**
 * Validates that a path exists and is absolute
 * @param value Path to validate
 * @param context Validation context
 * @returns True if the path is valid
 */
export function validatePath(value: string, context?: z.RefinementCtx): boolean {
  if (!value) {
    context?.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Path is required',
    });
    return false;
  }

  if (!path.isAbsolute(value)) {
    context?.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Path must be absolute',
    });
    return false;
  }

  return true;
}

/**
 * Validates a task ID format
 * @param id Task ID to validate
 * @param allowSubtasks Whether to allow subtask IDs (e.g., '1.2')
 * @returns True if the ID is valid
 */
export function isValidTaskId(id: string, allowSubtasks = true): boolean {
  if (!id) return false;

  // Regular task ID (numeric)
  if (/^\d+$/.test(id)) return true;

  // Subtask ID (parent.subtask format)
  if (allowSubtasks && /^\d+\.\d+$/.test(id)) return true;

  return false;
}

/**
 * Parses a comma-separated list of task IDs
 * @param ids Comma-separated list of task IDs
 * @returns Array of task IDs
 */
export function parseTaskIds(ids: string): string[] {
  if (!ids) return [];
  return ids
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id);
}

/**
 * Creates a schema for validating a file path
 * @param description Schema description
 * @param isRequired Whether the parameter is required
 * @returns Zod schema for file path
 */
export function createFilePathSchema(description: string, isRequired = true): z.ZodType {
  const schema = z.string().min(1, 'File path is required').describe(description);

  // Use nullish() to handle null values from MCP Inspector
  return isRequired ? schema : schema.nullish();
}

/**
 * Removes quotes from a string if present
 * @param str String that might have quotes
 * @returns String without quotes
 */
function removeQuotes(str: string): string {
  if (!str) return str;

  // Remove both single and double quotes if they wrap the entire string
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.substring(1, str.length - 1);
  }

  return str;
}

/**
 * Gets the project root from the request parameters or environment variable
 * @param projectRoot Project root from request parameters (can be string, null, or undefined)
 * @returns Project root directory path
 * @throws Error if project root is not provided and environment variable is not set
 */
export function getProjectRoot(projectRoot?: string | null): string {
  // Use the provided value or fall back to the environment variable
  let envProjectRoot = PROJECT_ROOT;

  // Remove quotes from environment variable if present
  envProjectRoot = removeQuotes(envProjectRoot);

  logger.debug('Environment PROJECT_ROOT:', { envProjectRoot });

  // Handle null values from MCP Inspector and remove quotes if present
  let providedRoot = projectRoot !== null ? projectRoot : undefined;
  if (providedRoot) {
    providedRoot = removeQuotes(providedRoot);
  }

  const root = providedRoot || envProjectRoot || '';

  logger.debug('Using project root:', {
    providedRoot,
    envRoot: envProjectRoot,
    finalRoot: root,
  });

  if (!root) {
    throw new MCPValidationError('Project root is required', {
      projectRoot: [
        'Either provide it in the request or set the PROJECT_ROOT environment variable.',
      ],
    });
  }

  if (!path.isAbsolute(root)) {
    throw new MCPValidationError('Invalid project root', {
      projectRoot: ['Project root must be an absolute path'],
    });
  }

  return root;
}
