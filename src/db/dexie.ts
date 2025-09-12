import Dexie from 'dexie';
import { Event } from '../state/store';

class GimmiesDB extends Dexie {
  events!: Dexie.Table<Event, string>;
  constructor() {
    super('gimmies');
    this.version(1).stores({
      events: 'id'
    });
  }
}

export const db = new GimmiesDB();
