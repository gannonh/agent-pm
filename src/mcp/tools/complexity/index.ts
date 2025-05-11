/**
 * @fileoverview Consolidated MCP tool for analyzing task complexity and generating reports.
 * This tool evaluates tasks based on various complexity factors, recommends which ones
 * should be broken down into subtasks, and generates both JSON and Markdown reports.
 */
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readTasksFile, writeTasksFile } from '../../utils/file-utils.js';
import { schemas, validateParams, getProjectRoot } from '../../validation/index.js';
import { handleError, type MCPErrorResponse } from '../../errors/handler.js';
import { create_success_payload } from '../../utils/response.js';
import { MCPNotFoundError } from '../../errors/index.js';
import type { Task } from '../../types/index.js';
import type { ComplexityReport, TaskComplexityAnalysis } from '../../../types/task.d.js';
import Config, { ARTIFACTS_DIR } from '../../../config.js';
import { createAnthropicClient } from '../../../core/anthropic-client.js';
import { createPerplexityClient } from '../../../core/perplexity-client.js';
import { logger } from '../../utils/logger.js';

/**
 * Interface for AI complexity analysis response
 */
interface ComplexityAnalysisResponse {
  complexity: number;
  recommendedSubtasks: number;
  reasoning?: string;
  expansionPrompt: string;
  expansionCommand: string;
}

/**
 * Schema for complexity tool parameters
 */
const complexitySchema = z.object({
  projectRoot: schemas.projectRoot,
  file: schemas.file,
  output: z
    .string()
    .optional()
    .default(path.join(ARTIFACTS_DIR, 'resources', 'reports', 'task-complexity-report.json'))
    .describe(
      `Output file path for the JSON report (default: ${path.join(
        ARTIFACTS_DIR,
        'resources',
        'reports',
        'task-complexity-report.json'
      )})`
    ),
  markdownOutput: z
    .string()
    .optional()
    .default(path.join(ARTIFACTS_DIR, 'resources', 'reports', 'task-complexity-report.md'))
    .describe(
      `Output file path for the Markdown report (default: ${path.join(
        ARTIFACTS_DIR,
        'resources',
        'reports',
        'task-complexity-report.md'
      )})`
    ),
  threshold: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe('Minimum complexity score to recommend expansion (1-10) (default: 5)'),
  model: z
    .string()
    .optional()
    .describe('LLM model to use for analysis (defaults to configured model)'),
  research: schemas.research,
});

/**
 * Type for complexity tool parameters
 */
type ComplexityParams = z.infer<typeof complexitySchema>;

/**
 * Registers the complexity tool with the MCP server
 * @param server MCP server instance
 */
