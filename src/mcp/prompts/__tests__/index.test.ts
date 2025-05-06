/**
 * @fileoverview Tests for MCP prompts registration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
// Mock Anthropic and config
vi.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: 'Mock response from Anthropic' }],
        }),
      },
    })),
  };
});

vi.mock('../../../core/config.js', () => ({
  config: {
    anthropic: {
      apiKey: 'test-api-key',
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4000,
      temperature: 0.7,
      DEBUG: false, // Add DEBUG flag
    },
    perplexity: {
      apiKey: 'test-perplexity-key',
      model: 'sonar-small-online',
    },
  },
}));

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  const mockPrompt = vi.fn();
  return {
    McpServer: vi.fn().mockImplementation(() => ({
      prompt: mockPrompt,
    })),
  };
});

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../tools/project/index.js', () => ({
  InterviewStageType: {
    PROJECT_OVERVIEW: 'project_overview',
    GOALS_AND_STAKEHOLDERS: 'goals_and_stakeholders',
    TECHNOLOGIES: 'technologies',
    CONSTRAINTS: 'constraints',
    TIMELINE_AND_PHASES: 'timeline_and_phases',
    FEATURES: 'features',
    REVIEW: 'review',
  },
  promptTemplates: {
    project_overview: {
      system: 'System prompt for project overview',
      user: 'User prompt for project overview',
    },
    goals_and_stakeholders: {
      system: 'System prompt for goals and stakeholders',
      user: 'User prompt for goals and stakeholders',
    },
    technologies: {
      system: 'System prompt for technologies',
      user: 'User prompt for technologies',
    },
    constraints: {
      system: 'System prompt for constraints',
      user: 'User prompt for constraints',
    },
    timeline_and_phases: {
      system: 'System prompt for timeline and phases',
      user: 'User prompt for timeline and phases',
    },
    features: {
      system: 'System prompt for features',
      user: 'User prompt for features',
    },
    review: {
      system: 'System prompt for review',
      user: 'User prompt for review with [PROJECT_BRIEF_SUMMARY] placeholder',
    },
  },
}));

// Import the module under test
import { registerPrompts } from '../index.js';

// Import types for type checking
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger.js';

describe('registerPrompts', () => {
  // Define a mock server that satisfies the minimum requirements for the tests
  let mockServer: { prompt: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a mock server with the necessary properties
    mockServer = {
      prompt: vi.fn(),
    } as Partial<McpServer> & { prompt: ReturnType<typeof vi.fn> };
  });

  it('should register all prompts with the server', () => {
    registerPrompts(mockServer as unknown as McpServer);

    expect(logger.info).toHaveBeenCalledWith('Registering MCP prompts...');

    // Verify that all interview stage prompts are registered
    expect(mockServer.prompt).toHaveBeenCalledWith(
      'project_overview',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    expect(mockServer.prompt).toHaveBeenCalledWith(
      'project_goals_and_stakeholders',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    expect(mockServer.prompt).toHaveBeenCalledWith(
      'project_technologies',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    expect(mockServer.prompt).toHaveBeenCalledWith(
      'project_constraints',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    expect(mockServer.prompt).toHaveBeenCalledWith(
      'project_timeline_and_phases',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    expect(mockServer.prompt).toHaveBeenCalledWith(
      'project_features',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    // Verify that project_review prompt is registered
    const projectReviewCall = mockServer.prompt.mock.calls.find(
      (call) => call[0] === 'project_review'
    );
    expect(projectReviewCall).toBeDefined();
    expect(projectReviewCall?.[1]).toEqual('Asks the AI to help review the project brief');
    expect(projectReviewCall?.[2]).toHaveProperty('projectBrief');

    // Verify that create_project_brief prompt is registered
    const createProjectBriefCall = mockServer.prompt.mock.calls.find(
      (call) => call[0] === 'create_project_brief'
    );
    expect(createProjectBriefCall).toBeDefined();
    expect(createProjectBriefCall?.[1]).toEqual(
      'Initiates the project brief creation process with optional context'
    );
    expect(createProjectBriefCall?.[2]).toHaveProperty('existingBrief');
    expect(createProjectBriefCall?.[2]).toHaveProperty('projectType');
    expect(createProjectBriefCall?.[2]).toHaveProperty('teamSize');
    expect(createProjectBriefCall?.[2]).toHaveProperty('timeline');

    expect(logger.info).toHaveBeenCalledWith('MCP prompts registered');
  });

  it('should generate correct prompt messages for project overview', () => {
    registerPrompts(mockServer as unknown as McpServer);

    // Extract the handler function for the project overview prompt
    const handlerFn = mockServer.prompt.mock.calls.find(
      (call) => call[0] === 'project_overview'
    )?.[3];
    expect(handlerFn).toBeDefined();

    // Call the handler function
    const result = handlerFn({});

    // Verify the result
    expect(result).toEqual({
      description: 'Project Overview Interview',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'System prompt for project overview\n\nUser prompt for project overview',
          },
        },
      ],
    });
  });

  it('should generate correct prompt messages for project review with brief summary', () => {
    registerPrompts(mockServer as unknown as McpServer);

    // Extract the handler function for the project review prompt
    const handlerFn = mockServer.prompt.mock.calls.find(
      (call) => call[0] === 'project_review'
    )?.[3];
    expect(handlerFn).toBeDefined();

    // Call the handler function with a project brief
    const result = handlerFn({
      projectBrief: {
        title: 'Test Project',
        description: 'A test project',
      },
    });

    // Verify the result
    expect(result.messages[0].content.text).toContain('Test Project');
    expect(result.messages[0].content.text).toContain('A test project');
  });

  it('should generate correct prompt messages for create_project_brief with context', () => {
    registerPrompts(mockServer as unknown as McpServer);

    // Extract the handler function for the create_project_brief prompt
    const handlerFn = mockServer.prompt.mock.calls.find(
      (call) => call[0] === 'create_project_brief'
    )?.[3];
    expect(handlerFn).toBeDefined();

    // Call the handler function with context
    const result = handlerFn({
      projectType: 'web',
      teamSize: '5',
      timeline: '3 months',
    });

    // Verify the result
    expect(result.messages[0].content.text).toContain('web project');
    expect(result.messages[0].content.text).toContain('5 members');
    expect(result.messages[0].content.text).toContain('3 months');
  });

  it('should generate correct prompt messages for create_project_brief with existing brief', () => {
    registerPrompts(mockServer as unknown as McpServer);

    // Extract the handler function for the create_project_brief prompt
    const handlerFn = mockServer.prompt.mock.calls.find(
      (call) => call[0] === 'create_project_brief'
    )?.[3];
    expect(handlerFn).toBeDefined();

    // Call the handler function with an existing brief
    const result = handlerFn({
      existingBrief: {
        title: 'Existing Project',
        description: 'An existing project',
      },
    });

    // Verify the result
    expect(result.messages[0].content.text).toContain('existing project brief');
    expect(result.messages[0].content.text).toContain('Existing Project');
    expect(result.messages[0].content.text).toContain('An existing project');
  });
});
