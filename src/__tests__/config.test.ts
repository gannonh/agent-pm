/**
 * @fileoverview Tests for the configuration module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

// Save original environment
const originalEnv = { ...process.env };

describe('Config', () => {
  // Import the module in each test to ensure clean state
  let Config: typeof import('../config.js').Config;

  beforeEach(async () => {
    // Reset modules before each test
    vi.resetModules();

    // Clear environment variables that might affect tests
    delete process.env.PROJECT_ROOT;
    delete process.env.APM_ARTIFACTS_DIR;
    delete process.env.APM_ARTIFACTS_FILE;

    // Import the module after resetting
    const configModule = await import('../config.js');
    Config = configModule.Config;
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = { ...originalEnv };
  });

  describe('getProjectRoot', () => {
    it('should return the provided project root', () => {
      const projectRoot = '/test/project';
      expect(Config.getProjectRoot(projectRoot)).toBe(projectRoot);
    });

    it('should return the PROJECT_ROOT environment variable if no project root is provided', () => {
      const projectRoot = '/env/project';
      process.env.PROJECT_ROOT = projectRoot;
      expect(Config.getProjectRoot()).toBe(projectRoot);
    });

    it('should return an empty string if no project root is provided and no environment variable is set', () => {
      expect(Config.getProjectRoot()).toBe('');
    });
  });

  describe('getArtifactsDir', () => {
    it('should return the artifacts directory path with the provided project root', () => {
      const projectRoot = '/test/project';
      expect(Config.getArtifactsDir(projectRoot)).toBe(path.join(projectRoot, 'apm-artifacts'));
    });

    it('should use the APM_ARTIFACTS_DIR environment variable if set', () => {
      const projectRoot = '/test/project';
      const artifactsDir = 'custom-artifacts';
      process.env.APM_ARTIFACTS_DIR = artifactsDir;
      expect(Config.getArtifactsDir(projectRoot)).toBe(path.join(projectRoot, artifactsDir));
    });
  });

  describe('getArtifactsFile', () => {
    it('should return the artifacts file path with the provided project root', () => {
      const projectRoot = '/test/project';
      expect(Config.getArtifactsFile(projectRoot)).toBe(
        path.join(projectRoot, 'apm-artifacts', 'artifacts.json')
      );
    });

    it('should use the ARTIFACTS_FILE environment variable if set', () => {
      const projectRoot = '/test/project';
      const artifactsFile = 'custom-artifacts.json';
      process.env.ARTIFACTS_FILE = artifactsFile;
      expect(Config.getArtifactsFile(projectRoot)).toBe(
        path.join(projectRoot, 'apm-artifacts', artifactsFile)
      );
    });
  });

  describe('getArtifactExtension', () => {
    it('should return .md', () => {
      expect(Config.getArtifactExtension()).toBe('.md');
    });
  });

  describe('getArtifactFilePath', () => {
    it('should return the correct path for a numeric artifact ID', () => {
      const projectRoot = '/test/project';
      expect(Config.getArtifactFilePath(1, projectRoot)).toBe(
        path.join(projectRoot, 'apm-artifacts', 'task_001.md')
      );
    });

    it('should return the correct path for a string artifact ID', () => {
      const projectRoot = '/test/project';
      expect(Config.getArtifactFilePath('2', projectRoot)).toBe(
        path.join(projectRoot, 'apm-artifacts', 'task_002.md')
      );
    });

    it('should pad the artifact ID with zeros', () => {
      const projectRoot = '/test/project';
      expect(Config.getArtifactFilePath(5, projectRoot)).toBe(
        path.join(projectRoot, 'apm-artifacts', 'task_005.md')
      );
    });
  });

  describe('getProductBriefFilePath', () => {
    it('should return the product brief file path', () => {
      const projectRoot = '/test/project';
      expect(Config.getProductBriefFilePath(projectRoot)).toBe(
        path.join(projectRoot, 'apm-artifacts', 'project-brief.md')
      );
    });
  });

  // Note: ensureArtifactsDir is not tested here because it requires mocking fs
  // This would be tested in a separate test file with proper fs mocking
});
