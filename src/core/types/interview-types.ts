/**
 * @fileoverview Types for the interview system
 */

import { ErrorCode, AIError } from '../../types/errors.js';

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
 * Interview stage
 */
export interface InterviewStage {
  id: InterviewStageType;
  name: string;
  completed: boolean;
  skipped: boolean;
  userResponses: Record<string, string>;
}

/**
 * Project brief
 */
export interface ProjectBrief {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  title: string;
  description: string;
  goals: string[];
  stakeholders: string[];
  technologies: string[];
  constraints: string[];
  timeline: string;
  phases: Array<{ name: string; description: string; tasks: string[] }>;
  interviewProgress: InterviewStage[];
}

/**
 * Interview state
 */
export interface InterviewState {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  projectBriefId: string;
  currentStage: InterviewStageType;
  completedStages: InterviewStageType[];
  skippedStages: InterviewStageType[];
  userResponses: Record<string, string>;
  recommendationContext: Record<string, unknown>;
}

/**
 * Interview response
 */
export interface InterviewResponse {
  question: string;
  context?: string;
  recommendations?: string[];
  stage: InterviewStageType;
  isComplete: boolean;
  projectBriefUri: string;
  interviewStateUri: string;
}

/**
 * Error thrown when there's an issue with the interview process
 */
export class InterviewError extends AIError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.AI_API_ERROR, details);
    this.name = 'InterviewError';
  }
}

/**
 * Stage definition interface
 */
export interface StageDefinition {
  name: string;
  prompt: string;
  systemPrompt: string;
}

/**
 * Stage definitions record
 */
export type StageDefinitions = Record<InterviewStageType, StageDefinition>;
