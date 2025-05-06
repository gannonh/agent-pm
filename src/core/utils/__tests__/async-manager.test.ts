import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncOperationManager } from '../async-manager.js';

// Helper function to replace createMock
const createMock = vi.fn;

// Setup the UUID mock before importing any other modules
vi.mock('uuid', () => {
  return {
    v4: () => 'test-uuid',
  };
});

describe('AsyncOperationManager', () => {
  let manager: AsyncOperationManager;
  type MockLogger = {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
  };
  let mockLogger: MockLogger;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Setup fake timers
    vi.useFakeTimers();

    // Create a new instance for each test
    manager = new AsyncOperationManager();

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe('addOperation', () => {
    it('should add an operation and return an operation ID', async () => {
      // Create a successful operation function
      const successOperation = createMock().mockResolvedValue({
        success: true,
        data: { result: 'success' },
      });

      // Add the operation
      const operationId = manager.addOperation(
        successOperation,
        { param: 'test' },
        { log: mockLogger }
      );

      // Check if the operation ID is correctly formatted
      expect(operationId).toContain('op-');

      // Use await for the operation to complete instead of timers
      await Promise.resolve();

      // Verify operation was called with correct arguments
      expect(successOperation).toHaveBeenCalledWith(
        { param: 'test' },
        mockLogger,
        expect.objectContaining({
          reportProgress: expect.any(Function),
          mcpLog: mockLogger,
        })
      );
    });

    it('should handle operation failures gracefully', async () => {
      // Create a failing operation function
      const failOperation = createMock().mockResolvedValue({
        success: false,
        error: { code: 'TEST_ERROR', message: 'Test error message' },
      });

      // Add the operation
      const operationId = manager.addOperation(
        failOperation,
        { param: 'test' },
        { log: mockLogger }
      );

      // Wait for the operation to complete
      await Promise.resolve();
      await vi.runAllTimersAsync();

      // Get the operation status
      const status = manager.getStatus(operationId);

      // Verify the operation status
      expect(status).toEqual(
        expect.objectContaining({
          status: 'failed',
          error: { code: 'TEST_ERROR', message: 'Test error message' },
        })
      );
    });

    it('should handle thrown exceptions', async () => {
      // Create an operation function that throws an error
      const throwingOperation = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Add the operation
      const operationId = manager.addOperation(
        throwingOperation,
        { param: 'test' },
        { log: mockLogger }
      );

      // Wait for the operation to complete
      await Promise.resolve();

      // Get the operation status
      const status = manager.getStatus(operationId);

      // Verify the operation status
      expect(status).toEqual(
        expect.objectContaining({
          status: 'failed',
          error: {
            code: 'OPERATION_EXECUTION_ERROR',
            message: 'Unexpected error',
          },
        })
      );
    });
  });

  describe('getStatus', () => {
    it('should return operation status for active operations', async () => {
      // Create a slow operation that we can control
      let resolveOperation: (value: {
        success: boolean;
        data?: Record<string, unknown>;
        error?: { code: string; message: string };
      }) => void;
      const slowOperation = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveOperation = resolve;
        });
      });

      // Add the operation
      const operationId = manager.addOperation(
        slowOperation,
        { param: 'test' },
        { log: mockLogger }
      );

      // Allow the operation to start
      await Promise.resolve();

      // Check the initial status (should be 'running')
      const initialStatus = manager.getStatus(operationId);
      expect(initialStatus.status).toBe('running');

      // Resolve the operation
      resolveOperation!({ success: true, data: { result: 'completed' } });

      // Wait for the operation to complete
      await Promise.resolve();

      // Check the final status
      const finalStatus = manager.getStatus(operationId);
      expect(finalStatus.status).toBe('completed');
    });

    it('should return a not_found error for non-existent operation IDs', () => {
      const status = manager.getStatus('non-existent-id');

      expect(status).toEqual({
        error: {
          code: 'OPERATION_NOT_FOUND',
          message: expect.stringContaining('not found'),
        },
        status: 'not_found',
      });
    });
  });

  describe('progress reporting', () => {
    it('should report progress when a reportProgress function is provided', async () => {
      // Create a mock reportProgress function
      const mockReportProgress = vi.fn();

      // Create an operation that reports progress
      const progressOperation = vi.fn().mockImplementation(async (_args, _log, context) => {
        // Report progress
        context.reportProgress?.({ progress: 50, total: 100, message: 'Half done' });

        // Return success
        return { success: true, data: { result: 'completed with progress' } };
      });

      // Add the operation
      manager.addOperation(
        progressOperation,
        { param: 'test' },
        { log: mockLogger, reportProgress: mockReportProgress }
      );

      // Wait for the operation to complete
      await Promise.resolve();

      // Verify progress was reported
      expect(mockReportProgress).toHaveBeenCalledWith({
        progress: 50,
        total: 100,
        message: 'Half done',
      });
    });
  });

  describe('event handling', () => {
    it('should allow subscribing to operation status changes', async () => {
      // Create an event listener
      const statusListener = vi.fn();

      // Subscribe to status changes
      manager.on('statusChanged', statusListener);

      // Create a successful operation
      const successOperation = createMock().mockResolvedValue({
        success: true,
        data: { result: 'success' },
      });

      // Add the operation
      const operationId = manager.addOperation(
        successOperation,
        { param: 'test' },
        { log: mockLogger }
      );

      // Wait for the operation to complete
      await Promise.resolve();

      // Verify the listener was called
      expect(statusListener).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId,
          status: 'running',
        })
      );

      expect(statusListener).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId,
          status: 'completed',
          result: { result: 'success' },
        })
      );
    });
  });
});
