import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateClient } from 'aws-amplify/data';
import { useCourses } from '../src/hooks/useCourses';

vi.mock('aws-amplify/data', () => ({
  generateClient: vi.fn(),
}));

describe('useCourses', () => {
  const mockList = vi.fn();

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CLOUD_SYNC', 'true');
    mockList.mockReset();
    vi.mocked(generateClient).mockReturnValue({
      models: {
        Course: {
          list: mockList,
        },
      },
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to local courses when cloud query returns errors', async () => {
    mockList.mockResolvedValue({
      data: [],
      errors: [{ message: 'Unauthorized' }],
    });

    const { result } = renderHook(() => useCourses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Cloud courses unavailable; using local course list');
    expect(result.current.courses.length).toBeGreaterThan(0);
    expect(result.current.courses.some((course) => course.name === 'Davenport Country Club')).toBe(true);
  });
});
