/**
 * @fileoverview Implementation of the multi-stage task generation process
 */

import { logger } from '../../mcp/utils/logger.js';
import { AnthropicClient, AnthropicMessage } from '../anthropic-client.js';
import { ProjectBrief, InterviewError } from '../types/interview-types.js';
import { resourceStorage } from './ResourceStorage.js';
import { Task as CoreTask } from '../../types/task.js';
import { Task as McpTask, TasksData } from '../../mcp/types/index.js';
import {
  ANTHROPIC_TEMPERATURE,
  ANTHROPIC_MAX_TOKENS,
  ARTIFACTS_DIR,
  PRODUCT_BRIEF_FILE,
} from '../../config.js';

/**
 * Task type definition for task generation
 */
export interface GenerationTask {
  id: string;
  title: string;
  description: string;
  status?: string;
  priority?: string;
  dependencies?: string[];
  details?: string;
  testStrategy?: string;
  subtasks?: Array<{
    id: string;
    title: string;
    description: string;
    status?: string;
    dependencies?: string[];
  }>;
  [key: string]: unknown;
}

/**
 * Interface for detailed task input from AI responses
 */
interface DetailedTaskInput {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dependencies?: string[];
  details?: string;
  testStrategy?: string;
  subtasks?: unknown[];
}

/**
 * Interface for tasks data in generateMarkdown
 */
