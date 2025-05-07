/**
 * @fileoverview Utilities for creating enhanced response payloads with contextual information.
 * These utilities help maintain context across multiple tool invocations without requiring explicit session management.
 *
 * The enhanced response payload structure includes:
 * - Primary response data (the actual data requested by the client)
 * - Contextual metadata (session ID and context)
 * - Status indicators (success/failure)
 * - Timestamps (processing completed)
 * - Descriptive messages
 * - Operation tracking for async operations
 */

import { sessionManager } from '../session/manager.js';
import { logger } from './logger.js';
import { MCPErrorResponse } from '../errors/handler.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Options for creating an enhanced response payload
 *
 * This interface defines all possible options for customizing the response payload.
 * Most fields are optional to allow for flexibility in different scenarios.
 */
export interface EnhancedResponseOptions {
  /**
   * The primary data to include in the response
   */
  data: unknown;

  /**
   * Optional session ID to associate with the response
   * If provided, the session will be used to store and retrieve context
   */
  sessionId?: string;

  /**
   * Optional context data to include in the response
   * This will be merged with any existing context data from the session
   */
  context?: Record<string, unknown>;

  /**
   * Optional operation ID to include in the response
   * This is useful for long-running operations that need to be tracked
   */
  operationId?: string;

  /**
   * Optional operation status to include in the response
   * Common values: 'pending', 'running', 'completed', 'failed', 'cancelled'
   */
  operationStatus?: string;

  /**
   * Optional message to include in the response
   * This should be a human-readable description of the response
   */
  message?: string;

  /**
   * Whether the response represents an error
   * @default false
   */
  isError?: boolean;

  /**
   * Optional metadata to include in the response
   * This can be any additional information that might be useful for the client
   */
  metadata?: Record<string, unknown>;

  /**
   * Whether to include detailed debug information in the response
   * @default false
   */
  includeDebug?: boolean;

  /**
   * Optional request ID to associate with the response
   * This can be used to correlate requests and responses
   */
  requestId?: string;

  /**
   * Optional user communication guidance
   * This provides instructions for AI agents on how to communicate with users
   */
  userCommunication?: {
    /**
     * Primary message to relay to the user
     */
    message: string;

    /**
     * Type of expectation to set for the user
     * Common values: 'immediate', 'short_wait', 'long_wait'
     */
    expectationType?: 'immediate' | 'short_wait' | 'long_wait';

    /**
     * Estimated time in seconds for operation completion
     */
    estimatedTimeSeconds?: number;

    /**
     * Suggested response for AI agents to relay to users
     */
    suggestedResponse?: string;
  };

  /**
   * Optional wait time information for long-running operations
   * This provides information about expected wait times
   */
  waitTimeInfo?: string;

  /**
   * Optional instructions specifically for the AI agent
   * These are not meant to be relayed to the user, but to guide the agent's behavior
   */
  agentInstructions?: string;
}

/**
 * Creates an enhanced response payload with contextual information
 * This helps maintain context across multiple tool invocations without requiring explicit session management
 *
 * @param options Options for creating the enhanced response payload
 * @returns The enhanced response payload as a string
 */
/**
 * Enhanced response payload structure
 * This is the structure of the JSON response returned by createEnhancedResponse
 */
export interface EnhancedResponsePayload {
  /** Whether the operation was successful */
  success: boolean;

  /** The primary data requested by the client */
  data: unknown;

  /** Optional human-readable message describing the response */
  message?: string;

  /** Memory/context information for maintaining state across requests */
  memory?: {
    /** Session ID for context tracking */
    sessionId?: string;
    /** Context data associated with the session */
    context?: Record<string, unknown>;
  };

  /** Information about async operations */
  operation?: {
    /** Unique identifier for the operation */
    id: string;
    /** Current status of the operation */
    status: string;
  };

  /** ISO timestamp of when the response was created */
  timestamp: string;

  /** Additional metadata about the response */
  metadata?: Record<string, unknown>;

  /** Debug information (only included if includeDebug is true) */
  debug?: Record<string, unknown>;

