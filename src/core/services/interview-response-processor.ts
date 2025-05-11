/**
 * @fileoverview Process interview responses
 */

import { logger } from '../../mcp/utils/logger.js';
import type { AnthropicClient, AnthropicMessage } from '../anthropic-client.js';
import {
  InterviewStageType,
  InterviewError,
  type ProjectBrief,
  type InterviewState,
} from '../types/interview-types.js';
import { stageDefinitions } from './interview-stages.js';

/**
 * Process a stage response with Anthropic
 * @param stage - The current stage
 * @param userResponse - The user's response
 * @param projectBrief - The project brief
 * @param interviewState - The interview state
 * @param anthropicClient - The Anthropic client
 * @returns The processed response
 */
export async function processStageResponse(
  stage: InterviewStageType,
  userResponse: string,
  projectBrief: ProjectBrief,
  _interviewState: InterviewState,
  anthropicClient: AnthropicClient
): Promise<{
  title?: string;
  description?: string;
  goals?: string[];
  stakeholders?: string[];
  technologies?: string[];
  constraints?: string[];
  timeline?: string;
  phases?: Array<{ name: string; description: string; tasks: string[] }>;
  features?: string[];
}> {
  logger.debug('Processing stage response', { stage, userResponse });
  // Create a prompt for Anthropic based on the stage
  const stageDefinition = stageDefinitions[stage];
  const systemPrompt = `${stageDefinition.systemPrompt}

  Extract the key information from the user's response and format it according to the stage:

  For project_overview: Extract the project title and description.
  For goals_and_stakeholders: Extract a list of specific goals and a list of stakeholders.
  For technologies: Extract a list of technologies.
  For constraints: Extract a list of constraints.
  For timeline_and_phases: Extract the timeline information and a list of phases with names, descriptions, and tasks.
  For features: Extract a list of features.

  IMPORTANT: You must return ONLY valid JSON with no additional text or explanation. The JSON should be properly formatted with the appropriate fields for the stage.

  For project_overview, return JSON in this format: { "title": "Project Title", "description": "Project description" }
  For goals_and_stakeholders, return JSON in this format: { "goals": ["Goal 1", "Goal 2"], "stakeholders": ["Stakeholder 1", "Stakeholder 2"] }
  For technologies, return JSON in this format: { "technologies": ["Technology 1", "Technology 2"] }
  For constraints, return JSON in this format: { "constraints": ["Constraint 1", "Constraint 2"] }
  For timeline_and_phases, return JSON in this format: { "timeline": "Timeline information", "phases": [{ "name": "Phase 1", "description": "Phase 1 description", "tasks": ["Task 1", "Task 2"] }] }
  For features, return JSON in this format: { "features": ["Feature 1", "Feature 2"] }
  `;

  // Create a context message with the current project brief
  const contextMessage = `Current Project Brief:
  Title: ${projectBrief.title || 'Not specified'}
  Description: ${projectBrief.description || 'Not specified'}
  Goals: ${projectBrief.goals.length > 0 ? projectBrief.goals.join(', ') : 'Not specified'}
  Stakeholders: ${projectBrief.stakeholders.length > 0 ? projectBrief.stakeholders.join(', ') : 'Not specified'}
  Technologies: ${projectBrief.technologies.length > 0 ? projectBrief.technologies.join(', ') : 'Not specified'}
  Constraints: ${projectBrief.constraints.length > 0 ? projectBrief.constraints.join(', ') : 'Not specified'}
  Timeline: ${projectBrief.timeline || 'Not specified'}
  Phases: ${projectBrief.phases.length > 0 ? JSON.stringify(projectBrief.phases) : 'Not specified'}`;

  // Send the message to Anthropic
  const messages: AnthropicMessage[] = [
    { role: 'user', content: contextMessage },
    {
      role: 'assistant',
      content: 'I understand the current project brief. What is the user response for this stage?',
    },
    { role: 'user', content: `User's response for ${stageDefinition.name}: ${userResponse}` },
  ];

  const response = await anthropicClient.sendMessage(messages, {
    temperature: 0.2, // Lower temperature for more deterministic responses
    systemPrompt,
  });

  // Parse the response as JSON
  try {
    logger.debug('Attempting to parse Anthropic response', { response });
    const parsedResponse = JSON.parse(response) as Record<string, unknown>;
    logger.debug('Successfully parsed Anthropic response', { parsedResponse });
    return parsedResponse;
  } catch (error) {
    logger.error('Error parsing Anthropic response', { error, response });

    // Try to extract JSON from the response if it contains JSON
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/); // Match anything between { and }
      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        logger.debug('Attempting to parse extracted JSON', { jsonString });
        const extractedJson = JSON.parse(jsonString) as Record<string, unknown>;
        logger.debug('Successfully parsed extracted JSON', { extractedJson });
        return extractedJson;
      }
    } catch (extractError) {
      logger.error('Error extracting JSON from response', { extractError });
    }

    // If we can't extract JSON, create a default response based on the stage
    logger.debug('Creating fallback response for stage', { stage });
    switch (stage) {
      case InterviewStageType.PROJECT_OVERVIEW:
        return {
          title: userResponse.substring(0, 50),
          description: userResponse,
        };
      case InterviewStageType.GOALS_AND_STAKEHOLDERS:
        return {
          goals: [userResponse],
          stakeholders: [userResponse],
        };
      case InterviewStageType.TECHNOLOGIES:
        return { technologies: [userResponse] };
      case InterviewStageType.CONSTRAINTS:
        return { constraints: [userResponse] };
      case InterviewStageType.TIMELINE_AND_PHASES:
        return {
          timeline: userResponse,
          phases: [{ name: 'Phase 1', description: userResponse, tasks: [] }],
        };
      case InterviewStageType.FEATURES:
        return { features: [userResponse] };
      default:
        throw new InterviewError('Failed to parse Anthropic response', { error, response });
    }
  }
}
