import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../utils/file-utils.js', () => ({
  readTasksFile: vi.fn(),
  generateTaskFiles: vi.fn(),
}));

vi.mock('../../validation/index.js', () => ({
  schemas: {
    projectRoot: { type: 'string' },
    file: { type: 'string', optional: true },
  },
  validateParams: vi.fn((params) => params),
  getProjectRoot: vi.fn((root) => root || '/default/project/root'),
}));

vi.mock('../../errors/handler.js', () => ({
  handleError: vi.fn((error) => ({
    content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
    isError: true,
  })),
}));

vi.mock('../../utils/response.js', () => ({
  create_success_payload: vi.fn((data, message, options) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ data, message, ...options }),
      },
    ],
  })),
}));

vi.mock('../../errors/index.js', () => ({
  MCPError: class MCPError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../../../config.js', () => ({
  default: {
    getArtifactsDir: vi.fn((projectRoot) => `${projectRoot}/apm-artifacts`),
    getArtifactsFile: vi.fn((projectRoot) => `${projectRoot}/apm-artifacts/artifacts.json`),
  },
  ARTIFACTS_DIR: 'apm-artifacts',
  ARTIFACTS_FILE: 'artifacts.json',
}));

describe('Task Generate Tool', () => {
  let serverMock: any;

  beforeEach(() => {
    vi.resetAllMocks();

    // Create a mock server
    serverMock = {
      tool: vi.fn(),
    };
  });

  it('should register the generate tool with the server', async () => {
    // Import the module under test after mocks are set up
    const { registerGenerateTool } = await import('../task-generate.js');

    // Call the function
    registerGenerateTool(serverMock);

    // Verify that server.tool was called with the correct name and description
    expect(serverMock.tool).toHaveBeenCalledWith(
      'apm_task_generate',
      'Generates individual task files in apm-artifacts directory based on artifacts.json',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should successfully generate task files with custom file path', async () => {
    // Import the module under test and dependencies after mocks are set up
    const { registerGenerateTool } = await import('../task-generate.js');
    const { readTasksFile, generateTaskFiles } = await import('../../utils/file-utils.js');

    // Mock successful file operations
    vi.mocked(readTasksFile).mockResolvedValue({
      tasks: [
        { id: '1', title: 'Task 1', status: 'pending' },
        { id: '2', title: 'Task 2', status: 'pending' },
      ],
    });
    vi.mocked(generateTaskFiles).mockResolvedValue(true);

    // Register the tool
    registerGenerateTool(serverMock);

    // Get the handler function that was registered
    const handler = vi.mocked(serverMock.tool).mock.calls[0][3];

    // Call the handler with test parameters
    const result = await handler({
      projectRoot: '/test/project',
      file: 'custom/path/tasks.json',
    });

    // Verify the result
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response JSON
    const response = JSON.parse(result.content[0].text);

    // Verify the response data
    expect(response.data.success).toBe(true);
    expect(response.data.taskCount).toBe(2);
    expect(response.data.artifactsDir).toBe('/test/project/apm-artifacts');
    expect(response.data.tasksPath).toBe('custom/path/tasks.json');
    expect(response.message).toBe('Generated 2 task files in /test/project/apm-artifacts');
    expect(response.context.taskCount).toBe(2);

    // Verify that the file operations were called with the correct parameters
    expect(readTasksFile).toHaveBeenCalledWith('/test/project', 'custom/path/tasks.json');
    expect(generateTaskFiles).toHaveBeenCalledWith(
      {
        tasks: [
          { id: '1', title: 'Task 1', status: 'pending' },
          { id: '2', title: 'Task 2', status: 'pending' },
        ],
      },
      '/test/project'
    );
  });

  it('should successfully generate task files with default file path', async () => {
    // Import the module under test and dependencies after mocks are set up
    const { registerGenerateTool } = await import('../task-generate.js');
    const { readTasksFile, generateTaskFiles } = await import('../../utils/file-utils.js');
    const Config = (await import('../../../config.js')).default;

    // Mock the default artifacts file path
    vi.mocked(Config.getArtifactsFile).mockReturnValue(
      '/test/project/apm-artifacts/artifacts.json'
    );

    // Mock successful file operations
    vi.mocked(readTasksFile).mockResolvedValue({
      tasks: [
        { id: '1', title: 'Task 1', status: 'pending' },
        { id: '2', title: 'Task 2', status: 'pending' },
      ],
    });
    vi.mocked(generateTaskFiles).mockResolvedValue(true);

    // Register the tool
    registerGenerateTool(serverMock);

    // Get the handler function that was registered
    const handler = vi.mocked(serverMock.tool).mock.calls[0][3];

    // Call the handler with test parameters (no file specified)
    const result = await handler({
      projectRoot: '/test/project',
    });

    // Verify the result
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeDefined();

    // Parse the response JSON
    const response = JSON.parse(result.content[0].text);

    // Verify the response data
    expect(response.data.success).toBe(true);
    expect(response.data.taskCount).toBe(2);
    expect(response.data.artifactsDir).toBe('/test/project/apm-artifacts');
    expect(response.data.tasksPath).toBe('/test/project/apm-artifacts/artifacts.json');
    expect(response.message).toBe('Generated 2 task files in /test/project/apm-artifacts');
    expect(response.context.taskCount).toBe(2);

    // Verify that the file operations were called with the correct parameters
    expect(readTasksFile).toHaveBeenCalledWith('/test/project', undefined);
    expect(generateTaskFiles).toHaveBeenCalledWith(
      {
        tasks: [
          { id: '1', title: 'Task 1', status: 'pending' },
          { id: '2', title: 'Task 2', status: 'pending' },
        ],
      },
      '/test/project'
    );
  });

  it('should handle errors when tasks file is not found', async () => {
    // Import the module under test and dependencies after mocks are set up
    const { registerGenerateTool } = await import('../task-generate.js');
    const { readTasksFile } = await import('../../utils/file-utils.js');
    const { handleError } = await import('../../errors/handler.js');

    // Mock file not found
    vi.mocked(readTasksFile).mockResolvedValue(null);

    // Register the tool
    registerGenerateTool(serverMock);

    // Get the handler function that was registered
    const handler = vi.mocked(serverMock.tool).mock.calls[0][3];

    // Call the handler with test parameters
    await handler({
      projectRoot: '/test/project',
    });

    // Verify that handleError was called with the correct error
    expect(handleError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Tasks file not found or is empty',
      }),
      expect.any(Object)
    );
  });

  it('should handle errors when task file generation fails', async () => {
    // Import the module under test and dependencies after mocks are set up
    const { registerGenerateTool } = await import('../task-generate.js');
    const { readTasksFile, generateTaskFiles } = await import('../../utils/file-utils.js');
    const { handleError } = await import('../../errors/handler.js');

    // Mock successful file read but failed generation
    vi.mocked(readTasksFile).mockResolvedValue({
      tasks: [{ id: '1', title: 'Task 1', status: 'pending' }],
    });
    vi.mocked(generateTaskFiles).mockResolvedValue(false);

    // Register the tool
    registerGenerateTool(serverMock);

    // Get the handler function that was registered
    const handler = vi.mocked(serverMock.tool).mock.calls[0][3];

    // Call the handler with test parameters
    await handler({
      projectRoot: '/test/project',
    });

    // Verify that handleError was called with the correct error
    expect(handleError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to generate task files',
      }),
      expect.any(Object)
    );
  });
});
