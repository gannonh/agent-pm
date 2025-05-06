import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import { Dirent } from 'fs';
import path from 'path';
import { z } from 'zod';
import { FileSystemError, ErrorCode } from '../../../types/errors.js';

// Mock dependencies before importing the module under test
vi.mock('fs/promises');
vi.mock('path');
vi.mock('../../../core/utils/path.js', () => ({
  ensureDirectoryExists: vi.fn().mockResolvedValue(undefined),
}));

// Import the module under test after mocking dependencies
import {
  readJsonFile,
  writeJsonFile,
  fileExists,
  readTextFile,
  writeTextFile,
  deleteFile,
  listFiles,
  copyFile,
  moveFile,
} from '../fs.js';
import { ensureDirectoryExists } from '../path.js';

describe('File System Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('readJsonFile', () => {
    it('should read and parse a JSON file successfully', async () => {
      const mockData = { key: 'value' };
      const mockPath = '/path/to/file.json';

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));

      const result = await readJsonFile(mockPath);

      expect(fs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
      expect(result).toEqual(mockData);
    });

    it('should validate JSON data with a provided schema', async () => {
      const mockData = { name: 'Test', age: 30 };
      const mockPath = '/path/to/file.json';
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));

      const result = await readJsonFile(mockPath, schema);

      expect(result).toEqual(mockData);
    });

    it('should throw a validation error if data does not match schema', async () => {
      const mockData = { name: 'Test', age: 'thirty' }; // age should be a number
      const mockPath = '/path/to/file.json';
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));

      await expect(readJsonFile(mockPath, schema)).rejects.toThrow(FileSystemError);
      await expect(readJsonFile(mockPath, schema)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it('should throw a FileSystemError with NOT_FOUND code when file does not exist', async () => {
      const mockPath = '/path/to/nonexistent.json';
      const error = new Error('File not found');
      Object.defineProperty(error, 'code', { value: 'ENOENT' });

      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(readJsonFile(mockPath)).rejects.toThrow(FileSystemError);
      await expect(readJsonFile(mockPath)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('should throw a FileSystemError with INVALID_FORMAT code for invalid JSON', async () => {
      const mockPath = '/path/to/invalid.json';
      const invalidJson = '{invalid: json}';

      vi.mocked(fs.readFile).mockResolvedValue(invalidJson);

      await expect(readJsonFile(mockPath)).rejects.toThrow(FileSystemError);
      await expect(readJsonFile(mockPath)).rejects.toMatchObject({
        code: ErrorCode.INVALID_FORMAT,
      });
    });

    it('should throw a FileSystemError with FILE_READ_ERROR code for other errors', async () => {
      const mockPath = '/path/to/file.json';
      const error = new Error('Permission denied');

      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(readJsonFile(mockPath)).rejects.toThrow(FileSystemError);
      await expect(readJsonFile(mockPath)).rejects.toMatchObject({
        code: ErrorCode.FILE_READ_ERROR,
      });
    });
  });

  describe('writeJsonFile', () => {
    it('should write JSON data to a file successfully', async () => {
      const mockData = { key: 'value' };
      const mockPath = '/path/to/file.json';

      vi.mocked(path.dirname).mockReturnValue('/path/to');

      await writeJsonFile(mockPath, mockData);

      expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to');
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockPath,
        JSON.stringify(mockData, null, 2),
        'utf-8'
      );
    });

    it('should write non-pretty JSON when pretty=false', async () => {
      const mockData = { key: 'value' };
      const mockPath = '/path/to/file.json';

      vi.mocked(path.dirname).mockReturnValue('/path/to');

      await writeJsonFile(mockPath, mockData, undefined, false);

      expect(fs.writeFile).toHaveBeenCalledWith(mockPath, JSON.stringify(mockData), 'utf-8');
    });

    it('should validate data with a provided schema before writing', async () => {
      const mockData = { name: 'Test', age: 30 };
      const mockPath = '/path/to/file.json';
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      vi.mocked(path.dirname).mockReturnValue('/path/to');

      await writeJsonFile(mockPath, mockData, schema);

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw a validation error if data does not match schema', async () => {
      const mockData = { name: 'Test', age: 'thirty' }; // age should be a string
      const mockPath = '/path/to/file.json';
      // Create a schema that expects age to be a number to cause validation error
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      // Mock the schema.parse method to throw a ZodError
      const mockZodError = new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'number',
          received: 'string',
          path: ['age'],
          message: 'Expected number, received string',
        },
      ]);
      const schemaParseSpy = vi.spyOn(schema, 'parse').mockImplementation(() => {
        throw mockZodError;
      });

      await expect(
        writeJsonFile(mockPath, mockData, schema as unknown as z.ZodType<typeof mockData>)
      ).rejects.toThrow(FileSystemError);
      await expect(
        writeJsonFile(mockPath, mockData, schema as unknown as z.ZodType<typeof mockData>)
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });

      expect(fs.writeFile).not.toHaveBeenCalled();

      // Restore the original implementation
      schemaParseSpy.mockRestore();
    });

    it('should throw a FileSystemError with FILE_WRITE_ERROR code for write errors', async () => {
      const mockData = { key: 'value' };
      const mockPath = '/path/to/file.json';
      const error = new Error('Permission denied');

      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.writeFile).mockRejectedValue(error);

      await expect(writeJsonFile(mockPath, mockData)).rejects.toThrow(FileSystemError);
      await expect(writeJsonFile(mockPath, mockData)).rejects.toMatchObject({
        code: ErrorCode.FILE_WRITE_ERROR,
      });
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      const mockPath = '/path/to/existing.file';

      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await fileExists(mockPath);

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(mockPath);
    });

    it('should return false when file does not exist', async () => {
      const mockPath = '/path/to/nonexistent.file';

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const result = await fileExists(mockPath);

      expect(result).toBe(false);
      expect(fs.access).toHaveBeenCalledWith(mockPath);
    });
  });

  describe('readTextFile', () => {
    it('should read a text file successfully', async () => {
      const mockContent = 'File content';
      const mockPath = '/path/to/file.txt';

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await readTextFile(mockPath);

      expect(result).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should throw a FileSystemError with NOT_FOUND code when file does not exist', async () => {
      const mockPath = '/path/to/nonexistent.txt';
      const error = new Error('File not found');
      Object.defineProperty(error, 'code', { value: 'ENOENT' });

      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(readTextFile(mockPath)).rejects.toThrow(FileSystemError);
      await expect(readTextFile(mockPath)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('should throw a FileSystemError with FILE_READ_ERROR code for other errors', async () => {
      const mockPath = '/path/to/file.txt';
      const error = new Error('Permission denied');

      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(readTextFile(mockPath)).rejects.toThrow(FileSystemError);
      await expect(readTextFile(mockPath)).rejects.toMatchObject({
        code: ErrorCode.FILE_READ_ERROR,
      });
    });
  });

  describe('writeTextFile', () => {
    it('should write text content to a file successfully', async () => {
      const mockContent = 'File content';
      const mockPath = '/path/to/file.txt';

      vi.mocked(path.dirname).mockReturnValue('/path/to');

      await writeTextFile(mockPath, mockContent);

      expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to');
      expect(fs.writeFile).toHaveBeenCalledWith(mockPath, mockContent, 'utf-8');
    });

    it('should throw a FileSystemError with FILE_WRITE_ERROR code for write errors', async () => {
      const mockContent = 'File content';
      const mockPath = '/path/to/file.txt';
      const error = new Error('Permission denied');

      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.writeFile).mockRejectedValue(error);

      await expect(writeTextFile(mockPath, mockContent)).rejects.toThrow(FileSystemError);
      await expect(writeTextFile(mockPath, mockContent)).rejects.toMatchObject({
        code: ErrorCode.FILE_WRITE_ERROR,
      });
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      const mockPath = '/path/to/file.txt';

      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await deleteFile(mockPath);

      expect(fs.unlink).toHaveBeenCalledWith(mockPath);
    });

    it('should succeed silently when file does not exist', async () => {
      const mockPath = '/path/to/nonexistent.txt';
      const error = new Error('File not found');
      Object.defineProperty(error, 'code', { value: 'ENOENT' });

      vi.mocked(fs.unlink).mockRejectedValue(error);

      await expect(deleteFile(mockPath)).resolves.toBeUndefined();
    });

    it('should throw a FileSystemError with FILE_DELETE_ERROR code for other errors', async () => {
      const mockPath = '/path/to/file.txt';
      const error = new Error('Permission denied');

      vi.mocked(fs.unlink).mockRejectedValue(error);

      await expect(deleteFile(mockPath)).rejects.toThrow(FileSystemError);
      await expect(deleteFile(mockPath)).rejects.toMatchObject({
        code: ErrorCode.FILE_DELETE_ERROR,
      });
    });
  });

  describe('listFiles', () => {
    it('should list all files in a directory', async () => {
      const mockDirPath = '/path/to/dir';
      const mockEntries = [
        { name: 'file1.txt', isFile: () => true },
        { name: 'file2.txt', isFile: () => true },
        { name: 'subdir', isFile: () => false },
      ];

      // Create a mock implementation that returns the expected type
      vi.mocked(fs.readdir).mockImplementation(() => {
        // Create mock Dirent objects with the required methods
        const mockDirents = mockEntries.map((entry) => ({
          name: entry.name,
          isFile: entry.isFile,
          isDirectory: () => !entry.isFile(),
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        }));
        return Promise.resolve(mockDirents as unknown as Dirent[]);
      });
      vi.mocked(path.join).mockImplementation((dir, file) => `${dir}/${file}`);

      const result = await listFiles(mockDirPath);

      expect(result).toEqual(['/path/to/dir/file1.txt', '/path/to/dir/file2.txt']);
      expect(fs.readdir).toHaveBeenCalledWith(mockDirPath, { withFileTypes: true });
    });

    it('should filter files by pattern', async () => {
      const mockDirPath = '/path/to/dir';
      const mockEntries = [
        { name: 'file1.txt', isFile: () => true },
        { name: 'file2.json', isFile: () => true },
        { name: 'file3.txt', isFile: () => true },
        { name: 'subdir', isFile: () => false },
      ];

      // Create a mock implementation that returns the expected type
      vi.mocked(fs.readdir).mockImplementation(() => {
        // Create mock Dirent objects with the required methods
        const mockDirents = mockEntries.map((entry) => ({
          name: entry.name,
          isFile: entry.isFile,
          isDirectory: () => !entry.isFile(),
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        }));
        return Promise.resolve(mockDirents as unknown as Dirent[]);
      });
      vi.mocked(path.join).mockImplementation((dir, file) => `${dir}/${file}`);
      vi.mocked(path.basename).mockImplementation((filePath) => filePath.split('/').pop() || '');

      const result = await listFiles(mockDirPath, '*.json');

      expect(result).toEqual(['/path/to/dir/file2.json']);
    });

    it('should throw a FileSystemError with NOT_FOUND code when directory does not exist', async () => {
      const mockDirPath = '/path/to/nonexistent';
      const error = new Error('Directory not found');
      Object.defineProperty(error, 'code', { value: 'ENOENT' });

      vi.mocked(fs.readdir).mockRejectedValue(error);

      await expect(listFiles(mockDirPath)).rejects.toThrow(FileSystemError);
      await expect(listFiles(mockDirPath)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('should throw a FileSystemError with DIRECTORY_READ_ERROR code for other errors', async () => {
      const mockDirPath = '/path/to/dir';
      const error = new Error('Permission denied');

      vi.mocked(fs.readdir).mockRejectedValue(error);

      await expect(listFiles(mockDirPath)).rejects.toThrow(FileSystemError);
      await expect(listFiles(mockDirPath)).rejects.toMatchObject({
        code: ErrorCode.DIRECTORY_READ_ERROR,
      });
    });
  });

  describe('copyFile', () => {
    it('should copy a file successfully', async () => {
      const mockSourcePath = '/path/to/source.txt';
      const mockDestPath = '/path/to/dest.txt';

      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.copyFile).mockResolvedValue(undefined);

      await copyFile(mockSourcePath, mockDestPath);

      expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to');
      expect(fs.copyFile).toHaveBeenCalledWith(mockSourcePath, mockDestPath);
    });

    it('should throw a FileSystemError with NOT_FOUND code when source file does not exist', async () => {
      const mockSourcePath = '/path/to/nonexistent.txt';
      const mockDestPath = '/path/to/dest.txt';
      const error = new Error('File not found');
      Object.defineProperty(error, 'code', { value: 'ENOENT' });

      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.copyFile).mockRejectedValue(error);

      await expect(copyFile(mockSourcePath, mockDestPath)).rejects.toThrow(FileSystemError);
      await expect(copyFile(mockSourcePath, mockDestPath)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('should throw a FileSystemError with FILE_COPY_ERROR code for other errors', async () => {
      const mockSourcePath = '/path/to/source.txt';
      const mockDestPath = '/path/to/dest.txt';
      const error = new Error('Permission denied');

      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.copyFile).mockRejectedValue(error);

      await expect(copyFile(mockSourcePath, mockDestPath)).rejects.toThrow(FileSystemError);
      await expect(copyFile(mockSourcePath, mockDestPath)).rejects.toMatchObject({
        code: ErrorCode.FILE_COPY_ERROR,
      });
    });
  });

  describe('moveFile', () => {
    it('should move a file successfully', async () => {
      const mockSourcePath = '/path/to/source.txt';
      const mockDestPath = '/path/to/dest.txt';

      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await moveFile(mockSourcePath, mockDestPath);

      expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to');
      expect(fs.rename).toHaveBeenCalledWith(mockSourcePath, mockDestPath);
    });

    it('should throw a FileSystemError with NOT_FOUND code when source file does not exist', async () => {
      const mockSourcePath = '/path/to/nonexistent.txt';
      const mockDestPath = '/path/to/dest.txt';
      const error = new Error('File not found');
      Object.defineProperty(error, 'code', { value: 'ENOENT' });

      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.rename).mockRejectedValue(error);

      await expect(moveFile(mockSourcePath, mockDestPath)).rejects.toThrow(FileSystemError);
      await expect(moveFile(mockSourcePath, mockDestPath)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('should throw a FileSystemError with FILE_MOVE_ERROR code for other errors', async () => {
      const mockSourcePath = '/path/to/source.txt';
      const mockDestPath = '/path/to/dest.txt';
      const error = new Error('Permission denied');

      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.rename).mockRejectedValue(error);

      await expect(moveFile(mockSourcePath, mockDestPath)).rejects.toThrow(FileSystemError);
      await expect(moveFile(mockSourcePath, mockDestPath)).rejects.toMatchObject({
        code: ErrorCode.FILE_MOVE_ERROR,
      });
    });
  });
});
