/**
 * @fileoverview Tests for the task-generation-stages module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectBrief } from '../../types/interview-types.js';
import { TaskStructure, DetailedTasks } from '../../types/task-generation.js';

// Import the AnthropicClient type for type compatibility
import type { AnthropicClient } from '../../anthropic-client.js';

// Define a type for our mock client that's compatible with AnthropicClient
// This is a workaround for ESLint warnings about type compatibility
type MockAnthropicClient = AnthropicClient;

// Create mocks using vi.hoisted
const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  anthropicClient: {
    sendMessage: vi.fn().mockResolvedValue(
      JSON.stringify({
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium',
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      })
    ),
  },
  resourceStorage: {
    loadResource: vi.fn().mockResolvedValue({
      id: 'test-brief-id',
      title: 'Test Project',
      description: 'This is a test project',
      goals: ['Goal 1', 'Goal 2'],
      stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
      technologies: ['Tech 1', 'Tech 2'],
      constraints: ['Constraint 1', 'Constraint 2'],
      timeline: 'Project timeline',
      phases: [
        {
          name: 'Phase 1: Planning',
          description: 'Planning phase',
          tasks: ['Task 1', 'Task 2'],
        },
      ],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-02T00:00:00.000Z',
      version: '1.0.0',
    } as ProjectBrief),
  },
  // Add mocks for file-utils, fs, and path
  fileUtils: {
    writeTasksFile: vi.fn().mockResolvedValue(true),
    generateTaskFiles: vi.fn().mockResolvedValue(undefined),
  },
  fs: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  path: {
    join: vi.fn().mockImplementation((...args) => args.join('/')),
    dirname: vi.fn().mockImplementation((p) => p.split('/').slice(0, -1).join('/')),
  },
  config: {
    getProjectRoot: vi.fn().mockReturnValue('/project/root'),
    getArtifactsFile: vi.fn().mockReturnValue('/project/root/apm-artifacts/artifacts.json'),
    DEBUG: false, // Add DEBUG flag
  },
}));

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', async () => {
  return {
    default: class MockAnthropic {
      apiKey: string;
      baseURL: string;
      messages: { create: unknown };

      constructor(options: { apiKey: string; baseURL: string }) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL;
        this.messages = { create: vi.fn() };
      }
    },
  };
});

// Mock dependencies
vi.mock('../../../mcp/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../anthropic-client.js', () => ({
  AnthropicClient: vi.fn().mockImplementation(() => mocks.anthropicClient),
}));

vi.mock('../ResourceStorage.js', () => ({
  resourceStorage: mocks.resourceStorage,
}));

vi.mock('../../config.js', () => ({
  default: mocks.config,
}));

vi.mock('fs/promises', () => mocks.fs);

vi.mock('path', () => mocks.path);

// Mock dynamic imports
vi.mock('../../mcp/utils/file-utils.js', () => mocks.fileUtils);

// We'll mock the generateMarkdown function in the beforeEach block

describe('Task Generation Stages', () => {
  // Import the module under test after mocks are set up
  let taskGenerationStages: typeof import('../task-generation-stages.js');

  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks();

    // Set environment variables
    process.env.TEMPERATURE = '0.3';
    process.env.MAX_TOKENS = '4000';

    // Import the module under test
    taskGenerationStages = await import('../task-generation-stages.js');
  });

  describe('analyzeProjectBrief', () => {
    it('should handle errors when loading the project brief', async () => {
      const projectBriefUri = 'test-brief-uri';
      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      // Mock an error when loading the project brief
      mocks.resourceStorage.loadResource.mockRejectedValueOnce(
        new Error('Failed to load project brief')
      );

      await expect(
        taskGenerationStages.analyzeProjectBrief(
          projectBriefUri,
          anthropicClient as unknown as MockAnthropicClient
        )
      ).rejects.toThrow('Failed to analyze project brief');

      expect(mocks.resourceStorage.loadResource).toHaveBeenCalledWith(projectBriefUri);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Error analyzing project brief',
        expect.any(Object)
      );
    });

    it('should handle errors when sending the message to Anthropic', async () => {
      const projectBriefUri = 'test-brief-uri';
      const anthropicClient = {
        sendMessage: vi.fn().mockRejectedValueOnce(new Error('Failed to send message')),
      };

      await expect(
        taskGenerationStages.analyzeProjectBrief(
          projectBriefUri,
          anthropicClient as unknown as MockAnthropicClient
        )
      ).rejects.toThrow('Failed to analyze project brief');

      expect(mocks.resourceStorage.loadResource).toHaveBeenCalledWith(projectBriefUri);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Error analyzing project brief',
        expect.any(Object)
      );
    });
  });

  describe('createTaskStructure', () => {
    it('should create a task structure from a project analysis', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const, // Type assertion to fix TypeScript error
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      // Mock the Anthropic client to return a task structure
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify([
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Implement authentication',
            description: 'Create login and registration functionality',
            priority: 'high',
            dependencies: ['1'],
          },
        ])
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.createTaskStructure(
        analysis,
        anthropicClient as unknown as MockAnthropicClient
      );

      expect(mocks.anthropicClient.sendMessage).toHaveBeenCalled();

      expect(result).toEqual({
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Implement authentication',
            description: 'Create login and registration functionality',
            priority: 'high',
            dependencies: ['1'],
          },
        ],
      });
    });

    it('should respect the maxTasks parameter', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const,
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      // Mock the Anthropic client to return a task structure
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify([
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Implement authentication',
            description: 'Create login and registration functionality',
            priority: 'high',
            dependencies: ['1'],
          },
        ])
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      await taskGenerationStages.createTaskStructure(
        analysis,
        anthropicClient as unknown as MockAnthropicClient,
        5
      );

      // Check that the maxTasks parameter was included in the prompt
      expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          systemPrompt: expect.stringContaining('Generate approximately 5 tasks'),
        })
      );
    });

    it('should handle errors when creating the task structure', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const, // Type assertion to fix TypeScript error
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      const anthropicClient = {
        sendMessage: vi.fn().mockRejectedValueOnce(new Error('Failed to send message')),
      };

      await expect(
        taskGenerationStages.createTaskStructure(
          analysis,
          anthropicClient as unknown as MockAnthropicClient
        )
      ).rejects.toThrow('Failed to create task structure');

      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Error creating task structure',
        expect.any(Object)
      );
    });
  });

  describe('createTaskStructure with different response formats', () => {
    it('should handle a JSON array response', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const,
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      // Mock the Anthropic client to return a JSON array
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify([
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Implement authentication',
            description: 'Create login and registration functionality',
            priority: 'high',
            dependencies: ['1'],
          },
        ])
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.createTaskStructure(
        analysis,
        anthropicClient as unknown as MockAnthropicClient
      );

      expect(result).toEqual({
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Implement authentication',
            description: 'Create login and registration functionality',
            priority: 'high',
            dependencies: ['1'],
          },
        ],
      });
    });

    it('should handle a JSON object with tasks property', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const,
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      // Mock the Anthropic client to return a JSON object with tasks property
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify({
          tasks: [
            {
              id: '1',
              title: 'Set up project repository',
              description: 'Initialize Git repository and configure CI/CD',
              priority: 'high',
              dependencies: [],
            },
            {
              id: '2',
              title: 'Implement authentication',
              description: 'Create login and registration functionality',
              priority: 'high',
              dependencies: ['1'],
            },
          ],
        })
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.createTaskStructure(
        analysis,
        anthropicClient as unknown as MockAnthropicClient
      );

      expect(result).toEqual({
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Implement authentication',
            description: 'Create login and registration functionality',
            priority: 'high',
            dependencies: ['1'],
          },
        ],
      });
    });

    it('should handle a single task object response', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const,
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      // Mock the Anthropic client to return a single task object
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify({
          id: '1',
          title: 'Set up project repository',
          description: 'Initialize Git repository and configure CI/CD',
          priority: 'high',
          dependencies: [],
        })
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.createTaskStructure(
        analysis,
        anthropicClient as unknown as MockAnthropicClient
      );

      expect(result).toEqual({
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
        ],
      });
    });

    it('should handle invalid JSON responses', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const,
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      // Mock the Anthropic client to return an invalid JSON response
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce('This is not JSON');

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.createTaskStructure(
        analysis,
        anthropicClient as unknown as MockAnthropicClient
      );

      expect(result).toEqual({
        tasks: [
          {
            id: '1',
            title: 'Implement core functionality',
            description: 'Could not extract tasks from AI response',
            priority: 'high',
            dependencies: [],
          },
        ],
      });

      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Error processing task structure response',
        expect.any(Object)
      );
    });

    it('should restructure phase-like tasks', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const,
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      // Mock the Anthropic client to return tasks with phase-like titles
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify([
          {
            id: '1',
            title: 'Phase 1: Planning',
            description: 'Plan the project',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Implement authentication',
            description: 'Create login and registration functionality',
            priority: 'high',
            dependencies: ['1'],
          },
        ])
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.createTaskStructure(
        analysis,
        anthropicClient as unknown as MockAnthropicClient
      );

      // The phase-like task should be restructured
      expect(result.tasks[0].title).toContain('Implementation');
      expect(result.tasks[0].description).toContain('writing code');
    });

    it('should remove non-development tasks', async () => {
      const analysis = {
        components: [
          {
            name: 'Frontend',
            description: 'User interface',
            technologies: ['React', 'TypeScript'],
          },
        ],
        features: [
          {
            name: 'Authentication',
            description: 'User login and registration',
            complexity: 'medium' as const,
          },
        ],
        technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
        developmentConsiderations: [
          { category: 'Performance', considerations: ['Optimize bundle size'] },
        ],
      };

      // Mock the Anthropic client to return tasks with non-development tasks
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify([
          {
            id: '1',
            title: 'Marketing meeting',
            description: 'Discuss marketing strategy',
            priority: 'high',
            dependencies: [],
          },
          {
            id: '2',
            title: 'Implement authentication',
            description: 'Create login and registration functionality',
            priority: 'high',
            dependencies: ['1'],
          },
        ])
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.createTaskStructure(
        analysis,
        anthropicClient as unknown as MockAnthropicClient
      );

      // The non-development task should be removed
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].title).toBe('Implement authentication');
    });
  });

  describe('addTaskDetails', () => {
    it('should handle errors gracefully when adding task details', async () => {
      // Create a properly typed TaskStructure
      const taskStructure: TaskStructure = {
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
        ],
      };

      const anthropicClient = {
        sendMessage: vi.fn().mockRejectedValueOnce(new Error('Failed to send message')),
      };

      // The function should not throw but return the original tasks
      const result = await taskGenerationStages.addTaskDetails(
        taskStructure,
        anthropicClient as unknown as MockAnthropicClient
      );

      // Should return the original tasks without details
      expect(result.tasks).toEqual(taskStructure.tasks);

      // Should log the error
      expect(mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing batch'),
        expect.any(Object)
      );
    });

    it('should add details to tasks', async () => {
      // Create a properly typed TaskStructure
      const taskStructure: TaskStructure = {
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
        ],
      };

      // Mock the Anthropic client to return task details
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify([
          {
            id: '1',
            details: 'Detailed implementation steps',
            testStrategy: 'Test strategy',
            subtasks: [
              {
                id: '1.1',
                title: 'Initialize Git repository',
                description: 'Create a new Git repository',
              },
              {
                id: '1.2',
                title: 'Configure CI/CD',
                description: 'Set up CI/CD pipeline',
              },
            ],
          },
        ])
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };
      const progressCallback = vi.fn();

      const result = await taskGenerationStages.addTaskDetails(
        taskStructure,
        anthropicClient as unknown as MockAnthropicClient,
        progressCallback
      );

      // Use proper type for the result
      type DetailedTaskType = {
        id: string;
        title: string;
        description: string;
        priority: string;
        dependencies: string[];
        details?: string;
        testStrategy?: string;
        subtasks?: Array<{ id: string; title: string; description: string }>;
      };

      const detailedTask = result.tasks[0] as DetailedTaskType;

      expect(mocks.anthropicClient.sendMessage).toHaveBeenCalled();
      expect(detailedTask.details).toBe('Detailed implementation steps');
      expect(detailedTask.testStrategy).toBe('Test strategy');
      expect(detailedTask.subtasks).toHaveLength(2);
      expect(detailedTask.subtasks?.[0].title).toBe('Initialize Git repository');
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should handle invalid JSON responses when adding task details', async () => {
      // Create a properly typed TaskStructure
      const taskStructure: TaskStructure = {
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
        ],
      };

      // Mock the Anthropic client to return an invalid JSON response
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce('This is not JSON');

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.addTaskDetails(
        taskStructure,
        anthropicClient as unknown as MockAnthropicClient
      );

      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Error processing task details response',
        expect.any(Object)
      );

      // Should return the original tasks without details
      expect(result.tasks).toEqual(taskStructure.tasks);
    });

    it('should handle JSON responses with embedded JSON', async () => {
      // Create a properly typed TaskStructure
      const taskStructure: TaskStructure = {
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
        ],
      };

      // Mock the Anthropic client to return a response with embedded JSON
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        'Here is the task details: [{"id":"1","details":"Extracted details","testStrategy":"Extracted test strategy"}]'
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.addTaskDetails(
        taskStructure,
        anthropicClient as unknown as MockAnthropicClient
      );

      // Use proper type for the result
      type DetailedTaskType = {
        id: string;
        title: string;
        description: string;
        priority: string;
        dependencies: string[];
        details?: string;
        testStrategy?: string;
        subtasks?: Array<{ id: string; title: string; description: string }>;
      };

      const detailedTask = result.tasks[0] as DetailedTaskType;

      // Should extract the JSON from the response
      expect(detailedTask.details).toBe('Extracted details');
      expect(detailedTask.testStrategy).toBe('Extracted test strategy');
    });

    it('should handle JSON responses with embedded JSON object', async () => {
      // Create a properly typed TaskStructure
      const taskStructure: TaskStructure = {
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
        ],
      };

      // Mock the Anthropic client to return a response with embedded JSON object
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        'Here is the task details: {"tasks":[{"id":"1","details":"Object details","testStrategy":"Object test strategy"}]}'
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.addTaskDetails(
        taskStructure,
        anthropicClient as unknown as MockAnthropicClient
      );

      // Use proper type for the result
      type DetailedTaskType = {
        id: string;
        title: string;
        description: string;
        priority: string;
        dependencies: string[];
        details?: string;
        testStrategy?: string;
        subtasks?: Array<{ id: string; title: string; description: string }>;
      };

      const detailedTask = result.tasks[0] as DetailedTaskType;

      // Should extract the JSON from the response
      expect(detailedTask.details).toBe('Object details');
      expect(detailedTask.testStrategy).toBe('Object test strategy');
    });

    it('should handle JSON responses with a single task object', async () => {
      // Create a properly typed TaskStructure
      const taskStructure: TaskStructure = {
        tasks: [
          {
            id: '1',
            title: 'Set up project repository',
            description: 'Initialize Git repository and configure CI/CD',
            priority: 'high',
            dependencies: [],
          },
        ],
      };

      // Mock the Anthropic client to return a single task object
      mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
        JSON.stringify({
          id: '1',
          details: 'Single task details',
          testStrategy: 'Single task test strategy',
        })
      );

      const anthropicClient = { sendMessage: mocks.anthropicClient.sendMessage };

      const result = await taskGenerationStages.addTaskDetails(
        taskStructure,
        anthropicClient as unknown as MockAnthropicClient
      );

      // Use proper type for the result
      type DetailedTaskType = {
        id: string;
        title: string;
        description: string;
        priority: string;
        dependencies: string[];
        details?: string;
        testStrategy?: string;
        subtasks?: Array<{ id: string; title: string; description: string }>;
      };

      const detailedTask = result.tasks[0] as DetailedTaskType;

      // Should handle the single task object
      expect(detailedTask.details).toBe('Single task details');
      expect(detailedTask.testStrategy).toBe('Single task test strategy');
    });
  });

  describe('generateTaskFiles', () => {
    it('should handle errors when generating task files', async () => {
      // Create a simple detailed tasks object
      const detailedTasks: DetailedTasks = {
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'Description 1',
            priority: 'high',
            dependencies: [],
          },
        ],
      };

      // Mock the project brief
      const projectBriefUri = 'test-brief-uri';

      // Mock an error when loading the project brief
      mocks.resourceStorage.loadResource.mockRejectedValueOnce(
        new Error('Failed to load project brief')
      );

      // Call the function and expect it to throw
      await expect(
        taskGenerationStages.generateTaskFiles(detailedTasks, projectBriefUri)
      ).rejects.toThrow('Failed to generate task files');

      // Verify that the error was logged
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Error generating task files',
        expect.any(Object)
      );
    });

    it('should handle errors when generating markdown', async () => {
      // Create a simple detailed tasks object
      const detailedTasks: DetailedTasks = {
        tasks: [
          {
            id: '1',
            title: 'Task 1',
            description: 'Description 1',
            priority: 'high',
            dependencies: [],
          },
        ],
      };

      // Mock the project brief for the first call (in generateTaskFiles)
      mocks.resourceStorage.loadResource.mockResolvedValueOnce({
        id: 'test-brief-id',
        title: 'Test Project',
        description: 'Test project description',
        goals: ['Goal 1'],
        stakeholders: ['Stakeholder 1'],
        technologies: ['Technology 1'],
        constraints: ['Constraint 1'],
        timeline: 'Project timeline',
        phases: [
          {
            name: 'Phase 1',
            description: 'Phase 1 description',
            tasks: ['Task 1'],
          },
        ],
      });

      // Mock writeTasksFile to return true (success)
      mocks.fileUtils.writeTasksFile.mockResolvedValueOnce(true);

      // Mock the second call to loadResource to throw an error
      // This will cause the generateMarkdown function to fail
      mocks.resourceStorage.loadResource.mockRejectedValueOnce(
        new Error('Failed to load project brief for markdown')
      );

      // Call the function and expect it to throw
      await expect(
        taskGenerationStages.generateTaskFiles(detailedTasks, 'test-brief-uri')
      ).rejects.toThrow('Failed to generate task files');

      // Verify that the error was logged
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Error generating task files',
        expect.any(Object)
      );
    });
  });
});