  /** Request ID for correlation */
  requestId?: string;

  /** User communication guidance for AI agents */
  userCommunication?: {
    /** Primary message to relay to the user */
    message: string;
    /** Type of expectation to set for the user */
    expectationType?: string;
    /** Estimated time in seconds for operation completion */
    estimatedTimeSeconds?: number;
    /** Suggested response for AI agents to relay to users */
    suggestedResponse?: string;
  };

  /** Wait time information for long-running operations */
  waitTimeInfo?: string;

  /** Instructions specifically for the AI agent, not to be relayed to the user */
  agentInstructions?: string;
}

export function createEnhancedResponse(options: EnhancedResponseOptions): string {
  const {
    data,
    sessionId,
    context,
    operationId,
    operationStatus,
    message,
    isError = false,
    metadata,
    includeDebug = false,
    requestId = uuidv4(),
    userCommunication,
    waitTimeInfo,
    agentInstructions,
  } = options;

  // Start with the basic response structure
  const response: Record<string, unknown> = {
    success: !isError,
    data,
  };

  // Add message if provided
  if (message) {
    response.message = message;
  }

  // Create or update session context if needed
  let sessionContext: Record<string, unknown> = {};
  let responseSessionId = sessionId;

  if (context || operationId) {
    try {
      // If no session ID is provided, create a new session
      if (!responseSessionId) {
        const session = sessionManager.createSession({
          initialContext: context || {},
        });
        responseSessionId = session.id;
        sessionContext = session.context;
        logger.debug(`Created new session: ${responseSessionId}`);
      } else {
        // Try to get the existing session
        try {
          const session = sessionManager.getSession(responseSessionId);

          // Update the session context if new context is provided
          if (context) {
            const updatedSession = sessionManager.updateSessionContext(responseSessionId, context);
            sessionContext = updatedSession.context;
            logger.debug(`Updated session context: ${responseSessionId}`);
          } else {
            sessionContext = session.context;
          }
        } catch (_error) {
          // Session not found, create a new one
          const session = sessionManager.createSession({
            initialContext: context || {},
          });
          responseSessionId = session.id;
          sessionContext = session.context;
          logger.debug(`Created new session (previous not found): ${responseSessionId}`);
        }
      }

      // Add operation to session if provided
      if (operationId) {
        sessionManager.addSessionOperation(responseSessionId, operationId, {
          id: operationId,
          status: operationStatus || 'unknown',
          updatedAt: new Date().toISOString(),
        });
        logger.debug(`Added operation to session: ${responseSessionId}, operation: ${operationId}`);
      }
    } catch (_error) {
      // Log the error but don't fail the response
      logger.error(`Error managing session: ${_error}`);
    }
  }

  // Add memory/context information to the response
  response.memory = {
    sessionId: responseSessionId,
    context: sessionContext,
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

  // Add debug information if requested
  if (includeDebug) {
    response.debug = {
      options: { ...options, data: '[redacted]' }, // Avoid including potentially large data
      sessionInfo: responseSessionId ? { exists: true, id: responseSessionId } : { exists: false },
      timestamp: new Date().toISOString(),
    };
  }

  // Use a safer JSON stringify with circular reference handling
  try {
    const safeStringify = (obj: unknown): string => {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        // Use explicit type assertion to avoid 'any' return type
        return value as unknown;
      });
    };

    return safeStringify(response);
  } catch (error) {
    // If JSON.stringify fails, try a more aggressive approach
    logger.error('Error stringifying response', { error });

    // Create a simplified response without potentially problematic fields
    const safeResponse = {
      success: response.success,
      data: typeof response.data === 'object' ? { ...response.data } : response.data,
      message: response.message,
      timestamp: response.timestamp,
      requestId: response.requestId,
    };

    return JSON.stringify(safeResponse);
  }
}

/**
 * Creates an MCP tool response with enhanced contextual information
 *
 * @param options Options for creating the enhanced response payload
 * @returns The MCP tool response object
 */