interface TasksDataInput {
  tasks?: Array<{
    id: string;
    title: string;
    description: string;
    status?: string;
    priority?: string;
    details?: string;
    testStrategy?: string;
    subtasks?: Array<{
      id: string;
      title: string;
    }>;
  }>;
  metadata?: {
    projectName?: string;
    projectVersion?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

import {
  ProjectAnalysis,
  TaskStructure,
  DetailedTasks,
  TaskGenerationResult,
  TaskGenerationStage,
} from '../types/task-generation.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import Config from '../../config.js';

/**
 * Stage 1: Analyze the project brief to identify software development components
 * @param projectBriefUri - The URI of the project brief
 * @param anthropicClient - The Anthropic client instance
 * @returns A structured analysis of the project brief
 */
export async function analyzeProjectBrief(
  projectBriefUri: string,
  anthropicClient: AnthropicClient
): Promise<ProjectAnalysis> {
  try {
    // Load the project brief
    const projectBrief = await resourceStorage.loadResource<ProjectBrief>(projectBriefUri);

    // Create a focused prompt for analysis only
    const analysisPrompt = `
      Analyze the following project brief specifically for a software development project.
      Focus on:
      1. Technical components (frontend, backend, database, etc.)
      2. Development-specific features (not general project phases)
      3. Software architecture considerations
      4. Development dependencies and technical requirements

      Ignore or de-emphasize non-development aspects like general project management,
      marketing, or business operations unless they directly impact development tasks.

      Project Brief:
      ${JSON.stringify(projectBrief, null, 2)}

      Provide a structured analysis that can be used to generate development tasks.
      Format your response as JSON with the following structure:
      {
        "components": [
          { "name": "Component Name", "description": "Technical description", "technologies": ["Tech1", "Tech2"] }
        ],
        "features": [
          { "name": "Feature Name", "description": "Technical description", "complexity": "high|medium|low" }
        ],
        "technicalRequirements": [
          { "category": "Category", "requirements": ["Requirement 1", "Requirement 2"] }
        ],
        "developmentConsiderations": [
          { "category": "Category", "considerations": ["Consideration 1", "Consideration 2"] }
        ]
      }
    `;

    // Create a context message with the project brief
    const contextMessage = `Project Brief:
      Title: ${projectBrief.title}
      Description: ${projectBrief.description}
      Goals: ${projectBrief.goals.join(', ')}
      Stakeholders: ${projectBrief.stakeholders.join(', ')}
      Technologies: ${projectBrief.technologies.join(', ')}
      Constraints: ${projectBrief.constraints.join(', ')}
      Timeline: ${projectBrief.timeline}
      Phases: ${JSON.stringify(projectBrief.phases)}`;

    // Send the message to Anthropic
    const messages: AnthropicMessage[] = [
      { role: 'user', content: contextMessage },
      {
        role: 'assistant',
        content:
          'I understand the project brief. I will analyze it for software development components.',
      },
    ];

    // Get environment variables for temperature and maxTokens
    const temperature = ANTHROPIC_TEMPERATURE;
    const maxTokens = ANTHROPIC_MAX_TOKENS;

    // Make a smaller, focused AI call
    const response = await anthropicClient.sendMessage(messages, {
      temperature,
      maxTokens,
      systemPrompt: analysisPrompt,
    });

    // Process and structure the response
    return processAnalysisResponse(response);
  } catch (error) {
    logger.error('Error analyzing project brief', { error });
    throw new InterviewError('Failed to analyze project brief', error);
  }
}

/**
 * Process the analysis response from Anthropic
 * @param response - The response from Anthropic
 * @returns The processed analysis
 */
function processAnalysisResponse(response: string): ProjectAnalysis {
  try {
    // Define the expected response structure
    interface AnalysisResponse {
      components: Array<string>;
      features: Array<string>;
      technicalRequirements: Array<string>;
      developmentConsiderations: Array<string>;
      [key: string]: unknown;
    }

    // Parse the response as JSON
    const parsedResponse = JSON.parse(response) as AnalysisResponse;

    // Validate the response structure
    if (!parsedResponse.components || !Array.isArray(parsedResponse.components)) {
      throw new Error('Invalid response structure: missing components array');
    }

    if (!parsedResponse.features || !Array.isArray(parsedResponse.features)) {
      throw new Error('Invalid response structure: missing features array');
    }

    if (
      !parsedResponse.technicalRequirements ||
      !Array.isArray(parsedResponse.technicalRequirements)
    ) {
      throw new Error('Invalid response structure: missing technicalRequirements array');
    }

    if (
      !parsedResponse.developmentConsiderations ||
      !Array.isArray(parsedResponse.developmentConsiderations)
    ) {
      throw new Error('Invalid response structure: missing developmentConsiderations array');
    }

    // Convert the parsed response to the ProjectAnalysis type
    return {
      components: parsedResponse.components.map((component) => {
        if (typeof component === 'string') {
          return {
            name: component,
            description: '',
            technologies: [],
          };
        }
        return component as { name: string; description: string; technologies: string[] };
      }),
      features: parsedResponse.features.map((feature) => {
        if (typeof feature === 'string') {
          return {
            name: feature,
            description: '',
            complexity: 'medium' as const,
          };
        }
        // Handle object features with proper type casting
        const featureObj = feature as {
          name: string;
          description: string;
          complexity?: 'high' | 'medium' | 'low';
        };
        return {
          ...featureObj,
          complexity: featureObj.complexity || 'medium',
        };
      }),
      technicalRequirements: parsedResponse.technicalRequirements.map((req) => {
        if (typeof req === 'string') {
          return {
            category: 'General',
            requirements: [req],
          };
        }
        // Handle object requirements with proper type casting
        const reqObj = req as {
          name?: string;
          description?: string;
          category?: string;
          requirements?: string[];
        };
        return {
          category: reqObj.name || reqObj.category || 'General',
          requirements: reqObj.requirements || [reqObj.description || (req as string)],
        };
      }),
      developmentConsiderations: parsedResponse.developmentConsiderations.map((consideration) => {
        if (typeof consideration === 'string') {
          return {
            category: 'General',
            considerations: [consideration],
          };
        }
        // Handle object considerations with proper type casting
        const considerationObj = consideration as {
          name?: string;
          description?: string;
          category?: string;
          considerations?: string[];
        };
        return {
          category: considerationObj.name || considerationObj.category || 'General',
          considerations: considerationObj.considerations || [
            considerationObj.description || (consideration as string),
          ],
        };
      }),
    };
  } catch (error) {
    logger.error('Error processing analysis response', { error, response });

    // Try to extract JSON from the response
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Parse with proper type casting
        const extractedJson = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

        // Convert to ProjectAnalysis format
        return {
          components: Array.isArray(extractedJson.components)
            ? extractedJson.components.map((component: unknown) => {
                if (typeof component === 'string') {
                  return { name: component, description: '', technologies: [] };
                }
                const comp = component as Record<string, unknown>;
                return {
                  name: typeof comp.name === 'string' ? comp.name : 'Unknown',
                  description: typeof comp.description === 'string' ? comp.description : '',
                  technologies: Array.isArray(comp.technologies)
                    ? (comp.technologies as string[])
                    : [],
                };
              })
            : [{ name: 'Unknown', description: 'Could not extract components', technologies: [] }],
          features: [
            { name: 'Unknown', description: 'Could not extract features', complexity: 'medium' },
          ],
          technicalRequirements: [
            { category: 'Unknown', requirements: ['Could not extract requirements'] },
          ],
          developmentConsiderations: [
            { category: 'Unknown', considerations: ['Could not extract considerations'] },
          ],
        };
      }
    } catch (extractError) {
      logger.error('Error extracting JSON from response', { extractError });
    }

    // If all else fails, create a default analysis
    return {
      components: [
        { name: 'Unknown', description: 'Could not extract components', technologies: [] },
      ],
      features: [
        { name: 'Unknown', description: 'Could not extract features', complexity: 'medium' },
      ],
      technicalRequirements: [
        { category: 'Unknown', requirements: ['Could not extract requirements'] },
      ],
      developmentConsiderations: [
        { category: 'Unknown', considerations: ['Could not extract considerations'] },
      ],
    };
  }
}

/**
 * Stage 2: Create the high-level task structure with dependencies
 * @param analysis - The project analysis from Stage 1
 * @param anthropicClient - The Anthropic client instance
 * @param maxTasks - Optional maximum number of tasks to generate
 * @returns A list of high-level tasks with titles, descriptions, and dependencies
 */
