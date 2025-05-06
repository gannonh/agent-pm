/**
 * @fileoverview Test utilities for task-modify tests
 */

import { vi } from 'vitest';
// Import Task type directly from the task.d.ts file
import type { Task } from '../../../../types/task.js';

// Sample tasks for testing
export const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Task 1',
    description: 'Description for Task 1',
    status: 'pending',
    priority: 'high',
    dependencies: [],
  },
  {
    id: '2',
    title: 'Task 2',
    description: 'Description for Task 2',
    status: 'pending',
    priority: 'medium',
    dependencies: ['1'],
  },
  {
    id: '3',
    title: 'Task 3',
    description: 'Description for Task 3',
    status: 'pending',
    priority: 'low',
    dependencies: [],
    subtasks: [
      {
        id: '3.1',
        title: 'Subtask 3.1',
        description: 'Description for Subtask 3.1',
        status: 'done',
      },
      {
        id: '3.2',
        title: 'Subtask 3.2',
        description: 'Description for Subtask 3.2',
        status: 'pending',
      },
    ],
  },
];

// Create a mock server
export function createMockServer() {
  return {
    capabilities: {
      serverInfo: { name: 'Test Server', version: '1.0.0' },
    },
    tool: vi.fn(),
  };
}

// Mock response utilities
export function setupResponseMocks() {
  vi.mock('../../../utils/response.js', () => {
    // Mock implementation of createEnhancedResponse
    const createEnhancedResponse = (options: any) => {
      const {
        data,
        sessionId = 'mock-session-id',
        context = {},
        operationId,
        operationStatus,
        message,
        isError = false,
        metadata,
        _includeDebug = false,
        requestId = 'mock-request-id',
        userCommunication,
        waitTimeInfo,
        agentInstructions,
      } = options;

      // Start with the basic response structure
      const response: any = {
        success: !isError,
        data,
      };

      // Add message if provided
      if (message) {
        response.message = message;
      }

      // Add memory/context information
      response.memory = {
        sessionId,
        context,
      };

      // Add operation information if provided
      if (operationId) {
        response.operation = {
          id: operationId,
          status: operationStatus || 'unknown',
        };
      }

      // Add user communication guidance if provided
      if (userCommunication) {
        response.userCommunication = userCommunication;
      }

      // Add wait time information if provided
      if (waitTimeInfo) {
        response.waitTimeInfo = waitTimeInfo;
      }

      // Add agent instructions if provided
      if (agentInstructions) {
        response.agentInstructions = agentInstructions;
      }

      // Add timestamp
      response.timestamp = new Date().toISOString();

      // Add request ID for correlation
      response.requestId = requestId;

      // Add metadata if provided
      if (metadata) {
        response.metadata = metadata;
      }

      return response;
    };

    // Mock implementation of createMcpResponse
    const createMcpResponse = (options: any) => {
      const responseData = createEnhancedResponse(options);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(responseData),
          },
        ],
        isError: options.isError === true,
      };
    };

    // Mock implementation of create_enhanced_payload
    const create_enhanced_payload = (data: any, options = {}) => {
      return createMcpResponse({
        data,
        ...options,
      });
    };

    // Mock implementation of create_success_payload
    const create_success_payload = (data: any, message?: string, options = {}) => {
      return create_enhanced_payload(data, {
        message,
        isError: false,
        ...options,
      });
    };

    // Mock implementation of create_error_payload
    const create_error_payload = (errorData: any, message: string, options = {}) => {
      return create_enhanced_payload(errorData, {
        message,
        isError: true,
        ...options,
      });
    };

    return {
      createEnhancedResponse: vi.fn().mockImplementation(createEnhancedResponse),
      createMcpResponse: vi.fn().mockImplementation(createMcpResponse),
      create_enhanced_payload: vi.fn().mockImplementation(create_enhanced_payload),
      create_success_payload: vi.fn().mockImplementation(create_success_payload),
      create_error_payload: vi.fn().mockImplementation(create_error_payload),
    };
  });
}

// Mock file utilities
export function setupFileMocks() {
  vi.mock('../../../utils/file-utils.js', () => ({
    readTasksFile: vi.fn(),
    writeTasksFile: vi.fn(),
    generateTaskFiles: vi.fn(),
  }));
}

