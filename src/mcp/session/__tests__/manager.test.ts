import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../manager.js';
import { MCPSessionError } from '../../errors/index.js';

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// We'll use a simpler approach to testing without mocking uuid

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    // Create a new session manager for each test
    sessionManager = new SessionManager();

    // Mock Date.now and toISOString for consistent testing
    vi.useFakeTimers();
    const mockDate = new Date('2023-01-01T00:00:00.000Z');
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with default options', () => {
      // We'll test the structure without worrying about the exact ID
      const session = sessionManager.createSession();

      expect(session).toMatchObject({
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        context: {},
        operations: {},
      });
      expect(session.id).toMatch(/^session-/);
    });

    it('should create a new session with initial context', () => {
      // We'll test the structure without worrying about the exact ID
      const initialContext = { userId: 'user-123' };
      const session = sessionManager.createSession({ initialContext });

      expect(session.context).toEqual(initialContext);
    });

    it('should create a new session with custom timeout', () => {
      // We'll test the structure without worrying about the exact ID

      // Implementation detail: we can't easily test the timeout directly,
      // but we can verify the session is created correctly
      const session = sessionManager.createSession({ timeout: 30000 });

      expect(session.id).toMatch(/^session-/);
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', () => {
      const session = sessionManager.createSession();
      const retrievedSession = sessionManager.getSession(session.id);

      expect(retrievedSession).toEqual(session);
    });

    it('should throw MCPSessionError for non-existent session', () => {
      expect(() => sessionManager.getSession('non-existent')).toThrow(MCPSessionError);
      expect(() => sessionManager.getSession('non-existent')).toThrow('Session not found');
    });
  });

  describe('updateSessionContext', () => {
    it('should update session context with merge by default', () => {
      const session = sessionManager.createSession({
        initialContext: { userId: 'user-123' },
      });

      // Advance time to test updatedAt changes
      const newDate = new Date('2023-01-01T01:00:00.000Z');
      vi.setSystemTime(newDate);

      const updatedSession = sessionManager.updateSessionContext(session.id, {
        projectId: 'project-456',
      });

      expect(updatedSession.context).toEqual({
        userId: 'user-123',
        projectId: 'project-456',
      });
      expect(updatedSession.updatedAt).toBe('2023-01-01T01:00:00.000Z');
    });

    it('should replace session context when merge is false', () => {
      const session = sessionManager.createSession({
        initialContext: { userId: 'user-123' },
      });

      const updatedSession = sessionManager.updateSessionContext(
        session.id,
        { projectId: 'project-456' },
        false
      );

      expect(updatedSession.context).toEqual({
        projectId: 'project-456',
      });
    });

    it('should throw MCPSessionError for non-existent session', () => {
      expect(() => sessionManager.updateSessionContext('non-existent', { test: true })).toThrow(
        MCPSessionError
      );
    });
  });

  describe('addSessionOperation', () => {
    it('should add an operation to a session', () => {
      const session = sessionManager.createSession();
      const operation = {
        id: 'op-123',
        status: 'running',
        progress: 50,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Advance time to test updatedAt changes
      const newDate = new Date('2023-01-01T01:00:00.000Z');
      vi.setSystemTime(newDate);

      const updatedSession = sessionManager.addSessionOperation(session.id, 'op-123', operation);

      expect(updatedSession.operations['op-123']).toEqual(operation);
      expect(updatedSession.updatedAt).toBe('2023-01-01T01:00:00.000Z');
    });

    it('should throw MCPSessionError for non-existent session', () => {
      expect(() => sessionManager.addSessionOperation('non-existent', 'op-123', {})).toThrow(
        MCPSessionError
      );
    });
  });

  describe('removeSessionOperation', () => {
    it('should remove an operation from a session', () => {
      const session = sessionManager.createSession();
      const operation = {
        id: 'op-123',
        status: 'running',
        progress: 50,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Add the operation
      sessionManager.addSessionOperation(session.id, 'op-123', operation);

      // Advance time to test updatedAt changes
      const newDate = new Date('2023-01-01T02:00:00.000Z');
      vi.setSystemTime(newDate);

      // Remove the operation
      const updatedSession = sessionManager.removeSessionOperation(session.id, 'op-123');

      expect(updatedSession.operations['op-123']).toBeUndefined();
      expect(updatedSession.updatedAt).toBe('2023-01-01T02:00:00.000Z');
    });

    it('should throw MCPSessionError for non-existent session', () => {
      expect(() => sessionManager.removeSessionOperation('non-existent', 'op-123')).toThrow(
        MCPSessionError
      );
    });
  });

  describe('destroySession', () => {
    it('should destroy an existing session', () => {
      const session = sessionManager.createSession();
      const result = sessionManager.destroySession(session.id);

      expect(result).toBe(true);
      expect(() => sessionManager.getSession(session.id)).toThrow(MCPSessionError);
    });

    it('should return false for non-existent session', () => {
      const result = sessionManager.destroySession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAllSessions', () => {
    it('should return all active sessions', () => {
      // Clear any existing sessions
      (sessionManager as unknown as { sessions: Map<string, unknown> }).sessions.clear();

      // Create sessions without worrying about exact IDs
      const session1 = sessionManager.createSession();

      // Create another session
      const session2 = sessionManager.createSession();

      const allSessions = sessionManager.getAllSessions();

      expect(allSessions).toHaveLength(2);
      expect(allSessions).toEqual(expect.arrayContaining([session1, session2]));
    });

    it('should return empty array when no sessions exist', () => {
      const allSessions = sessionManager.getAllSessions();
      expect(allSessions).toHaveLength(0);
    });
  });

  describe('getSessionCount', () => {
    it('should return the correct number of active sessions', () => {
      // Clear any existing sessions
      (sessionManager as unknown as { sessions: Map<string, unknown> }).sessions.clear();

      expect(sessionManager.getSessionCount()).toBe(0);

      // Create sessions without worrying about exact IDs
      sessionManager.createSession();
      expect(sessionManager.getSessionCount()).toBe(1);

      // Create another session
      sessionManager.createSession();
      expect(sessionManager.getSessionCount()).toBe(2);

      // Create a third session
      const session3 = sessionManager.createSession();
      expect(sessionManager.getSessionCount()).toBe(3);

      sessionManager.destroySession(session3.id);
      expect(sessionManager.getSessionCount()).toBe(2);
    });
  });

  describe('session timeout', () => {
    it('should destroy expired sessions', () => {
      // Create a session with a short timeout (100ms)
      const sessionManager = new SessionManager(100);
      const session = sessionManager.createSession();

      // Verify the session exists
      expect(sessionManager.getSessionCount()).toBe(1);

      // Advance time past the timeout
      vi.advanceTimersByTime(200);

      // Manually invoke the private cleanupExpiredSessions method
      // We need to use any to access the private method
      (
        sessionManager as unknown as { cleanupExpiredSessions: () => void }
      ).cleanupExpiredSessions();

      // The session should be destroyed by the timeout
      expect(() => sessionManager.getSession(session.id)).toThrow(MCPSessionError);
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    it('should refresh session timeout on activity', () => {
      // Create a session with a short timeout (100ms)
      const sessionManager = new SessionManager(100);
      const session = sessionManager.createSession();

      // Advance time but not past the timeout
      vi.advanceTimersByTime(50);

      // Access the session to refresh the timeout
      sessionManager.getSession(session.id);

      // Advance time past the original timeout but not past the refreshed timeout
      vi.advanceTimersByTime(75);

      // The session should still exist because the timeout was refreshed
      expect(sessionManager.getSession(session.id)).toBeDefined();

      // Advance time past the refreshed timeout
      vi.advanceTimersByTime(200);

      // Manually invoke the private cleanupExpiredSessions method
      // We need to use any to access the private method
      (
        sessionManager as unknown as { cleanupExpiredSessions: () => void }
      ).cleanupExpiredSessions();

      // The session should be destroyed by the timeout
      expect(() => sessionManager.getSession(session.id)).toThrow(MCPSessionError);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', () => {
      // Create a session manager with a short timeout
      const sessionManager = new SessionManager(100);
      const session = sessionManager.createSession();

      // Manually invoke the private cleanupExpiredSessions method
      // We need to use any to access the private method
      (
        sessionManager as unknown as { cleanupExpiredSessions: () => void }
      ).cleanupExpiredSessions();

      // The session should still exist because it's not expired yet
      expect(sessionManager.getSession(session.id)).toBeDefined();

      // Advance time past the timeout
      vi.advanceTimersByTime(200);

      // Manually invoke the private cleanupExpiredSessions method
      (
        sessionManager as unknown as { cleanupExpiredSessions: () => void }
      ).cleanupExpiredSessions();

      // The session should be destroyed by the cleanup
      expect(() => sessionManager.getSession(session.id)).toThrow(MCPSessionError);
    });
  });
});
