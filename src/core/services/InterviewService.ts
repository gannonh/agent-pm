/**
 * @fileoverview Service for managing project brief interviews
 */

import { logger } from '../../mcp/utils/logger.js';
import { createAnthropicClient } from '../anthropic-client.js';
import { resourceStorage } from './ResourceStorage.js';
import {
  InterviewStageType,
  ProjectBrief,
  InterviewState,
  InterviewResponse,
  InterviewError,
} from '../types/interview-types.js';
import { stageDefinitions } from './interview-stages.js';
import { processStageResponse } from './interview-response-processor.js';
import { updateProjectBrief } from './project-brief-updater.js';
import { generateMarkdown as generateMarkdownFn } from './project-brief-markdown.js';
import { generateTasks as generateTasksFn } from './task-generator.js';
import { TaskGenerationStage } from '../types/task-generation.js';

/**
 * Service for managing project brief interviews
 */
export class InterviewService {
  private anthropicClient = createAnthropicClient();

  /**
   * Create a new interview session
   * @returns The interview response with the first question
   */
  async createInterview(): Promise<InterviewResponse> {
    try {
      // Initialize the resource storage
      await resourceStorage.initialize();

      // Create a new project brief resource
      const projectBrief = await resourceStorage.createResource<Partial<ProjectBrief>>(
        'project-brief',
        {
          title: '',
          description: '',
          goals: [],
          stakeholders: [],
          technologies: [],
          constraints: [],
          timeline: '',
          phases: [],
          interviewProgress: [
            {
              id: InterviewStageType.PROJECT_OVERVIEW,
              name: stageDefinitions[InterviewStageType.PROJECT_OVERVIEW].name,
              completed: false,
              skipped: false,
              userResponses: {},
            },
          ],
        }
      );

      // Create a new interview state resource
      const interviewState = await resourceStorage.createResource<Partial<InterviewState>>(
        'interview-state',
        {
          projectBriefId: projectBrief.id,
          currentStage: InterviewStageType.PROJECT_OVERVIEW,
          completedStages: [],
          skippedStages: [],
          userResponses: {},
          recommendationContext: {},
        }
      );

      // Log the created resources
      logger.info('Created project brief and interview state', {
        projectBriefId: projectBrief.id,
        interviewStateId: interviewState.id,
      });

      // Return the first question
      return {
        question: stageDefinitions[InterviewStageType.PROJECT_OVERVIEW].prompt,
        stage: InterviewStageType.PROJECT_OVERVIEW,
        isComplete: false,
        projectBriefUri: `project-brief://${projectBrief.id}`,
        interviewStateUri: `interview-state://${interviewState.id}`,
      };
    } catch (error) {
      logger.error('Error creating interview', { error });
      throw new InterviewError('Failed to create interview', error);
    }
  }

