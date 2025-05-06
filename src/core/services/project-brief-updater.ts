/**
 * @fileoverview Update project brief based on processed responses
 */

import { InterviewStageType, ProjectBrief } from '../types/interview-types.js';

/**
 * Update the project brief based on the processed response
 * @param projectBrief - The project brief to update
 * @param stage - The current stage
 * @param processedResponse - The processed response from Anthropic
 */
export function updateProjectBrief(
  projectBrief: ProjectBrief,
  stage: InterviewStageType,
  processedResponse: {
    title?: string;
    description?: string;
    goals?: string[];
    stakeholders?: string[];
    technologies?: string[];
    constraints?: string[];
    timeline?: string;
    phases?: Array<{ name: string; description: string; tasks: string[] }>;
    features?: string[];
  }
): void {
  switch (stage) {
    case InterviewStageType.PROJECT_OVERVIEW:
      if (processedResponse.title) {
        projectBrief.title = processedResponse.title;
      }
      if (processedResponse.description) {
        projectBrief.description = processedResponse.description;
      }
      break;
    case InterviewStageType.GOALS_AND_STAKEHOLDERS:
      if (processedResponse.goals && Array.isArray(processedResponse.goals)) {
        projectBrief.goals = processedResponse.goals;
      }
      if (processedResponse.stakeholders && Array.isArray(processedResponse.stakeholders)) {
        projectBrief.stakeholders = processedResponse.stakeholders;
      }
      break;
    case InterviewStageType.TECHNOLOGIES:
      if (processedResponse.technologies && Array.isArray(processedResponse.technologies)) {
        projectBrief.technologies = processedResponse.technologies;
      }
      break;
    case InterviewStageType.CONSTRAINTS:
      if (processedResponse.constraints && Array.isArray(processedResponse.constraints)) {
        projectBrief.constraints = processedResponse.constraints;
      }
      break;
    case InterviewStageType.TIMELINE_AND_PHASES:
      if (processedResponse.timeline) {
        projectBrief.timeline = processedResponse.timeline;
      }
      if (processedResponse.phases && Array.isArray(processedResponse.phases)) {
        projectBrief.phases = processedResponse.phases;
      }
      break;
    case InterviewStageType.FEATURES:
      // Features are typically added to phases, but we could add a separate field if needed
      if (processedResponse.features && Array.isArray(processedResponse.features)) {
        // Add features to the project brief or update phases
        const featuresPhase = {
          name: 'Features',
          description: 'Key features of the project',
          tasks: processedResponse.features,
        };

        // Check if a Features phase already exists
        const featurePhaseIndex = projectBrief.phases.findIndex(
          (phase) => phase.name === 'Features'
        );

        if (featurePhaseIndex !== -1) {
          projectBrief.phases[featurePhaseIndex] = featuresPhase;
        } else {
          projectBrief.phases.push(featuresPhase);
        }
      }
      break;
    case InterviewStageType.REVIEW:
      // The review stage doesn't update the project brief directly
      break;
  }
}
