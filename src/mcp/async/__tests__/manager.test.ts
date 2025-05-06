import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpAsyncOperationManager } from '../manager.js';
import { AsyncOperationStatus } from '../types.js';
import { asyncOperationManager } from '../../../core/utils/async-manager.js';

// Mock the core async operation manager
vi.mock('../../../core/utils/async-manager.js', () => {
  return {
    asyncOperationManager: {
      addOperation: vi.fn().mockReturnValue('mock-operation-id'),
      getStatus: vi.fn().mockImplementation((operationId) => {
        if (operationId === 'not-found-id') {
          return { status: 'not_found' };
        }
        if (operationId === 'error-id') {
          return {
            status: 'failed',
            startTime: Date.now(),
            endTime: Date.now(),
            error: { code: 'ERROR', message: 'Test error' },
            result: null,
          };
        }
        return {
          status: 'completed',
          startTime: Date.now(),
          endTime: Date.now(),
          result: { test: 'data' },
          error: null,
        };
      }),
    },
    OperationStatus: {
      PENDING: 'pending',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled',
      NOT_FOUND: 'not_found',
    },
  };
});

describe('McpAsyncOperationManager', () => {
  let manager: McpAsyncOperationManager;

  beforeEach(() => {
    manager = new McpAsyncOperationManager();
    vi.clearAllMocks();
  });

  it('should create an operation', () => {
    const operationFn = vi.fn();
    const params = { test: 'params' };
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const operationId = manager.createOperation('test-operation', operationFn, params, logger);

    expect(operationId).toBe('mock-operation-id');
    expect(asyncOperationManager.addOperation).toHaveBeenCalledWith(
      operationFn,
      params,
      expect.objectContaining({
        log: logger,
        reportProgress: expect.any(Function),
      })
    );
  });

  it('should get an operation', () => {
    // Create an operation to initialize the metadata
    manager.createOperation('test-operation', vi.fn(), {});

    // Mock the core manager's getStatus method to return a valid result
    vi.spyOn(asyncOperationManager, 'getStatus').mockReturnValueOnce({
      id: 'mock-operation-id',
      status: 'completed',
      startTime: Date.now(),
      endTime: Date.now(),
      result: { test: 'data' },
      error: null,
    });

    const operation = manager.getOperation('mock-operation-id');

    expect(operation).not.toBeNull();
    expect(operation?.id).toBe('mock-operation-id');
    expect(operation?.status).toBe(AsyncOperationStatus.COMPLETED);
    expect(operation?.result).toEqual({ data: { test: 'data' }, error: null });
  });

  it('should return null for non-existent operations', () => {
    const operation = manager.getOperation('not-found-id');

    expect(operation).toBeNull();
  });

  it('should get operation result', () => {
    // Mock getOperation to return a completed operation
    vi.spyOn(manager, 'getOperation').mockReturnValueOnce({
      id: 'mock-operation-id',
      status: AsyncOperationStatus.COMPLETED,
      operationType: 'test-operation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: Date.now(),
      progress: 100,
      statusMessage: 'Completed',
      result: {
        data: { test: 'data' },
        error: null,
      },
    });

    const result = manager.getOperationResult('mock-operation-id');

    expect(result).not.toBeNull();
    expect(result?.data).toEqual({ test: 'data' });
    expect(result?.error).toBeNull();
  });

  it('should return null for operation result if operation not found', () => {
    const result = manager.getOperationResult('not-found-id');

    expect(result).toBeNull();
  });

  it('should return error in operation result', () => {
    // Mock getOperation to return a failed operation
    vi.spyOn(manager, 'getOperation').mockReturnValueOnce({
      id: 'error-id',
      status: AsyncOperationStatus.FAILED,
      operationType: 'test-operation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: Date.now(),
      progress: 100,
      statusMessage: 'Failed',
      result: {
        data: null,
        error: { code: 'ERROR', message: 'Test error' },
      },
    });

    const result = manager.getOperationResult('error-id');

    expect(result).not.toBeNull();
    expect(result?.data).toBeNull();
    expect(result?.error).toEqual({ code: 'ERROR', message: 'Test error' });
  });

  it('should update operation status', () => {
    // Create a spy on the private operationMetadata Map's set method
    const setSpy = vi.spyOn(Map.prototype, 'set');

    // Create an operation to initialize the metadata
    manager.createOperation('test-operation', vi.fn(), {});

    // Clear the spy to focus only on the status update
    setSpy.mockClear();

    manager.updateOperationStatus('mock-operation-id', AsyncOperationStatus.FAILED, 'Test message');

    // Verify that the Map.set was called with the expected arguments
    expect(setSpy).toHaveBeenCalledWith(
      'mock-operation-id',
      expect.objectContaining({
        statusMessage: 'Test message',
      })
    );
  });

  it('should handle progress updates', () => {
    // Create a spy on the private operationMetadata Map's set method
    const setSpy = vi.spyOn(Map.prototype, 'set');

    // Create an operation to initialize the metadata
    manager.createOperation('test-operation', vi.fn(), {});

    // Clear the spy to focus only on the progress update
    setSpy.mockClear();

    // Call the private handleProgress method
    // Using type assertion to access private method for testing purposes
    // We need to use 'unknown' as an intermediate type to avoid TypeScript errors
    (
      manager as unknown as {
        handleProgress(id: string, progress: { progress: number; message: string }): void;
      }
    ).handleProgress('mock-operation-id', { progress: 50, message: 'Half done' });

    // Verify that the Map.set was called with the expected arguments
    expect(setSpy).toHaveBeenCalledWith(
      'mock-operation-id',
      expect.objectContaining({
        progress: 50,
        statusMessage: 'Half done',
      })
    );
  });

  it('should list operations', () => {
    // Create a few operations
    manager.createOperation('test-operation-1', vi.fn(), {});
    manager.createOperation('test-operation-2', vi.fn(), {});

    // Mock getOperation to return valid operations
    const getOperationSpy = vi.spyOn(manager, 'getOperation').mockImplementation((id) => ({
      id,
      status: AsyncOperationStatus.COMPLETED,
      operationType: 'test-operation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: Date.now(),
      progress: 100,
      statusMessage: 'Completed',
      result: null,
    }));

    const operations = manager.listOperations();

    // Verify that getOperation was called at least once
    expect(getOperationSpy).toHaveBeenCalled();

    // Verify that the operations list is not empty
    expect(operations.length).toBeGreaterThan(0);
  });

  it('should attempt to cancel an operation', () => {
    const result = manager.cancelOperation('mock-operation-id');

    // Currently, cancellation is not supported, so it should return false
    expect(result).toBe(false);
  });
});
