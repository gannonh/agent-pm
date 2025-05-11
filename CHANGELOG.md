# Changelog

All notable changes to AgentPM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-05-11

### Changed

- Type System Improvements: Changed import statements to use `type` for type-only imports across multiple files for better clarity and performance
- Code Consistency: Renamed Zod schemas to follow a consistent naming convention (camelCase)
- Build Configuration: Updated `tsconfig.json` to target ES2020 and added additional strict options for improved type safety
- Project Structure: Removed `tsconfig.test.json` file as its configurations are now integrated into the main `tsconfig.json`
- Type Safety: Refactored function signatures to explicitly define return types where applicable
- Error Handling: Implemented improved error handling in AnthropicClient for better reliability
- Documentation: Adjusted various comments and code formatting for consistency and clarity
- chore: bump dependencies to latest versions
  - @anthropic-ai/sdk           0.40.1 -> 0.50.3  
  - @modelcontextprotocol/sdk   1.11.0 -> 1.11.1
  - @types/node                 22.15.9 -> 22.15.17
  - eslint-config-prettier       10.1.2 -> 10.1.5
  - openai                      4.97.0 -> 4.98.0

## [0.1.3] - 2025-05-07

### Fixed

- Path Validation: Added handling for quoted paths in PROJECT_ROOT environment variable. This fixes an issue where paths with special characters (like '+') could be incorrectly encoded, causing "No ready tasks found" errors when the path actually contained quotes.
- Task File Management: Fixed issue with subtask management where task files weren't properly regenerated when removing subtasks. Ensured that all markdown files are deleted and regenerated whenever tasks are modified, preventing orphaned files and ensuring consistency between JSON data and markdown files.

## [0.1.2] - 2025-05-07

### Fixed

- Changed debug environment variable from `DEBUG` to `DEBUG_LOGS` to avoid conflicts with the Anthropic SDK
- Fixed JSON parsing errors in MCP protocol when debug logging is enabled
- Updated all tests to use the new environment variable name

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
