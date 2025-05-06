/**
 * @fileoverview Tests for the core utils index module
 */

import { describe, it, expect } from 'vitest';

// Import the module under test
import * as utils from '../index.js';

describe('Core Utils Index', () => {
  it('should export file system utilities', () => {
    expect(utils.readJsonFile).toBeDefined();
    expect(utils.writeJsonFile).toBeDefined();
    expect(utils.fileExists).toBeDefined();
    expect(utils.readTextFile).toBeDefined();
    expect(utils.writeTextFile).toBeDefined();
    expect(utils.deleteFile).toBeDefined();
    expect(utils.listFiles).toBeDefined();
    expect(utils.copyFile).toBeDefined();
    expect(utils.moveFile).toBeDefined();
  });

  it('should export path utilities', () => {
    expect(utils.ensureDirectoryExists).toBeDefined();
    expect(utils.findProjectRoot).toBeDefined();
    expect(utils.resolveProjectPath).toBeDefined();
    expect(utils.findTasksJsonPath).toBeDefined();
    expect(utils.findComplexityReportPath).toBeDefined();
    expect(utils.getTasksDirectoryPath).toBeDefined();
    expect(utils.getScriptsDirectoryPath).toBeDefined();
    expect(utils.getBackupDirectoryPath).toBeDefined();
    expect(utils.getTaskFilePath).toBeDefined();
    expect(utils.isPathWithinProject).toBeDefined();
    expect(utils.getRelativePathFromRoot).toBeDefined();
  });

  it('should export backup utilities', () => {
    expect(utils.createBackup).toBeDefined();
    expect(utils.restoreFromBackup).toBeDefined();
    expect(utils.listBackups).toBeDefined();
    expect(utils.cleanupBackups).toBeDefined();
  });

  it('should export lock utilities', () => {
    expect(utils.acquireLock).toBeDefined();
    expect(utils.releaseLock).toBeDefined();
    expect(utils.withFileLock).toBeDefined();
    expect(utils.cleanupLocks).toBeDefined();
  });

  it('should export serialization utilities', () => {
    expect(utils.serializeTaskToMarkdown).toBeDefined();
    expect(utils.parseTaskFromMarkdown).toBeDefined();
    expect(utils.validateTask).toBeDefined();
    expect(utils.validateSubtask).toBeDefined();
    expect(utils.validateTasksData).toBeDefined();
    expect(utils.safeStringify).toBeDefined();
    expect(utils.safeParse).toBeDefined();
    expect(utils.safeToString).toBeDefined();
    expect(utils.isPlainObject).toBeDefined();
    expect(utils.isValidJson).toBeDefined();
  });
});
