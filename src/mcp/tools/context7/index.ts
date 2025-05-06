/**
 * @fileoverview Context7 documentation retrieval tools for AgentPM.
 * These tools allow retrieving up-to-date documentation for libraries and technologies.
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchLibraries, fetchLibraryDocumentation } from '../../../context7/lib/api.js';
import { formatSearchResults } from '../../../context7/lib/utils.js';
import { logger } from '../../utils/logger.js';
import { handleError } from '../../errors/handler.js';

const DEFAULT_MINIMUM_TOKENS = 5000;

/**
 * Registers Context7 documentation tools with the MCP server
 */
export function registerContext7Tools(server: McpServer): void {
  logger.info('Registering Context7 documentation tools...');

  // Register resolve-library-id tool
  server.tool(
    'context7_library_id',
    "Required first step: Resolves a general package name into a Context7-compatible library ID. Must be called before using 'context7_library_docs' to retrieve a valid Context7-compatible library ID.",
    {
      libraryName: z
        .string()
        .describe('Library name to search for and retrieve a Context7-compatible library ID.'),
    },
    async (params) => {
      try {
        const { libraryName } = params;

        logger.info(`Searching for library: ${libraryName}`);
        const searchResponse = await searchLibraries(libraryName);

        if (!searchResponse || !searchResponse.results) {
          logger.error('Failed to retrieve library documentation data from Context7');
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to retrieve library documentation data from Context7',
              },
            ],
          };
        }

        if (searchResponse.results.length === 0) {
          logger.info(`No documentation libraries found for: ${libraryName}`);
          return {
            content: [
              {
                type: 'text',
                text: 'No documentation libraries available',
              },
            ],
          };
        }

        const resultsText = formatSearchResults(searchResponse);
        logger.info(`Found ${searchResponse.results.length} libraries for: ${libraryName}`);

        return {
          content: [
            {
              type: 'text',
              text:
                'Available libraries and their Context7-compatible library IDs:\n\n' + resultsText,
            },
          ],
        };
      } catch (error) {
        return handleError(error, { toolName: 'context7_library_id', params });
      }
    }
  );

  // Register get-library-docs tool
  server.tool(
    'context7_library_docs',
    "Fetches up-to-date documentation for a library. You must call 'context7_library_id' first to obtain the exact Context7-compatible library ID required to use this tool.",
    {
      context7CompatibleLibraryID: z
        .string()
        .describe(
          "Exact Context7-compatible library ID (e.g., 'mongodb/docs', 'vercel/nextjs') retrieved from 'context7_library_id'."
        ),
      topic: z
        .string()
        .optional()
        .describe("Topic to focus documentation on (e.g., 'hooks', 'routing')."),
      tokens: z
        .number()
        .transform((val) => (val < DEFAULT_MINIMUM_TOKENS ? DEFAULT_MINIMUM_TOKENS : val))
        .optional()
        .describe(
          `Maximum number of tokens of documentation to retrieve (default: ${DEFAULT_MINIMUM_TOKENS}). Higher values provide more context but consume more tokens.`
        ),
    },
    async (params) => {
      try {
        const { context7CompatibleLibraryID, tokens = DEFAULT_MINIMUM_TOKENS, topic = '' } = params;

        logger.info(
          `Fetching documentation for: ${context7CompatibleLibraryID}, topic: ${topic || 'none'}, tokens: ${tokens}`
        );

        // Extract folders parameter if present in the ID
        let folders = '';
        let libraryId = context7CompatibleLibraryID;

        if (context7CompatibleLibraryID.includes('?folders=')) {
          const [id, foldersParam] = context7CompatibleLibraryID.split('?folders=');
          libraryId = id;
          folders = foldersParam;
        }

        const documentationText = await fetchLibraryDocumentation(libraryId, {
          tokens,
          topic,
          folders,
        });

        if (!documentationText) {
          logger.error(`Documentation not found for: ${context7CompatibleLibraryID}`);
          return {
            content: [
              {
                type: 'text',
                text: "Documentation not found or not finalized for this library. This might have happened because you used an invalid Context7-compatible library ID. To get a valid Context7-compatible library ID, use the 'context7_library_id' with the package name you wish to retrieve documentation for.",
              },
            ],
          };
        }

        logger.info(`Successfully retrieved documentation for: ${context7CompatibleLibraryID}`);
        return {
          content: [
            {
              type: 'text',
              text: documentationText,
            },
          ],
        };
      } catch (error) {
        return handleError(error, { toolName: 'context7_library_docs', params });
      }
    }
  );

  logger.info('Context7 documentation tools registered');
}
