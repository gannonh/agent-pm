/**
 * @fileoverview Tests for the interview-response-processor module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  // Define InterviewStageType enum for testing
  const InterviewStageType = {
    PROJECT_OVERVIEW: 'project_overview',
    GOALS_AND_STAKEHOLDERS: 'goals_and_stakeholders',
    CONSTRAINTS: 'constraints',
    TECHNOLOGIES: 'technologies',
    TIMELINE_AND_PHASES: 'timeline_and_phases',
    FEATURES: 'features',
    REVIEW: 'review',
  };

  return {
    InterviewStageType,
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    anthropicClient: {
      sendMessage: vi.fn(),
    },
    stageDefinitions: {
      [InterviewStageType.PROJECT_OVERVIEW]: {
        name: 'Project Overview',
        prompt: 'Tell me about your project.',
        systemPrompt:
          'You are conducting an interview to gather information for a software project brief.',
      },
      [InterviewStageType.GOALS_AND_STAKEHOLDERS]: {
        name: 'Goals and Stakeholders',
        prompt: 'What are the main goals of your project?',
        systemPrompt:
          'You are conducting an interview to gather information for a software project brief.',
      },
      [InterviewStageType.CONSTRAINTS]: {
        name: 'Constraints',
        prompt: 'What constraints or limitations should we be aware of?',
        systemPrompt:
          'You are conducting an interview to gather information for a software project brief.',
      },
      [InterviewStageType.TECHNOLOGIES]: {
        name: 'Technologies',
        prompt: 'What technologies do you want to use?',
        systemPrompt:
          'You are conducting an interview to gather information for a software project brief.',
      },
      [InterviewStageType.TIMELINE_AND_PHASES]: {
        name: 'Timeline and Phases',
        prompt: 'What is the timeline for this project?',
        systemPrompt:
          'You are conducting an interview to gather information for a software project brief.',
      },
      [InterviewStageType.FEATURES]: {
        name: 'Features',
        prompt: 'What specific features do you want to include?',
        systemPrompt:
          'You are conducting an interview to gather information for a software project brief.',
      },
      [InterviewStageType.REVIEW]: {
        name: 'Review',
        prompt: "Let's review what we've discussed so far.",
        systemPrompt:
          'You are conducting an interview to gather information for a software project brief.',
      },
    },
    InterviewError: vi.fn().mockImplementation((message, details) => {
      const error = new Error(message);
      error.name = 'InterviewError';
      error.message = details;
      return error;
    }),
    DEBUG: false,
  };
});

// Mock dependencies
vi.mock('../../../mcp/utils/logger.js', () => ({
  logger: mocks.logger,
}));

vi.mock('../../anthropic-client.js', () => ({
  AnthropicClient: vi.fn().mockImplementation(() => mocks.anthropicClient),
}));

vi.mock('../interview-stages.js', () => ({
  stageDefinitions: mocks.stageDefinitions,
}));

vi.mock('../../../config.js', () => ({
  DEBUG: mocks.DEBUG,
}));

// Mock the InterviewError class
vi.mock('../../types/interview-types.js', () => ({
  InterviewStageType: mocks.InterviewStageType,
  InterviewError: mocks.InterviewError,
}));

describe('processStageResponse', () => {
  let processStageResponse: (
    stage: any,
    userResponse: string,
    projectBrief: any,
    interviewState: any,
    anthropicClient: any
  ) => Promise<any>;

  let mockProjectBrief: any;
  let mockInterviewState: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks();

    // Import the module under test AFTER mocks are set up
    const module = await import('../interview-response-processor.js');
    processStageResponse = module.processStageResponse;

    // Set up test data
    mockProjectBrief = {
      title: 'Test Project',
      description: 'A test project',
      goals: ['Goal 1', 'Goal 2'],
      stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
      technologies: ['Tech 1', 'Tech 2'],
      constraints: ['Constraint 1', 'Constraint 2'],
      timeline: '1 month',
      phases: [
        { name: 'Phase 1', description: 'Phase 1 description', tasks: ['Task 1', 'Task 2'] },
      ],
    };

    mockInterviewState = {
      id: 'test-interview',
      currentStage: mocks.InterviewStageType.PROJECT_OVERVIEW,
      completedStages: [],
      skippedStages: [],
      userResponses: {},
      recommendationContext: {},
    };
  });

  it('should process project overview stage response successfully', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.PROJECT_OVERVIEW;
    const userResponse = 'This is a test project for unit testing';
    const expectedResponse = {
      title: 'Test Project Title',
      description: 'Test Project Description',
    };

    // Mock the Anthropic client response
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce(JSON.stringify(expectedResponse));

    // Act
    const result = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert
    expect(result).toEqual(expectedResponse);
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.logger.debug).toHaveBeenCalledWith('Processing stage response', {
      stage,
      userResponse,
    });
    expect(mocks.logger.debug).toHaveBeenCalledWith('Successfully parsed Anthropic response', {
      parsedResponse: expectedResponse,
    });
  });

  it('should process goals and stakeholders stage response successfully', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.GOALS_AND_STAKEHOLDERS;
    const userResponse =
      'The goals are to test the system. Stakeholders include developers and testers.';
    const expectedResponse = {
      goals: ['Test the system'],
      stakeholders: ['Developers', 'Testers'],
    };

    // Mock the Anthropic client response
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce(JSON.stringify(expectedResponse));

    // Act
    const result = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert
    expect(result).toEqual(expectedResponse);
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should process technologies stage response successfully', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.TECHNOLOGIES;
    const userResponse = 'We will use TypeScript and Node.js';
    const expectedResponse = {
      technologies: ['TypeScript', 'Node.js'],
    };

    // Mock the Anthropic client response
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce(JSON.stringify(expectedResponse));

    // Act
    const result = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert
    expect(result).toEqual(expectedResponse);
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should handle JSON parsing error and extract JSON from response', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.CONSTRAINTS;
    const userResponse = 'We have budget and time constraints';
    const rawResponse =
      'Some text before { "constraints": ["Budget", "Time"] } and some text after';
    const expectedExtractedResponse = {
      constraints: ['Budget', 'Time'],
    };

    // Mock the Anthropic client response with text that includes JSON
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce(rawResponse);

    // Act
    const result = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert
    expect(result).toEqual(expectedExtractedResponse);
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Error parsing Anthropic response',
      expect.any(Object)
    );
    expect(mocks.logger.debug).toHaveBeenCalledWith('Attempting to parse extracted JSON', {
      jsonString: '{ "constraints": ["Budget", "Time"] }',
    });
  });

  it('should create fallback response when JSON parsing fails completely', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.FEATURES;
    const userResponse = 'We need a login feature and a dashboard';

    // Mock the Anthropic client response with invalid JSON
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce('This is not JSON at all');

    // Act
    const result = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert
    expect(result).toEqual({ features: [userResponse] });
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Error parsing Anthropic response',
      expect.any(Object)
    );
    // The error message for extracting JSON might not be called if the regex doesn't match
    // So we'll just check that error was logged at least once
    expect(mocks.logger.error).toHaveBeenCalled();
    expect(mocks.logger.debug).toHaveBeenCalledWith('Creating fallback response for stage', {
      stage,
    });
  });

  it('should create fallback response for timeline and phases stage', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.TIMELINE_AND_PHASES;
    const userResponse =
      'The project will take 3 months with design, development, and testing phases';

    // Mock the Anthropic client response with invalid JSON
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce('This is not JSON at all');

    // Act
    const result = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert
    expect(result).toEqual({
      timeline: userResponse,
      phases: [{ name: 'Phase 1', description: userResponse, tasks: [] }],
    });
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should throw error for unknown stage when JSON parsing fails', async () => {
    // Arrange
    // We need to add the unknown stage to the stageDefinitions mock
    const stage = 'unknown_stage';
    const userResponse = 'Some response';

    // Add the unknown stage to the stageDefinitions mock
    mocks.stageDefinitions[stage] = {
      name: 'Unknown Stage',
      prompt: 'Unknown prompt',
      systemPrompt: 'Unknown system prompt',
    };

    // Mock the Anthropic client response with invalid JSON
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce('This is not JSON at all');

    // Mock the InterviewError to be thrown
    mocks.InterviewError.mockImplementationOnce((message) => {
      const error = new Error(message);
      error.name = 'InterviewError';
      return error;
    });

    // Act & Assert
    await expect(
      processStageResponse(
        stage,
        userResponse,
        mockProjectBrief,
        mockInterviewState,
        mocks.anthropicClient
      )
    ).rejects.toThrow();
  });

  it('should handle JSON extraction when regex match is found but parsing fails', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.CONSTRAINTS;
    const userResponse = 'We have budget and time constraints';
    const rawResponse = 'Some text before { invalid json } and some text after';

    // Mock the Anthropic client response with text that includes invalid JSON
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce(rawResponse);

    // Act
    const result = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert
    expect(result).toEqual({ constraints: [userResponse] });
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Error parsing Anthropic response',
      expect.any(Object)
    );
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Error extracting JSON from response',
      expect.any(Object)
    );
  });

  it('should handle all fallback cases for different stages', async () => {
    // Mock the Anthropic client to return invalid JSON for all calls
    mocks.anthropicClient.sendMessage.mockResolvedValue('This is not JSON at all');

    // Test PROJECT_OVERVIEW fallback
    const projectOverviewResponse = await processStageResponse(
      mocks.InterviewStageType.PROJECT_OVERVIEW,
      'Project overview response',
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );
    expect(projectOverviewResponse).toEqual({
      title: 'Project overview response'.substring(0, 50),
      description: 'Project overview response',
    });

    // Test GOALS_AND_STAKEHOLDERS fallback
    const goalsResponse = await processStageResponse(
      mocks.InterviewStageType.GOALS_AND_STAKEHOLDERS,
      'Goals and stakeholders response',
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );
    expect(goalsResponse).toEqual({
      goals: ['Goals and stakeholders response'],
      stakeholders: ['Goals and stakeholders response'],
    });

    // Test TECHNOLOGIES fallback
    const techResponse = await processStageResponse(
      mocks.InterviewStageType.TECHNOLOGIES,
      'Technologies response',
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );
    expect(techResponse).toEqual({ technologies: ['Technologies response'] });

    // Test CONSTRAINTS fallback
    const constraintsResponse = await processStageResponse(
      mocks.InterviewStageType.CONSTRAINTS,
      'Constraints response',
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );
    expect(constraintsResponse).toEqual({ constraints: ['Constraints response'] });

    // Test TIMELINE_AND_PHASES fallback
    const timelineResponse = await processStageResponse(
      mocks.InterviewStageType.TIMELINE_AND_PHASES,
      'Timeline response',
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );
    expect(timelineResponse).toEqual({
      timeline: 'Timeline response',
      phases: [{ name: 'Phase 1', description: 'Timeline response', tasks: [] }],
    });

    // Test FEATURES fallback
    const featuresResponse = await processStageResponse(
      mocks.InterviewStageType.FEATURES,
      'Features response',
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );
    expect(featuresResponse).toEqual({ features: ['Features response'] });
  });

  it('should handle cached responses', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.PROJECT_OVERVIEW;
    const userResponse = 'This is a cached response test';
    const expectedResponse = {
      title: 'Cached Title',
      description: 'Cached Description',
    };

    // Mock the Anthropic client to return valid JSON
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce(JSON.stringify(expectedResponse));

    // Act - First call should use the mock
    const result1 = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert first call
    expect(result1).toEqual(expectedResponse);
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);

    // Reset the mock to return a different response
    mocks.anthropicClient.sendMessage.mockResolvedValueOnce(
      JSON.stringify({
        title: 'Different Title',
        description: 'Different Description',
      })
    );

    // Act - Second call with same parameters
    const result2 = await processStageResponse(
      stage,
      userResponse,
      mockProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert second call - should get a new response, not cached
    expect(result2).not.toEqual(result1);
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('should test the contextMessage formatting', async () => {
    // Arrange
    const stage = mocks.InterviewStageType.PROJECT_OVERVIEW;
    const userResponse = 'This is a test for context message formatting';

    // Create a project brief with empty arrays and undefined values
    const emptyProjectBrief = {
      title: undefined,
      description: undefined,
      goals: [],
      stakeholders: [],
      technologies: [],
      constraints: [],
      timeline: undefined,
      phases: [],
    };

    // Mock the Anthropic client response
    mocks.anthropicClient.sendMessage.mockImplementationOnce((messages) => {
      // Check that the context message contains "Not specified" for empty values
      const contextMessage = messages[0].content;
      expect(contextMessage).toContain('Title: Not specified');
      expect(contextMessage).toContain('Description: Not specified');
      expect(contextMessage).toContain('Goals: Not specified');
      expect(contextMessage).toContain('Stakeholders: Not specified');
      expect(contextMessage).toContain('Technologies: Not specified');
      expect(contextMessage).toContain('Constraints: Not specified');
      expect(contextMessage).toContain('Timeline: Not specified');
      expect(contextMessage).toContain('Phases: Not specified');

      return JSON.stringify({
        title: 'Test Title',
        description: 'Test Description',
      });
    });

    // Act
    const result = await processStageResponse(
      stage,
      userResponse,
      emptyProjectBrief,
      mockInterviewState,
      mocks.anthropicClient
    );

    // Assert
    expect(result).toEqual({
      title: 'Test Title',
      description: 'Test Description',
    });
    expect(mocks.anthropicClient.sendMessage).toHaveBeenCalledTimes(1);
  });
});
