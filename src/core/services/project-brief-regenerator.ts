/**
 * Utility functions for regenerating the project brief markdown file
 */
import { logger } from '../../mcp/utils/logger.js';
import { generateMarkdown } from './project-brief-markdown.js';
import { readTasksFile, writeTasksFile } from '../../mcp/utils/file-utils.js';

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

    // Read the tasks data
    const tasksData = await readTasksFile(projectRoot);

    // If tasks data is null, skip the update
    if (!tasksData) {
      logger.debug('Tasks data is null, skipping project brief update');
      return null;
    }

    // Check if there's a project brief URI in the tasks data
    const projectBriefUri = tasksData.metadata?.projectBriefUri as string | undefined;

    if (projectBriefUri) {
      // If we have a project brief URI, use it to regenerate the markdown
      logger.debug('Regenerating project brief markdown using URI', { projectBriefUri });

      // Convert to the expected format
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
            description: subtask.description || '',
          })),
        })),
        metadata: tasksData.metadata,
      };

      const markdownPath = await generateMarkdown(projectBriefUri, formattedTasksData);
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
          await writeTasksFile(tasksData, projectRoot);

          // Convert to the expected format
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
                description: subtask.description || '',
              })),
            })),
            metadata: tasksData.metadata,
          };

          // Generate the markdown
          const markdownPath = await generateMarkdown(projectBriefUri, formattedTasksData);
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
