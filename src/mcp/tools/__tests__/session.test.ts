import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCPSessionError } from '../../errors/index.js';

// Create shared mocks using vi.hoisted
const mocks = vi.hoisted(() => ({
  sessionManager: {
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSessionContext: vi.fn(),
    destroySession: vi.fn(),
  },
  validateParams: vi.fn((params) => params),
  handleError: vi.fn((error) => ({
    content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
    isError: true,
  })),
  createEnhancedResponse: vi.fn((options) =>
    JSON.stringify({
      success: !options.isError,
      data: options.data,
      message: options.message,
      timestamp: '2023-01-01T00:00:00.000Z',
    })
  ),
  createMcpResponse: vi.fn((options) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: !options.isError,
          data: options.data,
          message: options.message,
          timestamp: '2023-01-01T00:00:00.000Z',
        }),
      },
    ],
    isError: options.isError === true,
  })),
  create_error_payload: vi.fn((errorData, message, _options = {}) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: errorData,
          message,
          timestamp: '2023-01-01T00:00:00.000Z',
        }),
      },
    ],
    isError: true,
  })),
}));

// Mock dependencies
vi.mock('../../session/manager.js', () => ({
  sessionManager: mocks.sessionManager,
}));

vi.mock('../validation/index.js', () => ({
  validateParams: mocks.validateParams,
}));

vi.mock('../errors/handler.js', () => ({
  handleError: mocks.handleError,
}));

vi.mock('../../utils/response.ts', () => ({
  createEnhancedResponse: mocks.createEnhancedResponse,
  createMcpResponse: mocks.createMcpResponse,
  create_error_payload: mocks.create_error_payload,
}));

