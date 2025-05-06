import { z } from 'zod';

/**
 * MCP tool parameter type
 */
export interface MCPToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  schema: z.ZodType<unknown>;
}

/**
 * MCP tool definition
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: MCPToolParameter[];
  execute: (args: Record<string, unknown>, context: MCPToolContext) => Promise<MCPToolResponse>;
}

/**
 * MCP tool context
 */
export interface MCPToolContext {
  sessionId: string;
  log: MCPLogger;
  config: Record<string, unknown>;
}

/**
 * MCP logger interface
 */
export interface MCPLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * MCP tool response
 */
export type MCPToolResponse = MCPToolSuccessResponse | MCPToolErrorResponse;

/**
 * MCP tool success response
 */
export interface MCPToolSuccessResponse {
  success: true;
  data: unknown;
}

/**
 * MCP tool error response
 */
export interface MCPToolErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

/**
 * MCP async operation status
 */
export type MCPAsyncOperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * MCP async operation
 */
export interface MCPAsyncOperation {
  id: string;
  status: MCPAsyncOperationStatus;
  progress: number;
  result?: unknown;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * MCP session
 */
export interface MCPSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  context: Record<string, unknown>;
  operations: Record<string, MCPAsyncOperation>;
}

/**
 * MCP server events
 */
export type MCPServerEventType =
  | 'server-started'
  | 'server-stopped'
  | 'request-received'
  | 'response-sent'
  | 'tool-executed'
  | 'operation-created'
  | 'operation-updated'
  | 'operation-completed'
  | 'operation-failed'
  | 'session-created'
  | 'session-updated'
  | 'session-expired'
  | 'error';

/**
 * MCP server event
 */
export interface MCPServerEvent {
  type: MCPServerEventType;
  timestamp: string;
  sessionId?: string;
  operationId?: string;
  toolName?: string;
  data?: unknown;
}
