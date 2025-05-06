# AgentPM

AgentPM is a planning and orchestration system for AI-driven software development. Installed locally as an MCP server, it integrates with any IDE that supports Anthropic's Model Context Protocol specification, including Cursor, Augment, VS Code Copilot, Cline and Roo.

AgentPM serves the role of product manager, helping developers plan, prioritize, and execute complex projects:

- Develops comprehensive requirements
- Breaks down complex projects into actionable tasks with clear dependencies
- Orchestrates implementation with context-aware assistance
- Delivers relevant documentation and context when needed
- Guides technical decisions and systems design
- Promote software development best practices (TDD, vertical slicing)

<https://github.com/user-attachments/assets/6ddb551c-0c10-4a93-8665-fc5c1e3127c1>

## Why AgentPM?

- **Frictionless Setup**: Get started simply by chatting with your coding agent - no CLIs or complex rules needed.

- **Token/Context Optimization**: Consolidates functionality around a core set of dynamic tools that are contextually economical and easy for coding agents to use and understand.

- **Intelligent Context Management**: Delivers the right information to your coding agent at the right time, optimizing token usage and eliminating the need for manual context handling or "memory banks".

- **Structured Output**: Automatically generates clear, human-readable markdown documents; no need to decipher JSON or plain text files.

- **Integrated Documentation Retrieval**: Automatically retrieve relevant documentation through Context7 integration.

- **Comprehensive Task Management**: Creates well-structured tasks with proper dependencies, priorities, implementation details, and status tracking. Complex work can be broken down into manageable subtasks with clear relationships.

- **Flexible Requirements Process**: Works with or without existing documentation, guiding you through a structured interview when starting from scratch, or easily adapting to an existing project or plan.

- **AI-Powered Generation**: Leverages Claude Sonnet 3.7 for consistent task generation regardless of IDE coding model, with optional Perplexity API integration for research-backed results.

- **Adaptive Project Evolution**: Updates future tasks based on completed work to handle implementation drift, while maintaining living documentation that evolves with your project.

- **Best Practices Built-in**: Incorporates software development best practices with opinionated recommendations that improve code quality.

- **Seamless IDE Integration**: Works directly within your preferred development environment through Model Context Protocol support.

## Getting Started

### Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **Anthropic API Key**: For Claude AI integration
- **Perplexity API Key**: For research-backed task generation

### Installation & Configuration

#### Cursor

Add the following to your project's `.cursor/mcp.json` file (or install globally at `~/.cursor/mcp.json`).

```json
{
    "mcpServers": {
        "agent-pm": {
          "command": "npx",
          "args": [
            "-y",
            "@gannonh/agent-pm@latest"
          ],
          "env": {
            "PROJECT_ROOT": "/path/to/project/root/",
            "ANTHROPIC_API_KEY": "sk-your-anthropic-api-key",
            "PERPLEXITY_API_KEY": "pplx-your-perplexity-api-key",
            "DEBUG": "true"
          }
        }
    }
  }
  ```

#### Augment

Add the following to your VS-Code Augment User Settings file (CMD+SHIFT+P > Augment: Edit Settings > Edit in settings.json): `~/Library/Application Support/Code/User/settings.json`.

```json
"augment.advanced": {

  "mcpServers": [
    {
      "name": "agent-pm",
      "command": "npx",
          "args": [
            "-y",
            "@gannonh/agent-pm@latest"
          ],
          "env": {
            "PROJECT_ROOT": "/path/to/project/root/",
            "ANTHROPIC_API_KEY": "sk-your-anthropic-api-key",
            "PERPLEXITY_API_KEY": "pplx-your-perplexity-api-key",
            "DEBUG": "true"
          }
    },
  ]
}
```

For more information on MCP server configuration, refer to the documentation for your specific IDE:

