/**
 * @fileoverview MCP prompts registration and management
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { InterviewStageType, promptTemplates } from '../tools/project/index.js';

/**
 * Registers all MCP prompts with the server
 */
export function registerPrompts(server: McpServer): void {
  logger.info('Registering MCP prompts...');

  // Register interview prompts
  registerInterviewPrompts(server);

  logger.info('MCP prompts registered');
}

/**
 * Registers interview prompts for project brief creation
 */
function registerInterviewPrompts(server: McpServer): void {
  // Register project overview prompt
  server.prompt(
    'project_overview',
    'Asks the AI to help gather essential information about the project purpose and scope',
    {},
    () => ({
      description: 'Project Overview Interview',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${promptTemplates[InterviewStageType.PROJECT_OVERVIEW].system}\n\n${promptTemplates[InterviewStageType.PROJECT_OVERVIEW].user}`,
          },
        },
      ],
    })
  );

  // Register goals and stakeholders prompt
  server.prompt(
    'project_goals_and_stakeholders',
    'Asks the AI to help define clear goals and identify key stakeholders for the project',
    {},
    () => ({
      description: 'Project Goals and Stakeholders Interview',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${promptTemplates[InterviewStageType.GOALS_AND_STAKEHOLDERS].system}\n\n${promptTemplates[InterviewStageType.GOALS_AND_STAKEHOLDERS].user}`,
          },
        },
      ],
    })
  );

  // Register technologies prompt
  server.prompt(
    'project_technologies',
    'Asks the AI to help select appropriate technologies for the project',
    {},
    () => ({
      description: 'Project Technologies Interview',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${promptTemplates[InterviewStageType.TECHNOLOGIES].system}\n\n${promptTemplates[InterviewStageType.TECHNOLOGIES].user}`,
          },
        },
      ],
    })
  );

  // Register constraints prompt
  server.prompt(
    'project_constraints',
    'Asks the AI to help identify project constraints',
    {},
    () => ({
      description: 'Project Constraints Interview',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${promptTemplates[InterviewStageType.CONSTRAINTS].system}\n\n${promptTemplates[InterviewStageType.CONSTRAINTS].user}`,
          },
        },
      ],
    })
  );

  // Register timeline and phases prompt
  server.prompt(
    'project_timeline_and_phases',
    'Asks the AI to help establish a realistic project timeline and define project phases',
    {},
    () => ({
      description: 'Project Timeline and Phases Interview',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${promptTemplates[InterviewStageType.TIMELINE_AND_PHASES].system}\n\n${promptTemplates[InterviewStageType.TIMELINE_AND_PHASES].user}`,
          },
        },
      ],
    })
  );

  // Register features prompt
  server.prompt(
    'project_features',
    'Asks the AI to help identify and prioritize project features',
    {},
    () => ({
      description: 'Project Features Interview',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${promptTemplates[InterviewStageType.FEATURES].system}\n\n${promptTemplates[InterviewStageType.FEATURES].user}`,
          },
        },
      ],
    })
  );

  // Register review prompt
  server.prompt(
    'project_review',
    'Asks the AI to help review the project brief',
    {
      projectBrief: z.string().describe('The current project brief to review'),
    },
    ({ projectBrief }) => {
      // Create a summary of the project brief for the review prompt
      const briefSummary =
        typeof projectBrief === 'string' ? projectBrief : JSON.stringify(projectBrief, null, 2);

      // Replace the placeholder in the user prompt with the actual brief summary
      const userPrompt = promptTemplates[InterviewStageType.REVIEW].user.replace(
        '[PROJECT_BRIEF_SUMMARY]',
        briefSummary
      );

      return {
        description: 'Project Brief Review',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `${promptTemplates[InterviewStageType.REVIEW].system}\n\n${userPrompt}`,
            },
          },
        ],
      };
    }
  );

  // Register a custom prompt for project brief creation with context
  server.prompt(
    'create_project_brief',
    'Initiates the project brief creation process with optional context',
    {
      existingBrief: z
        .string()
        .optional()
        .describe('Optional existing project brief to start from'),
      projectType: z
        .string()
        .optional()
        .describe('Type of project (e.g., web, mobile, desktop, API, library)'),
      teamSize: z.string().optional().describe('Size of the development team'),
      timeline: z.string().optional().describe('Expected project timeline'),
    },
    (args) => {
      // Build a custom system prompt based on the provided context
      let systemPrompt = `You are an expert project planning assistant helping a user create a project brief.
Your goal is to guide the user through a structured interview process to gather all the information needed for a comprehensive project brief.
Be conversational but focused on extracting actionable information.`;

      // Add context-specific guidance if available
      if (args.projectType) {
        systemPrompt += `\n\nThis is a ${args.projectType} project, so focus on the specific requirements and best practices for this type of project.`;
      }

      if (args.teamSize) {
        systemPrompt += `\n\nThe development team consists of ${args.teamSize} members, so consider appropriate task distribution and coordination.`;
      }

      if (args.timeline) {
        systemPrompt += `\n\nThe expected timeline for this project is ${args.timeline}, so help prioritize tasks accordingly.`;
      }

      // Build a custom user prompt
      let userPrompt = `I'd like to create a project brief for my project. Let's start by discussing the project overview:

1. What is the project's name or working title?
2. What problem is this project trying to solve?
3. Who are the target users or beneficiaries?
4. What are the key outcomes you hope to achieve?`;

      // Add existing brief context if available
      if (args.existingBrief) {
        userPrompt = `I have an existing project brief that I'd like to refine and expand upon. Here's what I have so far:

${typeof args.existingBrief === 'string' ? args.existingBrief : JSON.stringify(args.existingBrief, null, 2)}

Let's discuss how we can improve and expand this brief. What additional information would be helpful to include?`;
      }

      return {
        description: 'Project Brief Creation',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `${systemPrompt}\n\n${userPrompt}`,
            },
          },
        ],
      };
    }
  );
}