export async function createTaskStructure(
  analysis: ProjectAnalysis,
  anthropicClient: AnthropicClient,
  maxTasks?: number
): Promise<TaskStructure> {
  try {
    // Example tasks to guide the model
    const exampleTasks = [
      {
        id: '1',
        title: 'Set up project repository and CI/CD pipeline',
        description:
          'Initialize Git repository, configure GitHub Actions for CI/CD, set up linting and testing automation',
        priority: 'high',
        dependencies: [],
      },
      {
        id: '2',
        title: 'Implement user authentication API endpoints',
        description:
          'Create REST API endpoints for user registration, login, password reset, and token validation',
        priority: 'high',
        dependencies: ['1'],
      },
    ];

    // Create a focused prompt for task structure only
    const structurePrompt = `
      Based on the following software project analysis, create a development-focused task structure:
      ${JSON.stringify(analysis, null, 2)}

      Here are examples of well-structured development tasks:
      ${JSON.stringify(exampleTasks, null, 2)}

      IMPORTANT GUIDELINES:
      - Tasks should be specific development activities, not general phases
      - Each task should be completable by a developer in 1-5 days
      - Tasks should have clear technical outcomes (e.g., "Implement user authentication API" not "Plan user features")
      - Include necessary planning/design tasks, but keep them technical and specific
      - Ensure tasks are at a consistent level of granularity

      For each task, create:
      1. A specific, actionable title
      2. A technical description
      3. Dependencies (which tasks must be completed first)
      4. Priority (high, medium, low)

      ${maxTasks ? `Generate approximately ${maxTasks} tasks.` : 'Generate an appropriate number of tasks based on the project scope, but no more than 10 tasks maximum.'}

      Format the response as a JSON array of task objects.
    `;

    // Use the constant for temperature
    const temperature = ANTHROPIC_TEMPERATURE;
    const maxTokens = ANTHROPIC_MAX_TOKENS;

    // Make a focused AI call for structure
    const messages: AnthropicMessage[] = [
      { role: 'user', content: 'Generate a task structure for this software project.' },
    ];

    const response = await anthropicClient.sendMessage(messages, {
      temperature,
      maxTokens,
      systemPrompt: structurePrompt,
    });

    // Process and validate the task structure
    const taskStructure = processTaskStructureResponse(response);

    // Validate and fix any issues with the task structure
    return validateTaskStructure(taskStructure);
  } catch (error) {
    logger.error('Error creating task structure', { error });
    throw new InterviewError('Failed to create task structure', error);
  }
}

/**
 * Process the task structure response from Anthropic
 * @param response - The response from Anthropic
 * @returns The processed task structure
 */
/**
 * Process the task structure response from the AI
 * @param response The response string from the AI
 * @returns A TaskStructure object with properly typed tasks
 */
function processTaskStructureResponse(response: string): TaskStructure {
  // Define the task type for proper type checking
  interface TaskData {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    type?: 'phase' | 'milestone' | 'feature' | 'task';
    [key: string]: unknown;
  }

  try {
    // Parse the response as JSON with proper type casting
    const parsedResponse = JSON.parse(response) as unknown;

    // If the response is an array, wrap it in an object
    if (Array.isArray(parsedResponse)) {
      // Validate and convert each task to ensure it has the required properties
      const validatedTasks = parsedResponse.map((task: unknown) => validateTask(task));
      return { tasks: validatedTasks };
    }

    // If the response has a tasks property, use that
    const responseObj = parsedResponse as Record<string, unknown>;
    if (responseObj.tasks && Array.isArray(responseObj.tasks)) {
      // Validate and convert each task to ensure it has the required properties
      const validatedTasks = responseObj.tasks.map((task: unknown) => validateTask(task));
      return { tasks: validatedTasks };
    }

    // Otherwise, assume the response is a single task object
    return { tasks: [validateTask(parsedResponse)] };
  } catch (error) {
    logger.error('Error processing task structure response', { error, response });

    // Try to extract JSON from the response
    try {
      // Try to extract an array
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const extractedJson = JSON.parse(jsonMatch[0]) as unknown[];
        // Validate and convert each task to ensure it has the required properties
        const validatedTasks = extractedJson.map((task: unknown) => validateTask(task));
        return { tasks: validatedTasks };
      }

      // Try to extract an object
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        const extractedJson = JSON.parse(objectMatch[0]) as unknown;
        const jsonObj = extractedJson as Record<string, unknown>;

        if (jsonObj.tasks && Array.isArray(jsonObj.tasks)) {
          // Validate and convert each task to ensure it has the required properties
          const validatedTasks = jsonObj.tasks.map((task: unknown) => validateTask(task));
          return { tasks: validatedTasks };
        }

        // Single task object
        return { tasks: [validateTask(extractedJson)] };
      }
    } catch (extractError) {
      logger.error('Error extracting JSON from response', { extractError });
    }
  }

  // Helper function to validate and normalize task objects
  function validateTask(task: unknown): TaskData {
    const defaultTask: TaskData = {
      id: generateId(),
      title: 'Unknown Task',
      description: 'Task details could not be parsed correctly',
      priority: 'medium',
      dependencies: [],
    };

    if (typeof task !== 'object' || task === null) {
      return defaultTask;
    }

    const taskObj = task as Record<string, unknown>;

    return {
      id: typeof taskObj.id === 'string' ? taskObj.id : defaultTask.id,
      title: typeof taskObj.title === 'string' ? taskObj.title : defaultTask.title,
      description:
        typeof taskObj.description === 'string' ? taskObj.description : defaultTask.description,
      priority: isValidPriority(taskObj.priority) ? taskObj.priority : defaultTask.priority,
      dependencies: Array.isArray(taskObj.dependencies)
        ? taskObj.dependencies.filter((dep): dep is string => typeof dep === 'string')
        : defaultTask.dependencies,
      type: isValidType(taskObj.type) ? taskObj.type : undefined,
    };
  }

  // Helper function to check if a priority value is valid
  function isValidPriority(priority: unknown): priority is 'high' | 'medium' | 'low' {
    return typeof priority === 'string' && ['high', 'medium', 'low'].includes(priority);
  }

  // Helper function to check if a type value is valid
  function isValidType(type: unknown): type is 'phase' | 'milestone' | 'feature' | 'task' {
    return typeof type === 'string' && ['phase', 'milestone', 'feature', 'task'].includes(type);
  }

  // Helper function to generate a random ID
  function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  // If all else fails, create a default task structure
  return {
    tasks: [
      {
        id: '1',
        title: 'Implement core functionality',
        description: 'Could not extract tasks from AI response',
        priority: 'high',
        dependencies: [],
      },
    ],
  };
}