- [Cursor MCP Server Docs](https://docs.cursor.com/context/model-context-protocol)
- [Augment MCP Server Docs](https://docs.augmentcode.com/setup-augment/mcp)
- [VS Code Copilot MCP Server Docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
- [Cline MCP Server Docs](https://docs.cline.bot/mcp-servers/mcp)

### Environment Variables

> **⚠️ Warning**: Most configuration options have been carefully tuned for optimal results. Unless you have specific requirements, it's recommended to only set the required variables and leave the rest at their default values.

#### Required Variables

| Variable            | Description                       | Default           |
| ------------------- | --------------------------------- | ----------------- |
| `PROJECT_ROOT`      | Path to the project directory     | Current directory |
| `ANTHROPIC_API_KEY` | API key for Claude AI integration | None              |

#### Common Optional Variables

| Variable             | Description                           | Default |
| -------------------- | ------------------------------------- | ------- |
| `PERPLEXITY_API_KEY` | API key for Perplexity AI integration | None    |
| `DEBUG`              | Enable debug mode with file logging   | false   |

#### Advanced Configuration (Not Recommended to Change)

##### Anthropic API Configuration
| Variable                   | Description                       | Default                        |
| -------------------------- | --------------------------------- | ------------------------------ |
| `ANTHROPIC_MODEL`          | Claude model to use               | "claude-3-7-sonnet-20250219"   |
| `ANTHROPIC_TEMPERATURE`    | Temperature for Claude API calls  | 0.2                            |
| `ANTHROPIC_MAX_TOKENS`     | Maximum tokens for Claude API     | 64000                          |
| `ANTHROPIC_MAX_CACHE_SIZE` | Maximum cache size for Claude API | 100                            |
| `ANTHROPIC_CACHE_TTL`      | Cache TTL for Claude API (ms)     | 3600000                        |
| `ANTHROPIC_MAX_RETRIES`    | Maximum retries for Claude API    | 5                              |
| `ANTHROPIC_BASE_URL`       | Base URL for Claude API           | "https://api.anthropic.com"    |
| `ANTHROPIC_SYSTEM_PROMPT`  | System prompt for Claude API      | "You are a helpful assistant." |

##### Perplexity API Configuration
| Variable                    | Description                           | Default                                                                           |
| --------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `PERPLEXITY_MODEL`          | Perplexity model to use               | "sonar-pro"                                                                       |
| `PERPLEXITY_MAX_TOKENS`     | Maximum tokens for Perplexity API     | 1024                                                                              |
| `PERPLEXITY_MAX_CACHE_SIZE` | Maximum cache size for Perplexity API | 100                                                                               |
| `PERPLEXITY_CACHE_TTL`      | Cache TTL for Perplexity API (ms)     | 3600000                                                                           |
| `PERPLEXITY_MAX_RESULTS`    | Maximum results for Perplexity API    | 5                                                                                 |
| `PERPLEXITY_MAX_RETRIES`    | Maximum retries for Perplexity API    | 5                                                                                 |
| `PERPLEXITY_BASE_URL`       | Base URL for Perplexity API           | "https://api.perplexity.ai"                                                       |
| `PERPLEXITY_TEMPERATURE`    | Temperature for Perplexity API calls  | 0.7                                                                               |
| `PERPLEXITY_SYSTEM_PROMPT`  | System prompt for Perplexity API      | "You are a helpful research assistant. Provide factual information with sources." |

##### File and Directory Configuration
| Variable             | Description                | Default            |
| -------------------- | -------------------------- | ------------------ |
| `ARTIFACTS_DIR`      | Directory for artifacts    | "apm-artifacts"    |
| `ARTIFACTS_FILE`     | Filename for artifacts     | "artifacts.json"   |
| `PRODUCT_BRIEF_FILE` | Filename for project brief | "project-brief.md" |

### Debug Mode

Setting `DEBUG=true` enables:

- Detailed logging to files in the `logs` directory
- Log files named with timestamps (e.g., `apm-2025-05-04-18-16.log`)
- Useful for troubleshooting API integrations and complex operations

When `DEBUG=false` (default):
- No log files are created
- Essential messages are still output to stderr
- Improved performance for normal operation

## MCP Tools

### Task Management (apm_task)

**Purpose**: Query tasks in the project.

**Actions**:

- `get_all`: List tasks, optionally filtered by status
- `get_single`: View a specific task by ID
- `get_next`: Find the next task to work on
- `filter_by_status` or `filter_by_priority`: Targeted task lists

<details>
  <summary><strong>Functional Details</strong></summary>

When the `apm_task` tool is called:

1. **Parameter Validation**:
   - Validates the `action` parameter (required, must be one of the valid actions)
   - Validates the `projectRoot` parameter (required, must be an absolute path)
   - Validates action-specific parameters:
     - For `get_single`: Validates the `id` parameter (required, non-empty string)
     - For `filter_by_status`: Validates the `status` parameter (required, must be a valid status)
     - For `filter_by_priority`: Validates the `priority` parameter (required, must be a valid priority)
   - Validates optional parameters: `file`, `withSubtasks`, and `containsText`

2. **Task Retrieval**:
   - Reads the tasks file from the specified location (defaults to `apm-artifacts/artifacts.json` if not provided)
   - Extracts the task list from the file

3. **Action Execution**:
   - Executes the appropriate action based on the `action` parameter:
     - `get_all`: Returns all tasks, optionally filtered by status
     - `get_single`: Returns a specific task by ID
     - `get_next`: Returns the next task to work on based on dependencies and status
     - `filter_by_status`: Returns tasks filtered by status
     - `filter_by_priority`: Returns tasks filtered by priority

4. **Action-Specific Processing**:
   - For `get_all` and `filter_by_status`:
     - Filters tasks by status if specified
     - Handles subtasks based on the `withSubtasks` parameter
     - Calculates summary metrics
   - For `get_single`:
     - Parses the task ID to determine if it's a subtask
     - Finds the specific task or subtask
   - For `get_next`:
     - Filters out completed tasks
     - Applies priority and text filters if specified
     - Checks dependency satisfaction
     - Prioritizes and selects the next task
   - For `filter_by_priority`:
     - Filters tasks by priority
     - Handles subtasks based on the `withSubtasks` parameter
     - Calculates summary metrics

5. **Response Formatting**:
   - Returns a structured JSON response containing:
     - The requested task data
     - Success status and message
     - Contextual information about the query
     - Timestamps and session information

6. **Error Handling**:
   - Handles validation errors (missing required fields, invalid values)
   - Handles file not found errors
   - Handles task not found errors
   - Returns standardized error responses with context information

##### JSON-RPC Request

```json
{
  "method": "apm_task",
  "params": {
    "action": "get_all|get_single|get_next|filter_by_status|filter_by_priority",
    "projectRoot": "/absolute/path/to/project",
    "file": "optional/path/to/artifacts.json",
    "id": "5",  // Required for get_single action
    "status": "pending|in-progress|done|deferred|cancelled",  // For get_all and filter_by_status actions
    "priority": "high|medium|low",  // For get_next and filter_by_priority actions
    "withSubtasks": true|false,
    "containsText": "optional search text"  // For get_next action
  }
}
```

##### JSON-RPC Response

For `get_all` and `filter_by_status` actions:

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          "tasks": [
            {
              "id": "1",
              "title": "Task 1",
              "description": "Description",
              "status": "pending",
              "priority": "high",
              "dependencies": []
            }
          ],
          "stats": {
            "totalTasks": 10,
            "completedTasks": 3,
            "pendingTasks": 5,
            "inProgressTasks": 2,
            "taskCompletionPercentage": 30
          },
          "filter": "pending"
        },
        "message": "Found 5 tasks with status 'pending'",
        "memory": {
          "sessionId": "session-123456",
          "context": {
            "lastQuery": {
              "action": "get_all",
              "status": "pending",
              "withSubtasks": false
            },
            "projectRoot": "/path/to/project",
            "timestamp": "2023-06-15T10:30:00Z"
          }
        }
      }
    }
  ]
}
```

For `get_single` action:

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          "task": {
            "id": "5",
            "title": "Implement Feature",
            "description": "Create the feature",
            "status": "pending",
            "priority": "high",
            "dependencies": ["3", "4"],
            "details": "Implementation details..."
          }
        },
        "message": "Found task: Implement Feature",
        "memory": {
          "sessionId": "session-123456",
          "context": {
            "lastQuery": {
              "action": "get_single",
              "id": "5"
            },
            "projectRoot": "/path/to/project",
            "timestamp": "2023-06-15T10:30:00Z"
          }
        }
      }
    }
  ]
}
```

