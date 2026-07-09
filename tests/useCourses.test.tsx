import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateClient } from 'aws-amplify/data';
import { useCourses } from '../src/hooks/useCourses';
import { courses as localCourses } from '../src/data/courses';

vi.mock('aws-amplify/data', () => ({
  generateClient: vi.fn(),
}));

describe('useCourses', () => {
  const mockList = vi.fn();
  const expectedLocalCourseIds = localCourses.map((course) => course.id);

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
    expect(result.current.courses).toHaveLength(localCourses.length);
    expect(result.current.courses.map((course) => course.courseId)).toEqual(expectedLocalCourseIds);
  });

  it('falls back to local courses when cloud query returns no courses', async () => {
    mockList.mockResolvedValue({
      data: [],
    });

    const { result } = renderHook(() => useCourses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Cloud courses unavailable; using local course list');
    expect(result.current.courses).toHaveLength(localCourses.length);
    expect(result.current.courses.map((course) => course.courseId)).toEqual(expectedLocalCourseIds);
  });
});
