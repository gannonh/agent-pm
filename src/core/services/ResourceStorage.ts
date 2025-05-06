/**
 * @fileoverview Resource storage service for MCP resources
 *
 * This service provides file system storage for MCP resources, including:
 * - Project briefs
 * - Interview states
 * - Recommendations
 *
 * Resources are stored as JSON files in a dedicated directory structure
 * under ARTIFACTS_DIR/resources/
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { acquireLock, releaseLock } from '../utils/lock.js';
import { ensureDirectoryExists } from '../utils/path.js';
import { findProjectRoot } from '../utils/path.js';
import { logger } from '../../mcp/utils/logger.js';
import { PROJECT_ROOT, ARTIFACTS_DIR } from '../../config.js';

/**
 * Base interface for all MCP resources
 */
export interface MCPResource {
  /** Unique identifier for the resource */
  id: string;
  /** Resource type (e.g., 'project-brief', 'interview-state') */
  type: string;
  /** When the resource was created */
  createdAt: string;
  /** When the resource was last updated */
  updatedAt: string;
  /** Resource version */
  version: string;
  /** Resource data */
  [key: string]: any;
}

/**
 * Options for resource storage operations
 */
export interface ResourceStorageOptions {
  /** Project root directory */
  projectRoot?: string;
  /** Base directory for resources (relative to project root) */
  resourcesDir?: string;
}

/**
 * Service for storing and retrieving MCP resources
 */
export class ResourceStorage {
  private projectRoot: string;
  private resourcesDir: string;
  private initialized: boolean = false;

  /**
   * Create a new ResourceStorage instance
   * @param options Storage options
   */
  constructor(options: ResourceStorageOptions = {}) {
    // Use the provided project root, or fall back to the environment variable
    this.projectRoot = options.projectRoot || PROJECT_ROOT;
    this.resourcesDir = options.resourcesDir || path.join(ARTIFACTS_DIR, 'resources');
    this.initialized = false;
  }

  /**
   * Initialize the resource storage
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.projectRoot) {
      logger.debug('No project root provided, attempting to find it');
      this.projectRoot = await findProjectRoot();
    }

    logger.debug('Using project root:', { projectRoot: this.projectRoot });

    const resourcesPath = path.join(this.projectRoot, this.resourcesDir);
    await ensureDirectoryExists(resourcesPath);

    // Create subdirectories for each resource type
    const resourceTypes = ['project-brief', 'interview-state'];
    for (const type of resourceTypes) {
      await ensureDirectoryExists(path.join(resourcesPath, type));
    }

    this.initialized = true;
  }

  /**
   * Get the full path to a resource file
   * @param type Resource type
   * @param id Resource ID
   * @returns Full path to the resource file
   */
  private getResourcePath(type: string, id: string): string {
    return path.join(this.projectRoot, this.resourcesDir, type, `${id}.json`);
  }

  /**
   * Parse a resource URI to extract type and ID
   * @param uri Resource URI (e.g., 'project-brief://123')
   * @returns Object with type and id
   */
  parseResourceUri(uri: string): { type: string; id: string } {
    // URI format: type://id
    const match = uri.match(/^([^:]+):\/\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    return {
      type: match[1],
      id: match[2],
    };
  }

  /**
   * Create a resource URI from type and ID
   * @param type Resource type
   * @param id Resource ID
   * @returns Resource URI
   */
  createResourceUri(type: string, id: string): string {
    return `${type}://${id}`;
  }

  /**
   * Save a resource to storage
   * @param resource Resource to save
   * @returns Promise that resolves when the resource is saved
   */
  async saveResource(resource: MCPResource): Promise<void> {
    await this.initialize();

    const { type, id } = resource;
    const resourcePath = this.getResourcePath(type, id);
    const lockPath = `${resourcePath}.lock`;

    try {
      await acquireLock(lockPath);

      // Update timestamps
      resource.updatedAt = new Date().toISOString();

      // Write to a temporary file first to ensure atomic operation
      const tempPath = `${resourcePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(resource, null, 2));

      // Rename the temporary file to the actual file
      await fs.rename(tempPath, resourcePath);
    } finally {
      await releaseLock(lockPath);
    }
  }

  /**
   * Load a resource from storage
   * @param uri Resource URI
   * @returns Promise that resolves with the loaded resource
   */
  async loadResource<T extends MCPResource>(uri: string): Promise<T> {
    await this.initialize();

    const { type, id } = this.parseResourceUri(uri);
    const resourcePath = this.getResourcePath(type, id);
    const lockPath = `${resourcePath}.lock`;

    try {
      await acquireLock(lockPath);

      const data = await fs.readFile(resourcePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        throw new Error(`Resource not found: ${uri}`);
      }
      throw error;
    } finally {
      await releaseLock(lockPath);
    }
  }

  /**
   * Check if a resource exists
   * @param uri Resource URI
   * @returns Promise that resolves with true if the resource exists
   */
  async resourceExists(uri: string): Promise<boolean> {
    await this.initialize();

    const { type, id } = this.parseResourceUri(uri);
    const resourcePath = this.getResourcePath(type, id);

    try {
      await fs.access(resourcePath);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Delete a resource from storage
   * @param uri Resource URI
   * @returns Promise that resolves when the resource is deleted
   */
  async deleteResource(uri: string): Promise<void> {
    await this.initialize();

    const { type, id } = this.parseResourceUri(uri);
    const resourcePath = this.getResourcePath(type, id);
    const lockPath = `${resourcePath}.lock`;

    try {
      await acquireLock(lockPath);

      await fs.unlink(resourcePath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        throw error;
      }
      // If the file doesn't exist, that's fine
    } finally {
      await releaseLock(lockPath);
    }
  }

  /**
   * List all resources of a specific type
   * @param type Resource type
   * @returns Promise that resolves with an array of resource URIs
   */
  async listResources(type: string): Promise<string[]> {
    await this.initialize();

    const typePath = path.join(this.projectRoot, this.resourcesDir, type);

    try {
      const files = await fs.readdir(typePath);

      // Filter for .json files and extract IDs
      return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          const id = path.basename(file, '.json');
          return this.createResourceUri(type, id);
        });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Create a new resource with a unique ID
   * @param type Resource type
   * @param data Resource data
   * @returns Promise that resolves with the created resource
   */
  async createResource<T extends Partial<MCPResource>>(
    type: string,
    data: T
  ): Promise<MCPResource & T> {
    const now = new Date().toISOString();
    const resource = {
      id: uuidv4(),
      type,
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      ...data,
    } as MCPResource & T;

    await this.saveResource(resource);
    return resource;
  }

  /**
   * Update an existing resource
   * @param uri Resource URI
   * @param data Updated resource data
   * @returns Promise that resolves with the updated resource
   */
  async updateResource<T extends Partial<MCPResource>>(uri: string, data: T): Promise<MCPResource> {
    const resource = await this.loadResource(uri);

    // Update the resource with new data
    const updatedResource = {
      ...resource,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // Don't allow changing the id, type, or createdAt
    updatedResource.id = resource.id;
    updatedResource.type = resource.type;
    updatedResource.createdAt = resource.createdAt;

    await this.saveResource(updatedResource);
    return updatedResource;
  }
}

// Export a singleton instance for convenience
export const resourceStorage = new ResourceStorage();