For `get_next` action:

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          "nextTask": {
            "id": "2",
            "title": "Next Task",
            "description": "Description",
            "status": "pending",
            "priority": "high",
            "dependencies": []
          },
          "allTasks": [
            /* Array of all tasks */
          ]
        },
        "message": "Found next task: Next Task",
        "memory": {
          "sessionId": "session-123456",
          "context": {
            "lastQuery": {
              "action": "get_next",
              "priority": "high",
              "containsText": null
            },
            "taskCount": 10,
            "readyTaskCount": 3,
            "timestamp": "2023-06-15T10:30:00Z"
          }
        }
      }
    }
  ]
}
```

For `filter_by_priority` action:

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          "tasks": [
            {
              "id": "1",
              "title": "Task 1",
              "description": "Description",
              "status": "pending",
              "priority": "high",
              "dependencies": []
            }
          ],
          "stats": {
            "totalTasks": 10,
            "completedTasks": 3,
            "pendingTasks": 5,
            "inProgressTasks": 2,
            "taskCompletionPercentage": 30
          },
          "filter": "high"
        },
        "message": "Found 5 tasks with priority 'high'",
        "memory": {
          "sessionId": "session-123456",
          "context": {
            "lastQuery": {
              "action": "filter_by_priority",
              "priority": "high",
              "withSubtasks": false
            },
            "projectRoot": "/path/to/project",
            "timestamp": "2023-06-15T10:30:00Z"
          }
        }
      }
    }
  ]
}
```

</details>

### Task Creation & Modification (apm_task_modify)

**Purpose**: Create, update, and delete tasks and subtasks

**Actions**:

- `create`: Add a new task
- `update`: Update a task's details
- `update_status`: Change a task's status
- `delete`: Remove a task
- `add_subtask`: Add a subtask to a task
- `remove_subtask`: Remove a subtask from a task
- `clear_subtasks`: Remove all subtasks from a task
- `expand`: Break down a task into subtasks
- `expand_all`: Expand all pending tasks

**Parameters**:

- `action`: The specific action to perform
- `projectRoot`: Root directory of the project
- Action-specific parameters (id, status, data, etc.)

<details>
  <summary><strong>Functional Details</strong></summary>

When the `apm_task_modify` tool is called:

1. **Parameter Validation**:
   - Validates the `action` parameter (required, must be one of the valid actions)
   - Validates the `projectRoot` parameter (required, must be an absolute path)
   - Validates action-specific parameters based on the action being performed
   - Validates optional parameters like `file`

2. **Action Execution**:
   - Executes the appropriate action based on the `action` parameter:
     - `create`: Creates a new task with the specified properties
     - `update`: Updates an existing task with new information
     - `update_status`: Changes the status of one or more tasks
     - `delete`: Removes a task from the project
     - `add_subtask`: Adds a subtask to an existing task
     - `remove_subtask`: Removes a subtask from a task
     - `clear_subtasks`: Removes all subtasks from one or more tasks
     - `expand`: Breaks down a task into subtasks using AI
     - `expand_all`: Expands all pending tasks into subtasks using AI

3. **File Operations**:
   - Reads the tasks file from the specified location (defaults to `apm-artifacts/artifacts.json` if not provided)
   - Updates the tasks data based on the action performed
   - Writes the updated tasks data back to the file
   - Generates individual task files if needed (unless `skipGenerate` is true)

4. **AI Integration** (for certain actions):
   - Uses Claude AI for task expansion and updates
   - Optionally uses Perplexity AI for research-backed operations
   - Generates intelligent subtasks based on task context

5. **Response Formatting**:
   - Returns a structured JSON response containing:
     - Action-specific data (task, subtasks, etc.)
     - Success message
     - User communication guidance
     - Agent instructions for next steps

6. **Error Handling**:
   - Handles validation errors (missing required fields, invalid values)
   - Handles file not found errors
   - Handles task not found errors
   - Handles AI service errors
   - Returns standardized error responses with context information

##### JSON-RPC Request

