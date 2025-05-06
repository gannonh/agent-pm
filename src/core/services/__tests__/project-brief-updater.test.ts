/**
 * @fileoverview Tests for the project-brief-updater module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InterviewStageType, ProjectBrief } from '../../types/interview-types.js';
import { updateProjectBrief } from '../project-brief-updater.js';

// Type for processed response to use in type assertions
type ProcessedResponse = {
  title?: string;
  description?: string;
  goals?: string[];
  stakeholders?: string[];
  technologies?: string[];
  constraints?: string[];
  timeline?: string;
  phases?: Array<{ name: string; description: string; tasks: string[] }>;
  features?: string[];
};

describe('Project Brief Updater', () => {
  let projectBrief: ProjectBrief;

  beforeEach(() => {
    // Reset the project brief before each test
    projectBrief = {
      id: 'test-id',
      type: 'project-brief',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      version: '1.0.0',
      title: 'Original Title',
      description: 'Original Description',
      goals: ['Original Goal 1'],
      stakeholders: ['Original Stakeholder 1'],
      technologies: ['Original Technology 1'],
      constraints: ['Original Constraint 1'],
      timeline: 'Original Timeline',
      phases: [
        {
          name: 'Original Phase',
          description: 'Original Phase Description',
          tasks: ['Original Task 1'],
        },
      ],
      interviewProgress: [],
    };
  });

  describe('PROJECT_OVERVIEW stage', () => {
    it('should update title and description', () => {
      const processedResponse = {
        title: 'New Title',
        description: 'New Description',
      };

      updateProjectBrief(projectBrief, InterviewStageType.PROJECT_OVERVIEW, processedResponse);

      expect(projectBrief.title).toBe('New Title');
      expect(projectBrief.description).toBe('New Description');
    });

    it('should only update title when only title is provided', () => {
      const processedResponse = {
        title: 'New Title Only',
      };

      updateProjectBrief(projectBrief, InterviewStageType.PROJECT_OVERVIEW, processedResponse);

      expect(projectBrief.title).toBe('New Title Only');
      expect(projectBrief.description).toBe('Original Description');
    });

    it('should only update description when only description is provided', () => {
      const processedResponse = {
        description: 'New Description Only',
      };

      updateProjectBrief(projectBrief, InterviewStageType.PROJECT_OVERVIEW, processedResponse);

      expect(projectBrief.title).toBe('Original Title');
      expect(projectBrief.description).toBe('New Description Only');
    });

    it('should not update anything when no relevant fields are provided', () => {
      const processedResponse = {
        irrelevantField: 'Some Value',
      } as unknown as ProcessedResponse;

      updateProjectBrief(projectBrief, InterviewStageType.PROJECT_OVERVIEW, processedResponse);

      expect(projectBrief.title).toBe('Original Title');
      expect(projectBrief.description).toBe('Original Description');
    });
  });

  describe('GOALS_AND_STAKEHOLDERS stage', () => {
    it('should update goals and stakeholders', () => {
      const processedResponse = {
        goals: ['New Goal 1', 'New Goal 2'],
        stakeholders: ['New Stakeholder 1', 'New Stakeholder 2'],
      };

      updateProjectBrief(
        projectBrief,
        InterviewStageType.GOALS_AND_STAKEHOLDERS,
        processedResponse
      );

      expect(projectBrief.goals).toEqual(['New Goal 1', 'New Goal 2']);
      expect(projectBrief.stakeholders).toEqual(['New Stakeholder 1', 'New Stakeholder 2']);
    });

    it('should only update goals when only goals are provided', () => {
      const processedResponse = {
        goals: ['New Goal Only'],
      };

      updateProjectBrief(
        projectBrief,
        InterviewStageType.GOALS_AND_STAKEHOLDERS,
        processedResponse
      );

      expect(projectBrief.goals).toEqual(['New Goal Only']);
      expect(projectBrief.stakeholders).toEqual(['Original Stakeholder 1']);
    });

    it('should only update stakeholders when only stakeholders are provided', () => {
      const processedResponse = {
        stakeholders: ['New Stakeholder Only'],
      };

      updateProjectBrief(
        projectBrief,
        InterviewStageType.GOALS_AND_STAKEHOLDERS,
        processedResponse
      );

      expect(projectBrief.goals).toEqual(['Original Goal 1']);
      expect(projectBrief.stakeholders).toEqual(['New Stakeholder Only']);
    });

    it('should not update when non-array values are provided', () => {
      const processedResponse = {
        goals: 'Not an array',
        stakeholders: 123,
      } as unknown as ProcessedResponse;

      updateProjectBrief(
        projectBrief,
        InterviewStageType.GOALS_AND_STAKEHOLDERS,
        processedResponse
      );

      expect(projectBrief.goals).toEqual(['Original Goal 1']);
      expect(projectBrief.stakeholders).toEqual(['Original Stakeholder 1']);
    });
  });

  describe('TECHNOLOGIES stage', () => {
    it('should update technologies', () => {
      const processedResponse = {
        technologies: ['New Technology 1', 'New Technology 2'],
      };

      updateProjectBrief(projectBrief, InterviewStageType.TECHNOLOGIES, processedResponse);

      expect(projectBrief.technologies).toEqual(['New Technology 1', 'New Technology 2']);
    });

    it('should not update when non-array value is provided', () => {
      const processedResponse = {
        technologies: 'Not an array',
      } as unknown as ProcessedResponse;

      updateProjectBrief(projectBrief, InterviewStageType.TECHNOLOGIES, processedResponse);

      expect(projectBrief.technologies).toEqual(['Original Technology 1']);
    });
  });

  describe('CONSTRAINTS stage', () => {
    it('should update constraints', () => {
      const processedResponse = {
        constraints: ['New Constraint 1', 'New Constraint 2'],
      };

      updateProjectBrief(projectBrief, InterviewStageType.CONSTRAINTS, processedResponse);

      expect(projectBrief.constraints).toEqual(['New Constraint 1', 'New Constraint 2']);
    });

    it('should not update when non-array value is provided', () => {
      const processedResponse = {
        constraints: 'Not an array',
      } as unknown as ProcessedResponse;

      updateProjectBrief(projectBrief, InterviewStageType.CONSTRAINTS, processedResponse);

      expect(projectBrief.constraints).toEqual(['Original Constraint 1']);
    });
  });

  describe('TIMELINE_AND_PHASES stage', () => {
    it('should update timeline and phases', () => {
      const processedResponse = {
        timeline: 'New Timeline',
        phases: [
          {
            name: 'New Phase 1',
            description: 'New Phase 1 Description',
            tasks: ['New Task 1', 'New Task 2'],
          },
          {
            name: 'New Phase 2',
            description: 'New Phase 2 Description',
            tasks: ['New Task 3'],
          },
        ],
      };

      updateProjectBrief(projectBrief, InterviewStageType.TIMELINE_AND_PHASES, processedResponse);

      expect(projectBrief.timeline).toBe('New Timeline');
      expect(projectBrief.phases).toEqual([
        {
          name: 'New Phase 1',
          description: 'New Phase 1 Description',
          tasks: ['New Task 1', 'New Task 2'],
        },
        {
          name: 'New Phase 2',
          description: 'New Phase 2 Description',
          tasks: ['New Task 3'],
        },
      ]);
    });

    it('should only update timeline when only timeline is provided', () => {
      const processedResponse = {
        timeline: 'New Timeline Only',
      };

      updateProjectBrief(projectBrief, InterviewStageType.TIMELINE_AND_PHASES, processedResponse);

      expect(projectBrief.timeline).toBe('New Timeline Only');
      expect(projectBrief.phases).toEqual([
        {
          name: 'Original Phase',
          description: 'Original Phase Description',
          tasks: ['Original Task 1'],
        },
      ]);
    });

    it('should only update phases when only phases are provided', () => {
      const processedResponse = {
        phases: [
          {
            name: 'New Phase Only',
            description: 'New Phase Only Description',
            tasks: ['New Task Only'],
          },
        ],
      };

      updateProjectBrief(projectBrief, InterviewStageType.TIMELINE_AND_PHASES, processedResponse);

      expect(projectBrief.timeline).toBe('Original Timeline');
      expect(projectBrief.phases).toEqual([
        {
          name: 'New Phase Only',
          description: 'New Phase Only Description',
          tasks: ['New Task Only'],
        },
      ]);
    });

    it('should not update phases when non-array value is provided', () => {
      const processedResponse = {
        phases: 'Not an array',
      } as unknown as ProcessedResponse;

      updateProjectBrief(projectBrief, InterviewStageType.TIMELINE_AND_PHASES, processedResponse);

      expect(projectBrief.phases).toEqual([
        {
          name: 'Original Phase',
          description: 'Original Phase Description',
          tasks: ['Original Task 1'],
        },
      ]);
    });
  });

  describe('FEATURES stage', () => {
    it('should add features as a new phase when no Features phase exists', () => {
      const processedResponse = {
        features: ['New Feature 1', 'New Feature 2'],
      };

      updateProjectBrief(projectBrief, InterviewStageType.FEATURES, processedResponse);

      expect(projectBrief.phases).toHaveLength(2);
      expect(projectBrief.phases[1]).toEqual({
        name: 'Features',
        description: 'Key features of the project',
        tasks: ['New Feature 1', 'New Feature 2'],
      });
    });

    it('should update existing Features phase when it already exists', () => {
      // Add a Features phase first
      projectBrief.phases.push({
        name: 'Features',
        description: 'Original features description',
        tasks: ['Original Feature 1'],
      });

      const processedResponse = {
        features: ['Updated Feature 1', 'Updated Feature 2'],
      };

      updateProjectBrief(projectBrief, InterviewStageType.FEATURES, processedResponse);

      expect(projectBrief.phases).toHaveLength(2);
      expect(projectBrief.phases[1]).toEqual({
        name: 'Features',
        description: 'Key features of the project',
        tasks: ['Updated Feature 1', 'Updated Feature 2'],
      });
    });

    it('should not update when non-array value is provided', () => {
      const processedResponse = {
        features: 'Not an array',
      } as unknown as ProcessedResponse;

      updateProjectBrief(projectBrief, InterviewStageType.FEATURES, processedResponse);

      expect(projectBrief.phases).toHaveLength(1);
      expect(projectBrief.phases[0].name).toBe('Original Phase');
    });
  });

  describe('REVIEW stage', () => {
    it('should not update anything in review stage', () => {
      const originalBrief = JSON.parse(JSON.stringify(projectBrief));

      const processedResponse = {
        title: 'Should Not Update',
        description: 'Should Not Update',
        goals: ['Should Not Update'],
      };

      updateProjectBrief(projectBrief, InterviewStageType.REVIEW, processedResponse);

      // The brief should remain unchanged
      expect(projectBrief).toEqual(originalBrief);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty processed response', () => {
      const originalBrief = JSON.parse(JSON.stringify(projectBrief));

      updateProjectBrief(projectBrief, InterviewStageType.PROJECT_OVERVIEW, {});

      // The brief should remain unchanged
      expect(projectBrief).toEqual(originalBrief);
    });

    it('should handle undefined values in processed response', () => {
      const processedResponse = {
        title: undefined,
        description: undefined,
      };

      updateProjectBrief(projectBrief, InterviewStageType.PROJECT_OVERVIEW, processedResponse);

      // The brief should remain unchanged
      expect(projectBrief.title).toBe('Original Title');
      expect(projectBrief.description).toBe('Original Description');
    });
  });
});
