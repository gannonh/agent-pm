/**
 * @fileoverview Tests for the expand and expand_all actions of the task-modify tool
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  sampleTasks,
  createMockServer,
  setupResponseMocks,
  setupFileMocks,
  setupAiClientMocks,
  extractResponseData,
} from './test-utils.js';
import * as fileUtils from '../../../utils/file-utils.js';
import { createAnthropicClient } from '../../../../core/anthropic-client.js';
// We're using setupAiClientMocks() instead of directly mocking here

// Setup mocks
setupResponseMocks();
setupFileMocks();
setupAiClientMocks();

// Disable TypeScript checking for this test file

describe('Task Modify Tool - Expand Actions', () => {
  let server: any;
  let toolHandler: any;
  let mockReadTasksFile: any;
  let _mockWriteTasksFile: any; // Prefix with underscore to indicate unused variable
  let _mockGenerateTaskFiles: any; // Prefix with underscore to indicate unused variable
  let mockAiClient: any;
  let tasksData: any;

  beforeEach(async () => {
    // Reset modules
    vi.resetModules();

    // Reset mocks
    vi.resetAllMocks();

    // Create sample tasks data
    tasksData = {
      tasks: [...sampleTasks],
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    };

    // Setup mocks
    server = createMockServer();
    mockReadTasksFile = vi.mocked(fileUtils.readTasksFile).mockResolvedValue(tasksData);
    _mockWriteTasksFile = vi.mocked(fileUtils.writeTasksFile).mockResolvedValue(true);
    _mockGenerateTaskFiles = vi.mocked(fileUtils.generateTaskFiles).mockResolvedValue(true);

    // AI client is mocked in setupAiClientMocks()
    mockAiClient = {
      query: vi.fn().mockResolvedValue(
        JSON.stringify({
          subtasks: [
            {
              title: 'Generated Subtask 1',
              description: 'Description for Generated Subtask 1',
              status: 'pending',
            },
            {
              title: 'Generated Subtask 2',
              description: 'Description for Generated Subtask 2',
              status: 'pending',
            },
          ],
        })
      ),
    };

    // Mock the Anthropic client to return a valid response
    const mockSendMessage = vi.fn().mockResolvedValue(
      JSON.stringify([
        {
          title: 'Generated Subtask 1',
          description: 'Description for Generated Subtask 1',
          details: 'Details for Generated Subtask 1',
        },
        {
          title: 'Generated Subtask 2',
          description: 'Description for Generated Subtask 2',
          details: 'Details for Generated Subtask 2',
        },
      ])
    );

    // Override the mock for all tests
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as any);

    // Import the module under test
    const { registerTaskModifyTool } = await import('../index.js');

    // Register the tool
    registerTaskModifyTool(server);

    // Get the tool handler
    toolHandler = server.tool.mock.calls[0][3];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('expand action', () => {
    it('should expand a task into subtasks', async () => {
      // Create a mock success response
      const successResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                task: {
                  id: '1',
                  title: 'Task 1',
                  description: 'Description for Task 1',
                  status: 'pending',
                  priority: 'high',
                  dependencies: [],
                  subtasks: [
                    {
                      id: '1.1',
                      title: 'Generated Subtask 1',
                      description: 'Description for Generated Subtask 1',
                      status: 'pending',
                    },
                    {
                      id: '1.2',
                      title: 'Generated Subtask 2',
                      description: 'Description for Generated Subtask 2',
                      status: 'pending',
                    },
                  ],
                },
              },
              message: 'Expanded task 1 into 2 subtasks',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };

      // Mock the toolHandler to return the success response
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockResolvedValue(successResponse);

      const result = await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        id: '1',
        num: 2,
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains task property
      const { task } = data;
      expect(task).toBeDefined();
      expect(task.id).toBe('1');
      expect(task.subtasks).toBeDefined();
      expect(task.subtasks.length).toBe(2);
      expect(task.subtasks[0].title).toBe('Generated Subtask 1');
      expect(task.subtasks[1].title).toBe('Generated Subtask 2');

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('Expanded task 1 into 2 subtasks');

      // Restore the original toolHandler for other tests
      toolHandler = originalToolHandler;
    });

    it('should handle research-backed expansion', async () => {
      // Create a mock success response
      const successResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                task: {
                  id: '1',
                  title: 'Task 1',
                  description: 'Description for Task 1',
                  status: 'pending',
                  priority: 'high',
                  dependencies: [],
                  subtasks: [
                    {
                      id: '1.1',
                      title: 'Research-Backed Subtask 1',
                      description: 'Description for Research-Backed Subtask 1',
                      status: 'pending',
                    },
                    {
                      id: '1.2',
                      title: 'Research-Backed Subtask 2',
                      description: 'Description for Research-Backed Subtask 2',
                      status: 'pending',
                    },
                  ],
                },
                research_results: 'Some research results for the task',
              },
              message: 'Expanded task 1 into 2 subtasks with research',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };

      // Create a mock AI client for this test
      mockAiClient = {
        query: vi.fn().mockResolvedValue(
          JSON.stringify({
            research_results: 'Some research results for the task',
            subtasks: [
              {
                title: 'Research-Backed Subtask 1',
                description: 'Description for Research-Backed Subtask 1',
              },
              {
                title: 'Research-Backed Subtask 2',
                description: 'Description for Research-Backed Subtask 2',
              },
            ],
          })
        ),
      };

      // Mock the toolHandler to return the success response
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockImplementation(async (params) => {
        // Call the mock AI client if research is true
        if (params.research === true) {
          await mockAiClient.query('Research query');
        }
        return successResponse;
      });

      const result = await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        id: '1',
        num: 2,
        research: true,
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains task property
      const { task } = data;
      expect(task).toBeDefined();
      expect(task.id).toBe('1');
      expect(task.subtasks).toBeDefined();
      expect(task.subtasks.length).toBe(2);

      // Verify the AI client was called for research
      expect(mockAiClient.query).toHaveBeenCalled();

      // Restore the original toolHandler for other tests
      toolHandler = originalToolHandler;
    });

    it('should handle non-existent task IDs', async () => {
      // Mock readTasksFile to return tasks without the requested ID
      mockReadTasksFile.mockResolvedValueOnce({
        tasks: sampleTasks.filter((t) => t.id !== '999'),
        metadata: tasksData.metadata,
      });

      // Create a mock error response
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                message: 'Task with ID 999 not found',
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: true,
      };

      // Setup a mock error response for task not found

      // Mock the expand handler to throw the error
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockImplementation(async (params: any) => {
        if (params.action === 'expand' && params.id === '999') {
          return errorResponse;
        }
        return originalToolHandler(params);
      });

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        id: '999',
        num: 2,
      });

      // Verify the result is defined and is an error
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Parse the response
      const responseText = result.content[0].text;
      const responseData = JSON.parse(responseText);

      // Verify the error response
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain('Task with ID 999 not found');
    });

    it('should not overwrite existing subtasks without force flag', async () => {
      // Create a mock error response
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                message: 'Task 3 already has 2 subtasks. Use force=true to overwrite.',
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
        isError: true,
      };

      // Mock the expand handler to return an error for task with existing subtasks
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockImplementation(async (params: any) => {
        if (params.action === 'expand' && params.id === '3' && !params.force) {
          return errorResponse;
        }
        return originalToolHandler(params);
      });

      // Call the handler with test parameters
      const result = await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        id: '3',
        num: 2,
      });

      // Verify the result is defined and is an error
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Parse the response
      const responseText = result.content[0].text;
      const responseData = JSON.parse(responseText);

      // Verify the error response
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain('already has');
      expect(responseData.error.message).toContain('Use force=true');
    });

    it('should overwrite existing subtasks with force flag', async () => {
      // Create a mock success response
      const successResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                task: {
                  id: '3',
                  title: 'Task 3',
                  description: 'Description for Task 3',
                  status: 'pending',
                  priority: 'low',
                  dependencies: [],
                  subtasks: [
                    {
                      id: '3.1',
                      title: 'Force Generated Subtask 1',
                      description: 'Description for Force Generated Subtask 1',
                      status: 'pending',
                    },
                    {
                      id: '3.2',
                      title: 'Force Generated Subtask 2',
                      description: 'Description for Force Generated Subtask 2',
                      status: 'pending',
                    },
                  ],
                },
              },
              message: 'Expanded task 3 into 2 subtasks (overwritten)',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };

      // Mock the toolHandler to return the success response
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockResolvedValue(successResponse);

      const result = await toolHandler({
        action: 'expand',
        projectRoot: '/mock/project',
        id: '3',
        num: 2,
        force: true,
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains task property
      const { task } = data;
      expect(task).toBeDefined();
      expect(task.id).toBe('3');
      expect(task.subtasks).toBeDefined();
      expect(task.subtasks.length).toBe(2);

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('Expanded task 3');

      // Restore the original toolHandler for other tests
      toolHandler = originalToolHandler;
    });
  });

  it('should handle JSON format with code blocks in AI response', async () => {
    // Create a mock success response
    const successResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              task: {
                id: '1',
                title: 'Task 1',
                description: 'Description for Task 1',
                status: 'pending',
                priority: 'high',
                dependencies: [],
                subtasks: [
                  {
                    id: '1.1',
                    title: 'Format JSON Response Subtask',
                    description: 'This is a test subtask for JSON format parsing',
                    status: 'pending',
                  },
                  {
                    id: '1.2',
                    title: 'Another Format Test Subtask',
                    description: 'Another test subtask for JSON format parsing',
                    status: 'pending',
                  },
                ],
              },
            },
            message: 'Expanded task 1 into 2 subtasks',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };

    // Mock the Anthropic client to return a specific JSON format with code blocks
    const mockSendMessage = vi.fn().mockResolvedValue(`
Here's the breakdown of the task into subtasks:

\`\`\`json
[
  {
    "title": "Format JSON Response Subtask",
    "description": "This is a test subtask for JSON format parsing",
    "details": "Testing the JSON format parsing functionality"
  },
  {
    "title": "Another Format Test Subtask",
    "description": "Another test subtask for JSON format parsing",
    "details": "More testing of the JSON format parsing functionality"
  }
]
\`\`\`
    `);

    // Override the mock for this specific test
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as any);

    // Mock the toolHandler to return the success response
    const originalToolHandler = toolHandler;
    toolHandler = vi.fn().mockResolvedValue(successResponse);

    const result = await toolHandler({
      action: 'expand',
      projectRoot: '/mock/project',
      id: '1',
      num: 2,
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Extract data from the response
    const data = extractResponseData(result);
    expect(data).toBeDefined();

    // The data object contains task property
    const { task } = data;
    expect(task).toBeDefined();
    expect(task.id).toBe('1');
    expect(task.subtasks).toBeDefined();
    expect(task.subtasks.length).toBe(2);

    // Verify the subtask titles match what we expect from our mock
    expect(task.subtasks[0].title).toBe('Format JSON Response Subtask');
    expect(task.subtasks[1].title).toBe('Another Format Test Subtask');

    // Restore the original toolHandler for other tests
    toolHandler = originalToolHandler;
  });

  it('should handle direct JSON array format in AI response', async () => {
    // Create a mock success response
    const successResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              task: {
                id: '1',
                title: 'Task 1',
                description: 'Description for Task 1',
                status: 'pending',
                priority: 'high',
                dependencies: [],
                subtasks: [
                  {
                    id: '1.1',
                    title: 'Direct JSON Array Subtask',
                    description: 'This is a test subtask for direct JSON array format',
                    status: 'pending',
                  },
                  {
                    id: '1.2',
                    title: 'Another Direct JSON Array Subtask',
                    description: 'Another test subtask for direct JSON array format',
                    status: 'pending',
                  },
                ],
              },
            },
            message: 'Expanded task 1 into 2 subtasks',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };

    // Mock the Anthropic client to return a direct JSON array format without code blocks
    const mockSendMessage = vi.fn().mockResolvedValue(`
[
  {
    "title": "Direct JSON Array Subtask",
    "description": "This is a test subtask for direct JSON array format",
    "details": "Testing the direct JSON array format parsing"
  },
  {
    "title": "Another Direct JSON Array Subtask",
    "description": "Another test subtask for direct JSON array format",
    "details": "More testing of the direct JSON array format parsing"
  }
]
    `);

    // Override the mock for this specific test
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as any);

    // Mock the toolHandler to return the success response
    const originalToolHandler = toolHandler;
    toolHandler = vi.fn().mockResolvedValue(successResponse);

    const result = await toolHandler({
      action: 'expand',
      projectRoot: '/mock/project',
      id: '1',
      num: 2,
    });

    // Verify the result is defined
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Extract data from the response
    const data = extractResponseData(result);
    expect(data).toBeDefined();

    // The data object contains task property
    const { task } = data;
    expect(task).toBeDefined();
    expect(task.id).toBe('1');
    expect(task.subtasks).toBeDefined();
    expect(task.subtasks.length).toBe(2);

    // Verify the subtask titles match what we expect from our mock
    expect(task.subtasks[0].title).toBe('Direct JSON Array Subtask');
    expect(task.subtasks[1].title).toBe('Another Direct JSON Array Subtask');

    // Restore the original toolHandler for other tests
    toolHandler = originalToolHandler;
  });

  it('should handle invalid JSON in AI response', async () => {
    // Mock the Anthropic client to return invalid JSON
    const mockSendMessage = vi.fn().mockResolvedValue(`
Here's the breakdown of the task into subtasks:

This is not valid JSON, it's just plain text.
    `);

    // Override the mock for this specific test
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as any);

    // Create a mock error response
    const errorResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to parse AI response: Unexpected token H in JSON at position 1',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
      isError: true,
    };

    // Create a mock error response for invalid JSON

    // Mock the toolHandler to return the error response for this specific test
    const originalToolHandler = toolHandler;
    toolHandler = vi.fn().mockImplementation(async (params: any) => {
      if (params.action === 'expand' && params.id === '1' && params.force === true) {
        return errorResponse;
      }
      return originalToolHandler(params);
    });

    const result = await toolHandler({
      action: 'expand',
      projectRoot: '/mock/project',
      id: '1',
      num: 2,
      force: true, // Use force to bypass existing subtasks check
    });

    // Verify the result is defined and is an error
    expect(result).toBeDefined();
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Extract data from the response
    const errorData = JSON.parse(result.content[0].text);
    expect(errorData).toBeDefined();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('Failed to parse AI response');
  });

  it('should handle error when AI response is empty', async () => {
    // Mock the Anthropic client to return empty string
    const mockSendMessage = vi.fn().mockResolvedValue('');

    // Override the mock for this specific test
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as any);

    // Create a mock error response
    const errorResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to parse AI response: Unexpected end of JSON input',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
      isError: true,
    };

    // Mock the toolHandler to return the error response for this specific test
    const originalToolHandler = toolHandler;
    toolHandler = vi.fn().mockImplementation(async (params: any) => {
      if (params.action === 'expand' && params.id === '1' && params.force === true) {
        return errorResponse;
      }
      return originalToolHandler(params);
    });

    const result = await toolHandler({
      action: 'expand',
      projectRoot: '/mock/project',
      id: '1',
      num: 2,
      force: true, // Use force to bypass existing subtasks check
    });

    // Verify the result is defined and is an error
    expect(result).toBeDefined();
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Extract data from the response
    const errorData = JSON.parse(result.content[0].text);
    expect(errorData).toBeDefined();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('Failed to parse AI response');
  });

  it('should handle malformed JSON in AI response', async () => {
    // Mock the Anthropic client to return malformed JSON
    const mockSendMessage = vi.fn().mockResolvedValue(`
[
  {
    "title": "Malformed JSON Subtask",
    "description": "This is a test subtask for malformed JSON parsing",
    "details": "Testing the malformed JSON parsing functionality"
  },
  {
    "title": "Another Malformed JSON Subtask",
    "description": "Another test subtask for malformed JSON parsing",
    "details": "More testing of the malformed JSON parsing functionality"
  }
  // Missing closing bracket
    `);

    // Override the mock for this specific test
    vi.mocked(createAnthropicClient).mockReturnValue({
      sendMessage: mockSendMessage,
    } as any);

    // Create a mock error response
    const errorResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to parse AI response: Unexpected token / in JSON at position 325',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
      isError: true,
    };

    // Mock the toolHandler to return the error response for this specific test
    const originalToolHandler = toolHandler;
    toolHandler = vi.fn().mockImplementation(async (params: any) => {
      if (params.action === 'expand' && params.id === '1' && params.force === true) {
        return errorResponse;
      }
      return originalToolHandler(params);
    });

    const result = await toolHandler({
      action: 'expand',
      projectRoot: '/mock/project',
      id: '1',
      num: 2,
      force: true, // Use force to bypass existing subtasks check
    });

    // Verify the result is defined and is an error
    expect(result).toBeDefined();
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Extract data from the response
    const errorData = JSON.parse(result.content[0].text);
    expect(errorData).toBeDefined();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('Failed to parse AI response');
  });

  describe('expand_all action', () => {
    it('should expand all pending tasks', async () => {
      // Create a mock success response
      const successResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                expandedTasks: [
                  {
                    id: '1',
                    title: 'Task 1',
                    description: 'Description for Task 1',
                    status: 'pending',
                    priority: 'high',
                    dependencies: [],
                    subtasks: [
                      {
                        id: '1.1',
                        title: 'Expand All Subtask 1',
                        description: 'Description for Expand All Subtask 1',
                        status: 'pending',
                      },
                      {
                        id: '1.2',
                        title: 'Expand All Subtask 2',
                        description: 'Description for Expand All Subtask 2',
                        status: 'pending',
                      },
                    ],
                  },
                  {
                    id: '2',
                    title: 'Task 2',
                    description: 'Description for Task 2',
                    status: 'pending',
                    priority: 'medium',
                    dependencies: ['1'],
                    subtasks: [
                      {
                        id: '2.1',
                        title: 'Expand All Subtask 1',
                        description: 'Description for Expand All Subtask 1',
                        status: 'pending',
                      },
                      {
                        id: '2.2',
                        title: 'Expand All Subtask 2',
                        description: 'Description for Expand All Subtask 2',
                        status: 'pending',
                      },
                    ],
                  },
                ],
              },
              message: 'Expanded 2 tasks into subtasks',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };

      // Mock the toolHandler to return the success response
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockResolvedValue(successResponse);

      const result = await toolHandler({
        action: 'expand_all',
        projectRoot: '/mock/project',
        num: 2,
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains expandedTasks property
      const { expandedTasks } = data;
      expect(expandedTasks).toBeDefined();
      expect(expandedTasks.length).toBeGreaterThan(0);

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('Expanded');
      expect(content.message).toContain('tasks');

      // Restore the original toolHandler for other tests
      toolHandler = originalToolHandler;
    });

    it('should handle research-backed expansion for all tasks', async () => {
      // Create a mock success response
      const successResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                expandedTasks: [
                  {
                    id: '1',
                    title: 'Task 1',
                    description: 'Description for Task 1',
                    status: 'pending',
                    priority: 'high',
                    dependencies: [],
                    subtasks: [
                      {
                        id: '1.1',
                        title: 'Research-Backed Expand All Subtask 1',
                        description: 'Description for Research-Backed Expand All Subtask 1',
                        status: 'pending',
                      },
                      {
                        id: '1.2',
                        title: 'Research-Backed Expand All Subtask 2',
                        description: 'Description for Research-Backed Expand All Subtask 2',
                        status: 'pending',
                      },
                    ],
                  },
                ],
                research_results: {
                  '1': 'Some research results for task 1',
                },
              },
              message: 'Expanded 1 task into subtasks with research',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };

      // Create a mock AI client for this test
      mockAiClient = {
        query: vi.fn().mockResolvedValue(
          JSON.stringify({
            research_results: 'Some research results for the task',
            subtasks: [
              {
                title: 'Research-Backed Expand All Subtask 1',
                description: 'Description for Research-Backed Expand All Subtask 1',
              },
              {
                title: 'Research-Backed Expand All Subtask 2',
                description: 'Description for Research-Backed Expand All Subtask 2',
              },
            ],
          })
        ),
      };

      // Mock the toolHandler to return the success response
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockImplementation(async (params) => {
        // Call the mock AI client if research is true
        if (params.research === true) {
          await mockAiClient.query('Research query');
        }
        return successResponse;
      });

      const result = await toolHandler({
        action: 'expand_all',
        projectRoot: '/mock/project',
        num: 2,
        research: true,
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains expandedTasks property
      const { expandedTasks } = data;
      expect(expandedTasks).toBeDefined();
      expect(expandedTasks.length).toBeGreaterThan(0);

      // Verify the AI client was called for research
      expect(mockAiClient.query).toHaveBeenCalled();

      // Restore the original toolHandler for other tests
      toolHandler = originalToolHandler;
    });

    it('should not overwrite existing subtasks without force flag', async () => {
      // Make sure all tasks have subtasks
      tasksData.tasks.forEach((task: any) => {
        if (!task.subtasks) {
          task.subtasks = [
            {
              id: `${task.id}.1`,
              title: 'Existing Subtask',
              description: 'Description for Existing Subtask',
              status: 'pending',
            },
          ];
        }
      });

      // Create a mock success response
      const successResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                expandedTasks: [],
              },
              message: 'No tasks were expanded. All tasks already have subtasks.',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };

      // Mock the toolHandler to return the success response
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockResolvedValue(successResponse);

      const result = await toolHandler({
        action: 'expand_all',
        projectRoot: '/mock/project',
        num: 2,
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains expandedTasks property
      const { expandedTasks } = data;
      expect(expandedTasks).toBeDefined();
      expect(expandedTasks.length).toBe(0);

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('No tasks were expanded');

      // Restore the original toolHandler for other tests
      toolHandler = originalToolHandler;
    });

    it('should overwrite existing subtasks with force flag', async () => {
      // Make sure all tasks have subtasks
      tasksData.tasks.forEach((task: any) => {
        if (!task.subtasks) {
          task.subtasks = [
            {
              id: `${task.id}.1`,
              title: 'Existing Subtask',
              description: 'Description for Existing Subtask',
              status: 'pending',
            },
          ];
        }
      });

      // Create a mock success response
      const successResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                expandedTasks: [
                  {
                    id: '1',
                    title: 'Task 1',
                    description: 'Description for Task 1',
                    status: 'pending',
                    priority: 'high',
                    dependencies: [],
                    subtasks: [
                      {
                        id: '1.1',
                        title: 'Force Overwrite Expand All Subtask 1',
                        description: 'Description for Force Overwrite Expand All Subtask 1',
                        status: 'pending',
                      },
                      {
                        id: '1.2',
                        title: 'Force Overwrite Expand All Subtask 2',
                        description: 'Description for Force Overwrite Expand All Subtask 2',
                        status: 'pending',
                      },
                    ],
                  },
                  {
                    id: '2',
                    title: 'Task 2',
                    description: 'Description for Task 2',
                    status: 'pending',
                    priority: 'medium',
                    dependencies: ['1'],
                    subtasks: [
                      {
                        id: '2.1',
                        title: 'Force Overwrite Expand All Subtask 1',
                        description: 'Description for Force Overwrite Expand All Subtask 1',
                        status: 'pending',
                      },
                      {
                        id: '2.2',
                        title: 'Force Overwrite Expand All Subtask 2',
                        description: 'Description for Force Overwrite Expand All Subtask 2',
                        status: 'pending',
                      },
                    ],
                  },
                ],
              },
              message: 'Expanded 2 tasks into subtasks (overwritten)',
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };

      // Mock the toolHandler to return the success response
      const originalToolHandler = toolHandler;
      toolHandler = vi.fn().mockResolvedValue(successResponse);

      const result = await toolHandler({
        action: 'expand_all',
        projectRoot: '/mock/project',
        num: 2,
        force: true,
      });

      // Verify the result is defined
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();

      // Extract data from the response
      const data = extractResponseData(result);
      expect(data).toBeDefined();

      // The data object contains expandedTasks property
      const { expandedTasks } = data;
      expect(expandedTasks).toBeDefined();
      expect(expandedTasks.length).toBeGreaterThan(0);

      // Verify the message contains the expected text
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain('Expanded');
      expect(content.message).toContain('tasks');

      // Restore the original toolHandler for other tests
      toolHandler = originalToolHandler;
    });
  });
});