```json
{
  "method": "apm_task_modify",
  "params": {
    "action": "create|update|update_status|delete|add_subtask|remove_subtask|clear_subtasks|expand|expand_all",
    "projectRoot": "/absolute/path/to/project",
    // Action-specific parameters
    // For create action
    "title": "Task Title",
    "description": "Task Description",
    "priority": "high|medium|low",
    "dependencies": "1,2,3",
    "details": "Implementation details",
    "testStrategy": "Test strategy",
    // For update action
    "id": "1",
    "prompt": "Update information",
    "research": true|false,
    "researchOnly": true|false,
    // For update_status action
    "id": "1",
    "status": "pending|in-progress|done|deferred|cancelled",
    // For delete action
    "id": "1",
    "confirm": true|false,
    // For add_subtask action
    "id": "1",
    "title": "Subtask Title",
    "description": "Subtask Description",
    "details": "Subtask details",
    "dependencies": "1.1,1.2",
    "status": "pending|in-progress|done|deferred|cancelled",
    "taskId": "2", // Existing task ID to convert to subtask
    "skipGenerate": true|false,
    // For remove_subtask action
    "id": "1.1",
    "convert": true|false,
    "skipGenerate": true|false,
    // For clear_subtasks action
    "id": "1", // Can be comma-separated for multiple tasks
    "all": true|false, // Clear subtasks from all tasks
    // For expand action
    "id": "1",
    "num": 3, // Number of subtasks to generate
    "prompt": "Additional context",
    "research": true|false,
    "force": true|false,
    // For expand_all action
    "num": 3,
    "prompt": "Additional context",
    "research": true|false,
    "force": true|false,
    // Common optional parameters
    "file": "optional/path/to/artifacts.json"
  }
}
```

##### JSON-RPC Response

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          // Action-specific response data
          // For create action
          "task": {
            "id": "1",
            "title": "Task Title",
            "description": "Task Description",
            "status": "pending",
            "priority": "high",
            "dependencies": ["1", "2", "3"],
            "details": "Implementation details",
            "testStrategy": "Test strategy"
          },
          // For update action
          "task": {
            "id": "1",
            "title": "Updated Task Title",
            "description": "Updated Task Description",
            "status": "pending",
            "priority": "high",
            "dependencies": ["1", "2", "3"],
            "details": "Updated implementation details",
            "testStrategy": "Updated test strategy"
          },
          // For update_status action
          "updatedTasks": [
            {
              "id": "1",
              "title": "Task Title",
              "status": "done"
            }
          ],
          // For delete action
          "removedTask": {
            "id": "1",
            "title": "Task Title",
            "description": "Task Description",
            "status": "pending",
            "priority": "high",
            "dependencies": [],
            "details": "Implementation details",
            "testStrategy": "Test strategy"
          },
          // For add_subtask action
          "task": {
            "id": "1",
            "title": "Task Title",
            "description": "Task Description",
            "status": "pending",
            "priority": "high",
            "dependencies": [],
            "details": "Implementation details",
            "testStrategy": "Test strategy",
            "subtasks": [
              {
                "id": "1.1",
                "title": "Subtask Title",
                "description": "Subtask Description",
                "status": "pending",
                "details": "Subtask details",
                "dependencies": []
              }
            ]
          },
          // For remove_subtask action
          "task": {
            "id": "1",
            "title": "Task Title",
            "description": "Task Description",
            "status": "pending",
            "priority": "high",
            "dependencies": [],
            "details": "Implementation details",
            "testStrategy": "Test strategy",
            "subtasks": []
          },
          // For clear_subtasks action
          "updatedTasks": [
            {
              "id": "1",
              "title": "Task Title",
              "description": "Task Description",
              "status": "pending",
              "priority": "high",
              "dependencies": [],
              "details": "Implementation details",
              "testStrategy": "Test strategy"
            }
          ],
          // For expand action
          "task": {
            "id": "1",
            "title": "Task Title",
            "description": "Task Description",
            "status": "pending",
            "priority": "high",
            "dependencies": [],
            "details": "Implementation details",
            "testStrategy": "Test strategy",
            "subtasks": [
              {
                "id": "1.1",
                "title": "Generated Subtask 1",
                "description": "Description for Generated Subtask 1",
                "status": "pending",
                "details": "Details for Generated Subtask 1",
                "dependencies": []
              },
              {
                "id": "1.2",
                "title": "Generated Subtask 2",
                "description": "Description for Generated Subtask 2",
                "status": "pending",
                "details": "Details for Generated Subtask 2",
                "dependencies": ["1.1"]
              },
              {
                "id": "1.3",
                "title": "Generated Subtask 3",
                "description": "Description for Generated Subtask 3",
                "status": "pending",
                "details": "Details for Generated Subtask 3",
                "dependencies": ["1.2"]
              }
            ]
          },
          // For expand_all action
          "expandedTasks": [
            {
              "id": "1",
              "title": "Task Title",
              "description": "Task Description",
              "status": "pending",
              "priority": "high",
              "dependencies": [],
              "details": "Implementation details",
              "testStrategy": "Test strategy",
              "subtasks": [
                {
                  "id": "1.1",
                  "title": "Generated Subtask 1",
                  "description": "Description for Generated Subtask 1",
                  "status": "pending",
                  "details": "Details for Generated Subtask 1",
                  "dependencies": []
                },
                {
                  "id": "1.2",
                  "title": "Generated Subtask 2",
                  "description": "Description for Generated Subtask 2",
                  "status": "pending",
                  "details": "Details for Generated Subtask 2",
                  "dependencies": ["1.1"]
                },
                {
                  "id": "1.3",
                  "title": "Generated Subtask 3",
                  "description": "Description for Generated Subtask 3",
                  "status": "pending",
                  "details": "Details for Generated Subtask 3",
                  "dependencies": ["1.2"]
                }
              ]
            }
          ]
        },
        "message": "Action-specific success message",
        "userCommunication": {
          "message": "User-friendly message about the action result"
        },
        "agentInstructions": "Instructions for the AI agent on how to proceed"
      }
    }
  ]
}
```

</details>

### Task File Generation (apm_task_generate)

**Purpose**: Generates individual task files in apm-artifacts/ directory based on artifacts.json.

<details>
  <summary><strong>Functional Details</strong></summary>

When the `apm_task_generate` tool is called:

1. **Parameter Validation**:
   - Validates the `projectRoot` parameter (required, must be an absolute path)
   - Validates optional parameters: `file` and `output`

2. **Task Retrieval**:
   - Reads the tasks file from the specified location (defaults to artifacts.json if not provided)
   - Returns an error if the tasks file is not found or is empty

3. **Directory Preparation**:
   - Ensures the output directory exists (creates it if necessary)
   - Uses the default artifacts directory if no output directory is specified

4. **File Generation Process**:
   - For each task in the tasks data:
     - Generates a markdown file with the task details
     - Includes all task properties (title, description, status, dependencies, etc.)
     - Formats subtasks as nested sections if present
     - Uses a consistent naming convention based on task IDs
   - Creates a well-structured, readable format for each task file

5. **Response Formatting**:
   - Returns a structured JSON response containing:
     - Success status
     - The number of task files generated
     - The path to the artifacts directory
     - The path to the tasks file
     - A success message
     - Context information (timestamp, task count)

6. **Error Handling**:
   - Handles file not found errors
   - Handles directory creation errors
   - Handles file writing errors
   - Returns standardized error responses with context information

##### JSON-RPC Request

```json
{
  "method": "apm_task_generate",
  "params": {
    "projectRoot": "/absolute/path/to/project",
    "file": "optional/path/to/artifacts.json",
    "output": "optional/path/to/output/directory"
  }
}
```

##### JSON-RPC Response

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          "success": true,
          "taskCount": 10,
          "artifactsDir": "/path/to/project/apm-artifacts",
          "tasksPath": "/path/to/project/apm-artifacts/artifacts.json"
        },
        "message": "Generated 10 task files in /path/to/project/apm-artifacts",
        "context": {
          "timestamp": "2023-06-15T10:30:00Z",
          "taskCount": 10
        }
      }
    }
  ]
}
```

