/**
 * Standard logger interface for consistent logging throughout the application.
 */
export interface Logger {
  /**
   * Log informational message
   * @param message - Message to log
   * @param meta - Optional metadata to include with the log
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log warning message
   * @param message - Message to log
   * @param meta - Optional metadata to include with the log
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log error message
   * @param message - Message to log
   * @param meta - Optional metadata to include with the log
   */
  error(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log debug message (only shown in debug mode)
   * @param message - Message to log
   * @param meta - Optional metadata to include with the log
   */
  debug(message: string, meta?: Record<string, unknown>): void;

  /**
   * Generic log method
   * @param message - Message to log
   * @param meta - Optional metadata to include with the log
   */
  log?(message: string, meta?: Record<string, unknown>): void;
}