describe('Session Tools', () => {
  // Define types for handlers
  let serverMock: { tool: ReturnType<typeof vi.fn> };
  let createSessionHandler: any;
  let getSessionHandler: any;
  let updateSessionHandler: any;
  let destroySessionHandler: any;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Create a mock server that captures the handler functions
    serverMock = {
      tool: vi.fn().mockImplementation((name, _description, _schema, handler) => {
        if (name === 'apm_create_session') {
          createSessionHandler = handler;
        } else if (name === 'apm_get_session') {
          getSessionHandler = handler;
        } else if (name === 'apm_update_session') {
          updateSessionHandler = handler;
        } else if (name === 'apm_destroy_session') {
          destroySessionHandler = handler;
        }
      }),
    };

    // Set up mock session data
    const mockSession = {
      id: 'session-123',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      context: { key: 'value' },
      operations: {},
    };

    // Set up mock implementations
    mocks.sessionManager.createSession.mockReturnValue(mockSession);
    mocks.sessionManager.getSession.mockImplementation((sessionId) => {
      if (sessionId === 'session-123') {
        return mockSession;
      }
      throw new MCPSessionError(`Session not found: ${sessionId}`);
    });
    mocks.sessionManager.updateSessionContext.mockImplementation((sessionId, context, merge) => {
      if (sessionId === 'session-123') {
        return {
          ...mockSession,
          context: merge ? { ...mockSession.context, ...context } : context,
          updatedAt: '2023-01-01T00:00:01.000Z',
        };
      }
      throw new MCPSessionError(`Session not found: ${sessionId}`);
    });
    mocks.sessionManager.destroySession.mockImplementation((sessionId) => {
      return sessionId === 'session-123';
    });
  });

  it('should register all session tools with the server', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Call the function
    registerSessionTools(serverMock as unknown as McpServer);

    // Verify that server.tool was called for each session tool
    expect(serverMock.tool).toHaveBeenCalledTimes(4);

    // Verify that each tool was registered with the correct name
    const toolNames = vi.mocked(serverMock.tool).mock.calls.map((call: any) => call[0]);
    expect(toolNames).toContain('apm_create_session');
    expect(toolNames).toContain('apm_get_session');
    expect(toolNames).toContain('apm_update_session');
    expect(toolNames).toContain('apm_destroy_session');
  });

  it('should create a session successfully', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Register the tools (this will set up createSessionHandler)
    registerSessionTools(serverMock as unknown as McpServer);

    // Ensure the handler was captured
    expect(createSessionHandler).toBeDefined();

    // Call the handler with test parameters
    const result = await createSessionHandler({
      initialContext: { testKey: 'testValue' },
      timeout: 3600000,
    });

    // Verify the sessionManager.createSession was called with correct parameters
    expect(mocks.sessionManager.createSession).toHaveBeenCalledWith({
      initialContext: { testKey: 'testValue' },
      timeout: 3600000,
    });

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response JSON
    const response = JSON.parse(result.content[0].text);

    // Verify the response data
    expect(response.success).toBe(true);
    expect(response.message).toBe('Session created successfully');
    expect(response.data.sessionId).toBe('session-123');
    expect(response.data.createdAt).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should get a session successfully', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Register the tools (this will set up getSessionHandler)
    registerSessionTools(serverMock as unknown as McpServer);

    // Ensure the handler was captured
    expect(getSessionHandler).toBeDefined();

    // Call the handler with test parameters
    const result = await getSessionHandler({
      sessionId: 'session-123',
    });

    // Verify the sessionManager.getSession was called with correct parameters
    expect(mocks.sessionManager.getSession).toHaveBeenCalledWith('session-123');

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response JSON
    const response = JSON.parse(result.content[0].text);

    // Verify the response data
    expect(response.success).toBe(true);
    expect(response.message).toBe('Session retrieved successfully');
    expect(response.data.session).toBeDefined();
    expect(response.data.session.id).toBe('session-123');
    expect(response.data.session.context).toEqual({ key: 'value' });
  });

  it('should update a session successfully', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Register the tools (this will set up updateSessionHandler)
    registerSessionTools(serverMock as unknown as McpServer);

    // Ensure the handler was captured
    expect(updateSessionHandler).toBeDefined();

    // Call the handler with test parameters
    const result = await updateSessionHandler({
      sessionId: 'session-123',
      context: { newKey: 'newValue' },
      merge: true,
    });

    // Verify the sessionManager.updateSessionContext was called with correct parameters
    expect(mocks.sessionManager.updateSessionContext).toHaveBeenCalledWith(
      'session-123',
      { newKey: 'newValue' },
      true
    );

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response JSON
    const response = JSON.parse(result.content[0].text);

    // Verify the response data
    expect(response.success).toBe(true);
    expect(response.message).toBe('Session updated successfully');
    expect(response.data.sessionId).toBe('session-123');
    expect(response.data.updatedAt).toBe('2023-01-01T00:00:01.000Z');
  });

  it('should destroy a session successfully', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Register the tools (this will set up destroySessionHandler)
    registerSessionTools(serverMock as unknown as McpServer);

    // Ensure the handler was captured
    expect(destroySessionHandler).toBeDefined();

    // Call the handler with test parameters
    const result = await destroySessionHandler({
      sessionId: 'session-123',
    });

    // Verify the sessionManager.destroySession was called with correct parameters
    expect(mocks.sessionManager.destroySession).toHaveBeenCalledWith('session-123');

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response JSON
    const response = JSON.parse(result.content[0].text);

    // Verify the response data
    expect(response.success).toBe(true);
    expect(response.message).toBe('Session destroyed successfully');
    expect(response.data.sessionId).toBe('session-123');
    expect(response.data.destroyed).toBe(true);
  });

  it('should handle session not found when destroying', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Register the tools (this will set up destroySessionHandler)
    registerSessionTools(serverMock as unknown as McpServer);

    // Ensure the handler was captured
    expect(destroySessionHandler).toBeDefined();

    // Call the handler with test parameters
    const result = await destroySessionHandler({
      sessionId: 'non-existent-session-id',
    });

    // Verify the sessionManager.destroySession was called with correct parameters
    expect(mocks.sessionManager.destroySession).toHaveBeenCalledWith('non-existent-session-id');

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response JSON
    const response = JSON.parse(result.content[0].text);

    // Verify the response data
    expect(response.success).toBe(true);
    expect(response.message).toBe('Session not found or already destroyed');
    expect(response.data.sessionId).toBe('non-existent-session-id');
    expect(response.data.destroyed).toBe(false);
  });

  it('should handle errors when creating a session', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Register the tools (this will set up createSessionHandler)
    registerSessionTools(serverMock as unknown as McpServer);

    // Ensure the handler was captured
    expect(createSessionHandler).toBeDefined();

    // Set up the mock to throw an error
    const testError = new Error('Test error');
    mocks.sessionManager.createSession.mockImplementationOnce(() => {
      throw testError;
    });

    // Set up the handleError mock to return an error response
    mocks.handleError.mockReturnValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ error: 'Test error' }) }],
      isError: true,
    });

    // Call the handler with test parameters
    const result = await createSessionHandler({
      initialContext: { testKey: 'testValue' },
    });

    // Verify the result is an error response
    expect(result.isError).toBe(true);
  });

  it('should handle errors when getting a session', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Register the tools (this will set up getSessionHandler)
    registerSessionTools(serverMock as unknown as McpServer);

    // Ensure the handler was captured
    expect(getSessionHandler).toBeDefined();

    // Set up the mock to throw an error
    const sessionError = new MCPSessionError('Session not found: non-existent-session-id');
    mocks.sessionManager.getSession.mockImplementationOnce(() => {
      throw sessionError;
    });

    // Set up the handleError mock to return an error response
    mocks.handleError.mockReturnValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ error: 'Session not found' }) }],
      isError: true,
    });

    // Call the handler with a non-existent session ID
    const result = await getSessionHandler({
      sessionId: 'non-existent-session-id',
    });

    // Verify the result is an error response
    expect(result.isError).toBe(true);
  });

  it('should handle errors when updating a session', async () => {
    // Import the module under test after mocks are set up
    const { registerSessionTools } = await import('../session.js');

    // Register the tools (this will set up updateSessionHandler)
    registerSessionTools(serverMock as unknown as McpServer);

    // Ensure the handler was captured
    expect(updateSessionHandler).toBeDefined();

    // Set up the mock to throw an error
    const sessionError = new MCPSessionError('Session not found: non-existent-session-id');
    mocks.sessionManager.updateSessionContext.mockImplementationOnce(() => {
      throw sessionError;
    });

    // Set up the handleError mock to return an error response
    mocks.handleError.mockReturnValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ error: 'Session not found' }) }],
      isError: true,
    });

    // Call the handler with a non-existent session ID
    const result = await updateSessionHandler({
      sessionId: 'non-existent-session-id',
      context: { newKey: 'newValue' },
    });

    // Verify the result is an error response
    expect(result.isError).toBe(true);
  });
});
