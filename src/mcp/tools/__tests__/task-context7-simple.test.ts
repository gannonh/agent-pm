import { describe, it, expect, vi } from 'vitest';

// Import the functions directly
import { handleGetSingle, handleGetNext } from '../task.js';

// Mock the create_success_payload function
vi.mock('../../utils/response.js', () => ({
  create_success_payload: vi.fn((data, message, options) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ data, message, options }),
      },
    ],
  })),
}));

describe('Task Tool Context7 Integration', () => {
  it('should include Context7 instructions in get_single response', async () => {
    // Create a mock task
    const mockTask = {
      id: '1',
      title: 'Test Task',
      description: 'A test task',
      status: 'pending',
      priority: 'medium',
      dependencies: [],
    };

    // Call handleGetSingle directly
    const result = await handleGetSingle({ id: '1' }, [mockTask], '/mock/project');

    // Extract the response data
    const responseText = result.content[0].text;
    const responseData = JSON.parse(responseText);

    // Verify that the agent instructions include Context7 tools
    expect(responseData.options.agentInstructions).toContain('context7_library_id');
    expect(responseData.options.agentInstructions).toContain('context7_library_docs');
  });

  it('should include Context7 instructions in get_next response', async () => {
    // Create a mock task
    const mockTask = {
      id: '1',
      title: 'Test Task',
      description: 'A test task',
      status: 'pending',
      priority: 'medium',
      dependencies: [],
    };

    // Call handleGetNext directly
    const result = await handleGetNext({}, [mockTask], '/mock/project');

    // Extract the response data
    const responseText = result.content[0].text;
    const responseData = JSON.parse(responseText);

    // Verify that the agent instructions include Context7 tools
    expect(responseData.options.agentInstructions).toContain('context7_library_id');
    expect(responseData.options.agentInstructions).toContain('context7_library_docs');

    // Verify that the agent instructions also include marking the task as in-progress
    expect(responseData.options.agentInstructions).toContain('mark the task as "in-progress"');
  });
});
