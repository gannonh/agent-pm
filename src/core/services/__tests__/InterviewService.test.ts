import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InterviewService } from '../InterviewService.js';
import { InterviewStageType } from '../../types/interview-types.js';
import { resourceStorage } from '../ResourceStorage.js';

// Mock dependencies
vi.mock('../../anthropic-client.js', () => {
  return {
    createAnthropicClient: vi.fn(() => ({
      sendMessage: vi.fn().mockImplementation((messages, options) => {
        // Check if this is a task generation request by looking at the system prompt
        const systemPrompt = options?.systemPrompt || '';

        if (
          systemPrompt.includes('Extract the key information') ||
          systemPrompt.includes('Extract a list of specific goals')
        ) {
          // For processStageResponse
          return Promise.resolve(
            JSON.stringify({
              title: 'Test Project',
              description: 'A test project description',
              goals: ['Goal 1', 'Goal 2'],
              stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
              technologies: ['Technology 1', 'Technology 2'],
              constraints: ['Constraint 1', 'Constraint 2'],
              timeline: 'Timeline information',
              phases: [
                {
                  name: 'Phase 1',
                  description: 'Phase 1 description',
                  tasks: ['Task 1', 'Task 2'],
                },
              ],
              features: ['Feature 1', 'Feature 2'],
            })
          );
        } else if (
          systemPrompt.includes('task generation') ||
          systemPrompt.includes('generate tasks')
        ) {
          // For task generation
          return Promise.resolve(
            JSON.stringify({
              tasks: [
                {
                  id: '1',
                  title: 'Task 1',
                  description: 'Task 1 description',
                  priority: 'high',
                  details: 'Task 1 details',
                  testStrategy: 'Task 1 test strategy',
                  type: 'task',
                  subtasks: [
                    {
                      id: '1.1',
                      title: 'Subtask 1.1',
                      description: 'Subtask 1.1 description',
                      priority: 'high',
                      details: 'Subtask 1.1 details',
                      testStrategy: 'Subtask 1.1 test strategy',
                    },
                  ],
                },
                {
                  id: '2',
                  title: 'Task 2',
                  description: 'Task 2 description',
                  priority: 'medium',
                  details: 'Task 2 details',
                  testStrategy: 'Task 2 test strategy',
                  type: 'task',
                },
              ],
            })
          );
        } else {
          // Default response
          return Promise.resolve(
            JSON.stringify({
              title: 'Test Project',
              description: 'A test project description',
              goals: ['Goal 1', 'Goal 2'],
              stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
              technologies: ['Technology 1', 'Technology 2'],
              constraints: ['Constraint 1', 'Constraint 2'],
              timeline: 'Timeline information',
              phases: [
                {
                  name: 'Phase 1',
                  description: 'Phase 1 description',
                  tasks: ['Task 1', 'Task 2'],
                },
              ],
              features: ['Feature 1', 'Feature 2'],
            })
          );
        }
      }),
    })),
    AnthropicMessage: vi.fn(),
  };
});

vi.mock('../ResourceStorage.js', () => {
  const mockResourceStorage = {
    initialize: vi.fn().mockResolvedValue(undefined),
    createResource: vi.fn().mockImplementation((type, data) => {
      return {
        id: 'test-id',
        type,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        ...data,
      };
    }),
    loadResource: vi.fn().mockImplementation((uri) => {
      if (uri.includes('project-brief')) {
        return {
          id: 'test-id',
          type: 'project-brief',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          title: 'Test Project',
          description: 'A test project description',
          goals: ['Goal 1', 'Goal 2'],
          stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
          technologies: ['Technology 1', 'Technology 2'],
          constraints: ['Constraint 1', 'Constraint 2'],
          timeline: 'Timeline information',
          phases: [
            { name: 'Phase 1', description: 'Phase 1 description', tasks: ['Task 1', 'Task 2'] },
          ],
          interviewProgress: [
            {
              id: InterviewStageType.PROJECT_OVERVIEW,
              name: 'Project Overview',
              completed: true,
              skipped: false,
              userResponses: { response: 'Test response' },
            },
            {
              id: InterviewStageType.GOALS_AND_STAKEHOLDERS,
              name: 'Goals and Stakeholders',
              completed: false,
              skipped: false,
              userResponses: {},
            },
          ],
        };
      } else if (uri.includes('interview-state')) {
        return {
          id: 'test-id',
          type: 'interview-state',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          projectBriefId: 'test-id',
          currentStage: InterviewStageType.GOALS_AND_STAKEHOLDERS,
          completedStages: [InterviewStageType.PROJECT_OVERVIEW],
          skippedStages: [],
          userResponses: {
            [InterviewStageType.PROJECT_OVERVIEW]: 'Test response',
          },
          recommendationContext: {},
        };
      }
      return null;
    }),
    saveResource: vi.fn().mockResolvedValue(undefined),
    resourceExists: vi.fn().mockResolvedValue(true),
  };

  return {
    resourceStorage: mockResourceStorage,
  };
});

