/**
 * @fileoverview Mock implementation of the InterviewService for testing
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

export class InterviewService {
  async createInterview() {
    return {
      interviewStateUri: 'interview-state://mock-interview-state',
      projectBriefUri: 'project-brief://mock-project-brief',
      question: 'What is your project about?',
      stage: InterviewStageType.PROJECT_OVERVIEW,
      isComplete: false,
    };
  }

  async processResponse(interviewStateUri: string, response: string) {
    // If the response is "complete", return a completed interview
    if (response === 'complete') {
      return {
        interviewStateUri,
        projectBriefUri: 'project-brief://mock-project-brief',
        question: 'Review your project brief. Is everything correct?',
        stage: InterviewStageType.REVIEW,
        isComplete: true,
      };
    }

    // Otherwise, return a continuing interview
    return {
      interviewStateUri,
      projectBriefUri: 'project-brief://mock-project-brief',
      question: 'What are the goals of your project?',
      stage: InterviewStageType.GOALS_AND_STAKEHOLDERS,
      isComplete: false,
    };
  }

  async generateTasks(
    projectBriefUri: string,
    options?: {
      maxTasks?: number;
      allowUserIntervention?: boolean;
    },
    progressCallback?: (progress: any) => void
  ) {
    // Call the progress callback a few times to simulate progress
    if (progressCallback) {
      progressCallback({
        progress: 25,
        message: 'Analyzing project brief',
        stage: 'analysis',
        steps: ['analysis', 'planning', 'generation'],
        currentStepNumber: 1,
        elapsedTime: 1000,
      });

      progressCallback({
        progress: 50,
        message: 'Planning task structure',
        stage: 'planning',
        steps: ['analysis', 'planning', 'generation'],
        currentStepNumber: 2,
        elapsedTime: 2000,
      });

      progressCallback({
        progress: 75,
        message: 'Generating tasks',
        stage: 'generation',
        steps: ['analysis', 'planning', 'generation'],
        currentStepNumber: 3,
        elapsedTime: 3000,
      });

      progressCallback({
        progress: 100,
        message: 'Task generation complete',
        stage: 'complete',
        steps: ['analysis', 'planning', 'generation', 'complete'],
        currentStepNumber: 4,
        elapsedTime: 4000,
      });
    }

    return {
      tasks: [
        { id: '1', title: 'Task 1', description: 'Description for Task 1' },
        { id: '2', title: 'Task 2', description: 'Description for Task 2' },
      ],
      tasksPath: '/mock/project/apm-artifacts/artifacts.json',
      markdownPath: '/mock/project/apm-artifacts/project-brief.md',
    };
  }
}

export const interviewService = new InterviewService();
