# AgentPM - MCP Software Development Assistant

## Overview
Installed locally as an MCP server, AgentPM acts as our product manager:

- Develops comprehensive requirements
- Breaks down complex projects into well-defined tasks
- Guides technical decisions and systems design
- Creates actionable tasks with clear dependencies
- Orchestrates implementation with context-aware assistance
- Delivers relevant documentation and context when needed
- Promote software development best practices (TDD, vertical slicing)

## Project Architecture
- AgentPM implements the Model Context Protocol (MCP)
- Task management is centralized in artifacts.json with individual markdown task files
- Claude Sonnet 3.7 powers task generation and analysis
- Perplexity API integration for research-backed generation

## Key Features
1. Task Management
   - Structured task model with dependencies, priorities, and metadata
   - Subtask support for complex work breakdown
   - Status tracking (pending, in-progress, done, deferred, cancelled)
   - Dependency validation and management

2. AI Integration
   - Claude-powered task generation with consistent results
   - Context-aware task expansion incorporating project knowledge
   - Implementation drift handling to update future tasks based on completed work

3. Documentation & Requirements
   - Guided project brief development through structured interviews
   - Living documentation that evolves with your project
   - Automatic context retrieval through Context7 integration

## Tool Usage Guidelines
Always use the AgentPM MCP tools for: 

- Requirements development  
- Task and project management

Following are detailed usage instructions for each tool:

### Project Brief (apm_project_brief_create)
- Interactive interview process for comprehensive project specification
- Generates structured documentation and initial tasks
- Use `apm_project_brief_status` to check operation progress
- Use `apm_project_brief_result` to retrieve completed briefing

### Complexity Analysis (apm_complexity)
- Analyzes task complexity on a 1-10 scale
- Recommends task breakdown for complex items
- Generates reports in both JSON and markdown formats

### Task Management (apm_task)
- Use `get_all` to list tasks, optionally filtered by status
- Use `get_single` to view a specific task by ID
- Use `get_next` to find the next task to work on
- Use `filter_by_status` or `filter_by_priority` for targeted task lists

### Task Creation & Modification (apm_task_modify)
- Use `create` to add new tasks with titles, descriptions, priorities
- Use `update` to modify existing tasks
- Use `update_status` to change task status (pending → in-progress → done)
- Use `expand` to break down tasks into subtasks (AI-assisted)
- Use `add_subtask`/`remove_subtask` for manual subtask management

### Dependency Management (apm_dependencies)
- Use `add`/`remove` to manage task dependencies
- Use `validate` to check for circular or missing dependencies
- Use `fix` to automatically resolve dependency issues

## Best Practices
- Start with a project brief for well-structured requirements: `apm_project_brief_create`
- Break down complex tasks (complexity > 5) into subtasks: `apm_complexity`
- Maintain clear dependencies between tasks: `apm_dependencies`
- Update task status as you work to help AgentPM track progress: `apm_task_modify/update_status`
- Use research-backed generation for domain-specific tasks: research: `true`

## Data Model
Tasks include:
- id: Unique identifier (string)
- title: Short, descriptive name
- description: Detailed explanation
- status: pending, in-progress, done, deferred, cancelled
- priority: high, medium, low
- dependencies: Array of task IDs this task depends on
- details: Implementation specifics
- testStrategy: Testing approach
- subtasks: Array of child tasks (optional)

## File Structure
- apm-artifacts/artifacts.json: Central task repository
- apm-artifacts/task-{id}.md: Individual task files
- apm-artifacts/resources/reports/: Analysis reports
- apm-artifacts/project-brief.md: Project requirements