/**
 * Validate and fix issues with the task structure
 * @param taskStructure - The task structure to validate
 * @returns The validated task structure
 */
function validateTaskStructure(taskStructure: TaskStructure): TaskStructure {
  const tasks = [...taskStructure.tasks];

  // Check for phase-like tasks
  const phaseKeywords = [
    'phase',
    'stage',
    'planning',
    'design',
    'development',
    'testing',
    'deployment',
  ];
  const suspiciousTasks = tasks.filter((task) =>
    phaseKeywords.some((keyword) => task.title.toLowerCase().includes(keyword))
  );

  if (suspiciousTasks.length > 0) {
    // Convert phase-like tasks to proper tasks
    restructurePhaselikeTasks(tasks, suspiciousTasks);
  }

  // Check for non-development tasks
  const nonDevKeywords = ['marketing', 'business', 'stakeholder meeting', 'general planning'];
  const nonDevTasks = tasks.filter((task) =>
    nonDevKeywords.some(
      (keyword) =>
        task.title.toLowerCase().includes(keyword) ||
        task.description.toLowerCase().includes(keyword)
    )
  );

  if (nonDevTasks.length > 0) {
    // Either remove or refocus non-dev tasks
    refocusNonDevTasks(tasks, nonDevTasks);
  }

  // Ensure consistent granularity
  ensureConsistentGranularity(tasks);

  // Validate dependencies
  validateTaskDependencies(tasks);

  return { tasks };
}

/**
 * Restructure phase-like tasks into proper development tasks
 * @param tasks - All tasks
 * @param phaselikeTasks - Tasks that look like phases
 */
function restructurePhaselikeTasks(
  _tasks: GenerationTask[],
  phaselikeTasks: GenerationTask[]
): void {
  // Implementation for restructuring phase-like tasks
  // This would convert things like "Phase 1: Planning" into specific development tasks

  // For each phase-like task, add a more specific title
  phaselikeTasks.forEach((task) => {
    if (task.title.toLowerCase().includes('phase') || task.title.toLowerCase().includes('stage')) {
      // Add a more specific development focus to the title
      if (
        !task.title.toLowerCase().includes('implementation') &&
        !task.title.toLowerCase().includes('develop') &&
        !task.title.toLowerCase().includes('code')
      ) {
        task.title = `${task.title} - Implementation`;
      }

      // Ensure the description is development-focused
      if (
        !task.description.toLowerCase().includes('code') &&
        !task.description.toLowerCase().includes('implement') &&
        !task.description.toLowerCase().includes('develop')
      ) {
        task.description = `${task.description} This task involves writing code and implementing the technical components described.`;
      }
    }
  });
}

/**
 * Refocus non-development tasks to be more development-oriented
 * @param tasks - All tasks
 * @param nonDevTasks - Tasks that aren't focused on development
 */
function refocusNonDevTasks(tasks: GenerationTask[], nonDevTasks: GenerationTask[]): void {
  // Implementation for refocusing non-development tasks
  // This would either remove or modify tasks that aren't focused on development

  nonDevTasks.forEach((task) => {
    const taskIndex = tasks.findIndex((t) => t === task);

    // If the task is purely non-development, remove it
    if (
      task.title.toLowerCase().includes('marketing') ||
      task.title.toLowerCase().includes('business meeting')
    ) {
      if (taskIndex !== -1) {
        tasks.splice(taskIndex, 1);
      }
      return;
    }

    // Otherwise, refocus the task on development aspects
    task.title = task.title.replace(/stakeholder/i, 'technical');
    task.title = task.title.replace(/general planning/i, 'technical planning');

    task.description = `[Development Focus] ${task.description}`;
  });
}

/**
 * Ensure tasks have consistent granularity
 * @param tasks - All tasks
 */
function ensureConsistentGranularity(tasks: GenerationTask[]): void {
  // Implementation for ensuring consistent granularity
  // This would identify and fix tasks that are too broad or too specific

  // Find the average description length as a proxy for granularity
  const totalLength = tasks.reduce((sum, task) => sum + task.description.length, 0);
  const averageLength = totalLength / tasks.length;

  // Adjust tasks that are significantly different from the average
  tasks.forEach((task) => {
    // If the task is too broad (short description)
    if (task.description.length < averageLength * 0.5) {
      task.description = `${task.description} This task should be broken down further during implementation.`;
    }

    // If the task is too specific (long description)
    if (task.description.length > averageLength * 2) {
      // Truncate the description to be more concise
      task.description = task.description.substring(0, averageLength * 1.5) + '...';
    }
  });
}