</details>

### Project Brief (apm_project_brief_create)

**Purpose**: Create a project brief through an interactive interview process and generate tasks.

- Use `apm_project_brief_status` to check operation progress
- Use `apm_project_brief_result` to retrieve completed briefing

<details>
  <summary><strong>Functional Details</strong></summary>

When the `apm_project_brief_create` tool is called:

1. **Parameter Validation**:
   - Validates the `projectRoot` parameter (required, must be an absolute path)
   - Validates optional parameters: `sessionId`, `input`, `stage`, `response`, `exportFormat`, and `maxTasks`

2. **Session Handling**:
   - If no `sessionId` is provided, starts a new interview session
   - If a `sessionId` is provided, continues an existing interview session
   - Maintains state across multiple interactions

3. **Interview Process**:
   - Guides the user through a structured interview with multiple stages:
     - Project Overview: Basic information about the project's purpose and scope
     - Goals and Stakeholders: Project objectives and involved parties
     - Constraints: Limitations, requirements, and boundaries
     - Technologies: Technical stack and tools
     - Timeline and Phases: Project schedule and major milestones
     - Features: Detailed functionality requirements
     - Review: Final confirmation and adjustments
   - Asks contextually relevant questions based on previous answers
   - Processes user responses to build a comprehensive project brief

4. **Task Generation**:
   - After completing the interview, generates tasks based on the project brief
   - Creates a structured task hierarchy with proper dependencies
   - Organizes tasks by phases and features
   - Limits the number of tasks based on the `maxTasks` parameter
   - Saves tasks to the artifacts.json file

5. **Response Formatting**:
   - For new sessions: Returns an operation ID for tracking the interview process
   - For continuing sessions: Returns the next question or confirmation of task generation
   - Includes user communication guidance with suggested responses
   - Provides clear next steps and commands

6. **Error Handling**:
   - Handles validation errors
   - Handles file not found errors
   - Handles interview processing errors
   - Returns standardized error responses with context information

### JSON-RPC Request

```json
{
  "method": "apm_project_brief_create",
  "params": {
    "projectRoot": "/absolute/path/to/project",
    "sessionId": "optional-session-id-for-continuing-interviews",
    "input": "optional/path/to/existing/brief.json",
    "stage": "project_overview|goals_and_stakeholders|constraints|technologies|timeline_and_phases|features|review",
    "response": "Your answer to the current interview question",
    "exportFormat": "json|markdown|text",
    "maxTasks": 10
  }
}
```

