/**
 * @fileoverview MCP tool for creating project briefs through an interactive interview process.
 * This tool facilitates an interactive project brief development process through user interviews
 * and generates initial tasks with proper structure and dependencies.
 */

import { z } from 'zod';
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger.js';
import { schemas, validateParams, getProjectRoot } from '../../validation/index.js';
import { handleError, type MCPErrorResponse } from '../../errors/handler.js';
import { create_success_payload, create_async_operation_payload } from '../../utils/response.js';
import { mcpAsyncOperationManager } from '../../async/manager.js';
import type { OperationProgress } from '../../../core/utils/async-manager.js';
import { ARTIFACTS_DIR } from '../../../config.js';
import { resourceStorage, type MCPResource } from '../../../core/services/ResourceStorage.js';
import { interviewService } from '../../../core/services/InterviewService.js';

/**
 * Project brief resource type
 */
export interface ProjectBrief extends MCPResource {
  id: string;
  title: string;
  description: string;
  goals: string[];
  stakeholders: string[];
  technologies: string[];
  constraints: string[];
  timeline: string;
  phases: Phase[];
  interviewProgress: InterviewStage[];
  createdAt: string;
  updatedAt: string;
  version: string;
}

/**
 * Phase in the project brief
 */
export interface Phase {
  id: string;
  title: string;
  description: string;
  features: Feature[];
}

/**
 * Feature in a phase
 */