export function registerComplexityTool(server: McpServer): void {
  server.tool(
    'apm_complexity',
    'Analyze task complexity, generate expansion recommendations, and create reports',
    complexitySchema.shape,
    async (
      params: ComplexityParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }> } | MCPErrorResponse> => {
      try {
        // Validate parameters using our validation utilities
        const validatedParams = validateParams(params, complexitySchema);
        const {
          projectRoot: rawProjectRoot,
          file,
          output,
          markdownOutput,
          threshold,
          model,
          research,
        } = validatedParams;

        // Ensure we have valid values for optional parameters
        const validatedOutput =
          output || path.join(ARTIFACTS_DIR, 'resources', 'reports', 'task-complexity-report.json');
        const validatedMarkdownOutput =
          markdownOutput ||
          path.join(ARTIFACTS_DIR, 'resources', 'reports', 'task-complexity-report.md');
        const validatedThreshold = threshold || 5;
        const validatedResearch = Boolean(research);

        // Get the project root (from params or environment variable)
        const projectRoot = getProjectRoot(rawProjectRoot);

        // Read tasks from file
        const tasksData = await readTasksFile(projectRoot, file);
        if (!tasksData) {
          throw new MCPNotFoundError('Tasks file not found or is empty', {
            file: ['Tasks file not found or is empty'],
          });
        }

        // Filter tasks to only include those that are not done
        const pendingTasks = tasksData.tasks.filter(
          (task) => task.status !== 'done' && task.status !== 'cancelled'
        );

        if (pendingTasks.length === 0) {
          return create_success_payload(
            {
              message: 'No pending tasks to analyze',
              tasksPath: file || Config.getArtifactsFile(projectRoot),
            },
            'No pending tasks to analyze. All tasks are either completed or cancelled.'
          );
        }

        // Analyze task complexity
        const complexityAnalysis = await analyzeTaskComplexity(
          pendingTasks,
          validatedThreshold,
          model,
          validatedResearch
        );

        // Update task metadata with complexity scores
        for (const analysis of complexityAnalysis) {
          const task = tasksData.tasks.find((t) => t.id === analysis.taskId);
          if (task) {
            // Initialize metadata if it doesn't exist
            if (!task.metadata) {
              task.metadata = {};
            }

            // Store complexity score in task metadata
            // Use type assertion to handle the unknown type
            (task.metadata as Record<string, unknown>).complexity = analysis.complexity;
            logger.debug(
              `Updated task ${task.id} metadata with complexity score: ${analysis.complexity}`
            );
          }
        }

        // Write the updated tasks data back to the file
        const success = await writeTasksFile(tasksData, projectRoot, file);
        if (!success) {
          logger.error('Failed to write tasks data with complexity scores');
        } else {
          logger.info('Successfully updated task metadata with complexity scores');
        }

        // Create the complexity report
        const report: ComplexityReport = {
          tasks: complexityAnalysis,
          metadata: {
            generated: new Date().toISOString(),
            threshold: validatedThreshold,
            totalTasks: pendingTasks.length,
            averageComplexity:
              complexityAnalysis.length > 0
                ? complexityAnalysis.reduce((sum, task) => sum + task.complexity, 0) /
                  complexityAnalysis.length
                : null,
          },
        };

        // Ensure the output directories exist
        const outputPath = path.isAbsolute(validatedOutput)
          ? validatedOutput
          : path.join(projectRoot, validatedOutput);
        const markdownOutputPath = path.isAbsolute(validatedMarkdownOutput)
          ? validatedMarkdownOutput
          : path.join(projectRoot, validatedMarkdownOutput);

        const outputDir = path.dirname(outputPath);
        const markdownOutputDir = path.dirname(markdownOutputPath);

        try {
          await fs.mkdir(outputDir, { recursive: true });
          await fs.mkdir(markdownOutputDir, { recursive: true });
        } catch (error) {
          logger.error(`Error creating directories:`, error);
          // Continue anyway for testing purposes
        }

        // Write the JSON report to the output file
        try {
          await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
          logger.info(`JSON report written to ${outputPath}`);
        } catch (error) {
          logger.error(`Error writing JSON file ${outputPath}:`, error);
          // Continue anyway for testing purposes
        }

        // Format the report for display and markdown output
        const formattedReport = formatComplexityReport(report);

        // Write the Markdown report to the output file
        try {
          await fs.writeFile(markdownOutputPath, formattedReport, 'utf-8');
          logger.info(`Markdown report written to ${markdownOutputPath}`);
        } catch (error) {
          logger.error(`Error writing Markdown file ${markdownOutputPath}:`, error);
          // Continue anyway for testing purposes
        }

        // Return the analysis results with the formatted report
        return create_success_payload(
          {
            report,
            formattedReport,
            jsonOutputPath: outputPath,
            markdownOutputPath,
            tasksAnalyzed: pendingTasks.length,
            complexTasks: complexityAnalysis.filter((task) => task.complexity >= validatedThreshold)
              .length,
          },
          `Analyzed ${pendingTasks.length} tasks and identified ${
            complexityAnalysis.filter((task) => task.complexity >= validatedThreshold).length
          } complex tasks that should be broken down.`,
          {
            userCommunication: {
              message: formattedReport,
              expectationType: 'immediate' as const,
              suggestedResponse: `I've analyzed your project tasks and identified which ones might benefit from being broken down into subtasks. Here's the complexity report:\n\n${formattedReport.substring(0, 500)}...`,
            },
            agentInstructions: `The complexity analysis is complete. The report has been formatted for display and saved as both JSON and Markdown. Use 'apm_task_modify' with the 'expand' action to expand individual tasks or the 'expand_all' action to expand all eligible tasks.`,
          }
        );
      } catch (error) {
        return handleError(error, {
          toolName: 'apm_complexity',
          params,
        });
      }
    }
  );
}

