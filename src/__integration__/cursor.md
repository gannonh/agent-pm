# Cursor AgentPM Integration Tests

You are going to help me test the AgentPM MCP server. Follow the instructions as closely as possible. At the end of the test provide a summary of the results.

## Your Instructions

1. Initialize a new AgentPM project by calling `apm_project_brief_create`.
2. Use the contents of the attached file `prd.md` as the basis for the interview answers.
   - Use your best judgment; no need to ask the user for input; just submit the answers in response to the questionsas you see fit, including final summary that initiates task generation.
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