/**
 * Validate task dependencies to ensure no circular references
 * @param tasks - All tasks
 */
function validateTaskDependencies(tasks: GenerationTask[]): void {
  // Implementation for validating dependencies
  // This would check for circular references and fix them

  // Create a map of task IDs to indices
  const taskIndices = new Map<string, number>();
  tasks.forEach((task, index) => {
    taskIndices.set(task.id, index);
  });

  // Check for dependencies on non-existent tasks
  tasks.forEach((task) => {
    if (task.dependencies && Array.isArray(task.dependencies)) {
      task.dependencies = task.dependencies.filter((depId: string) => {
        const exists = taskIndices.has(depId);
        if (!exists) {
          logger.warn(`Task ${task.id} depends on non-existent task ${depId}`);
        }
        return exists;
      });
    }
  });

  // Check for circular dependencies
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(taskId: string): boolean {
    if (!visited.has(taskId)) {
      visited.add(taskId);
      recursionStack.add(taskId);

      const task = tasks[taskIndices.get(taskId) || -1];
      if (task && task.dependencies) {
        for (const depId of task.dependencies) {
          if (!visited.has(depId) && hasCycle(depId)) {
            return true;
          } else if (recursionStack.has(depId)) {
            logger.warn(`Circular dependency detected: ${taskId} -> ${depId}`);
            // Remove the circular dependency
            task.dependencies = task.dependencies.filter((id: string) => id !== depId);
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
    }
    return false;
  }

  // Check each task for cycles
  tasks.forEach((task) => {
    visited.clear();
    recursionStack.clear();
    hasCycle(task.id);
  });
}

/**
 * Stage 3: Fill in detailed implementation steps for each task
 * @param taskStructure - The task structure from Stage 2
 * @param anthropicClient - The Anthropic client instance
 * @returns Fully detailed tasks with implementation steps and testing strategies
 */
export async function addTaskDetails(
  taskStructure: TaskStructure,
  anthropicClient: AnthropicClient,
  progressCallback?: (progress: {
    stage: TaskGenerationStage;
    message: string;
    progress: number;
    currentStepNumber: number;
    steps: string[];
    stageProgress?: number;
    elapsedTime?: string;
    estimatedTimeRemaining?: string;
  }) => void
): Promise<DetailedTasks> {
  try {
    const startTime = Date.now();
    const getElapsedTime = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      return `${minutes} min ${seconds} sec`;
    };

    // Process tasks in batches for better performance
    const taskBatches = createTaskBatches(taskStructure.tasks, 3); // 3 tasks per batch for better parallelization
    const totalBatches = taskBatches.length;

    logger.info('Processing task details in parallel', {
      batchCount: totalBatches,
      tasksPerBatch: 3,
    });

    // Track progress for parallel processing
    let completedBatches = 0;

    // Function to estimate remaining time based on completed batches
    const estimateTimeRemaining = (startTime: number, completed: number, total: number) => {
      if (completed === 0) return 'calculating...';

      const elapsedMs = Date.now() - startTime;
      const msPerBatch = elapsedMs / completed;
      const remainingBatches = total - completed;
      const remainingMs = msPerBatch * remainingBatches;

      const remainingSec = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(remainingSec / 60);
      const seconds = remainingSec % 60;

      return `~${minutes} min ${seconds} sec`;
    };

    // Process in parallel but with rate limiting
    const concurrencyLimit = 3; // Maximum number of concurrent requests to avoid rate limits
    const allDetailedTasks: GenerationTask[] = [];

    // Process batches with limited concurrency
    for (let i = 0; i < taskBatches.length; i += concurrencyLimit) {
      const batchGroup = taskBatches.slice(i, i + concurrencyLimit);

      logger.info(
        `Processing batch group ${i / concurrencyLimit + 1}/${Math.ceil(taskBatches.length / concurrencyLimit)}`,
        {
          batchesInGroup: batchGroup.length,
          tasksInGroup: batchGroup.reduce((sum, batch) => sum + batch.length, 0),
        }
      );

      // Process this group in parallel
      const groupPromises = batchGroup.map(async (batch, batchIndex) => {
        try {
          // Create a focused prompt for adding details to this batch of tasks
          const detailsPrompt = `
            Add detailed implementation steps to the following software development tasks:
            ${JSON.stringify(batch, null, 2)}

            For each task, provide:
            1. Detailed implementation steps (3-7 specific steps)
            2. Technical considerations and potential challenges
            3. Testing strategy with specific test cases

            IMPORTANT:
            - Focus on technical details relevant to developers
            - Be specific about technologies, libraries, and approaches
            - Include code-level considerations where appropriate
            - For testing, include unit, integration, and end-to-end test approaches

            Format the response as a JSON array of detailed task objects.
          `;

          // Use the constant for temperature
          const temperature = ANTHROPIC_TEMPERATURE;
          const maxTokens = ANTHROPIC_MAX_TOKENS;

          // Make a focused AI call for details
          const messages: AnthropicMessage[] = [
            { role: 'user', content: 'Add detailed implementation steps to these tasks.' },
          ];

          logger.debug(`Starting API call for batch ${i + batchIndex}/${taskBatches.length}`, {
            batchSize: batch.length,
            taskIds: batch.map((t: GenerationTask) => t.id),
          });

          const response = await anthropicClient.sendMessage(messages, {
            temperature,
            maxTokens,
            systemPrompt: detailsPrompt,
          });

          logger.debug(`Completed API call for batch ${i + batchIndex}/${taskBatches.length}`);

          // Process and validate the detailed tasks
          return processTaskDetailsResponse(response, batch);
        } catch (error) {
          logger.error(`Error processing batch ${i + batchIndex}`, { error, batch });
          // Return the original batch without details as a fallback
          return batch;
        }
      });

      // Wait for this group to complete
      const groupResults = await Promise.all(groupPromises);

      // Flatten and add to the results
      for (const batchResult of groupResults) {
        allDetailedTasks.push(...batchResult);
      }

      // Update progress
      completedBatches += batchGroup.length;

      // Report progress
      if (progressCallback) {
        const progress = 50 + (completedBatches / totalBatches) * 25; // 50-75% range for this stage
        progressCallback({
          stage: TaskGenerationStage.TASK_DETAILS,
          message: `Processing task details (batch ${completedBatches}/${totalBatches})`,
          progress,
          currentStepNumber: 3,
          steps: ['Project Analysis', 'Task Structure', 'Task Details', 'File Generation'],
          stageProgress: (completedBatches / totalBatches) * 100,
          elapsedTime: getElapsedTime(),
          estimatedTimeRemaining: estimateTimeRemaining(startTime, completedBatches, totalBatches),
        });
      }

      logger.info(
        `Completed batch group ${i / concurrencyLimit + 1}/${Math.ceil(taskBatches.length / concurrencyLimit)}`,
        {
          completedBatches,
          totalBatches,
          progress: `${Math.round((completedBatches / totalBatches) * 100)}%`,
          elapsedTime: getElapsedTime(),
        }
      );
    }

    logger.info('All task details processed successfully', {
      taskCount: allDetailedTasks.length,
      elapsedTime: getElapsedTime(),
    });

    return { tasks: allDetailedTasks };
  } catch (error) {
    logger.error('Error adding task details', { error });
    throw new InterviewError('Failed to add task details', error);
  }
}

/**
 * Process the task details response from Anthropic
 * @param response - The response from Anthropic
 * @param originalTasks - The original tasks from the batch
 * @returns The processed detailed tasks
 */
/**
 * Process the task details response from the AI
 * @param response The response string from the AI
 * @param originalTasks The original tasks to merge with
 * @returns The merged tasks with details
 */
function processTaskDetailsResponse(
  response: string,
  originalTasks: GenerationTask[]
): GenerationTask[] {
  // Define the task detail type for proper type checking
  interface TaskDetail {
    id?: string;
    title?: string;
    description?: string;
    priority?: 'high' | 'medium' | 'low';
    dependencies?: string[];
    type?: 'phase' | 'milestone' | 'feature' | 'task';
    details?: string;
    testStrategy?: string;
    subtasks?: Array<{
      id?: string;
      title?: string;
      description?: string;
      status?: string;
      dependencies?: string[];
    }>;
    [key: string]: unknown;
  }

  try {
    // Parse the response as JSON with proper type casting
    const parsedResponse = JSON.parse(response) as unknown;

    // If the response is an array, use it directly
    if (Array.isArray(parsedResponse)) {
      // Validate and convert each task detail
      const validatedDetails = parsedResponse.map((detail: unknown) => validateTaskDetail(detail));
      return mergeTasksWithDetails(originalTasks, validatedDetails);
    }

    // If the response has a tasks property, use that
    const responseObj = parsedResponse as Record<string, unknown>;
    if (responseObj.tasks && Array.isArray(responseObj.tasks)) {
      // Validate and convert each task detail
      const validatedDetails = responseObj.tasks.map((detail: unknown) =>
        validateTaskDetail(detail)
      );
      return mergeTasksWithDetails(originalTasks, validatedDetails);
    }

    // Otherwise, assume the response is a single task detail
    return mergeTasksWithDetails(originalTasks, [validateTaskDetail(parsedResponse)]);
  } catch (error) {
    logger.error('Error processing task details response', { error, response });

    // Try to extract JSON from the response
    try {
      // Try to extract an array
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const extractedJson = JSON.parse(jsonMatch[0]) as unknown[];
        // Validate and convert each task detail
        const validatedDetails = extractedJson.map((detail: unknown) => validateTaskDetail(detail));
        return mergeTasksWithDetails(originalTasks, validatedDetails);
      }

      // Try to extract an object
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        const extractedJson = JSON.parse(objectMatch[0]) as unknown;
        const jsonObj = extractedJson as Record<string, unknown>;

        if (jsonObj.tasks && Array.isArray(jsonObj.tasks)) {
          // Validate and convert each task detail
          const validatedDetails = jsonObj.tasks.map((detail: unknown) =>
            validateTaskDetail(detail)
          );
          return mergeTasksWithDetails(originalTasks, validatedDetails);
        }

        // Single task detail object
        return mergeTasksWithDetails(originalTasks, [validateTaskDetail(extractedJson)]);
      }
    } catch (extractError) {
      logger.error('Error extracting JSON from response', { extractError });
    }
  }

  // Helper function to validate and normalize task detail objects
  function validateTaskDetail(detail: unknown): TaskDetail {
    if (typeof detail !== 'object' || detail === null) {
      return {};
    }

    const detailObj = detail as Record<string, unknown>;
    const result: TaskDetail = {};

    // Only include properties that are of the correct type
    if (typeof detailObj.id === 'string') result.id = detailObj.id;
    if (typeof detailObj.title === 'string') result.title = detailObj.title;
    if (typeof detailObj.description === 'string') result.description = detailObj.description;
    if (isValidPriority(detailObj.priority)) result.priority = detailObj.priority;
    if (Array.isArray(detailObj.dependencies)) {
      result.dependencies = detailObj.dependencies.filter(
        (dep): dep is string => typeof dep === 'string'
      );
    }
    if (isValidType(detailObj.type)) result.type = detailObj.type;
    if (typeof detailObj.details === 'string') result.details = detailObj.details;
    if (typeof detailObj.testStrategy === 'string') result.testStrategy = detailObj.testStrategy;

    // Handle subtasks if they exist
    if (Array.isArray(detailObj.subtasks)) {
      result.subtasks = detailObj.subtasks
        .filter(
          (subtask): subtask is Record<string, unknown> =>
            typeof subtask === 'object' && subtask !== null
        )
        .map((subtask) => {
          // Define the type explicitly to avoid indexing issues
          const validSubtask: {
            id?: string;
            title?: string;
            description?: string;
            status?: string;
            dependencies?: string[];
          } = {};

          if (typeof subtask.id === 'string') validSubtask.id = subtask.id;
          if (typeof subtask.title === 'string') validSubtask.title = subtask.title;
          if (typeof subtask.description === 'string')
            validSubtask.description = subtask.description;
          if (typeof subtask.status === 'string') validSubtask.status = subtask.status;
          if (Array.isArray(subtask.dependencies)) {
            validSubtask.dependencies = subtask.dependencies.filter(
              (dep): dep is string => typeof dep === 'string'
            );
          }
          return validSubtask;
        });
    }

    return result;
  }

  // Helper function to check if a priority value is valid
  function isValidPriority(priority: unknown): priority is 'high' | 'medium' | 'low' {
    return typeof priority === 'string' && ['high', 'medium', 'low'].includes(priority);
  }

  // Helper function to check if a type value is valid
  function isValidType(type: unknown): type is 'phase' | 'milestone' | 'feature' | 'task' {
    return typeof type === 'string' && ['phase', 'milestone', 'feature', 'task'].includes(type);
  }

  // If all else fails, return the original tasks
  return originalTasks;
}

