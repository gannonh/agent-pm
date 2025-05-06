import { describe, it, expect } from 'vitest';
import { AsyncOperationStatus, mapToCoreStatus, mapFromCoreStatus } from '../types.js';

describe('Async Types', () => {
  describe('AsyncOperationStatus', () => {
    it('should have the correct values', () => {
      expect(AsyncOperationStatus.NOT_STARTED).toBe('pending');
      expect(AsyncOperationStatus.IN_PROGRESS).toBe('running');
      expect(AsyncOperationStatus.COMPLETED).toBe('completed');
      expect(AsyncOperationStatus.FAILED).toBe('failed');
      expect(AsyncOperationStatus.CANCELLED).toBe('cancelled');
      expect(AsyncOperationStatus.NOT_FOUND).toBe('not_found');
    });
  });

  describe('mapToCoreStatus', () => {
    it('should map NOT_STARTED to pending', () => {
      expect(mapToCoreStatus(AsyncOperationStatus.NOT_STARTED)).toBe('pending');
    });

    it('should map IN_PROGRESS to running', () => {
      expect(mapToCoreStatus(AsyncOperationStatus.IN_PROGRESS)).toBe('running');
    });

    it('should map COMPLETED to completed', () => {
      expect(mapToCoreStatus(AsyncOperationStatus.COMPLETED)).toBe('completed');
    });

    it('should map FAILED to failed', () => {
      expect(mapToCoreStatus(AsyncOperationStatus.FAILED)).toBe('failed');
    });

    it('should map CANCELLED to cancelled', () => {
      expect(mapToCoreStatus(AsyncOperationStatus.CANCELLED)).toBe('cancelled');
    });

    it('should map NOT_FOUND to not_found', () => {
      expect(mapToCoreStatus(AsyncOperationStatus.NOT_FOUND)).toBe('not_found');
    });

    it('should default to pending for unknown status', () => {
      expect(mapToCoreStatus('unknown' as AsyncOperationStatus)).toBe('pending');
    });
  });

  describe('mapFromCoreStatus', () => {
    it('should map pending to NOT_STARTED', () => {
      expect(mapFromCoreStatus('pending')).toBe(AsyncOperationStatus.NOT_STARTED);
    });

    it('should map running to IN_PROGRESS', () => {
      expect(mapFromCoreStatus('running')).toBe(AsyncOperationStatus.IN_PROGRESS);
    });

    it('should map completed to COMPLETED', () => {
      expect(mapFromCoreStatus('completed')).toBe(AsyncOperationStatus.COMPLETED);
    });

    it('should map failed to FAILED', () => {
      expect(mapFromCoreStatus('failed')).toBe(AsyncOperationStatus.FAILED);
    });

    it('should map cancelled to CANCELLED', () => {
      expect(mapFromCoreStatus('cancelled')).toBe(AsyncOperationStatus.CANCELLED);
    });

    it('should map not_found to NOT_FOUND', () => {
      expect(mapFromCoreStatus('not_found')).toBe(AsyncOperationStatus.NOT_FOUND);
    });

    it('should default to NOT_STARTED for unknown status', () => {
      // Using a non-standard status string to test the default case
      expect(mapFromCoreStatus('unknown' as unknown as AsyncOperationStatus)).toBe(
        AsyncOperationStatus.NOT_STARTED
      );
    });
  });
});
