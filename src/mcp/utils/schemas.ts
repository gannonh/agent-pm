/**
 * @fileoverview Common schema definitions for MCP tools.
 * @deprecated Use src/mcp/validation/index.ts instead.
 */
import { schemas as validationSchemas } from '../validation/index.js';

/**
 * Common schema definitions for MCP tools
 * @deprecated Use src/mcp/validation/index.ts instead
 */
export const schemas = {
  /**
   * Project root directory path
   */
  projectRoot: validationSchemas.projectRoot,

  /**
   * Optional file path (relative or absolute)
   */
  file: validationSchemas.file,

  /**
   * Optional task status filter
   */
  status: validationSchemas.status,

  /**
   * Optional flag to include subtasks
   */
  withSubtasks: validationSchemas.withSubtasks,
};