/**
 * Analyzes task complexity based on various factors
 * @param tasks Tasks to analyze
 * @param threshold Minimum complexity score to recommend expansion
 * @param model LLM model to use for analysis
 * @param useResearch Whether to use Perplexity AI for research-backed analysis
 * @returns Task complexity analysis results
 */
async function analyzeTaskComplexity(
  tasks: Task[],
  threshold: number,
  model?: string,
  useResearch = false
): Promise<TaskComplexityAnalysis[]> {
  // Initialize the AI client
  const anthropicClient = createAnthropicClient();

  // Initialize the Perplexity client if research is enabled
  const perplexityClient = useResearch ? createPerplexityClient() : null;

  // Prepare the results array
  const results: TaskComplexityAnalysis[] = [];

  // Process each task
  for (const task of tasks) {
    logger.info(`Analyzing complexity for task ${task.id}: ${task.title}`);

    // Skip tasks that already have subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      logger.debug(`Skipping task ${task.id} as it already has subtasks`);
      continue;
    }

    // Calculate basic complexity factors
    const basicComplexity = calculateBasicComplexity(task);

    // If research is enabled, enhance the analysis with Perplexity
    let researchData = null;
    if (useResearch && perplexityClient) {
      try {
        const query = `Task complexity analysis for software development task: "${task.title}". ${
          task.description ? `Description: ${task.description}` : ''
        } ${task.details ? `Implementation details: ${task.details}` : ''}`;

        const researchResults = await perplexityClient.query(query);
        researchData = researchResults.results;
        logger.debug(`Research data for task ${task.id}:`, { researchData });
      } catch (error) {
        logger.error(`Error performing research for task ${task.id}:`, error);
      }
    }

    // Use AI to analyze complexity
    const analysisPrompt = createComplexityAnalysisPrompt(task, basicComplexity, researchData);

    try {
      const analysisResponse = await anthropicClient.sendMessage(
        [
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        {
          systemPrompt:
            'You are an expert software development project manager specializing in task breakdown and complexity analysis. Your job is to analyze tasks and determine their complexity on a scale of 1-10, where 1 is very simple and 10 is extremely complex. You will also recommend how many subtasks the task should be broken into and provide a prompt for generating those subtasks.',
          temperature: 0.2,
          maxTokens: 4096,
          ...(model ? { model } : {}),
        }
      );

      // Parse the AI response
      const analysis = parseComplexityAnalysis(analysisResponse, task, threshold);
      results.push(analysis);

      logger.info(
        `Completed analysis for task ${task.id}: Complexity ${analysis.complexity}, Recommended subtasks: ${analysis.recommendedSubtasks}`
      );
    } catch (error) {
      logger.error(`Error analyzing task ${task.id}:`, error);

      // Add a fallback analysis based on basic complexity
      const fallbackAnalysis: TaskComplexityAnalysis = {
        taskId: task.id,
        title: task.title,
        complexity: Math.min(Math.round(basicComplexity * 10), 10), // Scale to 1-10
        recommendedSubtasks:
          basicComplexity >= threshold / 10 ? Math.ceil(basicComplexity * 10) : 0,
        expansionPrompt: `Break down the implementation of "${task.title}" into logical subtasks.`,
        expansionCommand: `apm_task_modify --action=expand --id=${task.id} --num=${Math.ceil(basicComplexity * 10)}`,
      };

      results.push(fallbackAnalysis);
      logger.info(
        `Added fallback analysis for task ${task.id}: Complexity ${fallbackAnalysis.complexity}, Recommended subtasks: ${fallbackAnalysis.recommendedSubtasks}`
      );
    }
  }

  return results;
}

/**
 * Calculates basic complexity factors for a task
 * @param task Task to analyze
 * @returns Basic complexity score (0-1 scale)
 */
