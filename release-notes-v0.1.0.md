# AgentPM v0.1.0 Release Notes

We're excited to announce the initial release of AgentPM, a planning and orchestration system for AI-driven software development. This release establishes the foundation for seamless integration with AI coding assistants through the Model Context Protocol (MCP).

## Overview

AgentPM serves as a product manager for your development workflow, helping you plan, prioritize, and execute complex projects. It integrates with any IDE that supports Anthropic's Model Context Protocol specification, including Cursor, Augment, VS Code Copilot, Cline, and Roo.

## Key Features

### Core Functionality

- **MCP Server Integration**: Seamlessly works with AI coding assistants through the Model Context Protocol
- **Comprehensive Task Management**: Create, update, and track tasks with proper dependencies, priorities, and status
- **Project Brief Generation**: Interactive interview process to develop comprehensive project requirements
- **Task Expansion**: Break down complex tasks into manageable subtasks with AI assistance
- **Dependency Management**: Add, remove, validate, and fix task dependencies
- **Complexity Analysis**: Analyze task complexity and generate expansion recommendations

### User Experience

- **Frictionless Setup**: Get started simply by chatting with your coding agent - no CLIs or complex rules needed
- **Token/Context Optimization**: Consolidates functionality around a core set of dynamic tools that are contextually economical
- **Intelligent Context Management**: Delivers the right information to your coding agent at the right time
- **Structured Output**: Automatically generates clear, human-readable markdown documents
- **Integrated Documentation Retrieval**: Automatically retrieve relevant documentation through Context7 integration

### AI Integration

- **Claude Sonnet 3.7 Integration**: Leverages Claude for consistent task generation regardless of IDE coding model
- **Optional Perplexity API Integration**: Research-backed task generation and updates
- **Adaptive Project Evolution**: Updates future tasks based on completed work to handle implementation drift

## MCP Tools

This release includes the following MCP tools:

- **apm_task**: Query tasks in the project (get_all, get_single, get_next, filter_by_status, filter_by_priority)
- **apm_task_modify**: Create, update, and delete tasks and subtasks
- **apm_task_generate**: Generate individual task files from artifacts.json
- **apm_project_brief_create**: Create a project brief through an interactive interview process
- **apm_project_brief_status**: Check the status of a project brief operation
- **apm_project_brief_result**: Get the result of a completed project brief operation
- **apm_dependencies**: Manage task dependencies (add, remove, validate, fix)
- **apm_complexity**: Analyze task complexity and generate expansion recommendations

## Getting Started

### Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **Anthropic API Key**: For Claude AI integration
- **Perplexity API Key** (optional): For research-backed task generation

### Installation

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

Add the following to your VS-Code Augment User Settings file:

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

## What's Next

- GitHub Issues integration
- Linear Integration

## Feedback and Contributions

We welcome your feedback and contributionsr. Please open issues on GitHub for bug reports or feature requests.