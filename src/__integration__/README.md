# AgentPM Integration Tests

This directory contains integration tests for the AgentPM application. These tests verify that different components of the system work together correctly.

## Test Structure

The integration tests are organized by feature area:

- **file-system**: Tests for file system operations (reading/writing artifacts, backups, etc.)
- **mcp-server**: Tests for MCP server initialization and tool registration
- **project-brief**: Tests for project brief creation and task generation
- **task-management**: Tests for task lifecycle management (create, update, status changes, etc.)
- **helpers**: Shared utilities for integration tests

## Running Integration Tests

To run the integration tests, use the following commands:

```bash
# Run all integration tests
npm run test:integration

# Run integration tests with coverage
npm run test:integration:coverage

# Run integration tests in watch mode
npm run test:integration:watch

# Run a specific integration test file
npx vitest run src/__integration__/file-system/artifacts-file.test.ts --config vitest.integration.config.ts
```

## Test Helpers

The `helpers/test-utils.ts` file provides utilities for setting up integration tests:

- `setupIntegrationTest()`: Sets up test environment hooks (beforeEach/afterEach)
- `createTempTestDir()`: Creates a temporary test directory
- `cleanupTempTestDir()`: Cleans up a temporary test directory
- `createTestProject()`: Creates a basic project structure
- `createSampleTasks()`: Creates sample tasks for testing
- `createSampleProjectBrief()`: Creates a sample project brief
- `createSamplePrd()`: Creates a sample PRD file
- `readArtifactsJson()`: Reads the artifacts.json file

## Best Practices

1. **Isolation**: Each test should run in isolation with its own test directory
2. **Cleanup**: Always clean up temporary files and directories
3. **Mocking**: Mock external services (Anthropic API, etc.) to avoid network calls
4. **Verification**: Verify both the API response and the actual file system state
5. **Timeouts**: Use appropriate timeouts for long-running operations

## Adding New Tests

When adding new integration tests:

1. Create a new test file in the appropriate directory
2. Use the `setupIntegrationTest()` helper to set up the test environment
3. Create any necessary test fixtures
4. Import the modules under test
5. Write tests that verify the end-to-end functionality
6. Clean up any resources created during the test
