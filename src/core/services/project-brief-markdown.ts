/**
 * @fileoverview Generate Markdown from project briefs
 */

import { logger } from '../../mcp/utils/logger.js';
import { resourceStorage } from './ResourceStorage.js';
import { ProjectBrief, InterviewError } from '../types/interview-types.js';
import { PRODUCT_BRIEF_FILE } from '../../config.js';

/**
 * Add tasks to the Markdown content
 * @param markdown - The existing Markdown content
 * @param tasks - The tasks to add
 * @returns The updated Markdown content
 */
export async function addTasksToMarkdown(
  markdown: string,
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    priority?: string;
    type?: string;
    phaseId?: string;
    childTasks?: string[];
    subtasks?: Array<{
      id: string;
      title: string;
      status: string;
      description?: string;
    }>;
  }>
): Promise<string> {
  let result = '\n## Development Roadmap\n\n';

  // Group tasks by type
  const tasksByType: Record<
    string,
    Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority?: string;
      type?: string;
      phaseId?: string;
      childTasks?: string[];
      subtasks?: Array<{
        id: string;
        title: string;
        status: string;
        description?: string;
      }>;
    }>
  > = {
    phase: tasks.filter((t) => t.type === 'phase'),
    milestone: tasks.filter((t) => t.type === 'milestone'),
    feature: tasks.filter((t) => t.type === 'feature'),
    task: tasks.filter((t) => !t.type || t.type === 'task' || t.type === 'subtask'),
  };

  // Create a map of tasks by ID for easy lookup
  const tasksById: Record<
    string,
    {
      id: string;
      title: string;
      description: string;
      status: string;
      priority?: string;
      type?: string;
      phaseId?: string;
      childTasks?: string[];
      subtasks?: Array<{
        id: string;
        title: string;
        status: string;
        description?: string;
      }>;
    }
  > = {};
  tasks.forEach((task) => {
    tasksById[task.id] = task;
  });

  // Create a map of logical phase numbers
  const phaseNumberMap: Record<string, string> = {};

  // First, extract phase numbers from phase titles
  tasksByType.phase.forEach((phase) => {
    // Extract phase number from title if it exists (e.g., "Phase 1: Core Architecture" -> "1")
    const phaseNumberMatch = phase.title.match(/Phase\s+(\d+)[:\s]/i);
    if (phaseNumberMatch && phaseNumberMatch[1]) {
      phaseNumberMap[phase.id] = phaseNumberMatch[1];
      logger.debug(`Mapped phase ID ${phase.id} to logical number ${phaseNumberMatch[1]}`);
    } else {
      // If no phase number in title, use the task ID as fallback
      phaseNumberMap[phase.id] = phase.id;
    }
  });

  // Add phases first
  if (tasksByType.phase.length > 0) {
    result += '### Project Phases\n\n';
    for (const phase of tasksByType.phase) {
      // Get the logical phase number
      const phaseNumber = phaseNumberMap[phase.id] || phase.id;

      // Check if title already contains "Phase X:" format
      if (phase.title.match(/^Phase\s+\d+:/i)) {
        // Title already has the format, use it directly
        result += `#### ${phase.title}\n\n`;
      } else if (phase.title.match(/^Phase\s+\d+\s/i)) {
        // Title has "Phase X " but no colon, add the colon
        result += `#### ${phase.title.replace(/^(Phase\s+\d+)\s/, '$1: ')}\n\n`;
      } else {
        // Title doesn't have the format, add it
        result += `#### Phase ${phaseNumber}: ${phase.title}\n\n`;
      }

      result += `${phase.description}\n\n`;

      // Add priority and status
      result += `- **Priority:** ${phase.priority}\n`;
      result += `- **Status:** ${phase.status}\n\n`;

      // Add child tasks if they exist
      if (phase.childTasks && phase.childTasks.length > 0) {
        result += `**Tasks in this phase:**\n\n`;
        for (const childId of phase.childTasks) {
          const childTask = tasksById[childId];
          if (childTask) {
            result += `- Task ${childTask.id}: ${childTask.title} (${childTask.status})\n`;
          }
        }
        result += '\n';
      }

      // Add subtasks if they exist
      if (phase.subtasks && phase.subtasks.length > 0) {
        result += `**Subtasks:**\n\n`;
        for (const subtask of phase.subtasks) {
          result += `- ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
        }
        result += '\n';
      }
    }
  }

  // Add milestones
  if (tasksByType.milestone.length > 0) {
    result += '### Milestones\n\n';
    for (const milestone of tasksByType.milestone) {
      result += `#### Milestone ${milestone.id}: ${milestone.title}\n\n`;
      result += `${milestone.description}\n\n`;

      // Add priority and status
      result += `- **Priority:** ${milestone.priority}\n`;
      result += `- **Status:** ${milestone.status}\n\n`;

      // Add phase reference if it exists
      if (milestone.phaseId) {
        const phase = tasksById[milestone.phaseId];
        if (phase) {
          // Get the logical phase number
          const phaseNumber = phaseNumberMap[phase.id] || phase.id;

          // Format the phase reference
          const phaseTitle = phase.title.replace(/^Phase\s+\d+[:\s]\s*/i, '');
          result += `- **Phase:** Phase ${phaseNumber}${phaseTitle ? `: ${phaseTitle}` : ''}\n\n`;
        }
      }

      // Add subtasks if they exist
      if (milestone.subtasks && milestone.subtasks.length > 0) {
        result += `**Subtasks:**\n\n`;
        for (const subtask of milestone.subtasks) {
          result += `- ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
        }
        result += '\n';
      }
    }
  }

  // Add features
  if (tasksByType.feature.length > 0) {
    result += '### Features\n\n';
    for (const feature of tasksByType.feature) {
      result += `#### Feature ${feature.id}: ${feature.title}\n\n`;
      result += `${feature.description}\n\n`;

      // Add priority and status
      result += `- **Priority:** ${feature.priority}\n`;
      result += `- **Status:** ${feature.status}\n\n`;

      // Add phase reference if it exists
      if (feature.phaseId) {
        const phase = tasksById[feature.phaseId];
        if (phase) {
          // Get the logical phase number
          const phaseNumber = phaseNumberMap[phase.id] || phase.id;

          // Format the phase reference
          const phaseTitle = phase.title.replace(/^Phase\s+\d+[:\s]\s*/i, '');
          result += `- **Phase:** Phase ${phaseNumber}${phaseTitle ? `: ${phaseTitle}` : ''}\n\n`;
        }
      }

      // Add subtasks if they exist
      if (feature.subtasks && feature.subtasks.length > 0) {
        result += `**Subtasks:**\n\n`;
        for (const subtask of feature.subtasks) {
          result += `- ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
        }
        result += '\n';
      }
    }
  }

  // Add regular tasks
  if (tasksByType.task.length > 0) {
    result += '### Tasks\n\n';

    // Group by priority
    const highPriorityTasks = tasksByType.task.filter((t) => t.priority === 'high');
    const mediumPriorityTasks = tasksByType.task.filter((t) => t.priority === 'medium');
    const lowPriorityTasks = tasksByType.task.filter((t) => t.priority === 'low');

    // Add high priority tasks
    if (highPriorityTasks.length > 0) {
      result += '#### High Priority\n\n';
      for (const task of highPriorityTasks) {
        result += `- **Task ${task.id}:** ${task.title} (${task.status})\n`;
        result += `  ${task.description}\n\n`;

        // Add phase reference if it exists
        if (task.phaseId) {
          const phase = tasksById[task.phaseId];
          if (phase) {
            // Get the logical phase number
            const phaseNumber = phaseNumberMap[phase.id] || phase.id;

            // Format the phase reference
            const phaseTitle = phase.title.replace(/^Phase\s+\d+[:\s]\s*/i, '');
            result += `  - **Phase:** Phase ${phaseNumber}${phaseTitle ? `: ${phaseTitle}` : ''}\n\n`;
          }
        }

        // Add subtasks if they exist
        if (task.subtasks && task.subtasks.length > 0) {
          result += `  **Subtasks:**\n\n`;
          for (const subtask of task.subtasks) {
            result += `  - ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
          }
          result += '\n';
        }
      }
    }

    // Add medium priority tasks
    if (mediumPriorityTasks.length > 0) {
      result += '#### Medium Priority\n\n';
      for (const task of mediumPriorityTasks) {
        result += `- **Task ${task.id}:** ${task.title} (${task.status})\n`;
        result += `  ${task.description}\n\n`;

        // Add phase reference if it exists
        if (task.phaseId) {
          const phase = tasksById[task.phaseId];
          if (phase) {
            // Get the logical phase number
            const phaseNumber = phaseNumberMap[phase.id] || phase.id;

            // Format the phase reference
            const phaseTitle = phase.title.replace(/^Phase\s+\d+[:\s]\s*/i, '');
            result += `  - **Phase:** Phase ${phaseNumber}${phaseTitle ? `: ${phaseTitle}` : ''}\n\n`;
          }
        }

        // Add subtasks if they exist
        if (task.subtasks && task.subtasks.length > 0) {
          result += `  **Subtasks:**\n\n`;
          for (const subtask of task.subtasks) {
            result += `  - ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
          }
          result += '\n';
        }
      }
    }

    // Add low priority tasks
    if (lowPriorityTasks.length > 0) {
      result += '#### Low Priority\n\n';
      for (const task of lowPriorityTasks) {
        result += `- **Task ${task.id}:** ${task.title} (${task.status})\n`;
        result += `  ${task.description}\n\n`;

        // Add phase reference if it exists
        if (task.phaseId) {
          const phase = tasksById[task.phaseId];
          if (phase) {
            // Get the logical phase number
            const phaseNumber = phaseNumberMap[phase.id] || phase.id;

            // Format the phase reference
            const phaseTitle = phase.title.replace(/^Phase\s+\d+[:\s]\s*/i, '');
            result += `  - **Phase:** Phase ${phaseNumber}${phaseTitle ? `: ${phaseTitle}` : ''}\n\n`;
          }
        }

        // Add subtasks if they exist
        if (task.subtasks && task.subtasks.length > 0) {
          result += `  **Subtasks:**\n\n`;
          for (const subtask of task.subtasks) {
            result += `  - ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
          }
          result += '\n';
        }
      }
    }
  }

  return result;
}

/**
 * Generate a Markdown file from a project brief
 * @param projectBriefUri - The URI of the project brief
 * @param tasksData - Optional tasks data to include in the Markdown
 * @returns The path to the generated Markdown file
 */
export async function generateMarkdown(
  projectBriefUri: string,
  tasksData?: {
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority?: string;
      type?: string;
      phaseId?: string;
      childTasks?: string[];
      subtasks?: Array<{
        id: string;
        title: string;
        status: string;
        description?: string;
      }>;
    }>;
    metadata?: {
      projectName?: string;
      projectVersion?: string;
      createdAt?: string;
      updatedAt?: string;
    };
  }
): Promise<string> {
  try {
    // Load the project brief
    const projectBrief = await resourceStorage.loadResource<ProjectBrief>(projectBriefUri);

    // Import necessary utilities
    const fs = await import('fs/promises');
    const path = await import('path');
    const Config = (await import('../../config.js')).default;

    // Get the project root
    const projectRoot = Config.getProjectRoot();

    // Generate Markdown content
    let markdown = `# ${projectBrief.title}\n\n`;

    // Add description
    markdown += `## Project Description\n\n${projectBrief.description}\n\n`;

    // Add goals
    if (projectBrief.goals && projectBrief.goals.length > 0) {
      markdown += `## Goals\n\n`;
      for (const goal of projectBrief.goals) {
        markdown += `- ${goal}\n`;
      }
      markdown += '\n';
    }

    // Add stakeholders
    if (projectBrief.stakeholders && projectBrief.stakeholders.length > 0) {
      markdown += `## Stakeholders\n\n`;
      for (const stakeholder of projectBrief.stakeholders) {
        markdown += `- ${stakeholder}\n`;
      }
      markdown += '\n';
    }

    // Add technologies
    if (projectBrief.technologies && projectBrief.technologies.length > 0) {
      markdown += `## Technologies\n\n`;
      for (const technology of projectBrief.technologies) {
        markdown += `- ${technology}\n`;
      }
      markdown += '\n';
    }

    // Add constraints
    if (projectBrief.constraints && projectBrief.constraints.length > 0) {
      markdown += `## Constraints\n\n`;
      for (const constraint of projectBrief.constraints) {
        markdown += `- ${constraint}\n`;
      }
      markdown += '\n';
    }

    // Add timeline
    if (projectBrief.timeline) {
      markdown += `## Timeline\n\n${projectBrief.timeline}\n\n`;
    }

    // Add phases
    if (projectBrief.phases && projectBrief.phases.length > 0) {
      markdown += `## Project Phases\n\n`;
      for (const phase of projectBrief.phases) {
        markdown += `### ${phase.name}\n\n`;
        if (phase.description) {
          markdown += `${phase.description}\n\n`;
        }
        if (phase.tasks && phase.tasks.length > 0) {
          markdown += `Tasks:\n\n`;
          for (const task of phase.tasks) {
            markdown += `- ${task}\n`;
          }
          markdown += '\n';
        }
      }
    }

    // Add metadata
    markdown += `## Metadata\n\n`;
    markdown += `- **Created:** ${new Date(projectBrief.createdAt).toLocaleString()}\n`;
    markdown += `- **Last Updated:** ${new Date(projectBrief.updatedAt).toLocaleString()}\n`;
    markdown += `- **Version:** ${projectBrief.version}\n`;
    markdown += `- **ID:** ${projectBrief.id}\n\n`;

    // Add tasks section if tasks data is provided
    if (
      tasksData &&
      tasksData.tasks &&
      Array.isArray(tasksData.tasks) &&
      tasksData.tasks.length > 0
    ) {
      markdown += await addTasksToMarkdown(markdown, tasksData.tasks);
    } else {
      // Try to load tasks from artifacts.json
      try {
        const tasksPath = Config.getArtifactsFile(projectRoot);
        const tasksFileExists = await fs
          .access(tasksPath)
          .then(() => true)
          .catch(() => false);

        if (tasksFileExists) {
          const tasksFileContent = await fs.readFile(tasksPath, 'utf-8');
          const loadedTasksData = JSON.parse(tasksFileContent) as {
            tasks?: Array<{
              id: string;
              title: string;
              description: string;
              status?: string;
              priority?: string;
              subtasks?: Array<{
                id: string;
                title: string;
                description?: string;
                status?: string;
              }>;
            }>;
          };

          if (
            loadedTasksData &&
            loadedTasksData.tasks &&
            Array.isArray(loadedTasksData.tasks) &&
            loadedTasksData.tasks.length > 0
          ) {
            // Ensure all tasks and subtasks have a status property
            const tasksWithStatus = loadedTasksData.tasks.map((task) => {
              // Process subtasks if they exist
              const processedSubtasks = task.subtasks?.map((subtask) => ({
                ...subtask,
                status: subtask.status || 'pending',
              }));

              return {
                ...task,
                status: task.status || 'pending',
                subtasks: processedSubtasks,
              };
            });
            markdown += await addTasksToMarkdown(markdown, tasksWithStatus);
          } else {
            markdown += `\n## Development Roadmap\n\nNo tasks have been generated yet.\n\n`;
          }
        } else {
          markdown += `\n## Development Roadmap\n\nNo tasks have been generated yet.\n\n`;
        }
      } catch (error) {
        logger.error('Error loading tasks for Markdown generation', { error });
        markdown += `\n## Development Roadmap\n\nError loading tasks: ${error instanceof Error ? error.message : String(error)}\n\n`;
      }
    }

    // Add footer
    markdown += `---\n\nGenerated by AgentPM Project Brief Interview System\n`;

    // Ensure the artifacts directory exists
    const artifactsDir = Config.getArtifactsDir(projectRoot);
    await fs.mkdir(artifactsDir, { recursive: true });

    // Write the Markdown file
    const markdownPath = path.join(artifactsDir, PRODUCT_BRIEF_FILE);
    await fs.writeFile(markdownPath, markdown, 'utf-8');

    logger.debug(`Generated project brief Markdown file at ${markdownPath}`);

    return markdownPath;
  } catch (error) {
    logger.error('Error generating project brief Markdown', { error });
    throw new InterviewError('Failed to generate project brief Markdown', error);
  }
}

/**
 * Update the project brief markdown file after task modifications
 * This function is used by all task modification actions to ensure consistent updates
 * @param projectRoot - The project root directory
 * @returns The path to the updated Markdown file or null if update failed
 */
export async function updateProjectBriefAfterTaskModification(
  projectRoot: string
): Promise<string | null> {
  try {
    logger.debug('Updating project brief markdown after task modification');

    // Import necessary utilities
    const fs = await import('fs/promises');
    const path = await import('path');
    const Config = (await import('../../config.js')).default;

    // Get the artifacts file path
    const artifactsFilePath = Config.getArtifactsFile(projectRoot);

    // Check if the artifacts file exists
    const artifactsFileExists = await fs
      .access(artifactsFilePath)
      .then(() => true)
      .catch(() => false);

    if (!artifactsFileExists) {
      logger.debug('Artifacts file does not exist, skipping project brief update');
      return null;
    }

    // Read the artifacts file
    const artifactsFileContent = await fs.readFile(artifactsFilePath, 'utf-8');
    const tasksData = JSON.parse(artifactsFileContent) as {
      tasks?: Array<{
        id: string;
        title: string;
        description: string;
        status?: string;
        priority?: string;
        subtasks?: Array<{
          id: string;
          title: string;
          description?: string;
          status?: string;
        }>;
      }>;
      metadata?: {
        projectBriefUri?: string;
        projectName?: string;
        projectVersion?: string;
        createdAt?: string;
        updatedAt?: string;
        [key: string]: unknown;
      };
    };

    // Check if there's a project brief URI in the tasks data
    const projectBriefUri = tasksData.metadata?.projectBriefUri;

    if (projectBriefUri) {
      // If we have a project brief URI, use it to regenerate the markdown
      logger.debug('Regenerating project brief markdown using URI', { projectBriefUri });
      // Ensure all tasks and subtasks have required properties before passing to generateMarkdown
      const processedTasksData = {
        tasks:
          tasksData.tasks?.map((task) => {
            // Process subtasks if they exist
            const processedSubtasks = task.subtasks?.map((subtask) => ({
              ...subtask,
              status: subtask.status || 'pending',
            }));

            return {
              ...task,
              status: task.status || 'pending',
              subtasks: processedSubtasks,
            };
          }) || [],
        metadata: tasksData.metadata,
      };

      const markdownPath = await generateMarkdown(projectBriefUri, processedTasksData);
      logger.debug('Project brief markdown regenerated', { markdownPath });
      return markdownPath;
    } else {
      // If no URI, try to find a project brief file in the resources directory
      const artifactsDir = Config.getArtifactsDir(projectRoot);
      const resourcesDir = path.join(artifactsDir, 'resources', 'project-brief');

      try {
        // Check if the resources directory exists
        await fs.access(resourcesDir);

        // List all files in the resources directory
        const files = await fs.readdir(resourcesDir);

        // Find the first .json file (project brief)
        const projectBriefFile = files.find((file) => file.endsWith('.json'));

        if (projectBriefFile) {
          // Found a project brief file, use it to regenerate the markdown
          const projectBriefUri = `project-brief://${projectBriefFile.replace('.json', '')}`;
          logger.debug('Found project brief file, regenerating markdown', { projectBriefUri });

          // Update the tasks data metadata with the project brief URI
          tasksData.metadata = {
            ...tasksData.metadata,
            projectBriefUri: projectBriefUri,
          };

          // Write the updated tasks data back to the file
          await fs.writeFile(artifactsFilePath, JSON.stringify(tasksData, null, 2), 'utf-8');

          // Generate the markdown
          // Ensure all tasks and subtasks have required properties before passing to generateMarkdown
          const processedTasksData = {
            tasks:
              tasksData.tasks?.map((task) => {
                // Process subtasks if they exist
                const processedSubtasks = task.subtasks?.map((subtask) => ({
                  ...subtask,
                  status: subtask.status || 'pending',
                }));

                return {
                  ...task,
                  status: task.status || 'pending',
                  subtasks: processedSubtasks,
                };
              }) || [],
            metadata: tasksData.metadata,
          };

          const markdownPath = await generateMarkdown(projectBriefUri, processedTasksData);
          logger.debug('Project brief markdown regenerated', { markdownPath });
          return markdownPath;
        }
      } catch (error) {
        logger.debug('Could not access project brief resources directory', { error });
      }
    }

    logger.debug('No project brief URI found, skipping project brief update');
    return null;
  } catch (error) {
    // Log the error but don't fail the operation
    logger.error('Error updating project brief markdown', { error });
    return null;
  }
}

/**
 * Update the project brief markdown file after task modifications
 * This function is used by all task modification actions to ensure consistent updates
 * @param projectRoot - The project root directory
 * @param tasksData - The tasks data from artifacts.json
 * @param file - Optional path to the tasks file
 * @returns The path to the updated Markdown file or null if update failed
 */
export async function updateProjectBriefMarkdown(
  projectRoot: string,
  tasksData: {
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority?: string;
      dependencies?: string[];
      subtasks?: Array<{
        id: string;
        title: string;
        status?: string;
        description?: string;
        dependencies?: string[];
        details?: string;
      }>;
      details?: string;
    }>;
    metadata?: {
      projectBriefUri?: string;
      projectName?: string;
      projectVersion?: string;
      createdAt?: string;
      updatedAt?: string;
      [key: string]: unknown;
    };
  },
  file?: string
): Promise<string | null> {
  try {
    logger.debug('Updating project brief markdown after task modification');

    // Check if there's a project brief URI in the tasks data
    const projectBriefUri = tasksData.metadata?.projectBriefUri;

    // Convert TasksData to the format expected by generateMarkdown
    const formattedTasksData = {
      tasks: tasksData.tasks.map((task) => ({
        id: String(task.id),
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'pending',
        priority: task.priority,
        subtasks: task.subtasks?.map((subtask) => ({
          id: String(subtask.id),
          title: subtask.title || '',
          status: subtask.status || 'pending',
          description: subtask.description,
        })),
      })),
      metadata: tasksData.metadata,
    };

    if (projectBriefUri) {
      // If we have a project brief URI, use it to regenerate the markdown
      logger.debug('Regenerating project brief markdown using URI', { projectBriefUri });
      const markdownPath = await generateMarkdown(projectBriefUri, formattedTasksData);
      logger.debug('Project brief markdown regenerated', { markdownPath });
      return markdownPath;
    } else {
      // If no URI, try to find a project brief file in the resources directory
      const fs = await import('fs/promises');
      const path = await import('path');
      const Config = (await import('../../config.js')).default;

      const artifactsDir = Config.getArtifactsDir(projectRoot);
      const resourcesDir = path.join(artifactsDir, 'resources', 'project-brief');
      const markdownPath = path.join(artifactsDir, PRODUCT_BRIEF_FILE);

      try {
        // Check if the resources directory exists
        await fs.access(resourcesDir);

        // List all files in the resources directory
        const files = await fs.readdir(resourcesDir);

        // Find the first .json file (project brief)
        const projectBriefFile = files.find((file) => file.endsWith('.json'));

        if (projectBriefFile) {
          // Found a project brief file, use it to regenerate the markdown
          const projectBriefUri = `project-brief://${projectBriefFile.replace('.json', '')}`;
          logger.debug('Found project brief file, regenerating markdown', { projectBriefUri });

          // Update the tasks data metadata with the project brief URI
          tasksData.metadata = {
            ...tasksData.metadata,
            projectBriefUri: projectBriefUri,
          };

          // Write the updated tasks data back to the file if provided
          if (file) {
            const { writeTasksFile: writeTasksFileFunc } = await import(
              '../../mcp/utils/file-utils.js'
            );

            // Convert to the expected TasksData format
            const convertedTasksData = {
              tasks: tasksData.tasks.map((task) => ({
                ...task,
                subtasks: task.subtasks?.map((subtask) => ({
                  ...subtask,
                  status: subtask.status || 'pending',
                })),
              })),
              metadata: tasksData.metadata,
            };

            await writeTasksFileFunc(convertedTasksData, projectRoot, file);
          }

          // Generate the markdown
          const markdownPath = await generateMarkdown(projectBriefUri, formattedTasksData);
          logger.debug('Project brief markdown regenerated', { markdownPath });
          return markdownPath;
        } else {
          // No project brief file found, fall back to updating the markdown file directly
          return await updateMarkdownDirectly();
        }
      } catch (error) {
        // Resources directory doesn't exist or other error, fall back to updating the markdown file directly
        logger.debug('Could not access project brief resources directory', { error });
        return await updateMarkdownDirectly();
      }

      // Helper function to update the markdown file directly
      async function updateMarkdownDirectly(): Promise<string | null> {
        try {
          // Check if the markdown file exists
          await fs.access(markdownPath);

          // File exists, so let's update it
          logger.debug('Project brief markdown file exists, updating it directly', {
            markdownPath,
          });

          // Read the existing file to get the project brief content
          const existingMarkdown = await fs.readFile(markdownPath, 'utf-8');

          // Extract the project brief content (everything before the Development Roadmap section)
          const roadmapSectionIndex = existingMarkdown.indexOf('## Development Roadmap');
          if (roadmapSectionIndex !== -1) {
            const projectBriefContent = existingMarkdown.substring(0, roadmapSectionIndex);

            // Generate the tasks section
            let tasksSection = '## Development Roadmap\n\n';

            // Group tasks by priority
            const highPriorityTasks = formattedTasksData.tasks.filter((t) => t.priority === 'high');
            const mediumPriorityTasks = formattedTasksData.tasks.filter(
              (t) => t.priority === 'medium'
            );
            const lowPriorityTasks = formattedTasksData.tasks.filter((t) => t.priority === 'low');

            // Add high priority tasks
            if (highPriorityTasks.length > 0) {
              tasksSection += '#### High Priority\n\n';
              for (const task of highPriorityTasks) {
                tasksSection += `- **Task ${task.id}:** ${task.title} (${task.status})\n`;
                tasksSection += `  ${task.description}\n\n`;

                if (task.subtasks && task.subtasks.length > 0) {
                  tasksSection += `  **Subtasks:**\n\n`;
                  for (const subtask of task.subtasks) {
                    tasksSection += `  - ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
                  }
                  tasksSection += '\n';
                }
              }
            }

            // Add medium priority tasks
            if (mediumPriorityTasks.length > 0) {
              tasksSection += '#### Medium Priority\n\n';
              for (const task of mediumPriorityTasks) {
                tasksSection += `- **Task ${task.id}:** ${task.title} (${task.status})\n`;
                tasksSection += `  ${task.description}\n\n`;

                if (task.subtasks && task.subtasks.length > 0) {
                  tasksSection += `  **Subtasks:**\n\n`;
                  for (const subtask of task.subtasks) {
                    tasksSection += `  - ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
                  }
                  tasksSection += '\n';
                }
              }
            }

            // Add low priority tasks
            if (lowPriorityTasks.length > 0) {
              tasksSection += '#### Low Priority\n\n';
              for (const task of lowPriorityTasks) {
                tasksSection += `- **Task ${task.id}:** ${task.title} (${task.status})\n`;
                tasksSection += `  ${task.description}\n\n`;

                if (task.subtasks && task.subtasks.length > 0) {
                  tasksSection += `  **Subtasks:**\n\n`;
                  for (const subtask of task.subtasks) {
                    tasksSection += `  - ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
                  }
                  tasksSection += '\n';
                }
              }
            }

            // Add footer
            tasksSection += `---\n\nGenerated by AgentPM Project Brief Interview System\n`;

            // Combine the project brief content with the updated tasks section
            const updatedMarkdown = projectBriefContent + tasksSection;

            // Write the updated markdown file
            await fs.writeFile(markdownPath, updatedMarkdown, 'utf-8');

            logger.debug('Project brief markdown updated directly', { markdownPath });
            return markdownPath;
          } else {
            logger.debug(
              'Could not find Development Roadmap section in project brief markdown, skipping update'
            );
            return null;
          }
        } catch (error) {
          // File doesn't exist or other error
          logger.debug('Project brief markdown file does not exist or could not be accessed', {
            error,
          });
          return null;
        }
      }
    }
  } catch (error) {
    // Log the error but don't fail the operation
    logger.error('Error updating project brief markdown', { error });
    return null;
  }
}
