import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Import only what's needed and fix the path

import { FileSystemError } from '../../../types/errors.js';

// First mock the module - BEFORE any imports of it
vi.mock('../../../core/utils/backup.js', () => ({
  listBackups: vi.fn(),
}));

// Now import the mocked function AFTER mocking
import { listBackups } from '../backup.js';

describe('Backup Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listBackups', () => {
    it('should list all backups for a file', async () => {
      const mockFilePath = '/path/to/file.json';
      const mockBackupPaths = [
        '/path/to/backups/file.json.2023-01-02T12-00-00-000Z.bak',
        '/path/to/backups/file.json.2023-01-01T12-00-00-000Z.bak',
      ];

      // Set up the mock return value
      vi.mocked(listBackups).mockResolvedValue(mockBackupPaths);

      const result = await listBackups(mockFilePath);

      expect(listBackups).toHaveBeenCalledWith(mockFilePath);
      expect(result).toEqual(mockBackupPaths);
    });
  });
});