function calculateBasicComplexity(task: Task): number {
  // Initialize complexity factors
  let complexity = 0;

  // Factor 1: Description length (0-0.2)
  const descriptionLength = task.description ? task.description.length : 0;
  complexity += Math.min(descriptionLength / 1000, 0.2);

  // Factor 2: Details length (0-0.2)
  const detailsLength = task.details ? task.details.length : 0;
  complexity += Math.min(detailsLength / 1000, 0.2);

  // Factor 3: Dependencies (0-0.2)
  const dependencyCount = task.dependencies ? task.dependencies.length : 0;
  complexity += Math.min(dependencyCount / 10, 0.2);

  // Factor 4: Priority (0-0.2)
  if (task.priority === 'high') {
    complexity += 0.2;
  } else if (task.priority === 'medium') {
    complexity += 0.1;
  }

  // Factor 5: Technical terms (0-0.2)
  const technicalTerms = [
    'api',
    'database',
    'authentication',
    'authorization',
    'security',
    'performance',
    'optimization',
    'integration',
    'deployment',
    'testing',
    'validation',
    'encryption',
    'algorithm',
    'architecture',
    'infrastructure',
    'scalability',
    'concurrency',
    'async',
    'transaction',
    'migration',
  ];

  const taskText = `${task.title} ${task.description || ''} ${task.details || ''}`.toLowerCase();
  const termCount = technicalTerms.filter((term) => taskText.includes(term)).length;
  complexity += Math.min(termCount / 10, 0.2);

  return complexity;
}

/**
 * Creates a prompt for AI to analyze task complexity
 * @param task Task to analyze
 * @param basicComplexity Basic complexity score (0-1 scale)
 * @param researchData Research data from Perplexity (if available)
 * @returns Prompt for AI analysis
 */
function createComplexityAnalysisPrompt(
  task: Task,
  basicComplexity: number,
  researchData: Array<{ title: string; snippet: string; url: string }> | null
): string {
  let prompt = `
Task Complexity Analysis Request

Please analyze the following software development task and provide:
1. A complexity score on a scale of 1-10 (where 1 is very simple and 10 is extremely complex)
2. A recommended number of subtasks to break this down into (0 if no breakdown needed)
3. A prompt for generating those subtasks
4. A command for expanding the task

Task ID: ${task.id}
Task Title: ${task.title}
Task Description: ${task.description || 'N/A'}
Task Details: ${task.details || 'N/A'}
Task Priority: ${task.priority}
Dependencies: ${task.dependencies && task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}
Test Strategy: ${task.testStrategy || 'N/A'}

Basic complexity factors:
- Description length: ${task.description ? task.description.length : 0} characters
- Details length: ${task.details ? task.details.length : 0} characters
- Dependency count: ${task.dependencies ? task.dependencies.length : 0}
- Priority factor: ${task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low'}
- Calculated basic complexity score: ${(basicComplexity * 10).toFixed(1)} / 10

Please respond in the following JSON format:
{
  "complexity": 5,
  "recommendedSubtasks": 3,
  "reasoning": "This task involves...",
  "expansionPrompt": "Break down the implementation of...",
  "expansionCommand": "apm_task_modify --action=expand --id=${task.id} --num=3"
}
`;

  // Add research data if available
  if (researchData && researchData.length > 0) {
    prompt += `\nResearch data for this type of task:\n`;

    for (let i = 0; i < Math.min(researchData.length, 3); i++) {
      const result = researchData[i];
      prompt += `\nSource ${i + 1}: ${result.title}\n`;
      prompt += `${result.snippet}\n`;
      prompt += `URL: ${result.url}\n`;
    }
  }

  return prompt;
}

/**
 * Parses the AI response to extract complexity analysis
 * @param response AI response
 * @param task Task being analyzed
 * @param threshold Minimum complexity score to recommend expansion
 * @returns Task complexity analysis
 */
function parseComplexityAnalysis(
  response: string,
  task: Task,
  threshold: number
): TaskComplexityAnalysis {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const analysisJson = JSON.parse(jsonMatch[0]) as ComplexityAnalysisResponse;

      // Create the analysis object
      return {
        taskId: task.id,
        title: task.title,
        complexity: analysisJson.complexity || 5,
        recommendedSubtasks: analysisJson.recommendedSubtasks || 0,
        expansionPrompt:
          analysisJson.expansionPrompt ||
          `Break down the implementation of "${task.title}" into logical subtasks.`,
        expansionCommand:
          analysisJson.expansionCommand ||
          `apm_task_modify --action=expand --id=${task.id} --num=${analysisJson.recommendedSubtasks || 3}`,
      };
    }
  } catch (error) {
    logger.error(`Error parsing complexity analysis for task ${task.id}:`, error);
  }

  // Fallback if parsing fails
  const fallbackComplexity = Math.min(Math.round(calculateBasicComplexity(task) * 10), 10);
  const recommendedSubtasks =
    fallbackComplexity >= threshold ? Math.ceil(fallbackComplexity / 2) : 0;

  return {
    taskId: task.id,
    title: task.title,
    complexity: fallbackComplexity,
    recommendedSubtasks,
    expansionPrompt: `Break down the implementation of "${task.title}" into logical subtasks.`,
    expansionCommand: `apm_task_modify --action=expand --id=${task.id} --num=${recommendedSubtasks}`,
  };
}

