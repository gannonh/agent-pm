/**
 * @fileoverview Helper utilities for integration tests
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import { ARTIFACTS_DIR, ARTIFACTS_FILE } from '../../config.js';

// Load test environment variables
dotenv.config({ path: '.env.test' });

/**
 * Creates a temporary test directory with a unique name
 * @returns The path to the temporary test directory
 */
export async function createTempTestDir(): Promise<string> {
  const testId = uuidv4();
  const tempDir = path.join(process.cwd(), 'temp-test', `test-${testId}`);

  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Cleans up a temporary test directory
 * @param tempDir The path to the temporary test directory
 */
export async function cleanupTempTestDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up temp directory ${tempDir}:`, error);
  }
}

/**
 * Creates a test project structure in the specified directory
 * @param projectRoot The root directory for the test project
 */
export async function createTestProject(projectRoot: string): Promise<void> {
  // Create basic project structure
  await fs.mkdir(path.join(projectRoot, ARTIFACTS_DIR), { recursive: true });

  // Create a minimal artifacts.json file
  const artifactsJson = {
    tasks: [],
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      projectName: 'Test Project',
    },
  };

  await fs.writeFile(
    path.join(projectRoot, ARTIFACTS_DIR, ARTIFACTS_FILE),
    JSON.stringify(artifactsJson, null, 2)
  );
}

/**
 * Creates a sample project brief for testing
 * @param projectRoot The root directory for the test project
 * @returns The project brief object
 */
export async function createSampleProjectBrief(projectRoot: string): Promise<any> {
  const projectBrief = {
    id: uuidv4(),
    title: 'Test Project',
    description: 'A test project for integration testing',
    goals: ['Test the application', 'Verify functionality'],
    stakeholders: ['Development team', 'QA team'],
    technologies: ['TypeScript', 'Node.js'],
    constraints: ['Must complete within 2 weeks', 'Must have test coverage'],
    timeline: '2 weeks',
    phases: [
      {
        name: 'Phase 1',
        description: 'Initial implementation',
        tasks: ['Set up project', 'Implement core functionality'],
      },
    ],
    features: ['Feature 1', 'Feature 2'],
  };

  // Create project brief directory if it doesn't exist
  await fs.mkdir(path.join(projectRoot, ARTIFACTS_DIR), { recursive: true });

  // Write project brief to file
  await fs.writeFile(
    path.join(projectRoot, ARTIFACTS_DIR, 'project-brief.json'),
    JSON.stringify(projectBrief, null, 2)
  );

  return projectBrief;
}

/**
 * Creates sample tasks for testing
 * @param projectRoot The root directory for the test project
 * @param count The number of tasks to create
 * @returns The created tasks
 */
export async function createSampleTasks(projectRoot: string, count = 3): Promise<any[]> {
  const tasks = [];

  for (let i = 1; i <= count; i++) {
    tasks.push({
      id: `${i}`,
      title: `Task ${i}`,
      description: `Description for Task ${i}`,
      status: 'pending',
      priority: 'medium',
      dependencies: i > 1 ? [`${i - 1}`] : [],
      details: `Implementation details for Task ${i}`,
      testStrategy: `Test strategy for Task ${i}`,
    });
  }

  const artifactsJson = {
    tasks,
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      projectName: 'Test Project',
    },
  };

  // Create artifacts directory if it doesn't exist
  await fs.mkdir(path.join(projectRoot, ARTIFACTS_DIR), { recursive: true });

  // Write tasks to artifacts.json
  await fs.writeFile(
    path.join(projectRoot, ARTIFACTS_DIR, ARTIFACTS_FILE),
    JSON.stringify(artifactsJson, null, 2)
  );

  return tasks;
}

/**
 * Sets up test environment hooks for integration tests
 * @returns Object with test directory and cleanup function
 */
export function setupIntegrationTest(): { getTestDir: () => string } {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = await createTempTestDir();

    // Reset all mocks
    vi.resetAllMocks();
  });

  afterEach(async () => {
    // Clean up the temporary test directory
    await cleanupTempTestDir(testDir);
  });

  return {
    getTestDir: () => testDir,
  };
}

/**
 * Reads the artifacts.json file from the test project
 * @param projectRoot The root directory for the test project
 * @returns The parsed artifacts.json content
 */
export async function readArtifactsJson(projectRoot: string): Promise<any> {
  const artifactsPath = path.join(projectRoot, ARTIFACTS_DIR, ARTIFACTS_FILE);
  const content = await fs.readFile(artifactsPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Creates a sample PRD file for testing
 * @param projectRoot The root directory for the test project
 * @returns The path to the created PRD file
 */
export async function createSamplePrd(projectRoot: string): Promise<string> {
  const prdContent = `# Test Project PRD

## Overview
This is a test project for integration testing.

## Goals
- Test the application
- Verify functionality

## Stakeholders
- Development team
- QA team

## Technologies
- TypeScript
- Node.js

## Constraints
- Must complete within 2 weeks
- Must have test coverage

## Timeline
2 weeks

## Phases
### Phase 1: Initial implementation
- Set up project
- Implement core functionality

## Features
- Feature 1
- Feature 2
`;

  // Create scripts directory if it doesn't exist
  await fs.mkdir(path.join(projectRoot, 'scripts'), { recursive: true });

  // Write PRD to file
  const prdPath = path.join(projectRoot, 'scripts', 'test-prd.txt');
  await fs.writeFile(prdPath, prdContent);

  return prdPath;
}
