/**
 * @fileoverview Generate tasks from project briefs
 */

import { logger } from '../../mcp/utils/logger.js';
import { resourceStorage } from './ResourceStorage.js';
import type { AnthropicClient } from '../anthropic-client.js';
import { InterviewStageType, InterviewError, type ProjectBrief } from '../types/interview-types.js';
import { TaskGenerationStage } from '../types/task-generation.js';
import {
  analyzeProjectBrief,
  createTaskStructure,
  addTaskDetails,
  generateTaskFiles,
} from './task-generation-stages.js';

/**
 * Generate tasks from a completed project brief
 * @param projectBriefUri - The URI of the project brief
 * @param anthropicClient - The Anthropic client
 * @param options - Options for task generation
 * @param progressCallback - Optional callback for reporting progress
 * @returns The generated tasks and tasks file path
 */
export async function generateTasks(
  projectBriefUri: string,
  anthropicClient: AnthropicClient,
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
  try {
    // Define the steps for task generation
    const steps = ['Project Analysis', 'Task Structure', 'Task Details', 'File Generation'];

    const startTime = Date.now();
    const getElapsedTime = (): string => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      return `${minutes} min ${seconds} sec`;
    };

    // Stage 1: Project Analysis
    progressCallback?.({
      stage: TaskGenerationStage.PROJECT_ANALYSIS,
      message: 'Analyzing project brief...',
      progress: 25,
      currentStepNumber: 1,
      steps,
      elapsedTime: getElapsedTime(),
      estimatedTimeRemaining: '~2 min',
    });

    // Check if the project brief exists and is complete
    const exists = await resourceStorage.resourceExists(projectBriefUri);
    if (!exists) {
      throw new InterviewError('Project brief not found', { projectBriefUri });
    }

    const projectBrief = await resourceStorage.loadResource<ProjectBrief>(projectBriefUri);
    if (!projectBrief) {
      throw new InterviewError('Project brief not found or invalid', { projectBriefUri });
    }

    // Check if the project brief is complete
    const isComplete = Object.values(InterviewStageType).every((stage) =>
      projectBrief.interviewProgress.some(
        (progress) => progress.id === stage && (progress.completed || progress.skipped)
      )
    );

    if (!isComplete) {
      throw new InterviewError('Project brief is not complete');
    }

    // Analyze the project brief
    const projectAnalysis = await analyzeProjectBrief(projectBriefUri, anthropicClient);

    // Stage 2: Task Structure Generation
    progressCallback?.({
      stage: TaskGenerationStage.TASK_STRUCTURE,
      message: 'Generating task structure...',
      progress: 50,
      currentStepNumber: 2,
      steps,
      elapsedTime: getElapsedTime(),
      estimatedTimeRemaining: '~1.5 min',
    });

    // Set a default maxTasks value of 10 if not provided
    const maxTasks = options?.maxTasks || 10;

    const taskStructure = await createTaskStructure(projectAnalysis, anthropicClient, maxTasks);

    // Stage 3: Task Details Generation
    progressCallback?.({
      stage: TaskGenerationStage.TASK_DETAILS,
      message: 'Adding task details...',
      progress: 75,
      currentStepNumber: 3,
      steps,
      elapsedTime: getElapsedTime(),
      estimatedTimeRemaining: '~1 min',
    });

    const detailedTasks = await addTaskDetails(taskStructure, anthropicClient, progressCallback);

    // Stage 4: File Generation
    progressCallback?.({
      stage: TaskGenerationStage.FILE_GENERATION,
      message: 'Generating task files...',
      progress: 90,
      currentStepNumber: 4,
      steps,
      elapsedTime: getElapsedTime(),
      estimatedTimeRemaining: '~15 sec',
    });

    const result = await generateTaskFiles(detailedTasks, projectBriefUri);

    progressCallback?.({
      stage: TaskGenerationStage.COMPLETE,
      message: 'Task generation complete',
      progress: 100,
      currentStepNumber: 4,
      steps,
      elapsedTime: getElapsedTime(),
      estimatedTimeRemaining: '0 sec',
    });

    return result;
  } catch (error) {
    logger.error('Error generating tasks', { error });
    throw new InterviewError('Failed to generate tasks', error);
  }
}
