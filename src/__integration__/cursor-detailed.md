# Cursor AgentPM Integration Tests

You are going to help me test the AgentPM MCP server. Follow the instructions as closely as possible. At the end of the test provide a summary of the results.

## Your Instructions

1. Initialize a new AgentPM project by calling `apm_project_brief_create`.
2. Use the contents of the attached file `prd.md` as the basis for the interview answer.
   - Use your best judgment; no need to ask the user for input; just submit the answers as you see fit, including final summary that initiates task generation.
3. When the user asks you to "check status", use `apm_project_brief_status` to check the operation status.
4. When the status is complete, retrieve the results using `apm_project_brief_result`.
5. After retrieving the results, run a complexity analysis using `apm_complexity`.
6. When the report is created, use `apm_task` with action "get_all" to view all tasks.
7. Then use `apm_task` with action "get_single" to view task 1 in detail.
8. Expand task 1 using `apm_task_modify` with action "expand".
9. When task 1 is expanded, use `apm_task` with action "get_single" to view the expanded task.
10. Update the status of a subtask using `apm_task_modify` with action "update_status".
11. Expand task 2 with research using `apm_task_modify` with action "expand" and research=true.
12. Add a dependency between tasks using `apm_dependencies` with action "add".
13. Validate dependencies using `apm_dependencies` with action "validate".
14. Expand all remaining tasks using `apm_task_modify` with action "expand_all".
15. Generate individual task files using `apm_task_generate`.
16. Use `context7_library_id` and `context7_library_docs` to retrieve documentation for a relevant library (e.g., "React").
17. Create a new task using `apm_task_modify` with action "create".
18. Update an existing task using `apm_task_modify` with action "update".
19. Add a subtask manually using `apm_task_modify` with action "add_subtask".
20. Remove a subtask using `apm_task_modify` with action "remove_subtask".
21. Clear all subtasks from a task using `apm_task_modify` with action "clear_subtasks".
22. Delete a task using `apm_task_modify` with action "delete".
23. Provide a summary of all the tests performed and their results.

## Tool Usage Details

### Project Brief Creation
- `apm_project_brief_create`: Initialize with `projectRoot` parameter. This starts an interview process.
- `apm_project_brief_status`: Check status with `projectRoot` and `operationId` parameters.
- `apm_project_brief_result`: Get results with `projectRoot` and `operationId` parameters.

### Task Management
- `apm_task` with action "get_all": Lists all tasks, can filter by `status`.
- `apm_task` with action "get_single": View a specific task by `id`.
- `apm_task` with action "get_next": Find the next task to work on, can filter by `priority` and `containsText`.
- `apm_task` with action "filter_by_status": Filter tasks by `status`.
- `apm_task` with action "filter_by_priority": Filter tasks by `priority`.

### Task Modification
- `apm_task_modify` with action "create": Create a new task with `title`, `description`, `priority`, etc.
- `apm_task_modify` with action "update": Update a task with `id` and `prompt`.
- `apm_task_modify` with action "update_status": Change task status with `id` and `status`.
- `apm_task_modify` with action "delete": Remove a task with `id`.
- `apm_task_modify` with action "add_subtask": Add a subtask to a task with `id` and subtask details.
- `apm_task_modify` with action "remove_subtask": Remove a subtask with `id`.
- `apm_task_modify` with action "clear_subtasks": Remove all subtasks from a task with `id`.
- `apm_task_modify` with action "expand": Break down a task into subtasks with `id` and `num`.
- `apm_task_modify` with action "expand_all": Expand all pending tasks with `num`.

### Dependency Management
- `apm_dependencies` with action "add": Add a dependency with `id` and `dependsOn`.
- `apm_dependencies` with action "remove": Remove a dependency with `id` and `dependsOn`.
- `apm_dependencies` with action "validate": Check for dependency issues.
- `apm_dependencies` with action "fix": Automatically fix dependency issues.

### Task Generation
- `apm_task_generate`: Generate individual task files with `projectRoot`.

### Complexity Analysis
- `apm_complexity`: Analyze task complexity with `projectRoot` and optional `threshold`.

### Documentation Retrieval
- `context7_library_id`: Resolve a library name to a Context7-compatible ID.
- `context7_library_docs`: Fetch documentation with the resolved `context7CompatibleLibraryID`.

## Example Parameter Formats

### Project Brief Creation
```json
{
  "projectRoot": "/path/to/project"
}
```

### Project Brief Status
```json
{
  "projectRoot": "/path/to/project",
  "operationId": "project-brief-123456"
}
```

### Task Management (Get All)
```json
{
  "action": "get_all",
  "projectRoot": "/path/to/project",
  "status": "pending"
}
```

### Task Management (Get Single)
```json
{
  "action": "get_single",
  "projectRoot": "/path/to/project",
  "id": "1"
}
```

### Task Modification (Create)
```json
{
  "action": "create",
  "projectRoot": "/path/to/project",
  "title": "New Task",
  "description": "Task description",
  "priority": "high",
  "dependencies": "1,2"
}
```

### Task Modification (Expand)
```json
{
  "action": "expand",
  "projectRoot": "/path/to/project",
  "id": "1",
  "num": 3,
  "research": true
}
```

### Dependency Management
```json
{
  "action": "add",
  "projectRoot": "/path/to/project",
  "id": "2",
  "dependsOn": "1"
}
```

### Complexity Analysis
```json
{
  "projectRoot": "/path/to/project",
  "threshold": 5
}
```

### Documentation Retrieval
```json
{
  "libraryName": "React"
}

{
  "context7CompatibleLibraryID": "facebook/react",
  "tokens": 5000,
  "topic": "hooks"
}
```

## Expected Responses and Troubleshooting

### Success Response Format
Most tools return responses in this format:
```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": { /* tool-specific data */ },
        "message": "Human-readable success message"
      }
    }
  ]
}
```

### Error Response Format
```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "error": "Error message",
        "code": "ERROR_CODE",
        "details": { /* error details */ }
      }
    }
  ],
  "isError": true
}
```

### Common Issues and Solutions

1. **Missing projectRoot**: Always include the `projectRoot` parameter with the absolute path to the project.

2. **Invalid task ID**: When using task IDs, make sure they exist in the artifacts.json file.

3. **Long-running operations**: For operations like project brief creation and task expansion, be patient and use the status checking tools.

4. **Dependency conflicts**: If you encounter circular dependency errors, use the `apm_dependencies` tool with action "validate" to identify and fix issues.

5. **File not found errors**: Ensure the artifacts.json file exists in the project root before calling tools that read from it.

6. **Parameter validation errors**: Double-check that all required parameters are provided and have the correct format/values.