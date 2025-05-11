import { describe, it, expect } from 'vitest';
import {
  appConfigSchema as AppConfigSchema,
  aiModelConfigSchema as AIModelConfigSchema,
  fileSystemConfigSchema as FileSystemConfigSchema,
  mcpServerConfigSchema as MCPServerConfigSchema,
  AppConfig,
} from '../../../types/config.js';
import {
  APP_NAME,
  ARTIFACTS_DIR,
  ARTIFACTS_FILE,
  ANTHROPIC_TEMPERATURE,
  ANTHROPIC_MAX_TOKENS,
} from '../../../config.js';

// Create a test configuration object based on the constants from config.ts
const testConfig: AppConfig = {
  projectName: APP_NAME,
  projectVersion: '0.1.0', // Hardcoded version for testing
  defaultSubtasks: 5,
  defaultPriority: 'medium',
  ai: {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    apiKey: '',
    maxTokens: ANTHROPIC_MAX_TOKENS,
    temperature: ANTHROPIC_TEMPERATURE,
  },
  fileSystem: {
    tasksDir: ARTIFACTS_DIR,
    scriptsDir: 'scripts',
    tasksFile: `${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`,
    complexityReportFile: 'apm-artifacts/resources/reports/task-complexity-report.json',
    backupDir: 'backups',
    enableBackups: true,
  },
  mcpServer: {
    port: 3000,
    host: 'localhost',
    enableLogging: true,
    logLevel: 'info',
    sessionTimeout: 3600,
    maxConcurrentOperations: 5,
  },
  debug: false,
  project: {
    name: APP_NAME,
    version: '0.1.0', // Hardcoded version for testing
  },
};

describe('Configuration Types', () => {
  describe('AIModelConfigSchema', () => {
    it('should validate valid AI model configuration', () => {
      const validConfig = {
        provider: 'anthropic' as const,
        model: 'claude-3-opus-20240229',
        apiKey: 'sk-ant-api03-example',
        maxTokens: 4000,
        temperature: 0.7,
      };

      const result = AIModelConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should reject invalid provider', () => {
      const invalidConfig = {
        provider: 'invalid-provider',
        model: 'claude-3-opus-20240229',
        apiKey: 'sk-ant-api03-example',
        maxTokens: 4000,
        temperature: 0.7,
      };

      expect(() => AIModelConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid temperature', () => {
      const invalidConfig = {
        provider: 'anthropic' as const,
        model: 'claude-3-opus-20240229',
        apiKey: 'sk-ant-api03-example',
        maxTokens: 4000,
        temperature: 1.5, // Temperature must be between 0 and 1
      };

      expect(() => AIModelConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('FileSystemConfigSchema', () => {
    it('should validate valid file system configuration', () => {
      const validConfig = {
        tasksDir: 'tasks',
        scriptsDir: 'scripts',
        tasksFile: 'tasks/tasks.json',
        complexityReportFile: 'scripts/task-complexity-report.json',
        backupDir: 'backups',
        enableBackups: true,
      };

      const result = FileSystemConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should reject missing required fields', () => {
      const invalidConfig = {
        tasksDir: 'tasks',
        scriptsDir: 'scripts',
        // Missing required fields
      };

      expect(() => FileSystemConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('MCPServerConfigSchema', () => {
    it('should validate valid MCP server configuration', () => {
      const validConfig = {
        port: 3000,
        host: 'localhost',
        enableLogging: true,
        logLevel: 'info' as const,
        sessionTimeout: 3600,
        maxConcurrentOperations: 5,
      };

      const result = MCPServerConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should reject invalid log level', () => {
      const invalidConfig = {
        port: 3000,
        host: 'localhost',
        enableLogging: true,
        logLevel: 'invalid-level',
        sessionTimeout: 3600,
        maxConcurrentOperations: 5,
      };

      expect(() => MCPServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject negative port number', () => {
      const invalidConfig = {
        port: -3000,
        host: 'localhost',
        enableLogging: true,
        logLevel: 'info' as const,
        sessionTimeout: 3600,
        maxConcurrentOperations: 5,
      };

      expect(() => MCPServerConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('AppConfigSchema', () => {
    it('should validate valid application configuration', () => {
      const result = AppConfigSchema.parse(testConfig);
      expect(result).toEqual(testConfig);
    });

    it('should reject invalid default priority', () => {
      const invalidConfig = {
        ...testConfig,
        defaultPriority: 'invalid-priority',
      };

      expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid nested configuration', () => {
      const invalidConfig = {
        ...testConfig,
        ai: {
          ...testConfig.ai,
          temperature: 2.0, // Invalid temperature
        },
      };

      expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('testConfig', () => {
    it('should be a valid configuration', () => {
      expect(() => AppConfigSchema.parse(testConfig)).not.toThrow();
    });

    it('should have expected values', () => {
      expect(testConfig.projectName).toBe(APP_NAME);
      expect(testConfig.defaultSubtasks).toBe(5);
      expect(testConfig.ai.provider).toBe('anthropic');
      expect(testConfig.fileSystem.tasksFile).toBe(`${ARTIFACTS_DIR}/${ARTIFACTS_FILE}`);
      expect(testConfig.mcpServer.port).toBe(3000);
    });
  });
});