// Mock task-generation-stages.js
vi.mock('../task-generation-stages.js', () => {
  return {
    analyzeProjectBrief: vi.fn().mockResolvedValue({
      components: [
        { name: 'Component 1', description: 'Component 1 description', technologies: ['Tech 1'] },
      ],
      features: [{ name: 'Feature 1', description: 'Feature 1 description', complexity: 'medium' }],
      technicalRequirements: [{ category: 'Category 1', requirements: ['Requirement 1'] }],
      developmentConsiderations: [{ category: 'Category 1', considerations: ['Consideration 1'] }],
    }),
    createTaskStructure: vi.fn().mockResolvedValue({
      tasks: [
        {
          id: '1',
          title: 'Task 1',
          description: 'Task 1 description',
          priority: 'high',
          dependencies: [],
        },
        {
          id: '2',
          title: 'Task 2',
          description: 'Task 2 description',
          priority: 'medium',
          dependencies: ['1'],
        },
      ],
    }),
    addTaskDetails: vi.fn().mockResolvedValue({
      tasks: [
        {
          id: '1',
          title: 'Task 1',
          description: 'Task 1 description',
          priority: 'high',
          dependencies: [],
          details: 'Task 1 details',
          testStrategy: 'Task 1 test strategy',
          subtasks: [
            {
              id: '1.1',
              title: 'Subtask 1.1',
              description: 'Subtask 1.1 description',
              priority: 'high',
              details: 'Subtask 1.1 details',
              testStrategy: 'Subtask 1.1 test strategy',
            },
          ],
        },
        {
          id: '2',
          title: 'Task 2',
          description: 'Task 2 description',
          priority: 'medium',
          dependencies: ['1'],
          details: 'Task 2 details',
          testStrategy: 'Task 2 test strategy',
        },
      ],
    }),
    generateTaskFiles: vi.fn().mockResolvedValue({
      tasks: [
        {
          id: '1',
          title: 'Task 1',
          description: 'Task 1 description',
          priority: 'high',
          dependencies: [],
          details: 'Task 1 details',
          testStrategy: 'Task 1 test strategy',
          subtasks: [
            {
              id: '1.1',
              title: 'Subtask 1.1',
              description: 'Subtask 1.1 description',
              priority: 'high',
              details: 'Subtask 1.1 details',
              testStrategy: 'Subtask 1.1 test strategy',
            },
          ],
        },
        {
          id: '2',
          title: 'Task 2',
          description: 'Task 2 description',
          priority: 'medium',
          dependencies: ['1'],
          details: 'Task 2 details',
          testStrategy: 'Task 2 test strategy',
        },
      ],
      tasksPath: '/mock/project/apm-artifacts/artifacts.json',
      markdownPath: '/mock/project/apm-artifacts/project-brief.md',
    }),
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => {
  return {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    access: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock path
vi.mock('path', () => {
  return {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
  };
});

// Mock config
vi.mock('../../../config.js', () => {
  return {
    default: {
      getProjectRoot: vi.fn().mockReturnValue('/mock/project'),
      getArtifactsFile: vi.fn().mockReturnValue('/mock/project/apm-artifacts/artifacts.json'),
      getArtifactsDir: vi.fn().mockReturnValue('/mock/project/apm-artifacts'),
    },
    PROJECT_ROOT: '/mock/project',
    DEBUG_LOGS: false, // Add DEBUG_LOGS flag
  };
});

describe('InterviewService', () => {
  let interviewService: InterviewService;

  beforeEach(() => {
    vi.clearAllMocks();
    interviewService = new InterviewService();
  });

  describe('createInterview', () => {
    it('should create a new interview', async () => {
      const result = await interviewService.createInterview();

      expect(result).toBeDefined();
      expect(result.stage).toBe(InterviewStageType.PROJECT_OVERVIEW);
      expect(result.isComplete).toBe(false);
      expect(result.projectBriefUri).toBeDefined();
      expect(result.interviewStateUri).toBeDefined();
    });
  });

  describe('processResponse', () => {
    it('should process a response and return the next question', async () => {
      const result = await interviewService.processResponse(
        'interview-state://test-id',
        'Test response'
      );

      expect(result).toBeDefined();
      expect(result.stage).toBe(InterviewStageType.CONSTRAINTS);
      expect(result.isComplete).toBe(false);
      expect(result.projectBriefUri).toBeDefined();
      expect(result.interviewStateUri).toBeDefined();
    });

    it('should mark the interview as complete when all stages are done', async () => {
      // Mock the getNextStage method to return null (indicating completion)
      vi.spyOn(interviewService as any, 'getNextStage').mockReturnValue(null);

      const result = await interviewService.processResponse(
        'interview-state://test-id',
        'Test response'
      );

      expect(result).toBeDefined();
      expect(result.isComplete).toBe(true);
    });
  });

  describe('skipStage', () => {
    it('should skip the current stage and return the next question', async () => {
      const result = await interviewService.skipStage('interview-state://test-id');

      expect(result).toBeDefined();
      expect(result.stage).toBe(InterviewStageType.CONSTRAINTS);
      expect(result.isComplete).toBe(false);
      expect(result.projectBriefUri).toBeDefined();
      expect(result.interviewStateUri).toBeDefined();
    });
  });

  describe('generateTasks', () => {
    it('should generate tasks from a completed project brief', async () => {
      // Mock the anthropic client to return a valid tasks response
      const anthropicClientMock = {
        sendMessage: vi.fn().mockResolvedValue(
          JSON.stringify({
            tasks: [
              {
                title: 'Task 1',
                description: 'Task 1 description',
                priority: 'high',
                details: 'Task 1 details',
                testStrategy: 'Task 1 test strategy',
                type: 'task',
                subtasks: [
                  {
                    title: 'Subtask 1.1',
                    description: 'Subtask 1.1 description',
                    priority: 'high',
                    details: 'Subtask 1.1 details',
                    testStrategy: 'Subtask 1.1 test strategy',
                  },
                ],
              },
              {
                title: 'Task 2',
                description: 'Task 2 description',
                priority: 'medium',
                details: 'Task 2 details',
                testStrategy: 'Task 2 test strategy',
                type: 'task',
              },
            ],
          })
        ),
      };

      // Replace the anthropicClient with our mock
      // @ts-expect-error - Accessing private property for testing
      interviewService.anthropicClient = anthropicClientMock;

      // Mock resourceStorage.loadResource to return a completed project brief
      const mockLoadResource = vi.spyOn(resourceStorage, 'loadResource');
      mockLoadResource.mockResolvedValueOnce({
        id: 'test-id',
        type: 'project-brief',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        title: 'Test Project',
        description: 'A test project description',
        goals: ['Goal 1', 'Goal 2'],
        stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
        technologies: ['Technology 1', 'Technology 2'],
        constraints: ['Constraint 1', 'Constraint 2'],
        timeline: 'Timeline information',
        phases: [
          { name: 'Phase 1', description: 'Phase 1 description', tasks: ['Task 1', 'Task 2'] },
        ],
        interviewProgress: [
          {
            id: InterviewStageType.PROJECT_OVERVIEW,
            name: 'Project Overview',
            completed: true,
            skipped: false,
            userResponses: { response: 'Test response' },
          },
          {
            id: InterviewStageType.GOALS_AND_STAKEHOLDERS,
            name: 'Goals and Stakeholders',
            completed: true,
            skipped: false,
            userResponses: { response: 'Test response' },
          },
          {
            id: InterviewStageType.TECHNOLOGIES,
            name: 'Technologies',
            completed: true,
            skipped: false,
            userResponses: { response: 'Test response' },
          },
          {
            id: InterviewStageType.CONSTRAINTS,
            name: 'Constraints',
            completed: true,
            skipped: false,
            userResponses: { response: 'Test response' },
          },
          {
            id: InterviewStageType.TIMELINE_AND_PHASES,
            name: 'Timeline and Phases',
            completed: true,
            skipped: false,
            userResponses: { response: 'Test response' },
          },
          {
            id: InterviewStageType.FEATURES,
            name: 'Features',
            completed: true,
            skipped: false,
            userResponses: { response: 'Test response' },
          },
          {
            id: InterviewStageType.REVIEW,
            name: 'Review',
            completed: true,
            skipped: false,
            userResponses: { response: 'Test response' },
          },
        ],
      });

      // Use vi.doMock instead of vi.mock to ensure the mock is applied
      vi.doMock('../../../mcp/utils/file-utils.js', () => {
        return {
          writeTasksFile: () => Promise.resolve('/mock/project/apm-artifacts/artifacts.json'),
          generateTaskFiles: () => Promise.resolve(undefined),
        };
      });

      // Use vi.doMock instead of vi.mock to ensure the mock is applied
      vi.doMock('../../../config.js', () => {
        return {
          default: {
            getProjectRoot: () => '/mock/project',
            getArtifactsFile: () => '/mock/project/apm-artifacts/artifacts.json',
            getArtifactsDir: () => '/mock/project/apm-artifacts',
          },
        };
      });

      // Use vi.doMock instead of vi.mock to ensure the mock is applied
      vi.doMock('fs/promises', () => {
        return {
          mkdir: () => Promise.resolve(undefined),
          writeFile: () => Promise.resolve(undefined),
          readFile: () => Promise.resolve('{}'),
          access: () => Promise.resolve(undefined),
        };
      });

      // Mock the generateMarkdown method
      vi.spyOn(interviewService, 'generateMarkdown').mockImplementation(async () => {
        return '/mock/project/apm-artifacts/project-brief.md';
      });

      const result = await interviewService.generateTasks('project-brief://test-id');

      expect(result).toBeDefined();
      expect(result.tasks).toBeDefined();
      expect(result.tasksPath).toBeDefined();
    });
  });
});