### JSON-RPC Response

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "operationId": "project-brief-123456",
        "message": "Project brief interview started",
        "nextAction": "check_operation_status",
        "checkStatusCommand": "apm_project_brief_status --operationId=project-brief-123456",
        "metadata": {
          "userCommunication": {
            "message": "I'm starting the project brief interview process.",
            "expectationType": "immediate",
            "suggestedResponse": "I'll start the project brief interview process. I'll ask you a series of questions to gather information about your project. Let's begin with understanding your project overview."
          }
        }
      }
    }
  ]
}
```

</details>

### apm_project_brief_status

**Purpose**: Get the status of a project brief interview operation.

<details>
  <summary><strong>Functional Details</strong></summary>

When the `apm_project_brief_status` tool is called:

1. **Parameter Validation**:
   - Validates the `projectRoot` parameter (required, must be an absolute path)
   - Validates the `operationId` parameter (required, non-empty string)

2. **Status Retrieval**:
   - Gets the operation status from the AsyncOperationManager
   - Returns an error if the operation is not found
   - Provides detailed information about the current state of the operation

3. **Progress Reporting**:
   - Returns the current progress percentage (0-100)
   - Provides a descriptive message about the current stage
   - Includes timestamps for creation, updates, and completion (if applicable)

4. **User Communication Guidance**:
   - For running operations, provides suggested responses to keep users informed
   - For completed operations, suggests next steps
   - For failed operations, explains what went wrong and how to proceed

5. **Response Formatting**:
   - Returns a structured JSON response containing:
     - Operation ID
     - Current status (pending, running, completed, failed)
     - Progress percentage
     - Status message
     - Timestamps (created, updated, completed)
     - User communication guidance

6. **Error Handling**:
   - Handles cases where the operation is not found
   - Handles internal errors during status retrieval
   - Returns standardized error responses with context information

##### JSON-RPC Request

```json
{
  "method": "apm_project_brief_status",
  "params": {
    "projectRoot": "/absolute/path/to/project",
    "operationId": "project-brief-123456"
  }
}
```

##### JSON-RPC Response

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "operationId": "project-brief-123456",
        "status": "running",
        "progress": 65,
        "message": "Generating tasks",
        "createdAt": "2023-06-15T10:30:00Z",
        "updatedAt": "2023-06-15T10:30:05Z",
        "completedAt": null,
        "metadata": {
          "operationType": "task-generation",
          "userCommunication": {
            "message": "Task generation is in progress.",
            "expectationType": "long_wait",
            "estimatedTimeSeconds": 180,
            "suggestedResponse": "The task generation is in progress (65% complete).\n\nWhile we wait, here's what's happening behind the scenes:\n- The AI is analyzing your project requirements\n- It's identifying key components, features, and dependencies\n- It will create a structured task breakdown with proper sequencing\n- Tasks will be saved to the apm-artifacts directory, along with an overall project brief.\n\nYou can ask me to \"check status\" anytime if you'd like an update, or we can discuss other aspects of your project while we wait."
          }
        }
      }
    }
  ]
}
```

</details>

### apm_project_brief_result

**Purpose**: Get the result of a completed project brief interview operation.

<details>
  <summary><strong>Functional Details</strong></summary>

When the `apm_project_brief_result` tool is called:

1. **Parameter Validation**:
   - Validates the `projectRoot` parameter (required, must be an absolute path)
   - Validates the `operationId` parameter (required, non-empty string)

2. **Result Retrieval**:
   - Gets the operation result from the AsyncOperationManager
   - Returns an error if the result is not available (operation not completed or not found)
   - Returns an error if the operation failed

3. **Result Processing**:
   - Extracts the generated tasks from the operation result
   - Includes file paths to the saved artifacts
   - Provides session information for potential follow-up actions
   - Suggests next steps for the user

4. **Response Formatting**:
   - Returns a structured JSON response containing:
     - Operation ID and status
     - Generated tasks with titles, descriptions, priorities, and details
     - File paths to the saved artifacts (artifacts.json, project brief markdown)
     - Session information (sessionId, projectBriefUri, interviewStateUri)
     - Next action suggestion and command
     - User communication guidance

5. **Error Handling**:
   - Handles cases where the operation is not found
   - Handles cases where the operation is still running
   - Handles cases where the operation failed
   - Returns standardized error responses with context information

6. **User Guidance**:
   - Provides clear next steps for the user
   - Suggests commands for viewing and managing the generated tasks
   - Includes user-friendly messages explaining the results

##### JSON-RPC Request

```json
{
  "method": "apm_project_brief_result",
  "params": {
    "projectRoot": "/absolute/path/to/project",
    "operationId": "project-brief-123456"
  }
}
```

