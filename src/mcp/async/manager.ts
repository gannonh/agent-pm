/**
 * @fileoverview MCP-specific wrapper for the core AsyncOperationManager.
 * Provides MCP-friendly interfaces and methods for managing async operations.
 */

import {
  asyncOperationManager as coreManager,
  OperationFunction,
  OperationProgress,
  Logger,
  OperationResult,
} from '../../core/utils/async-manager.js';

import {
  AsyncOperation,
  AsyncOperationResult,
  AsyncOperationStatus,
  mapFromCoreStatus,
} from './types.js';

import { logger } from '../utils/logger.js';

/**
 * Default logger implementation that uses the custom logger
 * to avoid writing to stdout which breaks MCP protocol
 */
const defaultLogger: Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
};

/**
 * MCP-specific wrapper for the core AsyncOperationManager.
 * Provides methods for creating, checking, and retrieving async operations.
 */
export class McpAsyncOperationManager {
  // In-memory storage for operation metadata
  private operationMetadata = new Map<
    string,
    {
      operationType: string;
      progress: number;
      statusMessage?: string;
      // Time tracking fields
      startTime: number;
      lastUpdateTime: number;
      progressHistory: Array<{ timestamp: number; progress: number }>;
      estimatedTimeRemaining?: number;
      estimatedEndTime?: number;
      // Step tracking fields
      currentStep?: string;
      totalSteps?: number;
      currentStepNumber?: number;
      steps?: string[];
    }
  >();

  /**
   * Creates a new async operation and starts executing it.
   * @template T The type of the operation's result data
   * @param operationType Type of operation being performed (e.g., 'prd-parse', 'task-expand')
   * @param operationFn The async function to execute
   * @param params Parameters for the operation
   * @param logger Optional logger instance
   * @returns The ID of the created operation
   */
  createOperation<T = unknown>(
    operationType: string,
    operationFn: OperationFunction<T, Record<string, unknown>>,
    params: Record<string, unknown>,
    logger: Logger = defaultLogger
  ): string {
    // Create the operation in the core manager
    const operationId = coreManager.addOperation(operationFn, params, {
      log: logger,
      reportProgress: (progress) => this.handleProgress(operationId, progress),
    });

    // Store additional metadata
    const now = Date.now();
    this.operationMetadata.set(operationId, {
      operationType,
      progress: 0,
      startTime: now,
      lastUpdateTime: now,
      progressHistory: [{ timestamp: now, progress: 0 }],
    });

    return operationId;
  }