  /**
   * Process a user response and get the next question
   * @param interviewStateUri - The URI of the interview state
   * @param userResponse - The user's response to the current question
   * @returns The next question or completion message
   */
  async processResponse(
    interviewStateUri: string,
    userResponse: string
  ): Promise<InterviewResponse> {
    try {
      logger.debug('Starting to process response', { interviewStateUri, userResponse });
      // Load the interview state
      const interviewState = await resourceStorage.loadResource<InterviewState>(interviewStateUri);

      // Load the project brief
      const projectBriefUri = `project-brief://${interviewState.projectBriefId}`;
      const projectBrief = await resourceStorage.loadResource<ProjectBrief>(projectBriefUri);

      // Update the user responses
      interviewState.userResponses[interviewState.currentStage] = userResponse;

      // Process the response with Anthropic
      const processedResponse = await processStageResponse(
        interviewState.currentStage,
        userResponse,
        projectBrief,
        interviewState,
        this.anthropicClient
      );

      // Update the project brief based on the processed response
      updateProjectBrief(projectBrief, interviewState.currentStage, processedResponse);

      // Mark the current stage as completed
      interviewState.completedStages.push(interviewState.currentStage);

      // Update the interview progress in the project brief
      const stageIndex = projectBrief.interviewProgress.findIndex(
        (stage) => stage.id === interviewState.currentStage
      );

      if (stageIndex !== -1) {
        projectBrief.interviewProgress[stageIndex].completed = true;
        projectBrief.interviewProgress[stageIndex].userResponses = {
          response: userResponse,
        };
      }

      // Determine the next stage
      const nextStage = this.getNextStage(interviewState);

      // Check if the interview is complete
      const isComplete = nextStage === null;

      if (!isComplete) {
        // Update the current stage
        interviewState.currentStage = nextStage;

        // Add the next stage to the interview progress if it doesn't exist
        if (!projectBrief.interviewProgress.some((stage) => stage.id === nextStage)) {
          projectBrief.interviewProgress.push({
            id: nextStage,
            name: stageDefinitions[nextStage].name,
            completed: false,
            skipped: false,
            userResponses: {},
          });
        }
      }

      // Save the updated resources
      await resourceStorage.saveResource(projectBrief);
      await resourceStorage.saveResource(interviewState);

      // Return the next question or completion message
      if (isComplete) {
        return {
          question: 'Thank you for completing the interview. Your project brief has been created.',
          stage: interviewState.currentStage,
          isComplete: true,
          projectBriefUri,
          interviewStateUri,
        };
      } else {
        return {
          question: stageDefinitions[nextStage].prompt,
          stage: nextStage,
          isComplete: false,
          projectBriefUri,
          interviewStateUri,
        };
      }
    } catch (error) {
      logger.error('Error processing response', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
        interviewStateUri,
        userResponse,
      });
      throw new InterviewError('Failed to process response', error);
    }
  }

  /**
   * Get the next stage in the interview process
   * @param interviewState - The current interview state
   * @returns The next stage or null if the interview is complete
   */
  private getNextStage(interviewState: InterviewState): InterviewStageType | null {
    const allStages = Object.values(InterviewStageType);
    const currentIndex = allStages.indexOf(interviewState.currentStage);

    // If we're at the last stage, the interview is complete
    if (currentIndex === allStages.length - 1) {
      return null;
    }

    // Otherwise, return the next stage
    return allStages[currentIndex + 1];
  }

  /**
   * Skip a stage in the interview process
   * @param interviewStateUri - The URI of the interview state
   * @returns The next question
   */
  async skipStage(interviewStateUri: string): Promise<InterviewResponse> {
    try {
      // Load the interview state
      const interviewState = await resourceStorage.loadResource<InterviewState>(interviewStateUri);

      // Load the project brief
      const projectBriefUri = `project-brief://${interviewState.projectBriefId}`;
      const projectBrief = await resourceStorage.loadResource<ProjectBrief>(projectBriefUri);

      // Mark the current stage as skipped
      interviewState.skippedStages.push(interviewState.currentStage);

      // Update the interview progress in the project brief
      const stageIndex = projectBrief.interviewProgress.findIndex(
        (stage) => stage.id === interviewState.currentStage
      );

      if (stageIndex !== -1) {
        projectBrief.interviewProgress[stageIndex].skipped = true;
      }

      // Determine the next stage
      const nextStage = this.getNextStage(interviewState);

      // Check if the interview is complete
      const isComplete = nextStage === null;

      if (!isComplete) {
        // Update the current stage
        interviewState.currentStage = nextStage;

        // Add the next stage to the interview progress if it doesn't exist
        if (!projectBrief.interviewProgress.some((stage) => stage.id === nextStage)) {
          projectBrief.interviewProgress.push({
            id: nextStage,
            name: stageDefinitions[nextStage].name,
            completed: false,
            skipped: false,
            userResponses: {},
          });
        }
      }

      // Save the updated resources
      await resourceStorage.saveResource(projectBrief);
      await resourceStorage.saveResource(interviewState);

      // Return the next question or completion message
      if (isComplete) {
        return {
          question: 'Thank you for completing the interview. Your project brief has been created.',
          stage: interviewState.currentStage,
          isComplete: true,
          projectBriefUri,
          interviewStateUri,
        };
      } else {
        return {
          question: stageDefinitions[nextStage].prompt,
          stage: nextStage,
          isComplete: false,
          projectBriefUri,
          interviewStateUri,
        };
      }
    } catch (error) {
      logger.error('Error skipping stage', { error });
      throw new InterviewError('Failed to skip stage', error);
    }
  }

  /**
   * Generate a Markdown file from a project brief
   * @param projectBriefUri - The URI of the project brief
   * @param tasksData - Optional tasks data to include in the Markdown
   * @returns The path to the generated Markdown file
   */
  async generateMarkdown(
    projectBriefUri: string,
    tasksData?: {
      tasks: Array<{
        id: string;
        title: string;
        description: string;
        status: string;
        priority?: string;
        type?: string;
        phaseId?: string;
        childTasks?: string[];
        subtasks?: Array<{
          id: string;
          title: string;
          status: string;
          description?: string;
        }>;
      }>;
      metadata?: {
        projectName?: string;
        projectVersion?: string;
        createdAt?: string;
        updatedAt?: string;
      };
    }
  ): Promise<string> {
    return generateMarkdownFn(projectBriefUri, tasksData);
  }

  /**
   * Generate tasks from a completed project brief
   * @param projectBriefUri - The URI of the project brief
   * @param options - Options for task generation
   * @param progressCallback - Optional callback for reporting progress
   * @returns The generated tasks and tasks file path
   */
  async generateTasks(
    projectBriefUri: string,
    options?: {
      maxTasks?: number;
      allowUserIntervention?: boolean;
    },
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
  ): Promise<{ tasks: Record<string, unknown>[]; tasksPath: string; markdownPath?: string }> {
    return generateTasksFn(projectBriefUri, this.anthropicClient, options, progressCallback);
  }
}

// Export a singleton instance
export const interviewService = new InterviewService();