export interface Feature {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Interview stage
 */
export interface InterviewStage {
  id: string;
  name: string;
  completed: boolean;
  skipped: boolean;
  userResponses: Record<string, string>;
  completedAt?: string;
}

/**
 * Interview state resource type
 */
export interface InterviewState extends MCPResource {
  id: string;
  projectBriefId: string;
  currentStage: string;
  completedStages: string[];
  skippedStages: string[];
  userResponses: Record<string, string>;
  recommendationContext: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interview stage types
 */
export enum InterviewStageType {
  PROJECT_OVERVIEW = 'project_overview',
  GOALS_AND_STAKEHOLDERS = 'goals_and_stakeholders',
  CONSTRAINTS = 'constraints',
  TECHNOLOGIES = 'technologies',
  TIMELINE_AND_PHASES = 'timeline_and_phases',
  FEATURES = 'features',
  REVIEW = 'review',
}

/**
 * Prompt templates for different interview stages
 */
export const promptTemplates = {
  [InterviewStageType.PROJECT_OVERVIEW]: {
    system: `You are an expert project planning assistant helping a user create a project brief.
Your goal is to gather essential information about the project's purpose, scope, and high-level requirements.
Ask thoughtful questions to understand the project's core purpose and vision.
Be conversational but focused on extracting actionable information.`,
    user: `I'd like to understand more about your project. Could you tell me:
1. What is the project's name or working title?
2. What problem is this project trying to solve?
3. Who are the target users or beneficiaries?
4. What are the key outcomes you hope to achieve?

Feel free to provide as much or as little detail as you have at this stage. We can refine this information later.`,
  },
  [InterviewStageType.GOALS_AND_STAKEHOLDERS]: {
    system: `You are an expert project planning assistant helping a user define clear goals and identify key stakeholders.
Your goal is to help the user articulate specific goals and understand all relevant stakeholders for the project.
Ask thoughtful questions to refine vague goals into concrete objectives and identify all parties with an interest in the project.
Help the user prioritize stakeholders based on their influence and interest in the project.`,
    user: `Let's define the goals and stakeholders for your project:

For goals, consider:
1. What specific, measurable outcomes do you want to achieve?
2. What defines success for this project?
3. Are there any key metrics or KPIs you'll use to measure progress?

For stakeholders:
1. Who will be using the software directly?
2. Who will be affected by or have influence over the project?
3. Are there any specific user personas or groups to consider?

Feel free to list both primary goals and key stakeholders in your response.`,
  },
  [InterviewStageType.CONSTRAINTS]: {
    system: `You are an expert project planning assistant helping a user identify project constraints.
Your goal is to help the user recognize and document all relevant constraints that might impact the project.
Ask thoughtful questions to uncover constraints the user might not have considered.
Help the user understand the implications of each constraint and how to plan around them.`,
    user: `Let's identify the key constraints for your project. Constraints are factors that limit your options or approach.

Consider:
1. Budget constraints - What financial limitations exist?
2. Timeline constraints - Are there fixed deadlines or time limitations?
3. Resource constraints - Do you have limited team members, expertise, or tools?
4. Technical constraints - Are there system limitations, compatibility requirements, or performance needs?
5. Legal or compliance constraints - Are there regulations, standards, or policies to follow?
6. Scope constraints - Are there specific features or functions that must be included or excluded?

Understanding these constraints now will help us create a more realistic project plan.`,
  },
  [InterviewStageType.TECHNOLOGIES]: {
    system: `You are an expert project planning assistant helping a user select appropriate technologies for their project.
Your goal is to help the user identify the most suitable technologies based on project requirements, constraints, and team capabilities.
Provide informed recommendations based on current best practices and the specific project context.
Be opinionated but flexible, recognizing that technology choices depend on many factors.`,
    user: `Let's discuss the technologies you're considering for this project.

1. Are there specific programming languages, frameworks, or platforms you plan to use?
2. Do you have existing technology infrastructure that this project needs to integrate with?
3. Are there any technology constraints or requirements (e.g., must work offline, must be mobile-friendly)?
4. What is your team's experience level with these technologies?

I can provide recommendations based on your project's needs if you're unsure about certain aspects.`,
  },
  [InterviewStageType.TIMELINE_AND_PHASES]: {
    system: `You are an expert project planning assistant helping a user establish a timeline and define project phases.
Your goal is to help the user create a high-level timeline and break down their project into logical, manageable phases.
Ask thoughtful questions to ensure the timeline is realistic and phases are well-defined with clear objectives.
Help the user establish dependencies between phases and identify critical path activities.`,
    user: `Let's establish a timeline and define the major phases for your project.

For the overall timeline:
1. When do you expect or need the project to be completed?
2. Are there any fixed milestones or deadlines that must be met?

For breaking down the project into phases:
1. What are the logical stages or phases for this project? (e.g., planning, development, testing, deployment)
2. For each phase, what are the main objectives and deliverables?
3. How much time do you estimate each phase will require?
4. Are there dependencies between phases that affect the sequence?

This breakdown will help make the project more manageable and establish a realistic timeline.`,
  },
  [InterviewStageType.FEATURES]: {
    system: `You are an expert project planning assistant helping a user define project features.
Your goal is to help the user identify and prioritize features that align with project goals and stakeholder needs.
Ask thoughtful questions to ensure features are well-defined with clear acceptance criteria.
Help the user distinguish between must-have, should-have, and nice-to-have features.`,
    user: `Let's identify the key features for your project. Features are specific capabilities or functions that your project will deliver.

For each feature, consider:
1. What value does this feature provide to users or stakeholders?
2. How essential is this feature to meeting project goals? (Must-have, Should-have, Nice-to-have)
3. What would constitute a minimum viable implementation of this feature?
4. Are there any dependencies between this feature and others?

Let's organize features by project phase if applicable. Feel free to be as specific or high-level as you'd like at this stage.`,
  },
  [InterviewStageType.REVIEW]: {
    system: `You are an expert project planning assistant helping a user review their project brief.
Your goal is to help the user identify any gaps, inconsistencies, or areas for improvement in their project brief.
Provide a comprehensive summary of the project brief as it currently stands.
Ask thoughtful questions to ensure the brief is complete and ready for task generation.`,
    user: `Let's review the project brief we've created so far. Here's a summary of what we've documented:

[PROJECT_BRIEF_SUMMARY]

Please review this information and let me know:
1. Is there anything missing or incorrect?
2. Are there any areas you'd like to expand on or clarify?
3. Do you feel this brief accurately represents your project vision and requirements?

Once you're satisfied with the brief, we can proceed to generating tasks based on this information.`,
  },
};

// Define the schema for the create_project_brief tool parameters
export const createProjectBriefSchema = z.object({
  projectRoot: schemas.projectRoot,
  sessionId: z.string().optional().describe('Session ID for maintaining state across interactions'),
  input: z.string().optional().describe('Path to an existing project brief file to start from'),
  stage: z
    .enum([
      InterviewStageType.PROJECT_OVERVIEW,
      InterviewStageType.GOALS_AND_STAKEHOLDERS,
      InterviewStageType.CONSTRAINTS,
      InterviewStageType.TECHNOLOGIES,
      InterviewStageType.TIMELINE_AND_PHASES,
      InterviewStageType.FEATURES,
      InterviewStageType.REVIEW,
    ])
    .optional()
    .describe('Specific interview stage to jump to'),
  response: z.string().optional().describe('User response to the current interview question'),
  exportFormat: z
    .enum(['json', 'markdown', 'text'])
    .optional()
    .describe('Format for exporting the project brief'),
  maxTasks: z.number().positive().optional().describe('Maximum number of tasks to generate'),
});

// Define the schema for the get_project_brief_status tool parameters
export const getProjectBriefStatusSchema = z.object({
  projectRoot: schemas.projectRoot,
  operationId: schemas.operationId,
});

// Define the schema for the get_project_brief_result tool parameters
export const getProjectBriefResultSchema = z.object({
  projectRoot: schemas.projectRoot,
  operationId: schemas.operationId,
});

/**
 * Registers the create_project_brief tool with the MCP server.
 * This tool facilitates an interactive project brief development process through user interviews
 * and generates initial tasks with proper structure and dependencies.
 *
 * @param server - The MCP server instance to register the tool with
 *
 * The tool handles:
 * - Creating and managing project brief resources
 * - Conducting an interactive interview process
 * - Generating tasks with a flexible taxonomy (phase/feature/task/subtask)
 * - Providing opinionated recommendations
 * - Supporting persistence, exportability, and visualization
 *
 * Parameters:
 * - projectRoot: Root directory of the project (required)
 * - sessionId: Session ID for maintaining state across interactions (optional)
 * - input: Path to an existing project brief file to start from (optional)
 * - stage: Specific interview stage to jump to (optional)
 * - response: User response to the current interview question (optional)
 * - exportFormat: Format for exporting the project brief (optional)
 * - maxTasks: Maximum number of tasks to generate (optional)
 */
export function registerCreateProjectBriefTool(server: McpServer): void {
  // Create a type for the parameters based on the schema
  type CreateProjectBriefParams = z.infer<typeof createProjectBriefSchema>;

  // Register the tool with the server
  server.tool(
    'apm_project_brief_create',
    'Create a project brief through an interactive interview process and generate tasks. IMPORTANT: Task generation is a long-running operation that may take several minutes to complete. Always inform users to be patient when this operation is in progress.',
    createProjectBriefSchema.shape,
    async (
      params: CreateProjectBriefParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters using our validation utilities
        const validatedParams = validateParams(params, createProjectBriefSchema);
        const {
          projectRoot: rawProjectRoot,
          sessionId,
          input,
          stage,
          // response and exportFormat are not used in this context
          maxTasks,
        } = validatedParams;

        // Get the project root (from params or environment variable)
        // This validates the project root but we don't need to use it yet
        getProjectRoot(rawProjectRoot);

        // Check if this is a new session or continuing an existing one
        if (!sessionId) {
          // This is a new session, start the interview process
          logger.info('Starting new project brief interview session');

          // Create a new operation for the interview process
          const operationId: string = mcpAsyncOperationManager.createOperation<
            Record<string, unknown>
          >(
            'project-brief-interview',
            async (
              _args: Record<string, unknown>,
              log: {
                info: (message: string, context?: Record<string, unknown>) => void;
                error: (message: string, context?: Record<string, unknown>) => void;
              },
              _context: Record<string, unknown>
            ): Promise<{
              success: boolean;
              data?: Record<string, unknown>;
              error?: { code: string; message: string };
            }> => {
              try {
                // Create a new interview using the InterviewService
                const interviewResponse = await interviewService.createInterview();

                log.info('Created new interview', { interviewResponse });

                return {
                  success: true,
                  data: {
                    operationId,
                    sessionId: interviewResponse.interviewStateUri.split('://')[1],
                    projectBriefUri: interviewResponse.projectBriefUri,
                    interviewStateUri: interviewResponse.interviewStateUri,
                    question: interviewResponse.question,
                    stage: interviewResponse.stage,
                    isComplete: interviewResponse.isComplete,
                    nextAction: 'respond_to_question',
                    suggestedCommand: `apm_project_brief_create --sessionId=${interviewResponse.interviewStateUri.split('://')[1]} --response="Your answer here"`,
                  },
                };
              } catch (error) {
                log.error('Error initializing project brief interview', { error });
                return {
                  success: false,
                  error: {
                    code: 'INTERVIEW_INIT_ERROR',
                    message:
                      error instanceof Error
                        ? error.message
                        : 'Unknown error initializing interview',
                  },
                };
              }
            },
            {
              input,
              stage,
              maxTasks,
            },
            logger
          );

          // Return the operation ID and initial prompt with user communication guidance
          return create_async_operation_payload(
            operationId,
            'project-brief-interview',
            {
              nextAction: 'check_operation_status',
              checkStatusCommand: `apm_project_brief_status --operationId=${operationId}`,
            },
            'Project brief interview started',
            {
              metadata: {
                userCommunication: {
                  message: "I'm starting the project brief interview process.",
                  expectationType: 'immediate' as const,
                  suggestedResponse:
                    "I'll start the project brief interview process. First, I need to check the status of the operation.",
                },
                agentInstructions: `IMPORTANT: DO NOT ask the user any questions yet. First, check the operation status using apm_project_brief_status. The first interview question will be available after checking the status.`,
              },
            }
          );
        } else {
          // This is a continuing session, process the response
          logger.info('Continuing project brief interview session', {
            sessionId,
            response: validatedParams.response,
          });

          // Check if we have a response to process
          if (!validatedParams.response) {
            return create_success_payload(
              {
                sessionId,
                message: 'No response provided',
                nextAction: 'provide_response',
                suggestedCommand: `apm_project_brief_create --sessionId=${sessionId} --response="Your answer here"`,
              },
              'No response provided'
            );
          }

          // Process the response using the InterviewService
          try {
            // The sessionId should be the actual interview state ID, not the session ID
            // First, check if the sessionId is already a valid interview state URI
            const interviewStateUri = `interview-state://${sessionId}`;

            logger.debug('Checking for interview state', {
              interviewStateUri,
              sessionId,
              response: validatedParams.response,
            });

            // Check if the interview state exists
            if (!(await resourceStorage.resourceExists(interviewStateUri))) {
              // If not found, try to find the interview state by listing all interview states
              // and finding one that matches the session ID pattern
              logger.warn(
                'Interview state not found directly, attempting to find by session pattern',
                {
                  interviewStateUri,
                  sessionId,
                }
              );

              // For now, just return a clear error message
              logger.error('Interview state not found', { interviewStateUri });
              return create_success_payload(
                {
                  sessionId,
                  message:
                    'Interview state not found. The session ID provided does not match any existing interview state.',
                  nextAction: 'start_new_interview',
                  suggestedCommand: `apm_project_brief_create`,
                },
                'Interview state not found'
              );
            }

            // Check if this is a "Generate tasks" response after interview completion
            if (validatedParams.response.trim().toLowerCase() === 'generate tasks') {
              // Load the interview state to check if it's complete
              const interviewState =
                await resourceStorage.loadResource<InterviewState>(interviewStateUri);
              const projectBriefUri = `project-brief://${interviewState.projectBriefId}`;

              // For "Generate tasks" response, we'll always start task generation
              // This is a special command that should always trigger task generation
              // regardless of the interview state
              {
                // Log that we're starting task generation
                logger.info('Starting asynchronous task generation from "Generate tasks" command', {
                  sessionId,
                  projectBriefUri,
                });

                // Create a new async operation for task generation
                const operationId = mcpAsyncOperationManager.createOperation<{
                  tasks: Array<Record<string, unknown>>;
                  tasksPath: string;
                  markdownPath?: string;
                  sessionId: string;
                  projectBriefUri: string;
                  interviewStateUri: string;
                }>(
                  'task-generation',
                  async (
                    _args: Record<string, unknown>,
                    log: {
                      info: (message: string, context?: Record<string, unknown>) => void;
                      error: (message: string, context?: Record<string, unknown>) => void;
                    },
                    context: {
                      reportProgress?: (progress: OperationProgress) => void;
                      mcpLog?: typeof log;
                      session?: unknown;
                    }
                  ) => {
                    try {
                      // Generate tasks asynchronously
                      const result = await interviewService.generateTasks(
                        projectBriefUri,
                        { maxTasks: maxTasks },
                        (progress) => {
                          // Report progress through the AsyncOperationManager
                          if (context.reportProgress) {
                            context.reportProgress({
                              progress: progress.progress,
                              message: progress.message,
                              currentStep: progress.stage,
                              totalSteps: progress.steps.length,
                              currentStepNumber: progress.currentStepNumber,
                              steps: progress.steps,
                            });
                          }

                          // Also log the progress updates
                          log.info('Task generation progress', {
                            progress: progress.progress,
                            message: progress.message,
                            currentStep: progress.stage,
                            totalSteps: progress.steps.length,
                            currentStepNumber: progress.currentStepNumber,
                          });
                        }
                      );

                      log.info('Task generation completed successfully', {
                        taskCount: result.tasks.length,
                        tasksPath: result.tasksPath,
                      });

                      return {
                        success: true,
                        data: {
                          tasks: result.tasks,
                          tasksPath: result.tasksPath,
                          markdownPath: result.markdownPath,
                          sessionId,
                          projectBriefUri,
                          interviewStateUri,
                        },
                      };
                    } catch (error) {
                      log.error('Error generating tasks', { error });
                      return {
                        success: false,
                        error: {
                          code: 'TASK_GENERATION_ERROR',
                          message:
                            error instanceof Error
                              ? error.message
                              : 'Unknown error generating tasks',
                        },
                      };
                    }
                  },
                  {},
                  logger
                );

                // Return immediately with the operation ID and clear instructions
                return create_async_operation_payload(
                  operationId,
                  'task-generation',
                  {
                    sessionId,
                    projectBriefUri,
                    interviewStateUri,
                    nextAction: 'check_operation_status',
                    checkStatusCommand: `apm_project_brief_status --operationId=${operationId}`,
                  },
                  'Task generation started',
                  {
                    metadata: {
                      operationType: 'task-generation',
                      userCommunication: {
                        message: 'Task generation has started.',
                        expectationType: 'long_wait' as const,
                        estimatedTimeSeconds: 180, // Default to 3 minutes
                        suggestedResponse: `The task generation process has started. This typically takes 2-3 minutes to complete.\n\nWhile we wait, here's what's happening behind the scenes:\n- The AI is analyzing your project requirements\n- It's identifying key components, features, and dependencies\n- It will create a structured task breakdown with proper sequencing\n- Tasks will be saved to the ${ARTIFACTS_DIR} directory, along with an overall project brief.\n\nYou can ask me to "check status" anytime if you'd like an update, or we can discuss other aspects of your project while we wait.`,
                      },
                      agentInstructions:
                        "DO NOT automatically check the status again. Wait for the user to explicitly request a status update by saying something like 'check status'. This is a long-running operation and repeated status checks are not helpful. The user will be notified when the operation completes.",
                      waitTimeInfo: `Task generation typically takes 2-3 minutes to complete. The process involves analyzing project requirements, identifying components and dependencies, creating a structured task breakdown, and saving the results to ${ARTIFACTS_DIR}. Please be patient while the tasks are being generated.`,
                    },
                  }
                );
              }
            }

            let interviewResponse;
            try {
              interviewResponse = await interviewService.processResponse(
                interviewStateUri,
                validatedParams.response
              );
            } catch (processError) {
              logger.error('Error processing response in interview service', {
                processError,
                errorMessage:
                  processError instanceof Error ? processError.message : String(processError),
                errorStack: processError instanceof Error ? processError.stack : undefined,
                errorName: processError instanceof Error ? processError.name : undefined,
                interviewStateUri,
                response: validatedParams.response,
              });

              // Create a fallback response
              const projectBriefUri = `project-brief://${(await resourceStorage.loadResource<InterviewState>(interviewStateUri)).projectBriefId}`;
              const projectBrief =
                await resourceStorage.loadResource<ProjectBrief>(projectBriefUri);

              // Update the project brief with the user response
              if (projectBrief.title === '') {
                projectBrief.title = validatedParams.response.substring(0, 50);
              }
              if (projectBrief.description === '') {
                projectBrief.description = validatedParams.response;
              }

              // Save the updated project brief
              await resourceStorage.saveResource(projectBrief);

              // Move to the next stage
              const interviewState =
                await resourceStorage.loadResource<InterviewState>(interviewStateUri);
              const currentStage = interviewState.currentStage;
              const allStages = Object.values(InterviewStageType);
              const currentIndex = allStages.indexOf(currentStage as InterviewStageType);

              // If we're at the last stage, the interview is complete
              const isComplete = currentIndex === allStages.length - 1;

              if (!isComplete) {
                // Update the current stage
                const nextStage = allStages[currentIndex + 1];
                interviewState.currentStage = nextStage;
                interviewState.completedStages.push(currentStage);

                // Save the updated interview state
                await resourceStorage.saveResource(interviewState);

                // Return the next question
                return create_success_payload(
                  {
                    sessionId,
                    message: 'Response processed with fallback mechanism',
                    projectBriefUri,
                    interviewStateUri,
                    question: `Tell me about the ${nextStage} for your project.`,
                    stage: nextStage,
                    isComplete: false,
                    nextAction: 'respond_to_question',
                    suggestedCommand: `apm_project_brief_create --sessionId=${sessionId} --response="Your answer here"`,
                  },
                  'Response processed with fallback mechanism'
                );
              } else {
                // The interview is complete
                return create_success_payload(
                  {
                    sessionId,
                    message: 'Project brief interview completed with fallback mechanism',
                    projectBriefUri,
                    interviewStateUri,
                    isComplete: true,
                    nextAction: 'generate_tasks',
                    suggestedCommand: `apm_project_brief_create --sessionId=${sessionId} --response="Generate tasks"`,
                  },
                  'Project brief interview completed with fallback mechanism'
                );
              }
            }

            // Check if the interview is complete
            if (interviewResponse.isComplete) {
              // If the interview is complete, start task generation asynchronously
              // Log that we're starting task generation
              logger.info('Starting asynchronous task generation after interview completion', {
                sessionId,
                projectBriefUri: interviewResponse.projectBriefUri,
              });

              // Create a new async operation for task generation
              const operationId = mcpAsyncOperationManager.createOperation<{
                tasks: Array<Record<string, unknown>>;
                tasksPath: string;
                markdownPath?: string;
                sessionId: string;
                projectBriefUri: string;
                interviewStateUri: string;
              }>(
                'task-generation',
                async (
                  _args: Record<string, unknown>,
                  log: {
                    info: (message: string, context?: Record<string, unknown>) => void;
                    error: (message: string, context?: Record<string, unknown>) => void;
                  },
                  context: {
                    reportProgress?: (progress: OperationProgress) => void;
                    mcpLog?: typeof log;
                    session?: unknown;
                  }
                ) => {
                  try {
                    // Generate tasks asynchronously
                    const result = await interviewService.generateTasks(
                      interviewResponse.projectBriefUri,
                      { maxTasks: maxTasks },
                      (progress) => {
                        // Report progress through the AsyncOperationManager
                        if (context.reportProgress) {
                          context.reportProgress({
                            progress: progress.progress,
                            message: progress.message,
                            currentStep: progress.stage,
                            totalSteps: progress.steps.length,
                            currentStepNumber: progress.currentStepNumber,
                            steps: progress.steps,
                          });
                        }

                        // Also log the progress updates
                        log.info('Task generation progress', {
                          progress: progress.progress,
                          message: progress.message,
                          stage: progress.stage,
                          steps: progress.steps,
                          currentStepNumber: progress.currentStepNumber,
                          elapsedTime: progress.elapsedTime,
                        });
                      }
                    );

                    log.info('Task generation completed successfully', {
                      taskCount: result.tasks.length,
                      tasksPath: result.tasksPath,
                    });

                    return {
                      success: true,
                      data: {
                        tasks: result.tasks,
                        tasksPath: result.tasksPath,
                        markdownPath: result.markdownPath,
                        sessionId,
                        projectBriefUri: interviewResponse.projectBriefUri,
                        interviewStateUri: interviewResponse.interviewStateUri,
                      },
                    };
                  } catch (error) {
                    log.error('Error generating tasks', { error });
                    return {
                      success: false,
                      error: {
                        code: 'TASK_GENERATION_ERROR',
                        message:
                          error instanceof Error ? error.message : 'Unknown error generating tasks',
                      },
                    };
                  }
                },
                {},
                logger
              );

              // Return immediately with the operation ID and clear instructions
              return create_async_operation_payload(
                operationId,
                'task-generation',
                {
                  sessionId,
                  projectBriefUri: interviewResponse.projectBriefUri,
                  interviewStateUri: interviewResponse.interviewStateUri,
                  nextAction: 'check_operation_status',
                  checkStatusCommand: `apm_project_brief_status --operationId=${operationId}`,
                },
                'Task generation started',
                {
                  metadata: {
                    operationType: 'task-generation',
                    userCommunication: {
                      message: 'Task generation has started.',
                      expectationType: 'long_wait' as const,
                      estimatedTimeSeconds: 180, // Default to 3 minutes
                      suggestedResponse: `The task generation process has started. This typically takes 2-3 minutes to complete.\n\nWhile we wait, here's what's happening behind the scenes:\n- The AI is analyzing your project requirements\n- It's identifying key components, features, and dependencies\n- It will create a structured task breakdown with proper sequencing\n- Tasks will be saved to the ${ARTIFACTS_DIR} directory, along with an overall project brief.\n\nYou can ask me to "check status" anytime if you'd like an update, or we can discuss other aspects of your project while we wait.`,
                    },
                    agentInstructions:
                      "DO NOT automatically check the status again. Wait for the user to explicitly request a status update by saying something like 'check status'. This is a long-running operation and repeated status checks are not helpful. The user will be notified when the operation completes.",
                    waitTimeInfo: `Task generation typically takes 2-3 minutes to complete. The process involves analyzing project requirements, identifying components and dependencies, creating a structured task breakdown, and saving the results to ${ARTIFACTS_DIR}. Please be patient while the tasks are being generated.`,
                  },
                }
              );
            } else {
              // If the interview is not complete, return the next question
              return create_success_payload(
                {
                  sessionId,
                  message: 'Response processed',
                  projectBriefUri: interviewResponse.projectBriefUri,
                  interviewStateUri: interviewResponse.interviewStateUri,
                  question: interviewResponse.question,
                  stage: interviewResponse.stage,
                  isComplete: false,
                  nextAction: 'respond_to_question',
                  suggestedCommand: `apm_project_brief_create --sessionId=${sessionId} --response="Your answer here"`,
                },
                'Response processed'
              );
            }
          } catch (error) {
            logger.error('Error processing response', { error });
            return handleError(error, { toolName: 'apm_project_brief_create', params });
          }
        }
      } catch (error) {
        // Handle errors
        logger.error('Error in apm_project_brief_create', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          errorName: error instanceof Error ? error.name : undefined,
        });

        // Try to create a more specific error message
        if (error instanceof Error) {
          if (error.message.includes('Anthropic')) {
            return create_success_payload(
              {
                error: {
                  message: 'Error communicating with Anthropic API',
                  code: 'ANTHROPIC_API_ERROR',
                },
              },
              'Error communicating with Anthropic API'
            );
          } else if (error.message.includes('parse')) {
            return create_success_payload(
              {
                error: {
                  message: 'Error parsing response from Anthropic API',
                  code: 'PARSE_ERROR',
                },
              },
              'Error parsing response from Anthropic API'
            );
          } else if (error.message.includes('resource')) {
            return create_success_payload(
              {
                error: {
                  message: 'Error accessing resource storage',
                  code: 'RESOURCE_ERROR',
                },
              },
              'Error accessing resource storage'
            );
          }
        }

        return handleError(error, { toolName: 'apm_project_brief_create', params });
      }
    }
  );

