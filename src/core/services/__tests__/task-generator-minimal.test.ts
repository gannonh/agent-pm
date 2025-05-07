/**
 * @fileoverview Minimal test for the task-generator module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../../../mcp/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Define mock types
type MockFn<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): ReturnType<T>;
  mockResolvedValue: (value: Awaited<ReturnType<T>>) => MockFn<T>;
  mockResolvedValueOnce: (value: Awaited<ReturnType<T>>) => MockFn<T>;
  mockImplementation: (fn: (...args: Parameters<T>) => ReturnType<T>) => MockFn<T>;
  mock: { calls: any[][] };
};

vi.mock('../ResourceStorage.js', () => ({
  resourceStorage: {
    resourceExists: vi.fn().mockResolvedValue(true) as MockFn<(uri: string) => Promise<boolean>>,
    loadResource: vi.fn().mockResolvedValue({
      id: 'test-brief-id',
      title: 'Test Project',
      description: 'This is a test project',
      goals: ['Goal 1', 'Goal 2'],
      stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
      technologies: ['Tech 1', 'Tech 2'],
      constraints: ['Constraint 1', 'Constraint 2'],
      timeline: 'Project timeline',
      phases: [
        {
          name: 'Phase 1: Planning',
          description: 'Planning phase',
          tasks: ['Task 1', 'Task 2'],
        },
      ],
      interviewProgress: [
        { id: 'project_overview', completed: true },
        { id: 'goals_and_stakeholders', completed: true },
        { id: 'constraints', completed: true },
        { id: 'technologies', completed: true },
        { id: 'timeline_and_phases', completed: true },
        { id: 'features', completed: true },
        { id: 'review', completed: true },
      ],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-02T00:00:00.000Z',
      version: '1.0.0',
    }) as MockFn<<T>(uri: string) => Promise<T>>,
  },
}));

// Define types for task generation stages
type ProjectAnalysis = {
  components: Array<{ name: string; description: string; technologies: string[] }>;
  features: Array<{ name: string; description: string; complexity: string }>;
  technicalRequirements?: Array<{ category: string; requirements: string[] }>;
  developmentConsiderations?: Array<{ category: string; considerations: string[] }>;
};

type TaskStructure = {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    dependencies: string[];
  }>;
};

type DetailedTasks = {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    dependencies: string[];
    details: string;
    testStrategy: string;
    subtasks: Array<{
      id: string;
      title: string;
      description: string;
    }>;
  }>;
};

type TaskGenerationResult = {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    dependencies: string[];
    details: string;
    testStrategy: string;
    subtasks: Array<{
      id: string;
      title: string;
      description: string;
    }>;
  }>;
  tasksPath: string;
  markdownPath: string;
};

type AnthropicClient = {
  sendMessage: (message: string) => Promise<string>;
};

vi.mock('../task-generation-stages.js', () => ({
  analyzeProjectBrief: vi.fn().mockResolvedValue({
    components: [
      {
        name: 'Frontend',
        description: 'User interface',
        technologies: ['React', 'TypeScript'],
      },
    ],
    features: [
      {
        name: 'Authentication',
        description: 'User login and registration',
        complexity: 'medium',
      },
    ],
  }) as MockFn<
    (projectBriefUri: string, anthropicClient: AnthropicClient) => Promise<ProjectAnalysis>
  >,

  createTaskStructure: vi.fn().mockResolvedValue({
    tasks: [
      {
        id: '1',
        title: 'Set up project repository',
        description: 'Initialize Git repository and configure CI/CD',
        priority: 'high',
        dependencies: [],
      },
    ],
  }) as MockFn<
    (
      analysis: ProjectAnalysis,
      anthropicClient: AnthropicClient,
      maxTasks?: number
    ) => Promise<TaskStructure>
  >,

  addTaskDetails: vi.fn().mockResolvedValue({
    tasks: [
      {
        id: '1',
        title: 'Set up project repository',
        description: 'Initialize Git repository and configure CI/CD',
        priority: 'high',
        dependencies: [],
        details: 'Detailed implementation steps',
        testStrategy: 'Test strategy',
        subtasks: [
          {
            id: '1.1',
            title: 'Initialize Git repository',
            description: 'Create a new Git repository',
          },
        ],
      },
    ],
  }) as MockFn<
    (
      taskStructure: TaskStructure,
      anthropicClient: AnthropicClient,
      progressCallback?: any
    ) => Promise<DetailedTasks>
  >,

  generateTaskFiles: vi.fn().mockResolvedValue({
    tasks: [
      {
        id: '1',
        title: 'Set up project repository',
        description: 'Initialize Git repository and configure CI/CD',
        priority: 'high',
        dependencies: [],
        details: 'Detailed implementation steps',
        testStrategy: 'Test strategy',
        subtasks: [
          {
            id: '1.1',
            title: 'Initialize Git repository',
            description: 'Create a new Git repository',
          },
        ],
      },
    ],
    tasksPath: '/project/root/apm-artifacts/artifacts.json',
    markdownPath: '/project/root/apm-artifacts/project-brief.md',
  }) as MockFn<
    (detailedTasks: DetailedTasks, projectBriefUri: string) => Promise<TaskGenerationResult>
  >,
}));

vi.mock('../../types/interview-types.js', () => ({
  InterviewStageType: {
    PROJECT_OVERVIEW: 'project_overview',
    GOALS_AND_STAKEHOLDERS: 'goals_and_stakeholders',
    CONSTRAINTS: 'constraints',
    TECHNOLOGIES: 'technologies',
    TIMELINE_AND_PHASES: 'timeline_and_phases',
    FEATURES: 'features',
    REVIEW: 'review',
  },
  InterviewError: class InterviewError extends Error {
    details?: unknown;

    constructor(message: string, details?: unknown) {
      super(message);
      this.name = 'InterviewError';
      this.details = details;
    }
  },
}));

vi.mock('../../types/task-generation.js', () => ({
  TaskGenerationStage: {
    PROJECT_ANALYSIS: 'project_analysis',
    TASK_STRUCTURE: 'task_structure',
    TASK_DETAILS: 'task_details',
    FILE_GENERATION: 'file_generation',
    COMPLETE: 'complete',
  },
}));

vi.mock('../../config.js', () => ({
  default: {
    getProjectRoot: vi.fn().mockReturnValue('/project/root'),
    getArtifactsFile: vi.fn().mockReturnValue('/project/root/apm-artifacts/artifacts.json'),
    DEBUG_LOGS: false,
  },
  DEBUG_LOGS: false,
}));

describe('Task Generator Minimal Test', () => {
  // Import the module under test after mocks are set up
  let taskGenerator: typeof import('../task-generator.js');
  let progressCallback: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks();

    // Create a mock progress callback
    progressCallback = vi.fn();

    // Import the module under test
    taskGenerator = await import('../task-generator.js');
  });

  it('should generate tasks successfully', async () => {
    const projectBriefUri = 'test-brief-uri';
    const anthropicClient = { sendMessage: vi.fn() };

    const result = await taskGenerator.generateTasks(
      projectBriefUri,
      anthropicClient as any,
      { maxTasks: 5 },
      progressCallback
    );

    // Verify the result
    expect(result).toEqual({
      tasks: [
        {
          id: '1',
          title: 'Set up project repository',
          description: 'Initialize Git repository and configure CI/CD',
          priority: 'high',
          dependencies: [],
          details: 'Detailed implementation steps',
          testStrategy: 'Test strategy',
          subtasks: [
            {
              id: '1.1',
              title: 'Initialize Git repository',
              description: 'Create a new Git repository',
            },
          ],
        },
      ],
      tasksPath: '/project/root/apm-artifacts/artifacts.json',
      markdownPath: '/project/root/apm-artifacts/project-brief.md',
    });

    // Verify that the progress callback was called
    expect(progressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'project_analysis',
        message: 'Analyzing project brief...',
        progress: 25,
        currentStepNumber: 1,
      })
    );

    expect(progressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'task_structure',
        message: 'Generating task structure...',
        progress: 50,
        currentStepNumber: 2,
      })
    );

    expect(progressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'task_details',
        message: 'Adding task details...',
        progress: 75,
        currentStepNumber: 3,
      })
    );

    expect(progressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'file_generation',
        message: 'Generating task files...',
        progress: 90,
        currentStepNumber: 4,
      })
    );

    expect(progressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'complete',
        message: 'Task generation complete',
        progress: 100,
        currentStepNumber: 4,
      })
    );
  });

  it('should throw an error if the project brief does not exist', async () => {
    const projectBriefUri = 'non-existent-brief-uri';
    const anthropicClient = { sendMessage: vi.fn() };

    // Mock resourceExists to return false
    const resourceStorage = await import('../ResourceStorage.js');
    (
      resourceStorage.resourceStorage.resourceExists as MockFn<(uri: string) => Promise<boolean>>
    ).mockResolvedValueOnce(false);

    // Spy on the logger to verify the error message
    const logger = await import('../../../mcp/utils/logger.js');

    try {
      await taskGenerator.generateTasks(projectBriefUri, anthropicClient as any);
      // If we get here, the test should fail
      expect(true).toBe(false); // This should not be reached
    } catch (error: unknown) {
      // Verify that the error was logged with the correct message
      expect(logger.logger.error).toHaveBeenCalled();

      // Type guard for error with message property
      if (error instanceof Error) {
        expect(error.message).toBe('Failed to generate tasks');
      } else {
        // If it's not an Error instance, the test should fail
        expect(true).toBe(false);
      }
    }

    // Verify that resourceExists was called
    expect(resourceStorage.resourceStorage.resourceExists).toHaveBeenCalledWith(projectBriefUri);
  });

  it('should throw an error if the project brief is not found or invalid', async () => {
    const projectBriefUri = 'invalid-brief-uri';
    const anthropicClient = { sendMessage: vi.fn() };

    // Mock resourceExists to return true but loadResource to return null
    const resourceStorage = await import('../ResourceStorage.js');
    (
      resourceStorage.resourceStorage.resourceExists as MockFn<(uri: string) => Promise<boolean>>
    ).mockResolvedValueOnce(true);
    (
      resourceStorage.resourceStorage.loadResource as MockFn<<T>(uri: string) => Promise<T>>
    ).mockResolvedValueOnce(null);

    // Spy on the logger to verify the error message
    const logger = await import('../../../mcp/utils/logger.js');

    try {
      await taskGenerator.generateTasks(projectBriefUri, anthropicClient as any);
      // If we get here, the test should fail
      expect(true).toBe(false); // This should not be reached
    } catch (error: unknown) {
      // Verify that the error was logged with the correct message
      expect(logger.logger.error).toHaveBeenCalled();

      // Type guard for error with message property
      if (error instanceof Error) {
        expect(error.message).toBe('Failed to generate tasks');
      } else {
        // If it's not an Error instance, the test should fail
        expect(true).toBe(false);
      }
    }

    // Verify that resourceExists and loadResource were called
    expect(resourceStorage.resourceStorage.resourceExists).toHaveBeenCalledWith(projectBriefUri);
    expect(resourceStorage.resourceStorage.loadResource).toHaveBeenCalledWith(projectBriefUri);
  });

  it('should throw an error if the project brief is not complete', async () => {
    const projectBriefUri = 'incomplete-brief-uri';
    const anthropicClient = { sendMessage: vi.fn() };

    // Reset the mocks to ensure they return the expected values
    const resourceStorage = await import('../ResourceStorage.js');
    (
      resourceStorage.resourceStorage.resourceExists as MockFn<(uri: string) => Promise<boolean>>
    ).mockResolvedValue(true);

    // Mock an incomplete project brief
    (
      resourceStorage.resourceStorage.loadResource as MockFn<<T>(uri: string) => Promise<T>>
    ).mockImplementation((uri: string) => {
      if (uri === projectBriefUri) {
        return Promise.resolve({
          id: 'test-brief-id',
          title: 'Test Project',
          description: 'This is a test project',
          goals: ['Goal 1', 'Goal 2'],
          stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
          technologies: ['Tech 1', 'Tech 2'],
          constraints: ['Constraint 1', 'Constraint 2'],
          timeline: 'Project timeline',
          phases: [
            {
              name: 'Phase 1: Planning',
              description: 'Planning phase',
              tasks: ['Task 1', 'Task 2'],
            },
          ],
          interviewProgress: [
            { id: 'project_overview', completed: true },
            { id: 'goals_and_stakeholders', completed: true },
            // Missing some stages
          ],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
          version: '1.0.0',
        });
      }
      return Promise.resolve(null);
    });

    // Spy on the logger to verify the error message
    const logger = await import('../../../mcp/utils/logger.js');

    try {
      await taskGenerator.generateTasks(projectBriefUri, anthropicClient as any);
      // If we get here, the test should fail
      expect(true).toBe(false); // This should not be reached
    } catch (error: unknown) {
      // Verify that the error was logged with the correct message
      expect(logger.logger.error).toHaveBeenCalled();

      // Type guard for error with message property
      if (error instanceof Error) {
        expect(error.message).toBe('Failed to generate tasks');
      } else {
        // If it's not an Error instance, the test should fail
        expect(true).toBe(false);
      }
    }

    // Verify that loadResource was called
    expect(resourceStorage.resourceStorage.loadResource).toHaveBeenCalledWith(projectBriefUri);
  });

  it('should use default maxTasks value if not provided', async () => {
    const projectBriefUri = 'test-brief-uri';
    const anthropicClient = { sendMessage: vi.fn() };

    // Reset the mocks to ensure they return the expected values
    const resourceStorage = await import('../ResourceStorage.js');
    (
      resourceStorage.resourceStorage.resourceExists as MockFn<(uri: string) => Promise<boolean>>
    ).mockResolvedValue(true);
    (
      resourceStorage.resourceStorage.loadResource as MockFn<<T>(uri: string) => Promise<T>>
    ).mockResolvedValue({
      id: 'test-brief-id',
      title: 'Test Project',
      description: 'This is a test project',
      goals: ['Goal 1', 'Goal 2'],
      stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
      technologies: ['Tech 1', 'Tech 2'],
      constraints: ['Constraint 1', 'Constraint 2'],
      timeline: 'Project timeline',
      phases: [
        {
          name: 'Phase 1: Planning',
          description: 'Planning phase',
          tasks: ['Task 1', 'Task 2'],
        },
      ],
      interviewProgress: [
        { id: 'project_overview', completed: true },
        { id: 'goals_and_stakeholders', completed: true },
        { id: 'constraints', completed: true },
        { id: 'technologies', completed: true },
        { id: 'timeline_and_phases', completed: true },
        { id: 'features', completed: true },
        { id: 'review', completed: true },
      ],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-02T00:00:00.000Z',
      version: '1.0.0',
    });

    // Reset the task generation stages mocks
    const taskGenerationStages = await import('../task-generation-stages.js');

    // Create a mock analysis result
    const mockAnalysis = {
      components: [
        {
          name: 'Frontend',
          description: 'User interface',
          technologies: ['React', 'TypeScript'],
        },
      ],
      features: [
        {
          name: 'Authentication',
          description: 'User login and registration',
          complexity: 'medium',
        },
      ],
      technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
      developmentConsiderations: [
        { category: 'Performance', considerations: ['Optimize bundle size'] },
      ],
    };

    // Mock the task generation stages
    (
      taskGenerationStages.analyzeProjectBrief as unknown as MockFn<
        (projectBriefUri: string, anthropicClient: AnthropicClient) => Promise<ProjectAnalysis>
      >
    ).mockResolvedValue(mockAnalysis);

    await taskGenerator.generateTasks(projectBriefUri, anthropicClient as any);

    // Verify that createTaskStructure was called with the default maxTasks value (10)
    expect(taskGenerationStages.createTaskStructure).toHaveBeenCalledWith(
      mockAnalysis,
      anthropicClient,
      10
    );
  });

  it('should work without a progress callback', async () => {
    const projectBriefUri = 'test-brief-uri';
    const anthropicClient = { sendMessage: vi.fn() };

    // Reset the mocks to ensure they return the expected values
    const resourceStorage = await import('../ResourceStorage.js');
    (
      resourceStorage.resourceStorage.resourceExists as MockFn<(uri: string) => Promise<boolean>>
    ).mockResolvedValue(true);
    (
      resourceStorage.resourceStorage.loadResource as MockFn<<T>(uri: string) => Promise<T>>
    ).mockResolvedValue({
      id: 'test-brief-id',
      title: 'Test Project',
      description: 'This is a test project',
      goals: ['Goal 1', 'Goal 2'],
      stakeholders: ['Stakeholder 1', 'Stakeholder 2'],
      technologies: ['Tech 1', 'Tech 2'],
      constraints: ['Constraint 1', 'Constraint 2'],
      timeline: 'Project timeline',
      phases: [
        {
          name: 'Phase 1: Planning',
          description: 'Planning phase',
          tasks: ['Task 1', 'Task 2'],
        },
      ],
      interviewProgress: [
        { id: 'project_overview', completed: true },
        { id: 'goals_and_stakeholders', completed: true },
        { id: 'constraints', completed: true },
        { id: 'technologies', completed: true },
        { id: 'timeline_and_phases', completed: true },
        { id: 'features', completed: true },
        { id: 'review', completed: true },
      ],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-02T00:00:00.000Z',
      version: '1.0.0',
    });

    // Reset the task generation stages mocks
    const taskGenerationStages = await import('../task-generation-stages.js');

    // Create a mock analysis result
    const mockAnalysis = {
      components: [
        {
          name: 'Frontend',
          description: 'User interface',
          technologies: ['React', 'TypeScript'],
        },
      ],
      features: [
        {
          name: 'Authentication',
          description: 'User login and registration',
          complexity: 'medium',
        },
      ],
      technicalRequirements: [{ category: 'Security', requirements: ['HTTPS', 'JWT'] }],
      developmentConsiderations: [
        { category: 'Performance', considerations: ['Optimize bundle size'] },
      ],
    };

    // Mock the task generation stages
    (
      taskGenerationStages.analyzeProjectBrief as unknown as MockFn<
        (projectBriefUri: string, anthropicClient: AnthropicClient) => Promise<ProjectAnalysis>
      >
    ).mockResolvedValue(mockAnalysis);

    // Mock the task structure
    const mockTaskStructure = {
      tasks: [
        {
          id: '1',
          title: 'Set up project repository',
          description: 'Initialize Git repository and configure CI/CD',
          priority: 'high',
          dependencies: [],
        },
      ],
    };
    (
      taskGenerationStages.createTaskStructure as unknown as MockFn<
        (
          analysis: ProjectAnalysis,
          anthropicClient: AnthropicClient,
          maxTasks?: number
        ) => Promise<TaskStructure>
      >
    ).mockResolvedValue(mockTaskStructure);

    // Mock the detailed tasks
    const mockDetailedTasks = {
      tasks: [
        {
          id: '1',
          title: 'Set up project repository',
          description: 'Initialize Git repository and configure CI/CD',
          priority: 'high',
          dependencies: [],
          details: 'Detailed implementation steps',
          testStrategy: 'Test strategy',
          subtasks: [
            {
              id: '1.1',
              title: 'Initialize Git repository',
              description: 'Create a new Git repository',
            },
          ],
        },
      ],
    };
    (
      taskGenerationStages.addTaskDetails as unknown as MockFn<
        (
          taskStructure: TaskStructure,
          anthropicClient: AnthropicClient,
          progressCallback?: any
        ) => Promise<DetailedTasks>
      >
    ).mockResolvedValue(mockDetailedTasks);

    // Mock the task files
    const mockTaskFiles = {
      tasks: [
        {
          id: '1',
          title: 'Set up project repository',
          description: 'Initialize Git repository and configure CI/CD',
          priority: 'high',
          dependencies: [],
          details: 'Detailed implementation steps',
          testStrategy: 'Test strategy',
          subtasks: [
            {
              id: '1.1',
              title: 'Initialize Git repository',
              description: 'Create a new Git repository',
            },
          ],
        },
      ],
      tasksPath: '/project/root/apm-artifacts/artifacts.json',
      markdownPath: '/project/root/apm-artifacts/project-brief.md',
    };
    (
      taskGenerationStages.generateTaskFiles as unknown as MockFn<
        (detailedTasks: DetailedTasks, projectBriefUri: string) => Promise<TaskGenerationResult>
      >
    ).mockResolvedValue(mockTaskFiles);

    const result = await taskGenerator.generateTasks(projectBriefUri, anthropicClient as any);

    // Verify the result
    expect(result).toEqual({
      tasks: [
        {
          id: '1',
          title: 'Set up project repository',
          description: 'Initialize Git repository and configure CI/CD',
          priority: 'high',
          dependencies: [],
          details: 'Detailed implementation steps',
          testStrategy: 'Test strategy',
          subtasks: [
            {
              id: '1.1',
              title: 'Initialize Git repository',
              description: 'Create a new Git repository',
            },
          ],
        },
      ],
      tasksPath: '/project/root/apm-artifacts/artifacts.json',
      markdownPath: '/project/root/apm-artifacts/project-brief.md',
    });

    // Verify that the task generation stages were called without a progress callback
    expect(taskGenerationStages.addTaskDetails).toHaveBeenCalledWith(
      mockTaskStructure,
      anthropicClient,
      undefined
    );
  });
});
