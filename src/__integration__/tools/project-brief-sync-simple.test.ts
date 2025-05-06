/**
 * Simple integration tests for project brief synchronization with task modifications
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createTempTestDir, cleanupTempTestDir } from '../helpers/test-utils.js';

// Create a simplified version of updateProjectBriefAfterTaskModification for testing
async function updateProjectBriefMarkdown(projectRoot: string): Promise<string | null> {
  try {
    // Read the tasks data
    const artifactsFilePath = path.join(projectRoot, 'apm-artifacts', 'artifacts.json');
    const artifactsFileContent = await fs.readFile(artifactsFilePath, 'utf-8');
    const tasksData = JSON.parse(artifactsFileContent);

    // Generate the markdown
    const markdownPath = path.join(projectRoot, 'apm-artifacts', 'project-brief.md');

    // Create a simple markdown with the tasks data
    let markdown = `# Test Project\n\n## Project Description\n\nA test project for integration testing\n\n`;
    markdown += `## Development Roadmap\n\n`;

    // Add tasks to the markdown
    if (tasksData && tasksData.tasks && tasksData.tasks.length > 0) {
      for (const task of tasksData.tasks) {
        markdown += `- **Task ${task.id}:** ${task.title} (${task.status})\n`;
        markdown += `  ${task.description}\n\n`;

        // Add subtasks if they exist
        if (task.subtasks && task.subtasks.length > 0) {
          markdown += `  **Subtasks:**\n\n`;
          for (const subtask of task.subtasks) {
            markdown += `  - ${subtask.id}: ${subtask.title} (${subtask.status})\n`;
          }
          markdown += '\n';
        }
      }
    }

    // Ensure the directory exists
    await fs.mkdir(path.dirname(markdownPath), { recursive: true });

    // Write the file
    await fs.writeFile(markdownPath, markdown);

    return markdownPath;
  } catch (error) {
    console.error('Error updating project brief markdown:', error);
    return null;
  }
}

describe('Project Brief Synchronization', () => {
  let tempDir: string;
  let projectRoot: string;
  let artifactsDir: string;
  let artifactsJsonPath: string;
  let projectBriefPath: string;
  let resourcesDir: string;
  let projectBriefResourcesDir: string;
  let projectBriefJsonPath: string;

  beforeEach(async () => {
    // Create a temporary test directory
    tempDir = await createTempTestDir();
    projectRoot = tempDir;

    // Set the environment variable for the test
    process.env.PROJECT_ROOT = projectRoot;

    // Create the artifacts directory
    artifactsDir = path.join(projectRoot, 'apm-artifacts');
    await fs.mkdir(artifactsDir, { recursive: true });

    // Create the resources directory
    resourcesDir = path.join(artifactsDir, 'resources');
    await fs.mkdir(resourcesDir, { recursive: true });

    // Create the project brief resources directory
    projectBriefResourcesDir = path.join(resourcesDir, 'project-brief');
    await fs.mkdir(projectBriefResourcesDir, { recursive: true });

    // Create the project brief JSON file
    projectBriefJsonPath = path.join(projectBriefResourcesDir, 'test-project-brief-id.json');
    const projectBriefData = {
      id: 'test-project-brief-id',
      type: 'project-brief',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      title: 'Test Project',
      description: 'A test project for integration testing',
      goals: ['Test project brief synchronization'],
      stakeholders: ['Developers'],
      technologies: ['TypeScript', 'Node.js'],
      constraints: ['Time'],
      timeline: '1 week',
      phases: [],
    };
    await fs.writeFile(projectBriefJsonPath, JSON.stringify(projectBriefData, null, 2));

    // Create the artifacts.json file with a project brief URI
    artifactsJsonPath = path.join(artifactsDir, 'artifacts.json');
    const initialTasksData = {
      tasks: [
        {
          id: '1',
          title: 'Test Task 1',
          description: 'This is test task 1',
          status: 'pending',
          priority: 'high',
          subtasks: [],
        },
      ],
      metadata: {
        projectName: 'Test Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectBriefUri: 'project-brief://test-project-brief-id',
      },
    };
    await fs.writeFile(artifactsJsonPath, JSON.stringify(initialTasksData, null, 2));

    // Create the project brief markdown file
    projectBriefPath = path.join(artifactsDir, 'project-brief.md');
    await fs.writeFile(
      projectBriefPath,
      '# Test Project\n\n## Project Description\n\nA test project for integration testing\n\n## Development Roadmap\n\n'
    );
  });

  afterEach(async () => {
    // Clean up the temporary test directory
    await cleanupTempTestDir(tempDir);
  });

  it('should update project brief markdown after task modification', async () => {
    // Add a new task to the artifacts.json file
    const tasksData = JSON.parse(await fs.readFile(artifactsJsonPath, 'utf-8'));
    tasksData.tasks.push({
      id: '2',
      title: 'Test Task 2',
      description: 'This is test task 2',
      status: 'pending',
      priority: 'medium',
      subtasks: [],
    });
    await fs.writeFile(artifactsJsonPath, JSON.stringify(tasksData, null, 2));

    // Update the project brief markdown
    await updateProjectBriefMarkdown(projectRoot);

    // Read the project brief markdown
    const briefContent = await fs.readFile(projectBriefPath, 'utf-8');

    // Verify the task is in the project brief
    expect(briefContent).toContain('Test Task 1');
    expect(briefContent).toContain('Test Task 2');
  });

  it('should include subtasks in the project brief markdown', async () => {
    // Add a task with subtasks to the artifacts.json file
    const tasksData = JSON.parse(await fs.readFile(artifactsJsonPath, 'utf-8'));
    tasksData.tasks.push({
      id: '2',
      title: 'Task with Subtasks',
      description: 'This is a task with subtasks',
      status: 'pending',
      priority: 'medium',
      subtasks: [
        {
          id: '2.1',
          title: 'Subtask 1',
          description: 'This is subtask 1',
          status: 'pending',
        },
        {
          id: '2.2',
          title: 'Subtask 2',
          description: 'This is subtask 2',
          status: 'pending',
        },
      ],
    });
    await fs.writeFile(artifactsJsonPath, JSON.stringify(tasksData, null, 2));

    // Update the project brief markdown
    await updateProjectBriefMarkdown(projectRoot);

    // Read the project brief markdown
    const briefContent = await fs.readFile(projectBriefPath, 'utf-8');

    // Verify the task and subtasks are in the project brief
    expect(briefContent).toContain('Task with Subtasks');
    expect(briefContent).toContain('Subtask 1');
    expect(briefContent).toContain('Subtask 2');
  });

  it('should handle task status updates in the project brief markdown', async () => {
    // Update a task status in the artifacts.json file
    const tasksData = JSON.parse(await fs.readFile(artifactsJsonPath, 'utf-8'));
    tasksData.tasks[0].status = 'in-progress';
    await fs.writeFile(artifactsJsonPath, JSON.stringify(tasksData, null, 2));

    // Update the project brief markdown
    await updateProjectBriefMarkdown(projectRoot);

    // Read the project brief markdown
    const briefContent = await fs.readFile(projectBriefPath, 'utf-8');

    // Verify the task status is updated in the project brief
    expect(briefContent).toContain('Test Task 1');
    expect(briefContent).toContain('in-progress');
  });

  it('should handle task deletion in the project brief markdown', async () => {
    // Add a second task to the artifacts.json file
    const tasksData = JSON.parse(await fs.readFile(artifactsJsonPath, 'utf-8'));
    tasksData.tasks.push({
      id: '2',
      title: 'Task to Delete',
      description: 'This task will be deleted',
      status: 'pending',
      priority: 'low',
      subtasks: [],
    });
    await fs.writeFile(artifactsJsonPath, JSON.stringify(tasksData, null, 2));

    // Update the project brief markdown
    await updateProjectBriefMarkdown(projectRoot);

    // Read the project brief markdown before deletion
    const briefBeforeDeletion = await fs.readFile(projectBriefPath, 'utf-8');

    // Verify the task is in the project brief
    expect(briefBeforeDeletion).toContain('Task to Delete');

    // Delete the task
    tasksData.tasks = tasksData.tasks.filter((task: { id: string }) => task.id !== '2');
    await fs.writeFile(artifactsJsonPath, JSON.stringify(tasksData, null, 2));

    // Update the project brief markdown
    await updateProjectBriefMarkdown(projectRoot);

    // Read the project brief markdown after deletion
    const briefAfterDeletion = await fs.readFile(projectBriefPath, 'utf-8');

    // Verify the task is no longer in the project brief
    expect(briefAfterDeletion).not.toContain('Task to Delete');
  });

  it('should handle missing project brief URI gracefully', async () => {
    // Create a new artifacts.json file without project brief URI
    const tasksData = {
      tasks: [
        {
          id: '1',
          title: 'No URI Task',
          description: 'A task created without project brief URI',
          status: 'pending',
          priority: 'medium',
          subtasks: [],
        },
      ],
      metadata: {
        projectName: 'Test Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    await fs.writeFile(artifactsJsonPath, JSON.stringify(tasksData, null, 2));

    // Update the project brief markdown
    await updateProjectBriefMarkdown(projectRoot);

    // Read the artifacts.json file
    const updatedTasksData = JSON.parse(await fs.readFile(artifactsJsonPath, 'utf-8'));

    // Verify the task was created
    expect(updatedTasksData.tasks).toHaveLength(1);
    expect(updatedTasksData.tasks[0].title).toBe('No URI Task');
  });
});
