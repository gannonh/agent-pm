import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEnhancedResponse,
  createMcpResponse,
  create_enhanced_payload,
  create_success_payload,
  create_error_payload,
  create_async_operation_payload,
} from '../response.js';
import { sessionManager } from '../../session/manager.js';

// Mock dependencies
vi.mock('../../session/manager.js', () => ({
  sessionManager: {
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSessionContext: vi.fn(),
    addSessionOperation: vi.fn(),
  },
}));

vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid-1234'),
}));

describe('Response utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Date.now and toISOString for consistent testing
    vi.useFakeTimers();
    const mockDate = new Date('2023-01-01T00:00:00.000Z');
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createEnhancedResponse', () => {
    it('should create a basic response with just data', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const result = createEnhancedResponse({ data });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        timestamp: '2023-01-01T00:00:00.000Z',
      });

      // Should not create a session
      expect(sessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should include debug information when includeDebug is true', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const result = createEnhancedResponse({ data, includeDebug: true });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        timestamp: '2023-01-01T00:00:00.000Z',
        debug: {
          options: expect.objectContaining({
            data: '[redacted]',
            includeDebug: true,
          }),
          sessionInfo: { exists: false },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should create a response with a message', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const message = 'Task retrieved successfully';
      const result = createEnhancedResponse({ data, message });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        message,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should create a response with an error', () => {
      const data = { error: 'Task not found' };
      const message = 'Failed to retrieve task';
      const result = createEnhancedResponse({ data, message, isError: true });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: false,
        data,
        message,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should create a new session when context is provided without sessionId', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const context = { userId: 'user-123' };

      // Mock session creation
      const mockSession = {
        id: 'session-123',
        context,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        operations: {},
      };
      vi.mocked(sessionManager.createSession).mockReturnValue(mockSession);

      const result = createEnhancedResponse({ data, context });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        memory: {
          sessionId: 'session-123',
          context,
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      });

      // Should create a session with the context
      expect(sessionManager.createSession).toHaveBeenCalledWith({
        initialContext: context,
      });
    });

    it('should update an existing session when sessionId is provided', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const sessionId = 'session-123';
      const existingContext = { userId: 'user-123' };
      const newContext = { projectId: 'project-456' };
      const mergedContext = { ...existingContext, ...newContext };

      // Mock session retrieval
      const mockSession = {
        id: sessionId,
        context: existingContext,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        operations: {},
      };
      vi.mocked(sessionManager.getSession).mockReturnValue(mockSession);

      // Mock session update
      const mockUpdatedSession = {
        ...mockSession,
        context: mergedContext,
        updatedAt: '2023-01-01T00:00:00.000Z',
      };
      vi.mocked(sessionManager.updateSessionContext).mockReturnValue(mockUpdatedSession);

      const result = createEnhancedResponse({ data, sessionId, context: newContext });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        memory: {
          sessionId,
          context: mergedContext,
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      });

      // Should get the session
      expect(sessionManager.getSession).toHaveBeenCalledWith(sessionId);

      // Should update the session context
      expect(sessionManager.updateSessionContext).toHaveBeenCalledWith(sessionId, newContext);
    });

    it('should create a new session when sessionId is invalid', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const sessionId = 'invalid-session';
      const context = { userId: 'user-123' };

      // Mock session retrieval to throw an error
      vi.mocked(sessionManager.getSession).mockImplementation(() => {
        throw new Error('Session not found');
      });

      // Mock session creation
      const mockSession = {
        id: 'session-456',
        context,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        operations: {},
      };
      vi.mocked(sessionManager.createSession).mockReturnValue(mockSession);

      const result = createEnhancedResponse({ data, sessionId, context });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        memory: {
          sessionId: 'session-456',
          context,
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      });

      // Should try to get the session
      expect(sessionManager.getSession).toHaveBeenCalledWith(sessionId);

      // Should create a new session
      expect(sessionManager.createSession).toHaveBeenCalledWith({
        initialContext: context,
      });
    });

    it('should add operation information when operationId is provided', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const sessionId = 'session-123';
      const operationId = 'op-123';
      const operationStatus = 'running' as const;

      // Mock session retrieval
      const mockSession = {
        id: sessionId,
        context: {},
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        operations: {},
      };
      vi.mocked(sessionManager.getSession).mockReturnValue(mockSession);

      // Mock operation addition
      const mockUpdatedSession = {
        ...mockSession,
        operations: {
          [operationId]: {
            id: operationId,
            status: operationStatus,
            progress: 0,
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        },
        updatedAt: '2023-01-01T00:00:00.000Z',
      };
      vi.mocked(sessionManager.addSessionOperation).mockReturnValue(mockUpdatedSession);

      const result = createEnhancedResponse({
        data,
        sessionId,
        operationId,
        operationStatus,
      });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        memory: {
          sessionId,
          context: {},
        },
        operation: {
          id: operationId,
          status: operationStatus,
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      });

      // Should get the session
      expect(sessionManager.getSession).toHaveBeenCalledWith(sessionId);

      // Should add the operation to the session
      expect(sessionManager.addSessionOperation).toHaveBeenCalledWith(
        sessionId,
        operationId,
        expect.objectContaining({
          id: operationId,
          status: operationStatus,
        })
      );
    });

    it('should handle session manager errors gracefully', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const sessionId = 'session-123';
      const context = { userId: 'user-123' };

      // Mock session retrieval to throw an error
      vi.mocked(sessionManager.getSession).mockImplementation(() => {
        throw new Error('Unexpected session error');
      });

      // Mock session creation to also throw an error
      vi.mocked(sessionManager.createSession).mockImplementation(() => {
        throw new Error('Failed to create session');
      });

      // This should not throw despite the session errors
      const result = createEnhancedResponse({ data, sessionId, context });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        memory: {
          sessionId,
          context: {}, // Empty context since session operations failed
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should include userCommunication when provided', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const userCommunication = {
        message: 'This is a message for the user',
        expectationType: 'immediate' as const,
        suggestedResponse: 'Here is your task:',
      };

      const result = createEnhancedResponse({ data, userCommunication });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        userCommunication,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should include waitTimeInfo when provided', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const waitTimeInfo = 'This operation will take about 2 minutes';

      const result = createEnhancedResponse({ data, waitTimeInfo });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        waitTimeInfo,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should include agentInstructions when provided', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const agentInstructions = 'These are instructions for the AI agent';

      const result = createEnhancedResponse({ data, agentInstructions });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        agentInstructions,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should include metadata when provided', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const metadata = { source: 'test', version: '1.0' };

      const result = createEnhancedResponse({ data, metadata });

      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        success: true,
        data,
        metadata,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });
  });

  describe('createMcpResponse', () => {
    it('should create an MCP response with the enhanced payload', () => {
      const data = { id: 'task-123', title: 'Test Task' };

      const result = createMcpResponse({ data });

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: expect.any(String),
          },
        ],
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: true,
        data,
        timestamp: expect.any(String),
        requestId: 'mock-uuid-1234',
      });
    });

    it('should include isError in the MCP response when specified', () => {
      const data = { error: 'Task not found' };
      const message = 'Failed to retrieve task';

      const result = createMcpResponse({ data, message, isError: true });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.any(String),
          },
        ],
        isError: true,
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: false,
        data,
        message,
        requestId: 'mock-uuid-1234',
      });
    });

    it('should use the provided requestId if specified', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const requestId = 'custom-request-id';

      const result = createMcpResponse({ data, requestId });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        requestId,
      });
    });
  });

  describe('create_enhanced_payload', () => {
    it('should create an enhanced payload with just data', () => {
      const data = { id: 'task-123', title: 'Test Task' };

      const result = create_enhanced_payload(data);

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: expect.any(String),
          },
        ],
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: true,
        data,
        timestamp: expect.any(String),
        requestId: 'mock-uuid-1234',
      });
    });

    it('should include additional options when provided', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const message = 'Task retrieved successfully';
      const metadata = { source: 'test' };

      const result = create_enhanced_payload(data, { message, metadata });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: true,
        data,
        message,
        metadata,
        timestamp: expect.any(String),
      });
    });
  });

  describe('create_success_payload', () => {
    it('should create a success payload with data and message', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const message = 'Task retrieved successfully';

      const result = create_success_payload(data, message);

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: true,
        data,
        message,
        timestamp: expect.any(String),
      });
    });

    it('should include additional options when provided', () => {
      const data = { id: 'task-123', title: 'Test Task' };
      const message = 'Task retrieved successfully';
      const metadata = { source: 'test' };

      const result = create_success_payload(data, message, { metadata });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: true,
        data,
        message,
        metadata,
        timestamp: expect.any(String),
      });
    });
  });

  describe('create_error_payload', () => {
    it('should create an error payload with error data and message', () => {
      const errorData = { code: 'NOT_FOUND', details: 'Task not found' };
      const message = 'Failed to retrieve task';

      const result = create_error_payload(errorData, message);

      expect(result.isError).toBe(true);

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: false,
        data: errorData,
        message,
        timestamp: expect.any(String),
      });
    });

    it('should include additional options when provided', () => {
      const errorData = { code: 'NOT_FOUND', details: 'Task not found' };
      const message = 'Failed to retrieve task';
      const metadata = { source: 'test' };

      const result = create_error_payload(errorData, message, { metadata });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: false,
        data: errorData,
        message,
        metadata,
        timestamp: expect.any(String),
      });
    });
  });

  describe('create_async_operation_payload', () => {
    it('should create an async operation payload with operation details', () => {
      const operationId = 'op-123';
      const status = 'running';

      const result = create_async_operation_payload(operationId, status);

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: true,
        data: { operationId, status },
        message: `Operation ${operationId} is ${status}`,
        operation: {
          id: operationId,
          status,
        },
        timestamp: expect.any(String),
      });
    });

    it('should include userCommunication for running operations', () => {
      const operationId = 'op-123';
      const status = 'running';

      const result = create_async_operation_payload(operationId, status);

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        userCommunication: {
          message: 'This operation is still in progress.',
          expectationType: 'long_wait',
          estimatedTimeSeconds: expect.any(Number),
          suggestedResponse: expect.stringContaining('The operation is in progress.'),
        },
        waitTimeInfo: expect.stringContaining('This operation typically takes'),
      });
    });

    it('should include userCommunication for completed operations', () => {
      const operationId = 'op-123';
      const status = 'completed';

      const result = create_async_operation_payload(operationId, status);

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        userCommunication: {
          message: 'The operation has completed successfully.',
          expectationType: 'immediate',
          suggestedResponse: expect.stringContaining('Great news!'),
        },
      });
    });

    it('should include userCommunication for failed operations', () => {
      const operationId = 'op-123';
      const status = 'failed';

      const result = create_async_operation_payload(operationId, status);

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        userCommunication: {
          message: 'The operation has failed.',
          expectationType: 'immediate',
          suggestedResponse: expect.stringContaining("I'm sorry"),
        },
      });
    });

    it('should include agentInstructions for task generation operations', () => {
      const operationId = 'op-123';
      const status = 'running';
      const metadata = { operationType: 'task-generation' };

      const result = create_async_operation_payload(operationId, status, undefined, undefined, {
        metadata,
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        agentInstructions: expect.stringContaining('DO NOT automatically check the status again'),
      });
    });

    it('should include progress information when available', () => {
      const operationId = 'op-123';
      const status = 'running';
      const metadata = {
        progress: 50,
        currentStep: 'Processing data',
        totalSteps: 3,
        currentStepNumber: 2,
      };

      const result = create_async_operation_payload(operationId, status, undefined, undefined, {
        metadata,
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.userCommunication.suggestedResponse).toContain('50% complete');
      expect(parsed.userCommunication.suggestedResponse).toContain('Processing data');
      expect(parsed.userCommunication.suggestedResponse).toContain('step 2 of 3');
      expect(parsed.waitTimeInfo).toContain('50% complete');
    });

    it('should use time estimate from metadata when available', () => {
      const operationId = 'op-123';
      const status = 'running';
      const metadata = { estimatedTimeRemaining: 120 }; // 2 minutes

      const result = create_async_operation_payload(operationId, status, undefined, undefined, {
        metadata,
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.userCommunication.estimatedTimeSeconds).toBe(120);
      expect(parsed.userCommunication.suggestedResponse).toContain('about 2 minutes');
      expect(parsed.waitTimeInfo).toContain('about 2 minutes');
    });

    it('should override userCommunication from metadata when provided', () => {
      const operationId = 'op-123';
      const status = 'running';
      const customUserComm = {
        message: 'Custom message',
        suggestedResponse: 'Custom response',
      };
      const metadata = { userCommunication: customUserComm };

      const result = create_async_operation_payload(operationId, status, undefined, undefined, {
        metadata,
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.userCommunication).toEqual(customUserComm);
      // Metadata should not contain userCommunication anymore
      expect(parsed.metadata?.userCommunication).toBeUndefined();
    });

    it('should override waitTimeInfo from metadata when provided', () => {
      const operationId = 'op-123';
      const status = 'running';
      const customWaitTimeInfo = 'Custom wait time info';
      const metadata = { waitTimeInfo: customWaitTimeInfo };

      const result = create_async_operation_payload(operationId, status, undefined, undefined, {
        metadata,
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.waitTimeInfo).toBe(customWaitTimeInfo);
      // Metadata should not contain waitTimeInfo anymore
      expect(parsed.metadata?.waitTimeInfo).toBeUndefined();
    });

    it('should override agentInstructions from metadata when provided', () => {
      const operationId = 'op-123';
      const status = 'running';
      const customAgentInstructions = 'Custom agent instructions';
      const metadata = { agentInstructions: customAgentInstructions };

      const result = create_async_operation_payload(operationId, status, undefined, undefined, {
        metadata,
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.agentInstructions).toBe(customAgentInstructions);
      // Metadata should not contain agentInstructions anymore
      expect(parsed.metadata?.agentInstructions).toBeUndefined();
    });

    it('should include custom data when provided', () => {
      const operationId = 'op-123';
      const status = 'completed';
      const data = { result: 'Task created successfully', taskId: 'task-123' };
      const message = 'Operation completed successfully';

      const result = create_async_operation_payload(operationId, status, data, message);

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: true,
        data,
        message,
        operation: {
          id: operationId,
          status,
        },
        timestamp: expect.any(String),
      });
    });

    it('should include additional options when provided', () => {
      const operationId = 'op-123';
      const status = 'running';
      const metadata = { source: 'test' };

      const result = create_async_operation_payload(operationId, status, undefined, undefined, {
        metadata,
      });

      // Verify the content
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        success: true,
        data: { operationId, status },
        message: `Operation ${operationId} is ${status}`,
        operation: {
          id: operationId,
          status,
        },
        metadata,
        timestamp: expect.any(String),
      });
    });
  });
});
