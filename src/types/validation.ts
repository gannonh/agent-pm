import { z } from 'zod';

/**
 * Zod schema for task status
 */
export const taskStatusSchema = z.enum(['pending', 'in-progress', 'done', 'deferred', 'cancelled']);

/**
 * Zod schema for task priority
 */
export const taskPrioritySchema = z.enum(['high', 'medium', 'low']);

/**
 * Zod schema for subtask
 */
export const subtaskSchema = z.object({
  id: z.string().regex(/^\d+\.\d+$/, 'Subtask ID must be in format "parentId.subtaskNumber"'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  details: z.string().optional(),
  status: taskStatusSchema,
  dependencies: z.array(z.string()).optional().default([]),
});

/**
 * Zod schema for task
 */
export const taskSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  details: z.string().optional(),
  testStrategy: z.string().optional(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dependencies: z.array(z.string()).default([]),
  subtasks: z.array(subtaskSchema).optional(),
});

/**
 * Zod schema for tasks metadata
 */
export const tasksMetadataSchema = z.object({
  version: z.string(),
  created: z.string().datetime({ offset: true }),
  updated: z.string().datetime({ offset: true }),
  projectName: z.string().optional(),
  projectDescription: z.string().optional(),
});

/**
 * Zod schema for tasks data
 */
export const tasksDataSchema = z.object({
  tasks: z.array(taskSchema),
  metadata: tasksMetadataSchema,
});

/**
 * Zod schema for task complexity analysis
 */
export const taskComplexityAnalysisSchema = z.object({
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
export const complexityReportSchema = z.object({
  tasks: z.array(taskComplexityAnalysisSchema),
  metadata: z.object({
    generated: z.string().datetime({ offset: true }),
    threshold: z.number().min(1).max(10),
    totalTasks: z.number().int().nonnegative(),
    averageComplexity: z.union([z.number().min(1).max(10), z.null()]),
  }),
});