##### JSON-RPC Response

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "operationId": "project-brief-123456",
        "status": "completed",
        "message": "Task generation completed successfully",
        "tasks": [
          {
            "id": "1",
            "title": "Set up project infrastructure",
            "description": "Initialize the project repository and set up basic infrastructure",
            "status": "pending",
            "priority": "high",
            "dependencies": [],
            "details": "Create the repository, set up CI/CD, and configure development environment"
          }
        ],
        "tasksPath": "/path/to/project/apm-artifacts/artifacts.json",
        "markdownPath": "/path/to/project/apm-artifacts/project-brief.md",
        "sessionId": "session-123456",
        "projectBriefUri": "resource://project-brief-123456",
        "interviewStateUri": "resource://interview-state-123456",
        "nextAction": "view_tasks",
        "suggestedCommand": "apm_get_tasks",
        "userCommunication": {
          "message": "I've successfully generated tasks based on your project brief. You can now view and manage these tasks using the task management tools.",
          "expectationType": "immediate",
          "suggestedResponse": "Great! I've generated a set of tasks based on your project requirements. These tasks have been saved to your project directory and are ready for you to work on. You can view them using the 'apm_get_tasks' command. Would you like to see the tasks now?"
        }
      }
    }
  ]
}
```

</details>

### Dependency Management (apm_dependencies)

**Purpose**: Manage task dependencies

**Actions**:

- `add`: Add a dependency between tasks
- `remove`: Remove a dependency between tasks
- `validate`: Check for dependency issues
- `fix`: Automatically fix dependency issues

**Parameters**:

- `action`: The specific action to perform
- `projectRoot`: Root directory of the project
- Action-specific parameters (id, dependsOn, etc.)

<details>
  <summary><strong>Functional Details</strong></summary>

When the `apm_dependencies` tool is called:

1. **Parameter Validation**:
   - Validates the `action` parameter (required, must be one of the valid actions)
   - Validates the `projectRoot` parameter (required, must be an absolute path)
   - Validates action-specific parameters:
     - For `add` and `remove`: Validates the `id` and `dependsOn` parameters (required, non-empty strings)
   - Validates optional parameters: `file`

2. **Task Retrieval**:
   - Reads the tasks file from the specified location (defaults to `apm-artifacts/artifacts.json` if not provided)
   - Extracts the task list from the file

3. **Action Execution**:
   - Executes the appropriate action based on the `action` parameter:
     - `add`: Adds a dependency between two tasks
     - `remove`: Removes a dependency between two tasks
     - `validate`: Checks for dependency issues (circular references, missing dependencies)
     - `fix`: Automatically fixes dependency issues

4. **Action-Specific Processing**:
   - For `add`:
     - Finds the task that will depend on another
     - Finds the task that will be depended on
     - Checks if the dependency already exists
     - Adds the dependency if it doesn't exist
     - Validates dependencies to ensure no circular references
   - For `remove`:
     - Finds the task that depends on another
     - Checks if the dependency exists
     - Removes the dependency if it exists
   - For `validate`:
     - Checks for circular dependencies
     - Checks for missing dependencies
     - Returns validation results
   - For `fix`:
     - Fixes missing dependencies by removing them
     - Fixes circular dependencies by breaking cycles
     - Returns fix results

5. **File Operations**:
   - Updates the tasks data in memory
   - Writes the updated tasks back to the file
   - Generates individual task files

6. **Response Formatting**:
   - Returns a structured JSON response containing:
     - Action-specific data (task, dependency task, validation results, fix results)
     - Success status and message
     - Contextual information about the operation
     - Timestamps and session information

7. **Error Handling**:
   - Handles validation errors (missing required fields, invalid values)
   - Handles file not found errors
   - Handles task not found errors
   - Handles circular dependency errors
   - Returns standardized error responses with context information

##### JSON-RPC Request

```json
{
  "method": "apm_dependencies",
  "params": {
    "action": "add|remove|validate|fix",
    "projectRoot": "/absolute/path/to/project",
    // Action-specific parameters
    // For add and remove actions
    "id": "1",
    "dependsOn": "2",
    // Common optional parameters
    "file": "optional/path/to/artifacts.json"
  }
}
```

##### JSON-RPC Response

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          // Action-specific response data
          // For add action
          "task": {
            "id": "1",
            "title": "Task 1",
            "description": "Description for Task 1",
            "status": "pending",
            "priority": "high",
            "dependencies": ["2"]
          },
          "dependencyTask": {
            "id": "2",
            "title": "Task 2",
            "description": "Description for Task 2",
            "status": "pending",
            "priority": "medium",
            "dependencies": []
          },
          "tasksPath": "/path/to/project/apm-artifacts/artifacts.json"
        },
        "message": "Added dependency: Task 1 now depends on task 2",
        "memory": {
          "sessionId": "session-123456",
          "context": {
            "taskId": "1",
            "dependsOn": "2",
            "timestamp": "2023-06-15T10:30:00Z"
          }
        }
      }
    }
  ]
}
```

For `validate` action:

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          "validationResults": {
            "circularDependencies": [
              {
                "taskId": "1",
                "path": ["1", "3", "2", "1"]
              }
            ],
            "missingDependencies": [
              {
                "taskId": "4",
                "missingDependencies": ["999"]
              }
            ],
            "valid": false
          },
          "tasksPath": "/path/to/project/apm-artifacts/artifacts.json"
        },
        "message": "Dependency issues detected",
        "memory": {
          "sessionId": "session-123456",
          "context": {
            "timestamp": "2023-06-15T10:30:00Z",
            "validationResults": {
              "circularDependencies": [
                {
                  "taskId": "1",
                  "path": ["1", "3", "2", "1"]
                }
              ],
              "missingDependencies": [
                {
                  "taskId": "4",
                  "missingDependencies": ["999"]
                }
              ],
              "valid": false
            }
          }
        }
      }
    }
  ]
}
```

For `fix` action:

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          "fixResults": {
            "circularDependenciesFixed": [
              {
                "taskId": "2",
                "removedDependencies": ["1"]
              }
            ],
            "missingDependenciesFixed": [
              {
                "taskId": "4",
                "removedDependencies": ["999"]
              }
            ],
            "fixesApplied": true
          },
          "tasksPath": "/path/to/project/apm-artifacts/artifacts.json"
        },
        "message": "Dependency issues fixed",
        "memory": {
          "sessionId": "session-123456",
          "context": {
            "timestamp": "2023-06-15T10:30:00Z",
            "fixResults": {
              "circularDependenciesFixed": [
                {
                  "taskId": "2",
                  "removedDependencies": ["1"]
                }
              ],
              "missingDependenciesFixed": [
                {
                  "taskId": "4",
                  "removedDependencies": ["999"]
                }
              ],
              "fixesApplied": true
            }
          }
        }
      }
    }
  ]
}
```

