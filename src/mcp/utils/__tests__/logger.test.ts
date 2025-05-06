import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs.appendFileSync to avoid actual file operations
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

// Import the module under test after mocking dependencies
import { logger } from '../logger.js';

// Create spies for process.stderr.write
const mockWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('info', () => {
    it('should write info message to stderr', () => {
      logger.info('Test info message');

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test info message'));
    });

    it('should write info message with args to stderr', () => {
      const args = { key: 'value' };
      logger.info('Test info message', args);

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test info message'));
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('"key": "value"'));
    });
  });

  describe('error', () => {
    it('should write error message to stderr', () => {
      logger.error('Test error message');

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error message'));
    });

    it('should write error message with Error object to stderr', () => {
      const error = new Error('Test error');
      logger.error('Test error message', error);

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error message'));
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'));
    });

    it('should write error message with non-Error object to stderr', () => {
      const error = { message: 'Test error' };
      logger.error('Test error message', error);

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error message'));
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('"message": "Test error"'));
    });
  });

  describe('debug', () => {
    it('should write debug message to stderr', () => {
      logger.debug('Test debug message');

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Test debug message'));
    });

    it('should write debug message with args to stderr', () => {
      const args = { key: 'value' };
      logger.debug('Test debug message', args);

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Test debug message'));
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('"key": "value"'));
    });
  });

  describe('warn', () => {
    it('should write warn message to stderr', () => {
      logger.warn('Test warn message');

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[WARN] Test warn message'));
    });

    it('should write warn message with args to stderr', () => {
      const args = { key: 'value' };
      logger.warn('Test warn message', args);

      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('[WARN] Test warn message'));
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('"key": "value"'));
    });
  });
});
