/**
 * @fileoverview Test helper utilities for working with MCP responses
 */

import { describe, it, expect } from 'vitest';

describe('Test Helpers', () => {
  it('should provide utility functions for testing MCP responses', () => {
    expect(extractResponseData).toBeDefined();
    expect(isErrorResponse).toBeDefined();
    expect(getErrorDetails).toBeDefined();
    expect(getResponseMessage).toBeDefined();
    expect(getSessionId).toBeDefined();
    expect(getResponseContext).toBeDefined();
    expect(getOperationInfo).toBeDefined();
  });
});

/**
 * Extracts data from an enhanced response payload
 * This function abstracts away the response structure, making tests more resilient to changes
 *
 * @param response The response object from an MCP tool
 * @param path Optional dot-notation path to extract specific data (e.g., 'data.nextTask')
 * @returns The extracted data
 */
export function extractResponseData<T = Record<string, unknown>>(
  response: { content: Array<{ text: string }> },
  path?: string
): T {
  // Parse the JSON response
  const parsedResponse = JSON.parse(response.content[0].text);

  // If no path is provided, return the entire data object
  if (!path) {
    return parsedResponse.data as T;
  }

  // Split the path into segments
  const segments = path.split('.');

  // Start with the parsed response
  let current = parsedResponse as Record<string, unknown>;

  // Traverse the path
  for (const segment of segments) {
    if (current === undefined || current === null) {
      return null as unknown as T;
    }
    // Need to cast to Record<string, unknown> at each level
    current = current[segment] as Record<string, unknown>;
  }

  return current as T;
}

/**
 * Checks if a response is an error
 *
 * @param response The response object from an MCP tool
 * @returns True if the response is an error
 */
export function isErrorResponse(response: {
  isError?: boolean;
  content?: Array<{ text: string }>;
}): boolean {
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

/**
 * Gets the error details from an error response
 *
 * @param response The error response object from an MCP tool
 * @returns The error details
 */
export function getErrorDetails(response: {
  content?: Array<{ text: string }>;
}): Record<string, unknown> {
  try {
    if (!response || !response.content || !response.content[0] || !response.content[0].text) {
      return { message: 'Unknown error', code: 'UNKNOWN_ERROR' };
    }
    const parsedResponse = JSON.parse(response.content[0].text);

    // Handle different error response formats
    if (parsedResponse.error && typeof parsedResponse.error === 'string') {
      return { message: parsedResponse.error, code: 'ERROR' };
    }

    if (parsedResponse.error && typeof parsedResponse.error === 'object') {
      return parsedResponse.error;
    }

    if (parsedResponse.data?.error) {
      return parsedResponse.data.error;
    }

    // If we can't find a structured error, look for error messages in the response
    const responseText = response.content[0].text;
    if (responseText.includes('Failed to read PRD file')) {
      return { message: 'Failed to read PRD file', code: 'FILE_ERROR' };
    }

    if (responseText.includes('Either prdText or input must be provided')) {
      return { message: 'Either prdText or input must be provided', code: 'VALIDATION_ERROR' };
    }

    if (responseText.includes('Operation not found')) {
      return { message: 'Operation not found', code: 'NOT_FOUND' };
    }

    if (responseText.includes('Result not available')) {
      return { message: 'Result not available', code: 'NOT_FOUND' };
    }

    if (responseText.includes('PRD_PARSE_ERROR')) {
      return { message: 'Failed to parse PRD', code: 'PRD_PARSE_ERROR' };
    }

    return { message: 'Unknown error', code: 'UNKNOWN_ERROR' };
  } catch (_error) {
    // If we can't parse the response, return a generic error
    return { message: 'Unknown error', code: 'UNKNOWN_ERROR' };
  }
}

/**
 * Gets the message from a response
 *
 * @param response The response object from an MCP tool
 * @returns The message
 */
export function getResponseMessage(response: { content?: Array<{ text: string }> }): string {
  try {
    if (!response || !response.content || !response.content[0] || !response.content[0].text) {
      return '';
    }
    const parsedResponse = JSON.parse(response.content[0].text);
    return parsedResponse.message || '';
  } catch (_error) {
    return '';
  }
}

/**
 * Gets the raw parsed response
 *
 * @param response The response object from an MCP tool
 * @returns The raw parsed response
 */
export function getRawResponse(response: { content?: Array<{ text: string }> }): unknown {
  try {
    if (!response || !response.content || !response.content[0] || !response.content[0].text) {
      return null;
    }
    return JSON.parse(response.content[0].text);
  } catch (_error) {
    return null;
  }
}

/**
 * Gets the session ID from a response
 *
 * @param response The response object from an MCP tool
 * @returns The session ID
 */
export function getSessionId(response: { content?: Array<{ text: string }> }): string | undefined {
  try {
    if (!response || !response.content || !response.content[0] || !response.content[0].text) {
      return undefined;
    }
    const parsedResponse = JSON.parse(response.content[0].text);
    return parsedResponse.memory?.sessionId;
  } catch (_error) {
    return undefined;
  }
}

/**
 * Gets the context from a response
 *
 * @param response The response object from an MCP tool
 * @returns The context
 */
export function getResponseContext(response: {
  content?: Array<{ text: string }>;
}): Record<string, unknown> | undefined {
  try {
    if (!response || !response.content || !response.content[0] || !response.content[0].text) {
      return undefined;
    }
    const parsedResponse = JSON.parse(response.content[0].text);
    return parsedResponse.memory?.context;
  } catch (_error) {
    return undefined;
  }
}

/**
 * Gets the operation information from a response
 *
 * @param response The response object from an MCP tool
 * @returns The operation information
 */
export function getOperationInfo(response: { content?: Array<{ text: string }> }):
  | {
      id: string;
      status: string;
    }
  | undefined {
  try {
    if (!response || !response.content || !response.content[0] || !response.content[0].text) {
      return undefined;
    }
    const parsedResponse = JSON.parse(response.content[0].text);
    return parsedResponse.operation;
  } catch (_error) {
    return undefined;
  }
}
