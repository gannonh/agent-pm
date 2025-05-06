import { describe, it, expect, beforeEach, vi, afterEach, assert } from 'vitest';
import { updateProjectBriefAfterTaskModification } from '../project-brief-regenerator.js';
import * as fileUtils from '../../../mcp/utils/file-utils.js';
import * as projectBriefMarkdown from '../project-brief-markdown.js';
import { logger } from '../../../mcp/utils/logger.js';
import { TasksData } from '../../../mcp/types/index.js';

// Mock dependencies
vi.mock('../../../mcp/utils/file-utils.js', () => ({
  readTasksFile: vi.fn(),
  writeTasksFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../project-brief-markdown.js', () => ({
  generateMarkdown: vi.fn().mockResolvedValue('/mock/project/apm-artifacts/project-brief.md'),
}));

vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue(['mock-id.json']),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('# Project Brief'),
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
}));

vi.mock('../../../mcp/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../config.js', () => ({
  default: {
    getArtifactsDir: vi.fn().mockReturnValue('/mock/project/apm-artifacts'),
    getArtifactsFile: vi.fn().mockReturnValue('/mock/project/apm-artifacts/artifacts.json'),
  },
}));

describe('project-brief-regenerator', () => {
  const mockProjectRoot = '/mock/project';
  let mockTasksData: TasksData;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Create mock tasks data
    mockTasksData = {
      tasks: [
        {
          id: '1',
          title: 'Task 1',
          description: 'First task',
          status: 'pending',
          priority: 'high',
          dependencies: [],
        },
        {
          id: '2',
          title: 'Task 2',
          description: 'Second task',
          status: 'in-progress',
          priority: 'medium',
          dependencies: ['1'],
          subtasks: [
            {
              id: '2.1',
              title: 'Subtask 2.1',
              description: 'First subtask of Task 2',
              status: 'pending',
              dependencies: [],
            },
          ],
        },
      ],
      metadata: {
        projectName: 'Test Project',
        createdAt: '2025-04-27T00:00:00.000Z',
        updatedAt: '2025-04-27T00:00:00.000Z',
        projectVersion: '1.0.0',
        projectBriefUri: 'project-brief://mock-id',
      },
    };

    // Mock readTasksFile to return the mock data
    vi.mocked(fileUtils.readTasksFile).mockResolvedValue(mockTasksData);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('updateProjectBriefAfterTaskModification', () => {
    it('should return null if tasks data is null', async () => {
      // Mock readTasksFile to return null
      vi.mocked(fileUtils.readTasksFile).mockResolvedValue(null);

      const result = await updateProjectBriefAfterTaskModification(mockProjectRoot);

      expect(result).toBeNull();
      expect(fileUtils.readTasksFile).toHaveBeenCalledWith(mockProjectRoot);
      expect(projectBriefMarkdown.generateMarkdown).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(fileUtils.readTasksFile).mockRejectedValue(new Error('Test error'));

      const result = await updateProjectBriefAfterTaskModification(mockProjectRoot);

      expect(result).toBeNull();
      expect(fileUtils.readTasksFile).toHaveBeenCalledWith(mockProjectRoot);
      expect(logger.error).toHaveBeenCalled();
      expect(projectBriefMarkdown.generateMarkdown).not.toHaveBeenCalled();
    });

    it('should correctly format task data for generateMarkdown', async () => {
      // Mock generateMarkdown to return a specific value
      vi.mocked(projectBriefMarkdown.generateMarkdown).mockResolvedValue(
        '/mock/project/apm-artifacts/project-brief.md'
      );

      await updateProjectBriefAfterTaskModification(mockProjectRoot);

      // Verify generateMarkdown was called
      expect(projectBriefMarkdown.generateMarkdown).toHaveBeenCalled();

      // Get the call arguments
      const generateMarkdownCall = vi.mocked(projectBriefMarkdown.generateMarkdown).mock.calls[0];
      if (!generateMarkdownCall) {
        assert(false, 'generateMarkdown was not called');
        return;
      }

      const formattedData = generateMarkdownCall[1];

      // Ensure formattedData is defined
      assert(formattedData, 'formattedData should be defined');

      // Check that tasks are properly formatted
      expect(formattedData.tasks).toHaveLength(2);
      expect(formattedData.tasks[0].id).toBe('1');
      expect(formattedData.tasks[0].title).toBe('Task 1');
      expect(formattedData.tasks[0].status).toBe('pending');

      // Check that subtasks are properly formatted
      expect(formattedData.tasks[1].subtasks).toHaveLength(1);

      // Ensure subtasks array is defined
      const subtasks = formattedData.tasks[1].subtasks;
      assert(subtasks, 'subtasks should be defined');

      expect(subtasks[0].id).toBe('2.1');
      expect(subtasks[0].title).toBe('Subtask 2.1');
      expect(subtasks[0].status).toBe('pending');
    });
  });
});