/**
 * Merge original tasks with detailed tasks
 * @param originalTasks - The original tasks
 * @param detailedTasks - The detailed tasks from the AI
 * @returns The merged tasks
 */
function mergeTasksWithDetails(
  originalTasks: GenerationTask[],
  detailedTasks: DetailedTaskInput[]
): GenerationTask[] {
  // Create a map of task IDs to detailed tasks
  const detailedTaskMap = new Map<string, DetailedTaskInput>();
  detailedTasks.forEach((task) => {
    const id = task.id;
    if (id) {
      detailedTaskMap.set(id, task);
    }
  });

  // Merge the original tasks with the detailed tasks
  return originalTasks.map((originalTask) => {
    const detailedTask = detailedTaskMap.get(originalTask.id);
    if (detailedTask) {
      const mergedTask: GenerationTask = {
        ...originalTask,
        details: (detailedTask.details as string) || originalTask.details,
        testStrategy: (detailedTask.testStrategy as string) || originalTask.testStrategy,
      };

      if (detailedTask.subtasks) {
        const typedSubtasks = detailedTask.subtasks.map((subtask) => {
          const typedSubtask = subtask as {
            id: string;
            title: string;
            description: string;
            status?: string;
            dependencies?: string[];
          };
          return typedSubtask;
        });
        mergedTask.subtasks = typedSubtasks;
      }

      return mergedTask;
    }
    return originalTask;
  });
}

