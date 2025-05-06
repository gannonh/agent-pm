import { z } from 'zod';

/**
 * Zod schema for task status
 */
export const TaskStatusSchema = z.enum(['pending', 'in-progress', 'done', 'deferred', 'cancelled']);

/**
 * Zod schema for task priority
 */
export const TaskPrioritySchema = z.enum(['high', 'medium', 'low']);

/**
 * Zod schema for subtask
 */
export const SubtaskSchema = z.object({
  id: z.string().regex(/^\d+\.\d+$/, 'Subtask ID must be in format "parentId.subtaskNumber"'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  details: z.string().optional(),
  status: TaskStatusSchema,
  dependencies: z.array(z.string()).optional().default([]),
});

/**
 * Zod schema for task
 */
export const TaskSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  details: z.string().optional(),
  testStrategy: z.string().optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  dependencies: z.array(z.string()).default([]),
  subtasks: z.array(SubtaskSchema).optional(),
});

/**
 * Zod schema for tasks metadata
 */
export const TasksMetadataSchema = z.object({
  version: z.string(),
  created: z.string().datetime({ offset: true }),
  updated: z.string().datetime({ offset: true }),
  projectName: z.string().optional(),
  projectDescription: z.string().optional(),
});

/**
 * Zod schema for tasks data
 */
export const TasksDataSchema = z.object({
  tasks: z.array(TaskSchema),
  metadata: TasksMetadataSchema,
});

/**
 * Zod schema for task complexity analysis
 */
export const TaskComplexityAnalysisSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  complexity: z.number().min(1).max(10),
  recommendedSubtasks: z.number().int().positive(),
  expansionPrompt: z.string(),
  expansionCommand: z.string(),
});

/**
 * Zod schema for complexity report
 */
export const ComplexityReportSchema = z.object({
  tasks: z.array(TaskComplexityAnalysisSchema),
  metadata: z.object({
    generated: z.string().datetime({ offset: true }),
    threshold: z.number().min(1).max(10),
    totalTasks: z.number().int().nonnegative(),
    averageComplexity: z.union([z.number().min(1).max(10), z.null()]),
  }),
});
