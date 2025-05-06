/**
 * @fileoverview Central configuration module for AgentPM
 *
 * This module provides a centralized configuration system for AgentPM,
 * including file paths, naming conventions, and constants.
 * It differentiates AgentPM from Task Master by using different
 * directory names, file names, and file formats.
 *
 * @module config
 *
 */

import path from 'path';
import fs from 'fs/promises';

/**
 * Application constants
 */
export const APP_NAME = 'AgentPM';
export const APP_VERSION = '0.1.0';
export const DEBUG = process.env.DEBUG === 'true';

/** API keys */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

/**
 * AI configuration constants
 */
// Anthropic
export const ANTHROPIC_TEMPERATURE = parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.2');
export const ANTHROPIC_MAX_TOKENS = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '64000', 10);
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
export const ANTHROPIC_MAX_CACHE_SIZE = parseInt(process.env.ANTHROPIC_MAX_CACHE_SIZE || '100', 10);
export const ANTHROPIC_CACHE_TTL = parseInt(process.env.ANTHROPIC_CACHE_TTL || '3600000', 10);
export const ANTHROPIC_MAX_RETRIES = parseInt(process.env.ANTHROPIC_MAX_RETRIES || '5', 10);
export const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
export const ANTHROPIC_SYSTEM_PROMPT =
  process.env.ANTHROPIC_SYSTEM_PROMPT || 'You are a helpful assistant.';
// Perplexity
export const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || 'sonar-pro';
export const PERPLEXITY_MAX_TOKENS = parseInt(process.env.PERPLEXITY_MAX_TOKENS || '1024', 10);
export const PERPLEXITY_MAX_CACHE_SIZE = parseInt(
  process.env.PERPLEXITY_MAX_CACHE_SIZE || '100',
  10
);
export const PERPLEXITY_CACHE_TTL = parseInt(process.env.PERPLEXITY_CACHE_TTL || '3600000', 10);
export const PERPLEXITY_MAX_RESULTS = parseInt(process.env.PERPLEXITY_MAX_RESULTS || '5', 10);
export const PERPLEXITY_MAX_RETRIES = parseInt(process.env.PERPLEXITY_MAX_RETRIES || '5', 10);
export const PERPLEXITY_BASE_URL = process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai';
export const PERPLEXITY_TEMPERATURE = parseFloat(process.env.PERPLEXITY_TEMPERATURE || '0.7');
export const PERPLEXITY_SYSTEM_PROMPT =
  process.env.PERPLEXITY_SYSTEM_PROMPT ||
  'You are a helpful research assistant. Provide factual information with sources.';

/**
 * Directories and files
 */
export const PROJECT_ROOT = process.env.PROJECT_ROOT || '';
export const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || 'apm-artifacts';
export const ARTIFACTS_FILE = process.env.ARTIFACTS_FILE || 'artifacts.json';
export const PRODUCT_BRIEF_FILE = process.env.PRODUCT_BRIEF_FILE || 'project-brief.md';
export const ARTIFACT_EXTENSION = '.md';

/**
 * Configuration class for AgentPM
 * Provides methods to access configuration values with environment variable overrides
 */
export class Config {
  /**
   * Get the project root directory
   * @param projectRoot Optional project root override
   * @returns The project root directory path
   */
  static getProjectRoot(projectRoot?: string): string {
    return projectRoot || process.env.PROJECT_ROOT || '';
  }

  /**
   * Get the artifacts directory path
   * @param projectRoot Optional project root override
   * @returns The artifacts directory path
   */
  static getArtifactsDir(projectRoot?: string): string {
    const root = Config.getProjectRoot(projectRoot);
    const dirName = process.env.APM_ARTIFACTS_DIR || process.env.ARTIFACTS_DIR || 'apm-artifacts';
    return path.join(root, dirName);
  }

  /**
   * Get the artifacts file path
   * @param projectRoot Optional project root override
   * @returns The artifacts file path
   */
  static getArtifactsFile(projectRoot?: string): string {
    const artifactsDir = Config.getArtifactsDir(projectRoot);
    const fileName = process.env.ARTIFACTS_FILE || 'artifacts.json';
    return path.join(artifactsDir, fileName);
  }

  /**
   * Get the artifact file extension
   * @returns The artifact file extension (.md)
   */
  static getArtifactExtension(): string {
    return ARTIFACT_EXTENSION;
  }

  /**
   * Get the path to an individual artifact file
   * @param artifactId The artifact ID
   * @param projectRoot Optional project root override
   * @returns The path to the artifact file
   */
  static getArtifactFilePath(artifactId: string | number, projectRoot?: string): string {
    const artifactsDir = Config.getArtifactsDir(projectRoot);
    const fileName = `task_${String(artifactId).padStart(3, '0')}${ARTIFACT_EXTENSION}`;
    return path.join(artifactsDir, fileName);
  }

  /**
   * Get the product brief file path
   * @param projectRoot Optional project root override
   * @returns The path to the product brief file
   */
  static getProductBriefFilePath(projectRoot?: string): string {
    const artifactsDir = Config.getArtifactsDir(projectRoot);
    const fileName = process.env.PRODUCT_BRIEF_FILE || 'project-brief.md';
    return path.join(artifactsDir, fileName);
  }

  /**
   * Ensure the artifacts directory exists
   * @param projectRoot Optional project root override
   * @returns The path to the artifacts directory
   */
  static async ensureArtifactsDir(projectRoot?: string): Promise<string> {
    const artifactsDir = Config.getArtifactsDir(projectRoot);

    try {
      await fs.access(artifactsDir);
    } catch (_error) {
      // Directory doesn't exist, create it
      await fs.mkdir(artifactsDir, { recursive: true });
    }

    return artifactsDir;
  }
}

/**
 * Default export for easier importing
 */
export default Config;
