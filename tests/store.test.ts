import { describe, it, expect } from 'vitest';
import { useStore } from '../src/state/store';

describe('store', () => {
  it('creates event', () => {
    useStore.getState().createEvent();
    const events = useStore.getState().events;
    expect(events.length).toBe(1);
  });
});