  // Register the get_project_brief_status tool
  server.tool(
    'apm_project_brief_status',
    'Get the status of a project brief interview operation. IMPORTANT: If the status is "running", remind users that the operation may take several minutes to complete, especially for task generation.',
    z.object({
      projectRoot: schemas.projectRoot,
      operationId: schemas.operationId,
    }).shape,
    async (params: {
      projectRoot?: string;
      operationId: string;
    }): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters
        const validatedParams = validateParams(
          params,
          z.object({
            projectRoot: schemas.projectRoot,
            operationId: schemas.operationId,
          })
        );
        const { projectRoot: rawProjectRoot, operationId } = validatedParams;

        // Get the project root (from params or environment variable)
        getProjectRoot(rawProjectRoot); // Validate but we don't need to use it

        // Get the operation status
        const status = mcpAsyncOperationManager.getOperation(operationId);

        if (!status) {
          return create_success_payload(
            {
              operationId,
              status: 'not_found',
              message: 'Operation not found',
              nextAction: 'check_operation_id',
            },
            'Operation not found'
          );
        }

        const responseData = {
          operationId,
          status: status.status,
          progress: status.progress,
          message: status.statusMessage || 'Operation in progress',
          result: status.result,
        };

        // Create a context object with metadata about the operation
        const contextMetadata = {
          context: {
            operationStatus: status.status,
            nextSteps:
              status.status === 'completed'
                ? status.operationType === 'task-generation'
                  ? ['get_operation_result', 'analyze_task_complexity']
                  : 'get_operation_result'
                : status.status === 'failed'
                  ? 'check_error_details'
                  : 'continue_waiting',
            suggestedCommand:
              status.status === 'completed'
                ? status.operationType === 'task-generation'
                  ? [
                      `apm_project_brief_result --operationId=${operationId}`,
                      `apm_analyze_project_complexity`,
                    ]
                  : `apm_project_brief_result --operationId=${operationId}`
                : undefined,
          },
        };

        // Add user communication guidance based on operation status
        let userCommunication;
        let waitTimeInfo;
        let agentInstructions;

        if (status.status === 'running' || status.status === 'pending') {
          // For operations that are still running
          // Check if we have time estimates and progress information
          const estimatedTimeRemaining = status.estimatedTimeRemaining;
          const progress = status.progress;
          const currentStep = status.currentStep;
          const totalSteps = status.totalSteps;
          const currentStepNumber = status.currentStepNumber;

          // Format the time estimate for display
          let timeEstimateText = '';
          if (estimatedTimeRemaining) {
            const minutes = Math.floor(estimatedTimeRemaining / 60);
            const seconds = estimatedTimeRemaining % 60;
            if (minutes > 0) {
              timeEstimateText = `about ${minutes} minute${minutes !== 1 ? 's' : ''}${seconds > 0 ? ` and ${seconds} seconds` : ''}`;
            } else {
              timeEstimateText = `about ${seconds} seconds`;
            }
          } else {
            timeEstimateText = 'about 2-3 minutes';
          }

          // Create a detailed progress message
          let progressText = '';
          if (progress !== undefined) {
            progressText = `${Math.round(progress)}% complete`;
            if (currentStep && totalSteps) {
              progressText += `, ${currentStep}`;
              if (currentStepNumber && totalSteps) {
                progressText += ` (step ${currentStepNumber} of ${totalSteps})`;
              }
            }
          }

          // For task generation operations, provide more detailed information
          if (status.operationType === 'task-generation') {
            userCommunication = {
              message: 'Task generation is still in progress.',
              expectationType: 'long_wait' as const,
              estimatedTimeSeconds: estimatedTimeRemaining || 180, // Use the estimated time if available, otherwise default to 3 minutes
              suggestedResponse: `The task generation is in progress (${Math.round(progress || 0)}% complete).\n\nWhile we wait, here's what's happening behind the scenes:\n- The AI is analyzing your project requirements\n- It's identifying key components, features, and dependencies\n- It will create a structured task breakdown with proper sequencing\n- Tasks will be saved to the ${ARTIFACTS_DIR} directory, along with an overall project brief.\n\nYou can ask me to "check status" anytime if you'd like an update, or we can discuss other aspects of your project while we wait.`,
            };
          } else {
            // Default response for other operation types
            userCommunication = {
              message: 'This operation is still in progress.',
              expectationType: 'long_wait' as const,
              estimatedTimeSeconds: estimatedTimeRemaining || 180, // Use the estimated time if available, otherwise default to 3 minutes
              suggestedResponse: `I've submitted your request and the operation is currently in progress. ${progressText ? progressText + '. ' : ''}This typically takes ${timeEstimateText} to complete. I'll let you know once it's finished.`,
            };
          }

          waitTimeInfo = `This operation typically takes ${timeEstimateText} to complete. ${progressText ? 'Current status: ' + progressText + '.' : ''} Please be patient while it processes.`;
        } else if (status.status === 'completed') {
          // For completed operations
          if (status.operationType === 'project-brief-interview') {
            // If this is a completed project-brief-interview operation, include the interview question
            const interviewResult = status.result?.data;

            if (
              interviewResult &&
              typeof interviewResult === 'object' &&
              'question' in interviewResult
            ) {
              const question = (interviewResult as Record<string, unknown>).question as string;

              userCommunication = {
                message: "I'm ready to start the project brief interview.",
                expectationType: 'immediate' as const,
                suggestedResponse: `I'll help you create a project brief through a series of interview questions. If you have any existing documentation like a PRD or specification document, feel free to share it and I'll use that to help answer the questions.\n\nLet's begin with understanding your project overview: ${question}`,
              };
            } else {
              userCommunication = {
                message: 'Project brief interview is ready to begin.',
                expectationType: 'immediate' as const,
                suggestedResponse:
                  "I'll help you create a project brief through a series of interview questions. If you have any existing documentation like a PRD or specification document, feel free to share it and I'll use that to help answer the questions.\n\nLet's start with understanding your project overview.",
              };
            }
          } else if (status.operationType === 'task-generation') {
            userCommunication = {
              message: 'Task generation has completed successfully.',
              expectationType: 'immediate' as const,
              suggestedResponse:
                'Great news! The tasks have been generated successfully. You can now view these tasks and analyze their complexity using the apm_analyze_project_complexity tool to identify which tasks might benefit from being broken down into subtasks.',
            };
          } else {
            userCommunication = {
              message: 'The operation has completed successfully.',
              expectationType: 'immediate' as const,
              suggestedResponse:
                'Great news! The operation has completed successfully. Let me get the results for you.',
            };
          }
        } else if (status.status === 'failed') {
          // For failed operations
          userCommunication = {
            message: 'The operation has failed.',
            expectationType: 'immediate' as const,
            suggestedResponse: "I'm sorry, but the operation has failed. Here's what went wrong:",
          };
        }

        // Add agent instructions for task generation operations
        if (
          status.operationType === 'task-generation' &&
          (status.status === 'running' || status.status === 'pending')
        ) {
          agentInstructions =
            "DO NOT automatically check the status again. Wait for the user to explicitly request a status update by saying something like 'check status'. This is a long-running operation and repeated status checks are not helpful. The user will be notified when the operation completes.";
        } else if (status.operationType === 'task-generation' && status.status === 'completed') {
          agentInstructions =
            "Project tasks have been generated. Next, you can use 'apm_complexity' to identify which tasks might benefit from being broken down into subtasks. Set `research` to true to use Perplexity AI for research-backed analysis.";
        } else if (
          status.operationType === 'project-brief-interview' &&
          status.status === 'completed'
        ) {
          // If this is a completed project-brief-interview operation, include the interview question
          const interviewResult = status.result?.data;

          if (
            interviewResult &&
            typeof interviewResult === 'object' &&
            'sessionId' in interviewResult
          ) {
            const sessionId = (interviewResult as Record<string, unknown>).sessionId as string;

            agentInstructions = `Now that the operation is complete, inform the user that you'll be gathering information about their project through a series of interview questions. Ask if they have any existing documentation they'd like to share. If they provide documentation, proactively use that material to suggest answers to each interview question, asking for confirmation or adjustments. When the user responds, use the apm_project_brief_create tool with the sessionId=${sessionId} and the user's response.`;
          }
        }

        return create_success_payload(
          responseData,
          status.statusMessage || `Operation status: ${status.status}`,
          {
            ...contextMetadata,
            userCommunication,
            waitTimeInfo,
            agentInstructions,
          }
        );
      } catch (error) {
        // Handle errors
        return handleError(error, { toolName: 'apm_project_brief_status', params });
      }
    }
  );

  // Register the get_project_brief_result tool
  server.tool(
    'apm_project_brief_result',
    'Get the result of a completed project brief interview operation. Call this after apm_project_brief_status indicates the operation is complete. If the operation is still running, inform users to be patient as task generation can take several minutes.',
    z.object({
      projectRoot: schemas.projectRoot,
      operationId: schemas.operationId,
    }).shape,
    async (params: {
      projectRoot?: string;
      operationId: string;
    }): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters
        const validatedParams = validateParams(
          params,
          z.object({
            projectRoot: schemas.projectRoot,
            operationId: schemas.operationId,
          })
        );
        const { projectRoot: rawProjectRoot, operationId } = validatedParams;

        // Get the project root (from params or environment variable)
        getProjectRoot(rawProjectRoot); // Validate but we don't need to use it

        // Get the operation result
        const result = mcpAsyncOperationManager.getOperationResult(operationId);

        if (!result) {
          // Add user communication guidance for operation not found
          const userCommunication = {
            message: 'The operation was not found.',
            expectationType: 'immediate' as const,
            suggestedResponse:
              "I couldn't find the operation you're looking for. Please check the operation ID and try again, or start a new operation.",
          };

          return create_success_payload(
            {
              operationId,
              status: 'not_found',
              message: 'Operation result not found',
              nextAction: 'check_operation_id',
            },
            'Operation result not found',
            {
              userCommunication,
            }
          );
        }

        if (result.error) {
          // Add user communication guidance for operation failure
          const userCommunication = {
            message: 'The operation has failed.',
            expectationType: 'immediate' as const,
            suggestedResponse: `I'm sorry, but the operation has failed. Here's what went wrong: ${result.error?.message || 'An unknown error occurred'}. You may want to try again or check the error details.`,
          };

          return create_success_payload(
            {
              operationId,
              status: 'failed',
              error: result.error,
              message: result.error?.message || 'Operation failed',
              nextAction: 'check_error_details',
            },
            result.error?.message || 'Operation failed',
            {
              userCommunication,
            }
          );
        }

        // Check if this is a task generation result
        if (result.data && typeof result.data === 'object' && 'tasks' in result.data) {
          // This is a task generation result
          // Add user communication guidance for task generation completion
          const userCommunication = {
            message: 'Task generation has completed successfully.',
            expectationType: 'immediate' as const,
            suggestedResponse:
              'Great news! The tasks have been generated successfully based on your project brief. You can now view and manage these tasks using the apm_get_tasks command.',
          };

          return create_success_payload(
            {
              operationId,
              status: 'completed',
              message: 'Task generation completed successfully',
              tasks: (result.data as Record<string, unknown>).tasks,
              tasksPath: (result.data as Record<string, unknown>).tasksPath,
              markdownPath: (result.data as Record<string, unknown>).markdownPath,
              sessionId: (result.data as Record<string, unknown>).sessionId as string,
              projectBriefUri: (result.data as Record<string, unknown>).projectBriefUri as string,
              interviewStateUri: (result.data as Record<string, unknown>)
                .interviewStateUri as string,
              nextAction: 'view_tasks',
              suggestedCommand: `apm_get_tasks`,
            },
            'Task generation completed successfully',
            {
              userCommunication,
              agentInstructions:
                "Project tasks have been generated. Next, you can use 'apm_complexity' to identify which tasks might benefit from being broken down into subtasks. Set `research` to true to use Perplexity AI for research-backed analysis.",
            }
          );
        } else {
          // Generic operation result
          // Add user communication guidance for generic operation completion
          const userCommunication = {
            message: 'The operation has completed successfully.',
            expectationType: 'immediate' as const,
            suggestedResponse: 'The operation has completed successfully. Here are the results.',
          };

          return create_success_payload(
            {
              operationId,
              status: 'completed',
              data: result.data,
              message: 'Operation completed successfully',
              nextAction: 'process_result',
              sessionId:
                result.data && typeof result.data === 'object'
                  ? ((result.data as Record<string, unknown>).sessionId as string)
                  : undefined,
            },
            'Operation completed successfully',
            {
              userCommunication,
            }
          );
        }
      } catch (error) {
        // Handle errors
        return handleError(error, { toolName: 'apm_project_brief_result', params });
      }
    }
  );

  // Register resources for project brief, interview state, and recommendations
  registerProjectBriefResources(server);
}

