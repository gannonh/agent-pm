import { z } from 'zod';

/**
 * AI model configuration
 */
export interface AIModelConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
}

/**
 * File system configuration
 */
export interface FileSystemConfig {
  tasksDir: string;
  scriptsDir: string;
  tasksFile: string;
  complexityReportFile: string;
  backupDir: string;
  enableBackups: boolean;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  port: number;
  host: string;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  sessionTimeout: number;
  maxConcurrentOperations: number;
}

/**
 * Project information
 */
export interface ProjectInfo {
  name: string;
  version: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  projectName: string;
  projectVersion: string;
  defaultSubtasks: number;
  defaultPriority: 'high' | 'medium' | 'low';
  ai: AIModelConfig;
  fileSystem: FileSystemConfig;
  mcpServer: MCPServerConfig;
  debug: boolean;
  project?: ProjectInfo; // Optional project info for backward compatibility
}

/**
 * Zod schema for AI model configuration
 */
export const AIModelConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  model: z.string(),
  apiKey: z.string(),
  maxTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(1),
});

/**
 * Zod schema for file system configuration
 */
export const FileSystemConfigSchema = z.object({
  tasksDir: z.string(),
  scriptsDir: z.string(),
  tasksFile: z.string(),
  complexityReportFile: z.string(),
  backupDir: z.string(),
  enableBackups: z.boolean(),
});

/**
 * Zod schema for MCP server configuration
 */
export const MCPServerConfigSchema = z.object({
  port: z.number().int().positive(),
  host: z.string(),
  enableLogging: z.boolean(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  sessionTimeout: z.number().int().positive(),
  maxConcurrentOperations: z.number().int().positive(),
});

/**
 * Zod schema for project information
 */
export const ProjectInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
});

/**
 * Zod schema for application configuration
 */
export const AppConfigSchema = z.object({
  projectName: z.string(),
  projectVersion: z.string(),
  defaultSubtasks: z.number().int().positive(),
  defaultPriority: z.enum(['high', 'medium', 'low']),
  ai: AIModelConfigSchema,
  fileSystem: FileSystemConfigSchema,
  mcpServer: MCPServerConfigSchema,
  debug: z.boolean(),
  project: ProjectInfoSchema.optional(),
});

// Default configuration has been moved to src/config.ts
// Configuration values should be imported from there instead