  /**
   * Retrieves the current state of an operation.
   * @template T The type of the operation's result data
   * @param operationId The ID of the operation to retrieve
   * @returns The operation details or null if not found
   */
  getOperation<T = unknown>(operationId: string): AsyncOperation<T> | null {
    const coreStatus = coreManager.getStatus(operationId);
    const metadata = this.operationMetadata.get(operationId);

    // If operation not found or metadata missing, return null
    if (!metadata || coreStatus.status === 'not_found') {
      return null;
    }

    // Check if coreStatus has the properties we need
    // If it's the error object, it won't have these properties
    if (!('startTime' in coreStatus)) {
      return null;
    }

    // Now we know it's an OperationResult
    const operationResult = coreStatus as OperationResult<T>;

    // Calculate elapsed time for running operations
    let statusMessage = metadata.statusMessage;
    if (operationResult.status === 'running') {
      const elapsedTimeMs = Date.now() - operationResult.startTime;
      const elapsedSeconds = Math.floor(elapsedTimeMs / 1000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      const remainingSeconds = elapsedSeconds % 60;

      // Format elapsed time message
      let timeMessage = '';
      if (elapsedMinutes > 0) {
        timeMessage = `Still working... (elapsed time: ${elapsedMinutes} min${remainingSeconds > 0 ? ` ${remainingSeconds} sec` : ''})`;
      } else {
        timeMessage = `Still working... (elapsed time: ${elapsedSeconds} secs)`;
      }

      // Only update the message if it's not already a time-based message
      if (!statusMessage || !statusMessage.includes('elapsed time')) {
        statusMessage = timeMessage;
      } else {
        // Replace the existing time-based message
        statusMessage = timeMessage;
      }
    } else if (operationResult.status === 'completed') {
      statusMessage = "Project artifacts have been generated and we're ready to start.";
    }

    // Create the AsyncOperation object
    const operation: AsyncOperation<T> = {
      id: operationId,
      status: mapFromCoreStatus(operationResult.status),
      operationType: metadata.operationType,
      createdAt: operationResult.startTime,
      updatedAt: operationResult.endTime || operationResult.startTime,
      completedAt: operationResult.endTime,
      progress: metadata.progress,
      statusMessage: statusMessage,
      // Include time estimation data
      estimatedTimeRemaining: metadata.estimatedTimeRemaining,
      estimatedEndTime: metadata.estimatedEndTime,
      // Include step tracking data
      currentStep: metadata.currentStep,
      totalSteps: metadata.totalSteps,
      currentStepNumber: metadata.currentStepNumber,
      steps: metadata.steps,
      result:
        operationResult.status === 'completed' || operationResult.status === 'failed'
          ? {
              data: operationResult.result,
              error: operationResult.error,
            }
          : null,
    };

    return operation;
  }

  /**
   * Retrieves the result of a completed operation.
   * @template T The type of the operation's result data
   * @param operationId The ID of the operation
   * @returns The operation result or null if not completed or not found
   */
  getOperationResult<T = unknown>(operationId: string): AsyncOperationResult<T> | null {
    const operation = this.getOperation<T>(operationId);

    if (!operation) {
      return null;
    }

    if (
      operation.status !== AsyncOperationStatus.COMPLETED &&
      operation.status !== AsyncOperationStatus.FAILED
    ) {
      return null;
    }

    return operation.result;
  }

  /**
   * Updates the status of an operation.
   * @param operationId The ID of the operation
   * @param status The new status
   * @param message Optional status message
   */
  updateOperationStatus(operationId: string, status: AsyncOperationStatus, message?: string): void {
    const metadata = this.operationMetadata.get(operationId);
    if (!metadata) {
      return;
    }

    // Update the metadata
    this.operationMetadata.set(operationId, {
      ...metadata,
      statusMessage: message,
    });

    // The core status is updated automatically by the core manager
  }

  /**
   * Updates the progress of an operation.
   * @param operationId The ID of the operation
   * @param progress The progress percentage (0-100)
   * @param message Optional status message
   */
  updateOperationProgress(operationId: string, progress: number, message?: string): void {
    // Log the input parameters
    logger.debug(
      `updateOperationProgress called with: operationId=${operationId}, progress=${progress}, message=${message}`
    );

    const metadata = this.operationMetadata.get(operationId);
    if (!metadata) {
      logger.debug(`No metadata found for operation ${operationId}`);
      return;
    }

    logger.debug(`Current metadata for operation ${operationId}`, { metadata });

    // Update the metadata
    this.operationMetadata.set(operationId, {
      ...metadata,
      progress,
      statusMessage: message || metadata.statusMessage,
    });

    // Log the updated metadata
    const updatedMetadata = this.operationMetadata.get(operationId);
    logger.debug(`Updated metadata for operation ${operationId}`, { metadata: updatedMetadata });
  }

  /**
   * Handles progress updates from operations.
   * @param operationId The ID of the operation
   * @param progress The progress information
   */
  private handleProgress(operationId: string, progress: OperationProgress): void {
    const metadata = this.operationMetadata.get(operationId);
    if (!metadata) {
      return;
    }

    const now = Date.now();
    const newProgress = progress.progress;

    // Create a copy of the progress history and add the new progress
    const progressHistory = [
      ...metadata.progressHistory,
      { timestamp: now, progress: newProgress },
    ];

    // Keep only the last 10 progress updates to avoid memory issues
    if (progressHistory.length > 10) {
      progressHistory.shift();
    }

    // Calculate estimated time remaining if we have at least 2 progress updates
    let estimatedTimeRemaining: number | undefined = undefined;
    let estimatedEndTime: number | undefined = undefined;

    if (progressHistory.length >= 2 && newProgress > 0 && newProgress < 100) {
      // Get the first and last progress updates
      const firstUpdate = progressHistory[0];
      const lastUpdate = progressHistory[progressHistory.length - 1];

      // Calculate progress rate (progress per millisecond)
      const progressDiff = lastUpdate.progress - firstUpdate.progress;
      const timeDiff = lastUpdate.timestamp - firstUpdate.timestamp;

      if (progressDiff > 0 && timeDiff > 0) {
        const progressRate = progressDiff / timeDiff; // progress per millisecond

        // Calculate remaining progress and estimated time
        const remainingProgress = 100 - newProgress;
        const estimatedRemainingMs = remainingProgress / progressRate;

        // Convert to seconds and set estimated times
        estimatedTimeRemaining = Math.round(estimatedRemainingMs / 1000);
        estimatedEndTime = now + estimatedRemainingMs;
      }
    }

    // Extract step information if provided
    const currentStep = progress.currentStep;
    const totalSteps = progress.totalSteps;
    const currentStepNumber = progress.currentStepNumber;
    const steps = progress.steps;

    // Update the metadata with the new progress and time estimates
    this.operationMetadata.set(operationId, {
      ...metadata,
      progress: newProgress,
      statusMessage: progress.message || metadata.statusMessage,
      lastUpdateTime: now,
      progressHistory,
      estimatedTimeRemaining,
      estimatedEndTime,
      currentStep,
      totalSteps,
      currentStepNumber,
      steps,
    });
  }

  /**
   * Lists all active operations.
   * @returns Array of active operations
   */
  listOperations(): AsyncOperation[] {
    const operations: AsyncOperation[] = [];

    // Iterate through all operation metadata
    for (const [operationId, _] of this.operationMetadata) {
      const operation = this.getOperation(operationId);
      if (operation) {
        operations.push(operation);
      }
    }

    return operations;
  }

  /**
   * Cancels an operation if it's still running.
   * @param _operationId The ID of the operation to cancel
   * @returns True if the operation was cancelled, false otherwise
   */
  cancelOperation(_operationId: string): boolean {
    // Currently, the core manager doesn't support cancellation directly
    // This is a placeholder for future implementation
    return false;
  }
}

/**
 * Singleton instance of the McpAsyncOperationManager.
 * Use this instance to manage asynchronous operations in the MCP context.
 */
export const mcpAsyncOperationManager = new McpAsyncOperationManager();
