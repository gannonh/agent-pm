/**
 * @fileoverview Test utilities for the dependencies tool tests
 */

import { vi } from 'vitest';

// Sample tasks for testing
export const sampleTasks = [
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
    dependencies: ['2'],
    subtasks: [
      {
        id: '1',
        title: 'Subtask 3.1',
        description: 'Description for Subtask 3.1',
        status: 'pending',
        dependencies: [],
      },
      {
        id: '2',
        title: 'Subtask 3.2',
        description: 'Description for Subtask 3.2',
        status: 'pending',
        dependencies: ['3.1'],
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

// Setup response mocks
export function setupResponseMocks() {
  vi.mock('../../../utils/response.js', () => ({
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

// Setup file mocks
export function setupFileMocks() {
  vi.mock('../../../utils/file-utils.js', () => ({
    readTasksFile: vi.fn(),
    writeTasksFile: vi.fn(),
    generateTaskFiles: vi.fn(),
  }));
}

// Extract data from a response
export function extractResponseData(response: any) {
  if (!response || !response.content || !response.content[0]?.text) {
    return null;
  }

  try {
    return JSON.parse(response.content[0].text);
  } catch (_error) {
    return null;
  }
}

// Check if a response is an error
export function isErrorResponse(response: any) {
  return response?.isError === true;
}
