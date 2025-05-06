/**
 * @fileoverview MCP tool for generating individual task files from tasks data.
 * This tool creates or updates markdown files for each task based on the current
 * artifacts.json file.
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readTasksFile, generateTaskFiles } from '../utils/file-utils.js';
import { schemas, validateParams, getProjectRoot } from '../validation/index.js';
import { handleError, MCPErrorResponse } from '../errors/handler.js';
import { create_success_payload } from '../utils/response.js';
import { MCPError } from '../errors/index.js';
import { ErrorCode } from '../../types/errors.js';
import Config, { ARTIFACTS_DIR, ARTIFACTS_FILE } from '../../config.js';

/**
 * Registers the generate tool with the MCP server.
 * This tool generates individual markdown files for each task based on the current
 * artifacts.json file.
 *
 * @param server - The MCP server instance to register the tool with
 *
 * The tool handles:
 * - Reading the tasks data from the artifacts.json file
 * - Generating markdown files for each task
 * - Handling errors and returning appropriate responses
 *
 * Parameters:
 * - projectRoot: Root directory of the project (required)
 * - file: Path to the tasks file (optional)
 * - output: Output directory for task files (optional, defaults to ARTIFACTS_DIR)
 */
export function registerGenerateTool(server: McpServer): void {
  // Define the schema for the generate tool parameters
  const generateSchema = z.object({
    projectRoot: schemas.projectRoot,
    file: schemas.file,
    output: z
      .string()
      .optional()
      .describe(`Output directory for task files (default: ${ARTIFACTS_DIR})`),
  });

  // Create a type for the parameters based on the schema
  type GenerateParams = z.infer<typeof generateSchema>;

  // Register the tool with the server
  server.tool(
    'apm_task_generate',
    `Generates individual task files in ${ARTIFACTS_DIR} directory based on ${ARTIFACTS_FILE}`,
    generateSchema.shape,
    async (
      params: GenerateParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters using our validation utilities
        const validatedParams = validateParams(params, generateSchema);
        const { projectRoot: rawProjectRoot, file, output: _output } = validatedParams;

        // Get the project root (from params or environment variable)
        const projectRoot = getProjectRoot(rawProjectRoot);

        // Read tasks from file
        const tasksData = await readTasksFile(projectRoot, file);
        if (!tasksData) {
          throw new MCPError('Tasks file not found or is empty', ErrorCode.NOT_FOUND);
        }

        // Generate task files
        const success = await generateTaskFiles(tasksData, projectRoot);
        if (!success) {
          throw new MCPError('Failed to generate task files', ErrorCode.FILE_WRITE_ERROR);
        }

        // Get the artifacts directory path
        const artifactsDir = Config.getArtifactsDir(projectRoot);

        // Return success response
        return create_success_payload(
          {
            success: true,
            taskCount: tasksData.tasks.length,
            artifactsDir,
            tasksPath: file || Config.getArtifactsFile(projectRoot),
          },
          `Generated ${tasksData.tasks.length} task files in ${artifactsDir}`,
          {
            context: {
              timestamp: new Date().toISOString(),
              taskCount: tasksData.tasks.length,
            },
          }
        );
      } catch (error) {
        // Handle errors
        return handleError(error, { toolName: 'apm_task_generate', params });
      }
    }
  );
}