export function createMcpResponse(options: EnhancedResponseOptions): MCPErrorResponse {
  // Generate a request ID if not provided
  if (!options.requestId) {
    options.requestId = uuidv4();
  }
  const responseText = createEnhancedResponse(options);

  return {
    content: [
      {
        type: 'text' as const,
        text: responseText,
      },
    ],
    isError: options.isError === true,
  };
}

/**
 * Creates an enhanced payload with contextual information
 * This is the primary utility function for creating standardized response payloads
 *
 * @param data The primary data to include in the response
 * @param options Additional options for customizing the response
 * @returns The MCP tool response object
 */
export function create_enhanced_payload(
  data: unknown,
  options: Omit<EnhancedResponseOptions, 'data'> = {}
): MCPErrorResponse {
  return createMcpResponse({
    data,
    ...options,
  });
}

/**
 * Creates an enhanced success payload
 * Convenience function for creating success responses
 *
 * @param data The primary data to include in the response
 * @param message Optional success message
 * @param options Additional options for customizing the response
 * @returns The MCP tool response object
 */
export function create_success_payload(
  data: unknown,
  message?: string,
  options: Omit<EnhancedResponseOptions, 'data' | 'message' | 'isError'> = {}
): MCPErrorResponse {
  return create_enhanced_payload(data, {
    message,
    isError: false,
    ...options,
  });
}

/**
 * Creates an enhanced error payload
 * Convenience function for creating error responses
 *
 * @param errorData The error data to include in the response
 * @param message Error message
 * @param options Additional options for customizing the response
 * @returns The MCP tool response object
 */
export function create_error_payload(
  errorData: unknown,
  message: string,
  options: Omit<EnhancedResponseOptions, 'data' | 'message' | 'isError'> = {}
): MCPErrorResponse {
  return create_enhanced_payload(errorData, {
    message,
    isError: true,
    ...options,
  });
}

/**
 * Creates an enhanced async operation payload
 * Convenience function for creating responses for long-running operations
 *
 * @param operationId The ID of the async operation
 * @param status The current status of the operation
 * @param data Optional data to include in the response
 * @param message Optional message describing the operation status
 * @param options Additional options for customizing the response
 * @returns The MCP tool response object
 */
