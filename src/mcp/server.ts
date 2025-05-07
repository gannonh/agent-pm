import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Package.json interface
 */
interface PackageJson {
  version: string;
  name: string;
  [key: string]: unknown;
}

/**
 * Get the package version from package.json
 * @returns The version string from package.json
 */
function getPackageVersion(): string {
  try {
    // Get the directory of the current module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Navigate up to the root directory where package.json is located
    // src/mcp/server.ts -> src/mcp -> src -> root
    const packagePath = path.resolve(__dirname, '../..', 'package.json');

    logger.info(`Reading package.json from: ${packagePath}`);

    // Check if the file exists
    if (!fs.existsSync(packagePath)) {
      logger.error(`package.json not found at path: ${packagePath}`);
      return '0.1.0'; // Fallback version
    }

    // Read and parse the package.json file
    const fileContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(fileContent) as PackageJson;

    if (!packageJson.version) {
      logger.warn('Version not found in package.json, using fallback version');
      return '0.1.0';
    }

    logger.info(`Found package version: ${packageJson.version}`);
    return packageJson.version;
  } catch (error) {
    logger.error('Failed to read package version', error);
    return '0.1.0'; // Fallback version
  }
}

/**
 * AgentPM MCP Server class
 */
export class AgentPMMCPServer {
  private transport: StdioServerTransport | null = null;
  private server: McpServer;
  private version: string;

  /**
   * Creates a new AgentPM MCP Server
   */
  constructor() {
    this.version = getPackageVersion();
    logger.info(`Initializing AgentPM MCP Server v${this.version}`);

    this.server = new McpServer({
      name: 'AgentPM',
      version: this.version,
      capabilities: {
        resources: {
          subscribe: true,
          listChanged: true,
        },
        prompts: {
          listChanged: true,
        },
        serverInfo: {
          name: 'AgentPM',
          version: this.version,
        },
      },
    });
  }

  /**
   * Gets the McpServer instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Starts the server with the specified transport
   */
  async start(): Promise<void> {
    try {
      // Initialize transport
      this.transport = new StdioServerTransport();

      logger.info('AgentPM MCP Server starting...');
      await this.server.connect(this.transport);
      logger.info('AgentPM MCP Server started');
    } catch (error) {
      logger.error('Failed to start AgentPM MCP Server', error);
      throw error;
    }
  }

  /**
   * Stops the server and cleans up resources
   */
  async stop(): Promise<void> {
    try {
      logger.info('AgentPM MCP Server stopping...');

      // Clean up resources
      if (this.transport) {
        await this.server.close();
        this.transport = null;
      }

      logger.info('AgentPM MCP Server stopped');
    } catch (error) {
      logger.error('Failed to stop AgentPM MCP Server', error);
      throw error;
    }
  }
}
