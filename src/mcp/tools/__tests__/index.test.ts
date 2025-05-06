import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all the imported modules
vi.mock('../task.js', () => ({
  registerTaskTool: vi.fn(),
}));

vi.mock('../task-modify/index.js', () => ({
  registerTaskModifyTool: vi.fn(),
}));

vi.mock('../project/index.js', () => ({
  registerCreateProjectBriefTool: vi.fn(),
}));

vi.mock('../dependencies/index.js', () => ({
  registerDependenciesTool: vi.fn(),
}));

vi.mock('../task-generate.js', () => ({
  registerGenerateTool: vi.fn(),
}));

vi.mock('../complexity/index.js', () => ({
  registerComplexityTool: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('Tools Registration', () => {
  let serverMock: any;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Create a mock server
    serverMock = {
      tool: vi.fn(),
    };
  });

  it('should register all tools with the server', async () => {
    // Import the module under test after mocks are set up
    const { registerTools } = await import('../index.js');

    // Call the function
    registerTools(serverMock);

    // Import all the mocked modules to verify they were called
    const { registerTaskTool } = await import('../task.js');
    const { registerTaskModifyTool } = await import('../task-modify/index.js');
    const { registerCreateProjectBriefTool } = await import('../project/index.js');
    const { registerDependenciesTool } = await import('../dependencies/index.js');
    const { registerGenerateTool } = await import('../task-generate.js');
    const { registerComplexityTool } = await import('../complexity/index.js');
    const { logger } = await import('../../utils/logger.js');

    // Verify that each registration function was called with the server
    expect(registerTaskTool).toHaveBeenCalledWith(serverMock);
    expect(registerTaskModifyTool).toHaveBeenCalledWith(serverMock);
    expect(registerCreateProjectBriefTool).toHaveBeenCalledWith(serverMock);
    expect(registerDependenciesTool).toHaveBeenCalledWith(serverMock);
    expect(registerGenerateTool).toHaveBeenCalledWith(serverMock);
    expect(registerComplexityTool).toHaveBeenCalledWith(serverMock);

    // Verify that logger.info was called
    expect(logger.info).toHaveBeenCalledWith('Registering MCP tools...');
    expect(logger.info).toHaveBeenCalledWith('MCP tools registered');
  });
});
