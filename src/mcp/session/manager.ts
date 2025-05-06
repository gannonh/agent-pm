/**
 * @fileoverview Session manager for MCP server.
 * Provides functionality to create, retrieve, update, and manage sessions.
 */

import { v4 as uuidv4 } from 'uuid';
import type { MCPSession, MCPAsyncOperation } from '../../types/mcp.js';
import { MCPSessionError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

/**
 * Session options for creating a new session
 */
export interface SessionOptions {
  /**
   * Initial context data for the session
   */
  initialContext?: Record<string, unknown>;

  /**
   * Session timeout in milliseconds (default: 1 hour)
   */
  timeout?: number;
}

/**
 * Session manager for MCP server
 * Manages session creation, retrieval, and cleanup
 */
export class SessionManager {
  /**
   * Map of active sessions by ID
   */
  private sessions: Map<string, MCPSession> = new Map();

  /**
   * Map of session timeouts by ID
   */
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Default session timeout in milliseconds (1 hour)
   */
  private defaultTimeout: number = 60 * 60 * 1000;

  /**
   * Creates a new SessionManager
   * @param defaultTimeout Default session timeout in milliseconds (default: 1 hour)
   */
  constructor(defaultTimeout?: number) {
    if (defaultTimeout) {
      this.defaultTimeout = defaultTimeout;
    }

    // Start the cleanup interval to periodically check for expired sessions
    this.startCleanupInterval();

    logger.info('Session manager initialized');
  }

  /**
   * Creates a new session
   * @param options Session options
   * @returns The created session
   */
  createSession(options: SessionOptions = {}): MCPSession {
    const sessionId = `session-${uuidv4()}`;
    const now = new Date().toISOString();

    const session: MCPSession = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      context: options.initialContext || {},
      operations: {},
    };

    // Store the session
    this.sessions.set(sessionId, session);

    // Set up session timeout
    this.setupSessionTimeout(sessionId, options.timeout || this.defaultTimeout);

    logger.info(`Session created: ${sessionId}`);
    return session;
  }

  /**
   * Gets a session by ID
   * @param sessionId Session ID
   * @returns The session or null if not found
   * @throws MCPSessionError if the session is not found
   */
  getSession(sessionId: string): MCPSession {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn(`Session not found: ${sessionId}`);
      throw new MCPSessionError(`Session not found: ${sessionId}`);
    }

    // Update the session timeout
    this.refreshSessionTimeout(sessionId);

    return session;
  }

  /**
   * Updates a session's context data
   * @param sessionId Session ID
   * @param context Context data to update
   * @param merge Whether to merge with existing context (default: true)
   * @returns The updated session
   * @throws MCPSessionError if the session is not found
   */
  updateSessionContext(
    sessionId: string,
    context: Record<string, unknown>,
    merge = true
  ): MCPSession {
    const session = this.getSession(sessionId);

    // Update the context
    session.context = merge
      ? {
          ...session.context,
          ...context,
        }
      : context;

    // Update the updatedAt timestamp
    session.updatedAt = new Date().toISOString();

    // Store the updated session
    this.sessions.set(sessionId, session);

    // Refresh the session timeout
    this.refreshSessionTimeout(sessionId);

    logger.debug(`Session context updated: ${sessionId}`);
    return session;
  }

  /**
   * Adds an operation to a session
   * @param sessionId Session ID
   * @param operationId Operation ID
   * @param operation Operation data
   * @returns The updated session
   * @throws MCPSessionError if the session is not found
   */
  addSessionOperation(
    sessionId: string,
    operationId: string,
    operation: Record<string, unknown>
  ): MCPSession {
    const session = this.getSession(sessionId);

    // Add the operation
    // Type assertion to MCPAsyncOperation since we know the structure matches
    session.operations[operationId] = operation as unknown as MCPAsyncOperation;

    // Update the updatedAt timestamp
    session.updatedAt = new Date().toISOString();

    // Store the updated session
    this.sessions.set(sessionId, session);

    // Refresh the session timeout
    this.refreshSessionTimeout(sessionId);

    logger.debug(`Operation added to session: ${sessionId}, operation: ${operationId}`);
    return session;
  }

  /**
   * Removes an operation from a session
   * @param sessionId Session ID
   * @param operationId Operation ID
   * @returns The updated session
   * @throws MCPSessionError if the session is not found
   */
  removeSessionOperation(sessionId: string, operationId: string): MCPSession {
    const session = this.getSession(sessionId);

    // Remove the operation
    delete session.operations[operationId];

    // Update the updatedAt timestamp
    session.updatedAt = new Date().toISOString();

    // Store the updated session
    this.sessions.set(sessionId, session);

    // Refresh the session timeout
    this.refreshSessionTimeout(sessionId);

    logger.debug(`Operation removed from session: ${sessionId}, operation: ${operationId}`);
    return session;
  }

  /**
   * Destroys a session
   * @param sessionId Session ID
   * @returns True if the session was destroyed, false if it wasn't found
   */
  destroySession(sessionId: string): boolean {
    // Clear the session timeout
    this.clearSessionTimeout(sessionId);

    // Remove the session
    const result = this.sessions.delete(sessionId);

    if (result) {
      logger.info(`Session destroyed: ${sessionId}`);
    } else {
      logger.warn(`Failed to destroy session (not found): ${sessionId}`);
    }

    return result;
  }

  /**
   * Gets all active sessions
   * @returns Array of active sessions
   */
  getAllSessions(): MCPSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Gets the number of active sessions
   * @returns Number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Sets up a timeout for a session
   * @param sessionId Session ID
   * @param timeout Timeout in milliseconds
   */
  private setupSessionTimeout(sessionId: string, timeout: number): void {
    // Clear any existing timeout
    this.clearSessionTimeout(sessionId);

    // Set up a new timeout
    const timeoutId = setTimeout(() => {
      logger.info(`Session expired: ${sessionId}`);
      this.destroySession(sessionId);
    }, timeout);

    // Store the timeout ID
    this.sessionTimeouts.set(sessionId, timeoutId);
  }

  /**
   * Refreshes a session's timeout
   * @param sessionId Session ID
   */
  private refreshSessionTimeout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Set up a new timeout with the default timeout
    this.setupSessionTimeout(sessionId, this.defaultTimeout);
  }

  /**
   * Clears a session's timeout
   * @param sessionId Session ID
   */
  private clearSessionTimeout(sessionId: string): void {
    const timeoutId = this.sessionTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  /**
   * Starts the cleanup interval to periodically check for expired sessions
   * Runs every 5 minutes by default
   */
  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Cleans up expired sessions
   * This is a safety mechanism in case the timeout doesn't fire
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    // Find expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      const updatedAt = new Date(session.updatedAt).getTime();
      const age = now - updatedAt;

      // If the session is older than the default timeout, mark it for cleanup
      if (age > this.defaultTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    // Clean up expired sessions
    for (const sessionId of expiredSessions) {
      logger.info(`Cleaning up expired session: ${sessionId}`);
      this.destroySession(sessionId);
    }

    if (expiredSessions.length > 0) {
      logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
}

/**
 * Singleton instance of the SessionManager
 */
export const sessionManager = new SessionManager();
