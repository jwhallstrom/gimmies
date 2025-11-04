// IndexedDB-backed storage for Zustand persist, using idb-keyval
import { get, set, del, createStore } from 'idb-keyval';

// Create a dedicated store to avoid collisions
const store = createStore('gimmies-idb', 'zustand-state');

type StorageLike = {
  getItem: (name: string) => Promise<string | null> | string | null;
  setItem: (name: string, value: string) => Promise<void> | void;
  removeItem: (name: string) => Promise<void> | void;
};

export const idbStorage: StorageLike = {
  async getItem(name: string) {
    const value = await get<string | null>(name, store);
    return value ?? null;
  },
  async setItem(name: string, value: string) {
    await set(name, value, store);
  },
  async removeItem(name: string) {
    await del(name, store);
  }
};