/**
 * Create batches of tasks for processing
 * @param tasks - The tasks to batch
 * @param batchSize - The size of each batch
 * @returns An array of task batches
 */
function createTaskBatches(tasks: GenerationTask[], batchSize: number): GenerationTask[][] {
  const batches: GenerationTask[][] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    batches.push(tasks.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Stage 4: Generate task files and update the project brief
 * @param detailedTasks - The detailed tasks from Stage 3
 * @param projectBriefUri - The URI of the project brief
 * @returns The generated tasks and file paths
 */
export async function generateTaskFiles(
  detailedTasks: DetailedTasks,
  projectBriefUri: string
): Promise<TaskGenerationResult> {
  try {
    // Get project root from the project brief URI
    const projectBrief = await resourceStorage.loadResource<ProjectBrief>(projectBriefUri);
    const projectRoot = Config.getProjectRoot();

    // Import necessary utilities
    const { writeTasksFile, generateTaskFiles: generateFiles } = await import(
      '../../mcp/utils/file-utils.js'
    );

    // Write the tasks.json file
    const tasksFilePath = Config.getArtifactsFile(projectRoot);

    // Create the tasks data structure
    const tasksData: TasksData = {
      tasks: detailedTasks.tasks.map((task) =>
        convertCoreTaskToMcpTask(task as unknown as CoreTask)
      ),
      metadata: {
        projectName: projectBrief.title,
        projectVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    // Write the tasks data to file
    const success = await writeTasksFile(tasksData, projectRoot);
    if (!success) {
      throw new InterviewError('Failed to write tasks data to file');
    }

    // Generate individual task files
    await generateFiles(tasksData, projectRoot);

    // Generate project brief markdown
    const markdownPath = await generateMarkdown(projectBriefUri, tasksData as unknown);

    return {
      tasks: detailedTasks.tasks,
      tasksPath: tasksFilePath,
      markdownPath,
    };
  } catch (error) {
    logger.error('Error generating task files', { error });
    throw new InterviewError('Failed to generate task files', error);
  }
}

/**
 * Convert a Core Task to an MCP Task
 * @param coreTask - The Core Task to convert
 * @returns The converted MCP Task
 */
function convertCoreTaskToMcpTask(coreTask: CoreTask): McpTask {
  const mcpTask: McpTask = {
    id: coreTask.id,
    title: coreTask.title,
    description: coreTask.description,
    status: coreTask.status || 'pending', // Set default status to 'pending' if not provided
    priority: coreTask.priority,
    dependencies: coreTask.dependencies,
    details: coreTask.details,
    testStrategy: coreTask.testStrategy,
  };

  // Convert subtasks if they exist
  if (coreTask.subtasks && coreTask.subtasks.length > 0) {
    mcpTask.subtasks = coreTask.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      description: subtask.description,
      status: subtask.status || 'pending', // Set default status to 'pending' if not provided
      dependencies: subtask.dependencies || [],
      details: subtask.details,
    }));
  }

  return mcpTask;
}

/**
 * Generate a Markdown file from the project brief and tasks
 * @param projectBriefUri - The URI of the project brief
 * @param tasksData - The tasks data
 * @returns The path to the generated Markdown file
 */
async function generateMarkdown(projectBriefUri: string, tasksData: unknown): Promise<string> {
  try {
    // Load the project brief
    const projectBrief = await resourceStorage.loadResource<ProjectBrief>(projectBriefUri);
    const projectRoot = Config.getProjectRoot();

    // Create the Markdown content
    let markdown = `# ${projectBrief.title}\n\n`;
    markdown += `## Project Brief\n\n`;
    markdown += `${projectBrief.description}\n\n`;

    // Add goals
    markdown += `## Goals\n\n`;
    for (const goal of projectBrief.goals) {
      markdown += `- ${goal}\n`;
    }
    markdown += '\n';

    // Add stakeholders
    markdown += `## Stakeholders\n\n`;
    for (const stakeholder of projectBrief.stakeholders) {
      markdown += `- ${stakeholder}\n`;
    }
    markdown += '\n';

    // Add technologies
    markdown += `## Technologies\n\n`;
    for (const technology of projectBrief.technologies) {
      markdown += `- ${technology}\n`;
    }
    markdown += '\n';

    // Add constraints
    markdown += `## Constraints\n\n`;
    for (const constraint of projectBrief.constraints) {
      markdown += `- ${constraint}\n`;
    }
    markdown += '\n';

    // Add timeline
    markdown += `## Timeline\n\n`;
    markdown += `${projectBrief.timeline}\n\n`;

    // Add phases
    markdown += `## Phases\n\n`;
    for (const phase of projectBrief.phases) {
      markdown += `### ${phase.name}\n\n`;
      markdown += `${phase.description}\n\n`;

      if (phase.tasks && phase.tasks.length > 0) {
        markdown += `Tasks:\n`;
        for (const task of phase.tasks) {
          markdown += `- ${task}\n`;
        }
        markdown += '\n';
      }
    }

    // Add tasks
    markdown += `## Tasks\n\n`;
    const tasks = (tasksData as TasksDataInput)?.tasks || [];
    for (const task of tasks) {
      markdown += `### ${task.id}: ${task.title}\n\n`;
      markdown += `**Description:** ${task.description}\n\n`;
      markdown += `**Priority:** ${task.priority}\n\n`;

      if (task.details) {
        markdown += `**Implementation Details:**\n\n${task.details}\n\n`;
      }

      if (task.testStrategy) {
        markdown += `**Test Strategy:**\n\n${task.testStrategy}\n\n`;
      }

      if (task.subtasks && task.subtasks.length > 0) {
        markdown += `**Subtasks:**\n\n`;
        for (const subtask of task.subtasks) {
          markdown += `- ${subtask.id}: ${subtask.title}\n`;
        }
        markdown += '\n';
      }
    }

    // Write the Markdown file
    const markdownPath = path.join(projectRoot, ARTIFACTS_DIR, PRODUCT_BRIEF_FILE);
    await fs.mkdir(path.dirname(markdownPath), { recursive: true });
    await fs.writeFile(markdownPath, markdown);

    return markdownPath;
  } catch (error) {
    logger.error('Error generating Markdown', { error });
    throw new InterviewError('Failed to generate project brief Markdown', error);
  }
}
