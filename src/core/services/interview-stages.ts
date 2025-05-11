/**
 * @fileoverview Interview stage definitions
 */

import { InterviewStageType, type StageDefinitions } from '../types/interview-types.js';

/**
 * Stage definitions with prompts and processing logic
 */
export const stageDefinitions: StageDefinitions = {
  [InterviewStageType.PROJECT_OVERVIEW]: {
    name: 'Project Overview',
    prompt:
      'Tell me about your project. What are you trying to build and what problem does it solve?',
    systemPrompt: `You are conducting an interview to gather information for a software project brief.
    Your goal is to understand the project overview. Ask follow-up questions to get a clear picture of what the user is trying to build.
    Be concise but thorough. Focus on understanding the project's purpose, target audience, and main features.`,
  },
  [InterviewStageType.GOALS_AND_STAKEHOLDERS]: {
    name: 'Goals and Stakeholders',
    prompt:
      'What are the main goals of your project, and who are the key stakeholders or users who will benefit from it?',
    systemPrompt: `You are conducting an interview to gather information for a software project brief.
    Your goal is to understand both the project's goals and its stakeholders. Ask follow-up questions to clarify objectives and identify all relevant parties.
    Be concise but thorough. Focus on understanding what success looks like and who will be using or affected by the software.`,
  },
  [InterviewStageType.CONSTRAINTS]: {
    name: 'Constraints',
    prompt: 'What constraints or limitations should we be aware of for this project?',
    systemPrompt: `You are conducting an interview to gather information for a software project brief.
    Your goal is to understand the project's constraints. Ask follow-up questions to identify limitations.
    Be concise but thorough. Focus on understanding budget, time, technical, or resource constraints.`,
  },
  [InterviewStageType.TECHNOLOGIES]: {
    name: 'Technologies',
    prompt:
      'What technologies do you want to use for this project? Any specific frameworks, languages, or tools?',
    systemPrompt: `You are conducting an interview to gather information for a software project brief.
    Your goal is to understand the technologies that will be used. Ask follow-up questions to clarify technical requirements.
    Be concise but thorough. Focus on understanding the tech stack, frameworks, languages, and tools.`,
  },
  [InterviewStageType.TIMELINE_AND_PHASES]: {
    name: 'Timeline and Phases',
    prompt:
      'What is the timeline for this project, and how would you like to break it down into phases?',
    systemPrompt: `You are conducting an interview to gather information for a software project brief.
    Your goal is to understand both the project's timeline and how it should be broken down into phases. Ask follow-up questions to clarify deadlines, milestones, and the logical progression of work.
    Be concise but thorough. Focus on understanding the overall schedule, key dates, and the structure of project phases.`,
  },
  [InterviewStageType.FEATURES]: {
    name: 'Features',
    prompt: 'What specific features or functionality do you want to include in this project?',
    systemPrompt: `You are conducting an interview to gather information for a software project brief.
    Your goal is to understand the specific features needed. Ask follow-up questions to clarify requirements.
    Be concise but thorough. Focus on understanding the core functionality and user stories.`,
  },
  [InterviewStageType.REVIEW]: {
    name: 'Review',
    prompt:
      "Let's review what we've discussed so far. Does this summary accurately reflect your project?",
    systemPrompt: `You are conducting an interview to gather information for a software project brief.
    Your goal is to review the information collected so far and confirm its accuracy. Present a summary of the project brief.
    Be concise but thorough. Focus on confirming the key details and identifying any gaps or misunderstandings.`,
  },
};
