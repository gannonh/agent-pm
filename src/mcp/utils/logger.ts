import * as fs from 'fs';
import * as path from 'path';
import { PROJECT_ROOT, DEBUG_LOGS } from '../../config.js';

/**
 * Simple logger utility that writes to stderr and a log file (if DEBUG_LOGS=true)
 * to avoid interfering with MCP stdio while providing better debugging
 */

// Variables for file logging
let logsDir: string;
let logFilePath: string;

// Only set up file logging if DEBUG_LOGS is true
if (DEBUG_LOGS) {
  // Set up the logs directory
  logsDir = path.join(PROJECT_ROOT, 'logs');
  process.stderr.write(`[DEBUG] Using logs directory: ${logsDir}\n`);

  try {
    if (!fs.existsSync(logsDir)) {
      process.stderr.write(`[DEBUG] Creating logs directory: ${logsDir}\n`);
      fs.mkdirSync(logsDir, { recursive: true });
      process.stderr.write(`[DEBUG] Logs directory created successfully\n`);
    } else {
      process.stderr.write(`[DEBUG] Logs directory already exists\n`);
    }
  } catch (error) {
    process.stderr.write(`[ERROR] Failed to create logs directory: ${error}\n`);
  }

  // Log file path with timestamp (YYYY-MM-DD-HH-MM)
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  logFilePath = path.join(logsDir, `apm-${timestamp}.log`);
  process.stderr.write(`[DEBUG] Log file path: ${logFilePath}\n`);
}

/**
 * Write a message to the log file if DEBUG_LOGS is true
 * @param message - The message to write
 */
const writeToFile = (message: string): void => {
  // Skip file writing if DEBUG_LOGS is false
  if (!DEBUG_LOGS) {
    return;
  }

  try {
    // Check if the logs directory exists again (just to be safe)
    if (!fs.existsSync(logsDir)) {
      process.stderr.write(`[DEBUG] Logs directory doesn't exist, creating it: ${logsDir}\n`);
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Write to the log file
    fs.appendFileSync(logFilePath, `${message}\n`);
  } catch (error) {
    process.stderr.write(`[ERROR] Failed to write to log file: ${error}\n`);
    if (error instanceof Error) {
      process.stderr.write(`[ERROR] Stack trace: ${error.stack}\n`);
    }
  }
};

/**
 * Format a log message with timestamp
 * @param level - The log level
 * @param message - The log message
 * @param args - Additional arguments
 * @returns The formatted log message
 */
const formatLogMessage = (level: string, message: string, args?: unknown[]): string => {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level}] ${message}`;

  if (args && args.length > 0) {
    try {
      // Use a safer JSON stringify with circular reference handling
      const safeStringify = (obj: unknown): string => {
        const seen = new WeakSet();
        return JSON.stringify(
          obj,
          (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
            }
            // Use explicit type assertion to avoid 'any' return type
            return value as unknown;
          },
          2
        );
      };

      logMessage += `\n${safeStringify(args)}`;
    } catch (error) {
      logMessage += `\n[Error serializing args: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  return logMessage;
};

export const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message: string, ...args: any[]) => {
    const logMessage = formatLogMessage('INFO', message, args);
    process.stderr.write(`${logMessage}\n`);
    writeToFile(logMessage);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message: string, error?: any) => {
    const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error, null, 2);
    const logMessage = formatLogMessage('ERROR', message);
    const fullMessage = error ? `${logMessage}\n${errorDetails}` : logMessage;

    process.stderr.write(`${fullMessage}\n`);
    writeToFile(fullMessage);
  },

  debug: (message: string, meta?: Record<string, unknown>) => {
    // Handle both formats: debug(message) and debug(message, {metadata})
    const args = meta ? [meta] : [];
    const logMessage = formatLogMessage('DEBUG', message, args);
    process.stderr.write(`${logMessage}\n`);
    writeToFile(logMessage);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message: string, ...args: any[]) => {
    const logMessage = formatLogMessage('WARN', message, args);
    process.stderr.write(`${logMessage}\n`);
    writeToFile(logMessage);
  },
};
