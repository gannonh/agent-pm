/**
 * @fileoverview Test utilities for the project tool tests
 */

import { vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Create a mock server
export function createMockServer() {
  return {
    capabilities: {
      serverInfo: { name: 'Test Server', version: '1.0.0' },
    },
    tool: vi.fn(),
    resource: vi.fn(),
  } as unknown as McpServer;
}

// Setup response mocks
export function setupResponseMocks() {
  vi.mock('../../../../utils/response.js', () => ({
    create_success_payload: vi.fn((data, message, options = {}) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ data, message, ...options }),
        },
      ],
    })),
    create_async_operation_payload: vi.fn(
      (operationId, operationType, data, message, options = {}) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ operationId, operationType, data, message, ...options }),
          },
        ],
      })
    ),
    create_error_payload: vi.fn((errorData, message, options = {}) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorData, message, ...options }),
        },
      ],
      isError: true,
    })),
    createMcpResponse: vi.fn((data) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(data),
        },
      ],
    })),
  }));
}

// Setup validation mocks
export function setupValidationMocks() {
  vi.mock('../../../../validation/index.js', () => ({
    schemas: {
      projectRoot: vi.fn(),
      operationId: vi.fn(),
    },
    validateParams: vi.fn((params) => params),
    getProjectRoot: vi.fn((root) => root || '/mock/project'),
  }));
}

// Setup async operation manager mocks
export function setupAsyncOperationManagerMocks() {
  vi.mock('../../../../async/manager.js', () => ({
    mcpAsyncOperationManager: {
      createOperation: vi.fn((_operationType, _callback, _args, _logger) => {
        // Simulate the operation being created
        return 'mock-operation-id';
      }),
      getOperation: vi.fn((operationId) => {
        // Return a mock operation status based on the operationId
        if (operationId === 'completed-operation') {
          return {
            status: 'completed',
            operationType: 'project-brief-interview',
            result: {
              success: true,
              data: {
                question: 'What is your project about?',
                stage: 'project_overview',
                sessionId: 'mock-session-id',
                interviewStateUri: 'interview-state://mock-interview-state',
                projectBriefUri: 'project-brief://mock-project-brief',
              },
            },
            progress: 100,
            statusMessage: 'Operation completed successfully',
          };
        } else if (operationId === 'running-operation') {
          return {
            status: 'running',
            operationType: 'task-generation',
            progress: 50,
            currentStep: 'Generating tasks',
            totalSteps: 3,
            currentStepNumber: 2,
            statusMessage: 'Operation in progress',
          };
        } else if (operationId === 'failed-operation') {
          return {
            status: 'failed',
            operationType: 'project-brief-interview',
            error: {
              code: 'INTERVIEW_ERROR',
              message: 'Failed to create interview',
            },
            statusMessage: 'Operation failed',
          };
        } else if (operationId === 'completed-task-generation') {
          return {
            status: 'completed',
            operationType: 'task-generation',
            result: {
              success: true,
              data: {
                tasks: [
                  { id: '1', title: 'Task 1' },
                  { id: '2', title: 'Task 2' },
                ],
                tasksPath: '/mock/project/apm-artifacts/artifacts.json',
                markdownPath: '/mock/project/apm-artifacts/project-brief.md',
                sessionId: 'mock-session-id',
                projectBriefUri: 'project-brief://mock-project-brief',
                interviewStateUri: 'interview-state://mock-interview-state',
              },
            },
            progress: 100,
            statusMessage: 'Task generation completed successfully',
          };
        } else {
          return null;
        }
      }),
    },
  }));
}

// Setup resource storage mocks
export function setupResourceStorageMocks() {
  vi.mock('../../../../core/services/ResourceStorage.js', () => ({
    resourceStorage: {
      resourceExists: vi.fn(async (uri) => {
        // Return true for specific test URIs
        return (
          uri === 'interview-state://mock-session-id' ||
          uri === 'project-brief://mock-project-brief' ||
          uri === 'interview-state://mock-interview-state'
        );
      }),
      loadResource: vi.fn(async (uri) => {
        if (
          uri === 'interview-state://mock-session-id' ||
          uri === 'interview-state://mock-interview-state'
        ) {
          return {
            id: 'mock-interview-state',
            projectBriefId: 'mock-project-brief',
            currentStage: 'project_overview',
            completedStages: [],
            skippedStages: [],
            userResponses: {},
            recommendationContext: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        } else if (uri === 'project-brief://mock-project-brief') {
          return {
            id: 'mock-project-brief',
            title: 'Mock Project',
            description: 'A mock project for testing',
            goals: [],
            stakeholders: [],
            technologies: [],
            constraints: [],
            timeline: '',
            phases: [],
            interviewProgress: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: '1.0.0',
          };
        }
        return null;
      }),
      saveResource: vi.fn(async (resource) => {
        return resource;
      }),
    },
    MCPResource: class MCPResource {
      id: string;
      constructor(id: string) {
        this.id = id;
      }
    },
  }));
}

// Setup AI client mocks
export function setupAiClientMocks() {
  // Mock the core AI client
  vi.mock('../../../../core/ai-client.js', () => ({
    createAiClient: vi.fn().mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: [{ text: 'This is a mock response from AI client' }],
      }),
      streamChat: vi.fn().mockImplementation(async (messages, options, callbacks) => {
        // Simulate streaming by calling the callbacks
        if (callbacks?.onContent) {
          callbacks.onContent('This is a mock streaming response');
        }
        if (callbacks?.onComplete) {
          callbacks.onComplete({
            content: [{ text: 'This is a mock response from AI client' }],
          });
        }
        return {
          content: [{ text: 'This is a mock response from AI client' }],
        };
      }),
    }),
  }));

  // Mock the Anthropic client
  vi.mock('../../../../core/anthropic-client.js', () => ({
    createAnthropicClient: vi.fn().mockReturnValue({
      sendMessage: vi
        .fn()
        .mockResolvedValue(
          '{"title": "Mock Project", "description": "A mock project for testing"}'
        ),
      streamMessage: vi.fn().mockImplementation(async (messages, options) => {
        if (options?.onPartialResponse) {
          options.onPartialResponse('This is a mock streaming response');
        }
        return '{"title": "Mock Project", "description": "A mock project for testing"}';
      }),
    }),
    AnthropicMessage: class AnthropicMessage {
      role: string;
      content: string;
      constructor(role: string, content: string) {
        this.role = role;
        this.content = content;
      }
    },
    AnthropicAuthError: class AnthropicAuthError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'AnthropicAuthError';
      }
    },
  }));
}

