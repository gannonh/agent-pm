/**
 * @fileoverview Tests for ResourceStorage service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import { ResourceStorage, MCPResource } from '../ResourceStorage.js';

// Mock dependencies
vi.mock('fs/promises', () => {
  // Create mock functions
  const mkdir = vi.fn().mockResolvedValue(undefined);
  const writeFile = vi.fn().mockResolvedValue(undefined);
  const readFile = vi.fn().mockImplementation(async (filePath: string) => {
    if (filePath.includes('existing-id')) {
      return JSON.stringify({
        id: 'existing-id',
        type: 'project-brief',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0.0',
        title: 'Existing Resource',
      });
    }
    throw Object.assign(new Error('File not found'), { code: 'ENOENT' });
  });
  const rename = vi.fn().mockResolvedValue(undefined);
  const unlink = vi.fn().mockResolvedValue(undefined);
  const readdir = vi
    .fn()
    .mockResolvedValue(['resource1.json', 'resource2.json', 'not-a-resource.txt']);
  const access = vi.fn().mockImplementation(async (filePath: string) => {
    if (filePath.includes('existing-id')) {
      return Promise.resolve();
    }
    throw Object.assign(new Error('File not found'), { code: 'ENOENT' });
  });

  // Create the mock object with all the functions
  const fsPromisesMock = {
    mkdir,
    writeFile,
    readFile,
    rename,
    unlink,
    readdir,
    access,
    default: {
      mkdir,
      writeFile,
      readFile,
      rename,
      unlink,
      readdir,
      access,
    },
  };

  return fsPromisesMock;
});

vi.mock('../../utils/lock.js', () => ({
  acquireLock: vi.fn().mockResolvedValue(undefined),
  releaseLock: vi.fn().mockResolvedValue(undefined),
}));

// No need to mock fs.js since we're using path.js for ensureDirectoryExists

vi.mock('../../utils/path.js', () => ({
  findProjectRoot: vi.fn().mockResolvedValue('/mock/project/root'),
  ensureDirectoryExists: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid'),
}));

describe('ResourceStorage', () => {
  let storage: ResourceStorage;
  const mockProjectRoot = '/mock/project/root';

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new ResourceStorage({ projectRoot: mockProjectRoot });
  });

  describe('initialize', () => {
    it('should create resource directories if they do not exist', async () => {
      const { ensureDirectoryExists } = await import('../../utils/path.js');

      await storage.initialize();

      expect(ensureDirectoryExists).toHaveBeenCalledWith(
        path.join(mockProjectRoot, 'apm-artifacts/resources')
      );
      expect(ensureDirectoryExists).toHaveBeenCalledWith(
        path.join(mockProjectRoot, 'apm-artifacts/resources/project-brief')
      );
      expect(ensureDirectoryExists).toHaveBeenCalledWith(
        path.join(mockProjectRoot, 'apm-artifacts/resources/interview-state')
      );
    });

    it('should find project root if not provided', async () => {
      const { findProjectRoot } = await import('../../utils/path.js');

      storage = new ResourceStorage();
      await storage.initialize();

      expect(findProjectRoot).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      const { ensureDirectoryExists } = await import('../../utils/path.js');

      await storage.initialize();
      await storage.initialize();

      expect(ensureDirectoryExists).toHaveBeenCalledTimes(3); // Base dir + 2 resource types
    });
  });

  describe('URI handling', () => {
    it('should parse resource URIs correctly', () => {
      const result = storage.parseResourceUri('project-brief://123');

      expect(result).toEqual({
        type: 'project-brief',
        id: '123',
      });
    });

    it('should throw an error for invalid URIs', () => {
      expect(() => storage.parseResourceUri('invalid-uri')).toThrow('Invalid resource URI');
    });

    it('should create resource URIs correctly', () => {
      const uri = storage.createResourceUri('project-brief', '123');

      expect(uri).toBe('project-brief://123');
    });
  });

  describe('saveResource', () => {
    it('should save a resource to the file system', async () => {
      const { acquireLock, releaseLock } = await import('../../utils/lock.js');
      const { writeFile, rename } = await import('fs/promises');

      const resource: MCPResource = {
        id: 'test-id',
        type: 'project-brief',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0.0',
        title: 'Test Resource',
      };

      await storage.saveResource(resource);

      const expectedPath = path.join(
        mockProjectRoot,
        'apm-artifacts/resources/project-brief/test-id.json'
      );

      expect(acquireLock).toHaveBeenCalledWith(`${expectedPath}.lock`);
      expect(writeFile).toHaveBeenCalledWith(`${expectedPath}.tmp`, expect.any(String));
      expect(rename).toHaveBeenCalledWith(`${expectedPath}.tmp`, expectedPath);
      expect(releaseLock).toHaveBeenCalledWith(`${expectedPath}.lock`);
    });

    it('should update the updatedAt timestamp', async () => {
      const { writeFile } = await import('fs/promises');

      const resource: MCPResource = {
        id: 'test-id',
        type: 'project-brief',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0.0',
        title: 'Test Resource',
      };

      // Mock Date.now
      const originalDate = Date;
      const mockDate = new Date('2023-02-01T00:00:00.000Z');
      global.Date = class extends Date {
        constructor() {
          super();
          return mockDate;
        }
        static now() {
          return mockDate.getTime();
        }
        toISOString() {
          return mockDate.toISOString();
        }
      } as any;

      await storage.saveResource(resource);

      // Restore Date
      global.Date = originalDate;

      // Verify that writeFile was called with a string containing the updated timestamp
      expect(writeFile).toHaveBeenCalled();

      // Get the arguments from the mock function
      const mockWriteFile = writeFile as ReturnType<typeof vi.fn>;
      const writeFileArgs = mockWriteFile.mock.calls[0];

      // Parse the JSON string to verify the updatedAt field
      const writtenData = JSON.parse(writeFileArgs[1]);
      expect(writtenData.updatedAt).toBe('2023-02-01T00:00:00.000Z');
    });
  });

  describe('loadResource', () => {
    it('should load a resource from the file system', async () => {
      const { acquireLock, releaseLock } = await import('../../utils/lock.js');
      const { readFile } = await import('fs/promises');

      const uri = 'project-brief://existing-id';
      const result = await storage.loadResource(uri);

      const expectedPath = path.join(
        mockProjectRoot,
        'apm-artifacts/resources/project-brief/existing-id.json'
      );

      expect(acquireLock).toHaveBeenCalledWith(`${expectedPath}.lock`);
      expect(readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(releaseLock).toHaveBeenCalledWith(`${expectedPath}.lock`);
      expect(result).toEqual({
        id: 'existing-id',
        type: 'project-brief',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0.0',
        title: 'Existing Resource',
      });
    });

    it('should throw an error if the resource does not exist', async () => {
      const uri = 'project-brief://non-existent-id';

      await expect(storage.loadResource(uri)).rejects.toThrow('Resource not found');
    });
  });

  describe('resourceExists', () => {
    it('should return true if the resource exists', async () => {
      const uri = 'project-brief://existing-id';
      const result = await storage.resourceExists(uri);

      expect(result).toBe(true);
    });

    it('should return false if the resource does not exist', async () => {
      const uri = 'project-brief://non-existent-id';
      const result = await storage.resourceExists(uri);

      expect(result).toBe(false);
    });
  });

  describe('deleteResource', () => {
    it('should delete a resource from the file system', async () => {
      const { acquireLock, releaseLock } = await import('../../utils/lock.js');
      const { unlink } = await import('fs/promises');

      const uri = 'project-brief://existing-id';
      await storage.deleteResource(uri);

      const expectedPath = path.join(
        mockProjectRoot,
        'apm-artifacts/resources/project-brief/existing-id.json'
      );

      expect(acquireLock).toHaveBeenCalledWith(`${expectedPath}.lock`);
      expect(unlink).toHaveBeenCalledWith(expectedPath);
      expect(releaseLock).toHaveBeenCalledWith(`${expectedPath}.lock`);
    });

    it('should not throw an error if the resource does not exist', async () => {
      const { unlink } = await import('fs/promises');
      (unlink as any).mockRejectedValueOnce(
        Object.assign(new Error('File not found'), { code: 'ENOENT' })
      );

      const uri = 'project-brief://non-existent-id';

      await expect(storage.deleteResource(uri)).resolves.not.toThrow();
    });
  });

  describe('listResources', () => {
    it('should list all resources of a specific type', async () => {
      const { readdir } = await import('fs/promises');

      const result = await storage.listResources('project-brief');

      const expectedPath = path.join(mockProjectRoot, 'apm-artifacts/resources/project-brief');

      expect(readdir).toHaveBeenCalledWith(expectedPath);
      expect(result).toEqual(['project-brief://resource1', 'project-brief://resource2']);
    });

    it('should return an empty array if the directory does not exist', async () => {
      const { readdir } = await import('fs/promises');
      (readdir as any).mockRejectedValueOnce(
        Object.assign(new Error('Directory not found'), { code: 'ENOENT' })
      );

      const result = await storage.listResources('non-existent-type');

      expect(result).toEqual([]);
    });
  });

  describe('createResource', () => {
    it('should create a new resource with a unique ID', async () => {
      const data = {
        type: 'project-brief',
        title: 'New Resource',
      };

      const result = await storage.createResource('project-brief', data);

      expect(result).toEqual({
        id: 'mock-uuid',
        type: 'project-brief',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        version: '1.0.0',
        title: 'New Resource',
      });
    });
  });

  describe('updateResource', () => {
    it('should update an existing resource', async () => {
      const uri = 'project-brief://existing-id';
      const data = {
        title: 'Updated Resource',
      };

      const result = await storage.updateResource(uri, data);

      expect(result).toEqual({
        id: 'existing-id',
        type: 'project-brief',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: expect.any(String),
        version: '1.0.0',
        title: 'Updated Resource',
      });
    });

    it('should not allow changing id, type, or createdAt', async () => {
      const uri = 'project-brief://existing-id';
      const data = {
        id: 'new-id',
        type: 'new-type',
        createdAt: '2023-02-01T00:00:00.000Z',
        title: 'Updated Resource',
      };

      const result = await storage.updateResource(uri, data);

      expect(result).toEqual({
        id: 'existing-id', // Should not change
        type: 'project-brief', // Should not change
        createdAt: '2023-01-01T00:00:00.000Z', // Should not change
        updatedAt: expect.any(String),
        version: '1.0.0',
        title: 'Updated Resource',
      });
    });
  });
});
