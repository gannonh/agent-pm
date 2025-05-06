/**
 * @fileoverview Types for the multi-stage task generation process
 */
/**
 * Project analysis result from Stage 1
 */
export interface ProjectAnalysis {
  components: {
    name: string;
    description: string;
    technologies: string[];
  }[];
  features: {
    name: string;
    description: string;
    complexity: 'high' | 'medium' | 'low';
  }[];
  technicalRequirements: {
    category: string;
    requirements: string[];
  }[];
  developmentConsiderations: {
    category: string;
    considerations: string[];
  }[];
}

/**
 * Task structure result from Stage 2
 */
export interface TaskStructure {
  tasks: {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    type?: 'task' | 'milestone' | 'feature' | 'phase';
  }[];
}

/**
 * Detailed tasks result from Stage 3
 */
export interface DetailedTasks {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status?: string;
    priority?: string;
    dependencies?: string[];
    details?: string;
    testStrategy?: string;
    subtasks?: unknown[];
    [key: string]: unknown;
  }>;
}

/**
 * Task generation options
 */
export interface TaskGenerationOptions {
  maxTasks?: number;
  allowUserIntervention?: boolean;
}

/**
 * Task generation result
 */
export interface TaskGenerationResult {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status?: string;
    priority?: string;
    dependencies?: string[];
    details?: string;
    testStrategy?: string;
    subtasks?: unknown[];
    [key: string]: unknown;
  }>;
  tasksPath: string;
  markdownPath?: string;
}

/**
 * Progress callback for tracking task generation progress
 */
export interface ProgressCallback {
  (progress: {
    stage: TaskGenerationStage;
    message: string;
    progress: number;
    currentStepNumber: number;
    steps: string[];
    stageProgress?: number;
    elapsedTime?: string;
    estimatedTimeRemaining?: string;
  }): void;
}

/**
 * Task generation stages
 */
export enum TaskGenerationStage {
  PROJECT_ANALYSIS = 'project_analysis',
  TASK_STRUCTURE = 'task_structure',
  TASK_DETAILS = 'task_details',
  FILE_GENERATION = 'file_generation',
  COMPLETE = 'complete',
}

/**
 * Progress callback for tracking task generation progress
 */
export interface ProgressCallback {
  (progress: {
    stage: TaskGenerationStage;
    message: string;
    progress: number;
    currentStepNumber: number;
    steps: string[];
    stageProgress?: number;
    elapsedTime?: string;
    estimatedTimeRemaining?: string;
  }): void;
}