// Setup config mocks
export function setupConfigMocks() {
  vi.mock('../../../../config.js', () => ({
    default: {
      getProjectRoot: vi.fn().mockReturnValue('/mock/project'),
      getArtifactsDir: vi.fn().mockReturnValue('/mock/project/apm-artifacts'),
      getArtifactsFile: vi.fn().mockReturnValue('/mock/project/apm-artifacts/artifacts.json'),
      getTaskMasterDir: vi.fn().mockReturnValue('/mock/project/tasks'),
      getTaskMasterFile: vi.fn().mockReturnValue('/mock/project/tasks/tasks.json'),
      getArtifactFilePath: vi
        .fn()
        .mockImplementation(
          (id) => `/mock/project/apm-artifacts/task_${String(id).padStart(3, '0')}.md`
        ),
      getTaskMasterFilePath: vi
        .fn()
        .mockImplementation((id) => `/mock/project/tasks/task_${String(id).padStart(3, '0')}.txt`),
      getAnthropicModel: vi.fn().mockReturnValue('claude-3-opus-20240229'),
      getAnthropicMaxTokens: vi.fn().mockReturnValue(64000),
      getAnthropicTemperature: vi.fn().mockReturnValue(0.2),
    },
  }));
}

// Setup interview service mocks
export function setupInterviewServiceMocks() {
  vi.mock('../../../../core/services/InterviewService.js', () => ({
    InterviewStageType: {
      PROJECT_OVERVIEW: 'project_overview',
      GOALS_AND_STAKEHOLDERS: 'goals_and_stakeholders',
      CONSTRAINTS: 'constraints',
      TECHNOLOGIES: 'technologies',
      TIMELINE_AND_PHASES: 'timeline_and_phases',
      FEATURES: 'features',
      REVIEW: 'review',
    },
    interviewService: {
      createInterview: vi.fn(async () => {
        return {
          interviewStateUri: 'interview-state://mock-interview-state',
          projectBriefUri: 'project-brief://mock-project-brief',
          question: 'What is your project about?',
          stage: 'project_overview',
          isComplete: false,
        };
      }),
      processResponse: vi.fn(async (interviewStateUri, response) => {
        // If the response is "complete", return a completed interview
        if (response === 'complete') {
          return {
            interviewStateUri,
            projectBriefUri: 'project-brief://mock-project-brief',
            question: 'Review your project brief. Is everything correct?',
            stage: 'review',
            isComplete: true,
          };
        }

        // Otherwise, return a continuing interview
        return {
          interviewStateUri,
          projectBriefUri: 'project-brief://mock-project-brief',
          question: 'What are the goals of your project?',
          stage: 'goals_and_stakeholders',
          isComplete: false,
        };
      }),
      generateTasks: vi.fn(async (projectBriefUri, options, progressCallback) => {
        // Call the progress callback a few times to simulate progress
        if (progressCallback) {
          progressCallback({
            progress: 25,
            message: 'Analyzing project brief',
            stage: 'analysis',
            steps: ['analysis', 'planning', 'generation'],
            currentStepNumber: 1,
            elapsedTime: 1000,
          });

          progressCallback({
            progress: 50,
            message: 'Planning task structure',
            stage: 'planning',
            steps: ['analysis', 'planning', 'generation'],
            currentStepNumber: 2,
            elapsedTime: 2000,
          });

          progressCallback({
            progress: 75,
            message: 'Generating tasks',
            stage: 'generation',
            steps: ['analysis', 'planning', 'generation'],
            currentStepNumber: 3,
            elapsedTime: 3000,
          });

          progressCallback({
            progress: 100,
            message: 'Task generation complete',
            stage: 'complete',
            steps: ['analysis', 'planning', 'generation', 'complete'],
            currentStepNumber: 4,
            elapsedTime: 4000,
          });
        }

        return {
          tasks: [
            { id: '1', title: 'Task 1', description: 'Description for Task 1' },
            { id: '2', title: 'Task 2', description: 'Description for Task 2' },
          ],
          tasksPath: '/mock/project/apm-artifacts/artifacts.json',
          markdownPath: '/mock/project/apm-artifacts/project-brief.md',
        };
      }),
    },
  }));
}

// Helper function to extract data from response
export function extractResponseData(response: any, path?: string) {
  if (!response || !response.content || !response.content[0]?.text) {
    return null;
  }

  try {
    const data = JSON.parse(response.content[0].text);

    if (!path) {
      return data;
    }

    // Extract nested property with dot notation (e.g., 'data.task')
    return path.split('.').reduce((obj, key) => obj?.[key], data);
  } catch (_error) {
    return null;
  }
}

// Helper function to check if response is an error
export function isErrorResponse(response: any) {
  return response?.isError === true;
}
