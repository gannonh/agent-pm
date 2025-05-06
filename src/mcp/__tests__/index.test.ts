import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock process.exit before other imports
vi.mock('process', () => ({
  exit: vi.fn(),
  stderr: {
    write: vi.fn(),
  },
}));

// Mock dependencies
const mockServer = {
  start: vi.fn().mockResolvedValue(undefined),
  getServer: vi.fn().mockReturnValue({}),
};

vi.mock('../server.js', () => ({
  AgentPMMCPServer: vi.fn().mockImplementation(() => mockServer),
}));

vi.mock('../tools/index.js', () => ({
  registerTools: vi.fn(),
}));

vi.mock('../resources/index.js', () => ({
  registerResources: vi.fn(),
}));

vi.mock('../prompts/index.js', () => ({
  registerPrompts: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MCP Server Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module cache to force re-execution of the module code
    vi.resetModules();
  });

  it('should initialize and start the MCP server successfully', async () => {
    // Import the module to trigger the initialization code
    await import('../../index.js');

    // Verify that the server was created and started
    expect(mockServer.getServer).toHaveBeenCalled();
    expect(mockServer.start).toHaveBeenCalled();

    // Verify that tools, resources, and prompts were registered
    const { registerTools } = await import('../tools/index.js');
    const { registerResources } = await import('../resources/index.js');
    const { registerPrompts } = await import('../prompts/index.js');

    expect(registerTools).toHaveBeenCalled();
    expect(registerResources).toHaveBeenCalled();
    expect(registerPrompts).toHaveBeenCalled();
  });

  it('should handle server start errors', async () => {
    // Mock server.start to throw an error
    const error = new Error('Server start error');
    mockServer.start.mockRejectedValueOnce(error);

    // Mock process.exit to prevent test from exiting
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      // Import the module to trigger the initialization code
      await import('../../index.js');
    } catch (e: unknown) {
      // Expect the error to be thrown
      expect((e as Error).message).toBe('process.exit called');
    }

    // Verify that the error was logged and process.exit was called
    const { logger } = await import('../utils/logger.js');

    expect(logger.error).toHaveBeenCalledWith('Failed to start the MCP server', error);
    expect(exitSpy).toHaveBeenCalledWith(1);

    // Restore the original implementation
    exitSpy.mockRestore();
  });
});
