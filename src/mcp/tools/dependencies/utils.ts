/**
 * @fileoverview Utility functions for the dependencies tool
 */

import { Task } from '../../types/index.js';

/**
 * Find a task by ID in the tasks array
 * @param tasks The tasks array
 * @param id The task ID to find
 * @returns The task object or undefined if not found
 */
export function findTaskById(tasks: Task[], id: string | number): Task | undefined {
  // Convert id to string if it's not already
  const idStr = String(id);

  // Check if it's a subtask ID (contains a dot)
  if (idStr.includes('.')) {
    const [parentId, subtaskId] = idStr.split('.');
    const parentTask = tasks.find((task) => String(task.id) === parentId);
    if (parentTask && parentTask.subtasks) {
      return parentTask.subtasks.find((subtask) => String(subtask.id) === subtaskId);
    }
    return undefined;
  }

  // Regular task ID
  return tasks.find((task) => String(task.id) === idStr);
}

/**
 * Validate dependencies to ensure no circular references
 * @param tasks The tasks array
 * @throws Error if circular dependencies are detected
 */
export function validateDependencies(tasks: Task[]): void {
  // For each task, check if there's a path from any of its dependencies back to itself
  for (const task of tasks) {
    // Check top-level task
    if (task.dependencies && task.dependencies.length > 0) {
      const visited = new Set<string>();
      const path: string[] = [];
      if (hasCycle(tasks, String(task.id), visited, path)) {
        throw new Error(`Circular dependency detected: ${path.join(' -> ')}`);
      }
    }

    // Check subtasks if they exist
    if (task.subtasks) {
      for (const subtask of task.subtasks) {
        if (subtask.dependencies && subtask.dependencies.length > 0) {
          const visited = new Set<string>();
          const path: string[] = [];
          const subtaskId = `${task.id}.${subtask.id}`;
          if (hasCycle(tasks, subtaskId, visited, path)) {
            throw new Error(`Circular dependency detected: ${path.join(' -> ')}`);
          }
        }
      }
    }
  }
}

/**
 * Check if there's a cycle in the dependency graph
 * @param tasks The tasks array
 * @param taskId The current task ID
 * @param visited Set of visited task IDs
 * @param path Current path of task IDs
 * @returns True if a cycle is detected, false otherwise
 */
function hasCycle(tasks: Task[], taskId: string, visited: Set<string>, path: string[]): boolean {
  // If we've already visited this task in the current path, we have a cycle
  if (path.includes(taskId)) {
    path.push(taskId); // Add the current task to complete the cycle
    return true;
  }

  // If we've already visited this task in another path and found no cycle, we can skip it
  if (visited.has(taskId)) {
    return false;
  }

  // Mark the task as visited
  visited.add(taskId);
  path.push(taskId);

  // Get the task object
  const task = findTaskById(tasks, taskId);
  if (!task) {
    // Task not found, remove from path and return false
    path.pop();
    return false;
  }

  // Check each dependency
  if (task.dependencies && task.dependencies.length > 0) {
    for (const depId of task.dependencies) {
      // For subtask dependencies, we need to construct the full ID
      let fullDepId = String(depId);

      // If this is a subtask and the dependency doesn't contain a dot,
      // it might be a reference to another subtask of the same parent
      if (taskId.includes('.') && !fullDepId.includes('.')) {
        const parentId = taskId.split('.')[0];
        // Check if this is a subtask ID (just a number) or a full ID
        // If it's just a number, prepend the parent ID
        if (!isNaN(Number(fullDepId))) {
          fullDepId = `${parentId}.${fullDepId}`;
        }
      }

      if (hasCycle(tasks, fullDepId, visited, path)) {
        return true;
      }
    }
  }

  // No cycle found, remove from path and return false
  path.pop();
  return false;
}

/**
 * Find tasks that depend on a given task
 * @param tasks The tasks array
 * @param taskId The task ID to find dependents for
 * @returns Array of task IDs that depend on the given task
 */
export function findDependentTasks(tasks: Task[], taskId: string): string[] {
  const dependentTasks: string[] = [];

  // Check each task
  for (const task of tasks) {
    if (task.dependencies && task.dependencies.includes(taskId)) {
      dependentTasks.push(task.id);
    }

    // Check subtasks if they exist
    if (task.subtasks) {
      for (const subtask of task.subtasks) {
        if (subtask.dependencies && subtask.dependencies.includes(taskId)) {
          dependentTasks.push(`${task.id}.${subtask.id}`);
        }
      }
    }
  }

  return dependentTasks;
}