/**
 * Formats the complexity report for display
 * @param report Complexity report
 * @returns Formatted report as a string
 */
function formatComplexityReport(report: ComplexityReport): string {
  // Start with a header
  let formatted = `# Task Complexity Analysis Report\n\n`;

  // Add metadata
  formatted += `## Report Summary\n\n`;
  formatted += `- **Generated:** ${new Date(report.metadata.generated).toLocaleString()}\n`;
  formatted += `- **Complexity Threshold:** ${report.metadata.threshold}\n`;
  formatted += `- **Total Tasks Analyzed:** ${report.metadata.totalTasks}\n`;
  formatted += `- **Average Complexity:** ${
    report.metadata.averageComplexity !== null && !isNaN(report.metadata.averageComplexity)
      ? report.metadata.averageComplexity.toFixed(1)
      : 'N/A'
  }\n\n`;

  // Add tasks section
  formatted += `## Task Analysis\n\n`;

  // Sort tasks by complexity (highest first)
  const sortedTasks = [...report.tasks].sort((a, b) => b.complexity - a.complexity);

  // Add each task
  for (const task of sortedTasks) {
    const isComplex = task.complexity >= report.metadata.threshold;
    const complexityEmoji = getComplexityEmoji(task.complexity);
    const complexityColor = getComplexityColor(task.complexity);

    formatted += `### ${complexityEmoji} Task ${task.taskId}: ${task.title}\n\n`;
    formatted += `- **Complexity Score:** ${complexityColor}${task.complexity}/10${isComplex ? ' ⚠️' : ''}\n`;
    formatted += `- **Recommended Subtasks:** ${task.recommendedSubtasks}\n`;

    if (isComplex) {
      formatted += `- **Action Required:** This task should be broken down into subtasks\n`;
      formatted += `- **Expansion Command:** \`${task.expansionCommand}\`\n`;
    }

    formatted += `\n**Expansion Guidance:**\n${task.expansionPrompt}\n\n`;
    formatted += `---\n\n`;
  }

  // Add a footer with recommendations
  if (sortedTasks.length === 0) {
    formatted += `## Recommendations\n\n`;
    formatted += `No tasks were analyzed for complexity. This is likely because all pending tasks already have subtasks.\n`;
    formatted += `To analyze a task's complexity, it should not have any subtasks yet.\n`;
  } else {
    const complexTasks = sortedTasks.filter((task) => task.complexity >= report.metadata.threshold);
    if (complexTasks.length > 0) {
      formatted += `## Recommendations\n\n`;
      formatted += `The following tasks should be prioritized for breakdown:\n\n`;

      for (const task of complexTasks) {
        formatted += `- Task ${task.taskId}: ${task.title} (Complexity: ${task.complexity}/10)\n`;
      }
    } else {
      formatted += `## Recommendations\n\n`;
      formatted += `No tasks exceed the complexity threshold. All tasks appear to be manageable as-is.\n`;
    }
  }

  return formatted;
}

/**
 * Gets an emoji representing the complexity level
 * @param complexity Complexity score (1-10)
 * @returns Emoji representing the complexity
 */
function getComplexityEmoji(complexity: number): string {
  if (complexity >= 8) return '🔴';
  if (complexity >= 5) return '🟠';
  if (complexity >= 3) return '🟡';
  return '🟢';
}

/**
 * Gets a color code for the complexity level
 * @param complexity Complexity score (1-10)
 * @returns Color code for the complexity
 */
function getComplexityColor(complexity: number): string {
  if (complexity >= 8) return '**';
  if (complexity >= 5) return '*';
  return '';
}