/**
 * Registers resources for project brief, interview state, and recommendations
 * @param server - The MCP server instance to register resources with
 */
function registerProjectBriefResources(server: McpServer): void {
  logger.info('Registering project brief resources');

  // Register project brief resource
  server.resource(
    'project-brief',
    new ResourceTemplate('project-brief://{id}', { list: undefined }),
    async (uri, _variables) => {
      try {
        // The ID is part of the URI, which we use directly

        // Check if the resource exists
        if (await resourceStorage.resourceExists(uri.href)) {
          // Load the resource from storage
          const projectBrief = await resourceStorage.loadResource(uri.href);

          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify(projectBrief),
              },
            ],
          };
        } else {
          // Resource not found, return a 404 error
          logger.error('Project brief not found', { uri });
          throw new Error(`Project brief not found: ${uri.href}`);
        }
      } catch (error) {
        logger.error('Error retrieving project brief', { error, uri });
        throw error;
      }
    }
  );

  // Register interview state resource
  server.resource(
    'interview-state',
    new ResourceTemplate('interview-state://{id}', { list: undefined }),
    async (uri, _variables) => {
      try {
        // The ID is part of the URI, which we use directly

        // Check if the resource exists
        if (await resourceStorage.resourceExists(uri.href)) {
          // Load the resource from storage
          const interviewState = await resourceStorage.loadResource(uri.href);

          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify(interviewState),
              },
            ],
          };
        } else {
          // Resource not found, return a 404 error
          logger.error('Interview state not found', { uri });
          throw new Error(`Interview state not found: ${uri.href}`);
        }
      } catch (error) {
        logger.error('Error retrieving interview state', { error, uri });
        throw error;
      }
    }
  );

  // Register prompt resource for interview stages
  server.resource(
    'interview-prompt',
    new ResourceTemplate('interview-prompt://{stage}', { list: undefined }),
    async (uri, variables) => {
      try {
        // Get the stage from the URI variables
        const stage = variables.stage as InterviewStageType;

        // Get the prompt template for the stage
        const promptTemplate = promptTemplates[stage] || {
          system: 'Default system prompt',
          user: 'Default user prompt',
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(promptTemplate),
            },
          ],
        };
      } catch (error) {
        logger.error('Error retrieving interview prompt', { error, uri });
        throw error;
      }
    }
  );
}
