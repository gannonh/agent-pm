# Changelog

All notable changes to AgentPM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-05-07

### Fixed

- Fixed "No server info found" error when running via npx by adding proper serverInfo capability to MCP server
- Added shebang line to make the package executable when installed globally or run via npx
- Improved server configuration to read version from package.json instead of hardcoding it
- Enhanced error handling and logging for package version detection

## [0.1.0] - 2025-05-06

### Added

- Initial release of AgentPM as an MCP server
- Core task management functionality
  - Create, update, and delete tasks
  - Task status tracking
  - Task dependencies management
  - Task expansion into subtasks
- Project brief generation through interactive interview
- Task complexity analysis and expansion recommendations
- MCP tools:
  - `apm_task`: Query tasks in the project
  - `apm_task_modify`: Create, update, and delete tasks and subtasks
  - `apm_task_generate`: Generate individual task files
  - `apm_project_brief_create`: Create a project brief through an interactive interview
  - `apm_project_brief_status`: Check the status of a project brief operation
  - `apm_project_brief_result`: Get the result of a completed project brief operation
  - `apm_dependencies`: Manage task dependencies
  - `apm_complexity`: Analyze task complexity and generate expansion recommendations
- Integration with Claude Sonnet 3.7 for AI-powered task generation
- Optional Perplexity API integration for research-backed results
- Structured markdown output for tasks and project briefs
- Context7 integration for documentation retrieval
- Debug mode with detailed logging