// Mock AI client
export function setupAiClientMocks() {
  // Mock the core AI clients instead of the utils/ai-client.js that doesn't exist
  vi.mock('../../../../core/anthropic-client.js', () => ({
    createAnthropicClient: vi.fn().mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue(
        JSON.stringify([
          {
            title: 'Generated Subtask 1',
            description: 'Description for Generated Subtask 1',
            details: 'Details for Generated Subtask 1',
          },
        ])
      ),
    }),
  }));

  vi.mock('../../../../core/perplexity-client.js', () => ({
    createPerplexityClient: vi.fn().mockReturnValue({
      query: vi.fn().mockResolvedValue({
        query: 'Research this topic',
        results: [
          {
            title: 'Research Result 1',
            snippet: 'This is a snippet from the research result',
            url: 'https://example.com/research1',
          },
        ],
        timestamp: new Date().toISOString(),
      }),
    }),
  }));
}

// Helper function to check if a response is an error
export function isErrorResponse(response: any): boolean {
  if (!response) {
    return false;
  }

  // For tests, we need to handle mock responses that don't have isError property
  if (response.isError === true) {
    return true;
  }

  try {
    if (!response.content || !response.content[0] || !response.content[0].text) {
      return false;
    }
    const parsedResponse = JSON.parse(response.content[0].text);
    return parsedResponse.success === false;
  } catch (_error) {
    return false;
  }
}

// Helper function to extract data from a response
export function extractResponseData(response: any, path?: string): any {
  if (!response || !response.content || !response.content[0] || !response.content[0].text) {
    return null;
  }

  try {
    const parsedResponse = JSON.parse(response.content[0].text);

    // For our mock responses, we need to handle the data property
    const data = parsedResponse.data || parsedResponse;

    if (!path) {
      return data;
    }

    // Split the path into segments
    const segments = path.split('.');

    // Start with the data
    let current = data;

    // Traverse the path
    for (const segment of segments) {
      if (current === undefined || current === null) {
        return null;
      }
      current = current[segment];
    }

    return current;
  } catch (_error) {
    console.error('Error parsing response:', _error);
    return null;
  }
}

// Add test suite
import { describe, it, expect } from 'vitest';
import * as responseUtils from '../../../utils/response.js';
import * as fileUtils from '../../../utils/file-utils.js';
import * as anthropicClient from '../../../../core/anthropic-client.js';
import * as perplexityClient from '../../../../core/perplexity-client.js';

describe('Task Modify Test Utilities', () => {
  it('should create a mock server with correct capabilities', () => {
    const mockServer = createMockServer();
    expect(mockServer.capabilities.serverInfo.name).toBe('Test Server');
    expect(mockServer.capabilities.serverInfo.version).toBe('1.0.0');
    expect(mockServer.tool).toBeDefined();
  });

  it('should setup response mocks correctly', () => {
    setupResponseMocks();
    expect(responseUtils.createEnhancedResponse).toBeDefined();
    expect(responseUtils.createMcpResponse).toBeDefined();
    expect(responseUtils.create_enhanced_payload).toBeDefined();
    expect(responseUtils.create_success_payload).toBeDefined();
    expect(responseUtils.create_error_payload).toBeDefined();
  });

  it('should setup file mocks correctly', () => {
    setupFileMocks();
    expect(fileUtils.readTasksFile).toBeDefined();
    expect(fileUtils.writeTasksFile).toBeDefined();
    expect(fileUtils.generateTaskFiles).toBeDefined();
  });

  it('should setup AI client mocks correctly', () => {
    setupAiClientMocks();
    expect(anthropicClient.createAnthropicClient).toBeDefined();
    expect(perplexityClient.createPerplexityClient).toBeDefined();
  });

  it('should correctly identify error responses', () => {
    const errorResponse = {
      isError: true,
      content: [{ text: JSON.stringify({ success: false }) }],
    };
    const successResponse = {
      isError: false,
      content: [{ text: JSON.stringify({ success: true }) }],
    };
    expect(isErrorResponse(errorResponse)).toBe(true);
    expect(isErrorResponse(successResponse)).toBe(false);
  });

  it('should correctly extract data from responses', () => {
    const response = {
      content: [{ text: JSON.stringify({ data: { test: 'value' } }) }],
    };
    expect(extractResponseData(response)).toEqual({ test: 'value' });
    expect(extractResponseData(response, 'test')).toBe('value');
  });
});