</details>

### Complexity Analysis (apm_complexity)

**Purpose**: Analyze task complexity, generate expansion recommendations, and create reports in a single operation.

<details>
  <summary><strong>Functional Details</strong></summary>

When the `apm_complexity_node` tool is called:

1. **Parameter Validation**:
   - Validates the `projectRoot` parameter (required, must be an absolute path)
   - Validates optional parameters: `file`, `output`, `markdownOutput`, `threshold`, `model`, and `research`
   - Applies default values for optional parameters:
     - `output`: "apm-artifacts/resources/reports/task-complexity-report.json"
     - `markdownOutput`: "apm-artifacts/resources/reports/task-complexity-report.md"
     - `threshold`: 5 (tasks with complexity ≥ 5 will be recommended for expansion)
     - `research`: false (whether to use Perplexity AI for research-backed analysis)

2. **Task Retrieval**:
   - Reads the tasks file from the specified location (defaults to artifacts.json if not provided)
   - Extracts the task list from the file
   - Filters tasks to only include those that are not 'done' and not 'cancelled'
   - Skips tasks that already have subtasks (as they've already been broken down)

3. **Task Analysis Process**:
   - For each task:
     - Calculates basic complexity factors:
       - Description length (0-0.2 points)
       - Details length (0-0.2 points)
       - Dependency count (0-0.2 points)
       - Priority factor (high: 0.2, medium: 0.1, low: 0 points)
       - Technical terms count (0-0.2 points)
     - If research is enabled, it enhances analysis with Perplexity AI
     - Uses Claude AI to analyze complexity on a scale of 1-10
     - Recommends a number of subtasks based on complexity
     - Generates expansion prompts and commands

4. **Report Generation**:
   - Creates a complexity report with:
     - Task-specific analysis (ID, title, complexity score, recommended subtasks)
     - Expansion prompts for breaking down complex tasks
     - Commands to execute for task expansion
     - Metadata (generation timestamp, threshold, task counts, average complexity)
   - Ensures the output directories exist
   - Writes the JSON report to the specified output path
   - Formats the report into a readable markdown document
   - Writes the markdown report to the specified markdown output path

5. **Response Formatting**:
   - Returns a structured JSON response containing:
     - The complete complexity report data
     - The formatted report as a markdown string
     - Output file paths for both JSON and markdown reports
     - Task analysis statistics (tasks analyzed, complex tasks found)
     - User communication guidance
     - Agent instructions for next steps

6. **Error Handling**:
   - Handles file not found errors
   - Handles directory creation errors
   - Handles file writing errors
   - Returns standardized error responses with context information

##### JSON-RPC Request

```json
{
  "method": "apm_complexity_node",
  "params": {
    "projectRoot": "/absolute/path/to/project",
    "file": "optional/path/to/artifacts.json",
    "output": "apm-artifacts/resources/reports/task-complexity-report.json",
    "markdownOutput": "apm-artifacts/resources/reports/task-complexity-report.md",
    "threshold": 5,
    "model": "optional-model-name",
    "research": false
  }
}
```

##### JSON-RPC Response

```json
{
  "content": [
    {
      "type": "text",
      "text": {
        "success": true,
        "data": {
          "report": {
            "tasks": [
              {
                "taskId": "15",
                "title": "Implement GraphQL API Integration",
                "complexity": 8,
                "recommendedSubtasks": 6,
                "expansionPrompt": "Break down the implementation...",
                "expansionCommand": "apm_task_modify_node --action=expand --id=15 --num=6"
              }
            ],
            "metadata": {
              "generated": "2025-04-24T14:40:04.508Z",
              "threshold": 5,
              "totalTasks": 4,
              "averageComplexity": 7
            }
          },
          "formattedReport": "# Task Complexity Analysis Report\n\n## Report Summary\n\n- **Generated:** 4/24/2025, 7:40:04 AM\n- **Complexity Threshold:** 5\n- **Total Tasks Analyzed:** 4\n- **Average Complexity:** 7.0\n\n## Task Analysis\n\n### 🔴 Task 15: Implement GraphQL API Integration\n\n- **Complexity Score:** **8/10 ⚠️\n- **Recommended Subtasks:** 6\n- **Action Required:** This task should be broken down into subtasks\n- **Expansion Command:** `apm_task_modify_node --action=expand --id=15 --num=6`\n\n**Expansion Guidance:**\nBreak down the implementation of the GraphQL API integration...\n\n---\n\n## Recommendations\n\nThe following tasks should be prioritized for breakdown:\n\n- Task 15: Implement GraphQL API Integration (Complexity: 8/10)\n",
          "jsonOutputPath": "/path/to/project/apm-artifacts/resources/reports/task-complexity-report.json",
          "markdownOutputPath": "/path/to/project/apm-artifacts/resources/reports/task-complexity-report.md",
          "tasksAnalyzed": 4,
          "complexTasks": 1
        },
        "message": "Analyzed 4 tasks and identified 1 complex task that should be broken down.",
        "userCommunication": {
          "message": "I've analyzed your project tasks and identified which ones might benefit from being broken down into subtasks. Here's the complexity report:\n\n# Task Complexity Analysis Report\n\n...",
          "expectationType": "immediate"
        },
        "agentInstructions": "The complexity analysis is complete. The report has been formatted for display and saved as both JSON and Markdown. You can suggest using 'apm_task_modify_node' with the 'expand' action for tasks with high complexity scores."
      }
    }
  ]
}
```

</details>
