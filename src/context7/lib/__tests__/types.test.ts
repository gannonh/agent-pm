import { describe, it, expect } from 'vitest';
import * as types from '../types.js';

describe('Context7 Types', () => {
  it('should export the expected types', () => {
    // Verify that the types module exports the expected types
    expect(types).toBeDefined();

    // We can't directly test TypeScript types at runtime since they're erased during compilation
    // Instead, we'll verify we can use the types correctly

    // Create a valid SearchResult object to verify the type structure
    const searchResult: types.SearchResult = {
      id: 'test/id',
      title: 'Test Library',
      description: 'Test Description',
      branch: 'main',
      lastUpdate: '2023-01-01',
      state: 'finalized' as types.DocumentState,
      totalTokens: 1000,
      totalSnippets: 10,
      totalPages: 5,
    };

    expect(searchResult.id).toBe('test/id');
    expect(searchResult.title).toBe('Test Library');

    // Create a valid SearchResponse object
    const searchResponse: types.SearchResponse = {
      results: [searchResult],
    };

    expect(searchResponse.results).toHaveLength(1);
    expect(searchResponse.results[0].id).toBe('test/id');

    // Verify DocumentState type can be used
    const validStates: types.DocumentState[] = [
      'initial',
      'parsed',
      'finalized',
      'invalid_docs',
      'error',
      'stop',
      'delete',
    ];

    expect(validStates).toContain(searchResult.state);
  });
});