export function create_async_operation_payload(
  operationId: string,
  status: string,
  data?: unknown,
  message?: string,
  options: Omit<
    EnhancedResponseOptions,
    | 'data'
    | 'message'
    | 'operationId'
    | 'operationStatus'
    | 'userCommunication'
    | 'waitTimeInfo'
    | 'agentInstructions'
  > = {}
): MCPErrorResponse {
  // Default user communication based on operation status
  let userCommunication: EnhancedResponseOptions['userCommunication'] = undefined;
  let waitTimeInfo: string | undefined = undefined;
  let agentInstructions: string | undefined = undefined;

  // Set appropriate user communication based on operation status
  if (status === 'running' || status === 'pending') {
    // Add agent instructions for task generation operations
    if (options.metadata?.operationType === 'task-generation') {
      agentInstructions =
        "DO NOT automatically check the status again. Wait for the user to explicitly request a status update by saying something like 'check status'. This is a long-running operation and repeated status checks are not helpful. The user will be notified when the operation completes.";
    }
    // For operations that are still running
    // Check if we have time estimates in the metadata
    const timeEstimate = options.metadata?.estimatedTimeRemaining as number | undefined;
    const _estimatedEndTime = options.metadata?.estimatedEndTime as number | undefined; // Unused for now, but could be used to show absolute time
    const progress = options.metadata?.progress as number | undefined;
    const currentStep = options.metadata?.currentStep as string | undefined;
    const totalSteps = options.metadata?.totalSteps as number | undefined;
    const currentStepNumber = options.metadata?.currentStepNumber as number | undefined;

    // Default to 3 minutes if no estimate is available
    const estimatedTimeSeconds = timeEstimate || 180;

    // Format the time estimate for display
    let timeEstimateText = '';
    if (timeEstimate) {
      const minutes = Math.floor(timeEstimate / 60);
      const seconds = timeEstimate % 60;
      if (minutes > 0) {
        timeEstimateText = `about ${minutes} minute${minutes !== 1 ? 's' : ''}${seconds > 0 ? ` and ${seconds} seconds` : ''}`;
      } else {
        timeEstimateText = `about ${seconds} seconds`;
      }
    } else {
      timeEstimateText = 'about 2-3 minutes';
    }

    // Create a detailed progress message
    let progressText = '';
    if (progress !== undefined) {
      progressText = `${Math.round(progress)}% complete`;
      if (currentStep && totalSteps) {
        progressText += `, ${currentStep}`;
        if (currentStepNumber && totalSteps) {
          progressText += ` (step ${currentStepNumber} of ${totalSteps})`;
        }
      }
    }

    // Create the user communication object
    userCommunication = {
      message: 'This operation is still in progress.',
      expectationType: 'long_wait',
      estimatedTimeSeconds,
      suggestedResponse: `The operation is in progress. ${progressText ? progressText + '. ' : ''}This typically takes ${timeEstimateText} to complete.\n\nYou can ask me to "check status" anytime if you'd like an update, or we can discuss other topics while we wait. I'll notify you when it's complete.`,
    };

    // Create the wait time info
    waitTimeInfo = `This operation typically takes ${timeEstimateText} to complete. ${progressText ? 'Current status: ' + progressText + '.' : ''} Please be patient while it processes.`;
  } else if (status === 'completed') {
    // For completed operations
    userCommunication = {
      message: 'The operation has completed successfully.',
      expectationType: 'immediate',
      suggestedResponse:
        'Great news! The operation has completed successfully. Here are the results:',
    };
  } else if (status === 'failed') {
    // For failed operations
    userCommunication = {
      message: 'The operation has failed.',
      expectationType: 'immediate',
      suggestedResponse: "I'm sorry, but the operation has failed. Here's what went wrong:",
    };
  }

  // Allow overriding the default user communication if provided in options
  if (options.metadata?.userCommunication) {
    const metadataComm = options.metadata
      .userCommunication as EnhancedResponseOptions['userCommunication'];
    if (metadataComm && typeof metadataComm === 'object' && 'message' in metadataComm) {
      userCommunication = metadataComm;
      // Remove from metadata to avoid duplication
      if (options.metadata) {
        delete options.metadata.userCommunication;
      }
    }
  }

  // Allow overriding the default wait time info if provided in options
  if (options.metadata?.waitTimeInfo && typeof options.metadata.waitTimeInfo === 'string') {
    waitTimeInfo = options.metadata.waitTimeInfo;
    // Remove from metadata to avoid duplication
    if (options.metadata) {
      delete options.metadata.waitTimeInfo;
    }
  }

  // Allow overriding the default agent instructions if provided in options
  if (
    options.metadata?.agentInstructions &&
    typeof options.metadata.agentInstructions === 'string'
  ) {
    agentInstructions = options.metadata.agentInstructions;
    // Remove from metadata to avoid duplication
    if (options.metadata) {
      delete options.metadata.agentInstructions;
    }
  }

  // Add default agent instructions for all async operations if not already set
  if (!agentInstructions) {
    // Create a default instruction that guides the AI to check the operation status first
    const checkStatusCommand =
      data && typeof data === 'object' && 'checkStatusCommand' in data
        ? ((data as Record<string, unknown>).checkStatusCommand as string)
        : `apm_project_brief_status --operationId=${operationId}`;

    agentInstructions = `IMPORTANT: DO NOT ask the user any questions yet. First, check the operation status using the checkStatusCommand: ${checkStatusCommand}. Only after the operation is complete should you present any questions to the user.`;
  }

  return create_enhanced_payload(data || { operationId, status }, {
    message: message || `Operation ${operationId} is ${status}`,
    operationId,
    operationStatus: status,
    userCommunication,
    waitTimeInfo,
    agentInstructions,
    ...options,
  });
}
