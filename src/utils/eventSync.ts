/**
 * Event Cloud Sync Utilities
 * Handles saving/loading events to/from AWS Amplify DynamoDB
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { Event, ChatMessage } from '../state/store';

const CLOUD_CHAT_PAYLOAD_PREFIX = '__GIMMIES_CHAT_V1__';

let cachedClient: ReturnType<typeof generateClient<Schema>> | null = null;
function getClient() {
  if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return null;
  if (cachedClient) return cachedClient;
  try {
    cachedClient = generateClient<Schema>();
    return cachedClient;
  } catch (e) {
    console.warn('❌ Amplify client unavailable (local/offline mode)', e);
    return null;
  }
}

function serializeCloudChatPayload(message: ChatMessage): string {
  const payload = {
    text: message.text,
    type: message.type,
    replyTo: message.replyTo,
    reactions: message.reactions,
    metadata: message.metadata,
    pollQuestion: message.pollQuestion,
    pollOptions: message.pollOptions,
    pollClosed: message.pollClosed,
    editedAt: message.editedAt,
    isDeleted: message.isDeleted,
  };
  return `${CLOUD_CHAT_PAYLOAD_PREFIX}${JSON.stringify(payload)}`;
}

function deserializeCloudChatPayload(rawText: string): Partial<ChatMessage> {
  if (!rawText || !rawText.startsWith(CLOUD_CHAT_PAYLOAD_PREFIX)) {
    return { text: rawText || '' };
  }

  try {
    const json = rawText.slice(CLOUD_CHAT_PAYLOAD_PREFIX.length);
    const parsed = JSON.parse(json);
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      type: parsed.type,
      replyTo: parsed.replyTo,
      reactions: parsed.reactions,
      metadata: parsed.metadata,
      pollQuestion: parsed.pollQuestion,
      pollOptions: parsed.pollOptions,
      pollClosed: parsed.pollClosed,
      editedAt: parsed.editedAt,
      isDeleted: parsed.isDeleted,
    };
  } catch (error) {
    console.warn('⚠️ Failed to parse cloud chat payload, falling back to raw text', error);
    return { text: rawText };
  }
}

function mapCloudChatMessage(cloudMessage: any): ChatMessage | null {
  if (!cloudMessage?.id || !cloudMessage?.profileId || !cloudMessage?.createdAt) {
    return null;
  }

  const decoded = deserializeCloudChatPayload(cloudMessage.text || '');
  return {
    id: cloudMessage.id,
    profileId: cloudMessage.profileId,
    senderName: cloudMessage.senderName || cloudMessage.profileId,
    text: decoded.text || '',
    createdAt: cloudMessage.createdAt,
    type: decoded.type,
    replyTo: decoded.replyTo,
    reactions: decoded.reactions,
    metadata: decoded.metadata,
    pollQuestion: decoded.pollQuestion,
    pollOptions: decoded.pollOptions,
    pollClosed: decoded.pollClosed,
    editedAt: decoded.editedAt,
    isDeleted: decoded.isDeleted,
  } as ChatMessage;
}

function mapCloudChatMessages(messages: any[]): ChatMessage[] {
  return (messages || [])
    .map((message) => mapCloudChatMessage(message))
    .filter((message): message is ChatMessage => Boolean(message))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as T;
      return (parsed == null ? fallback : parsed);
    } catch {
      return fallback;
    }
  }
  return ((value as T) == null ? fallback : (value as T));
}

function asObjectArray(value: unknown): any[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
}

function normalizeCloudEventRecord(cloudEvent: any): Event | null {
  if (!cloudEvent || typeof cloudEvent !== 'object' || !cloudEvent.id) return null;
  const golfers = asObjectArray(parseJsonField<any[]>(cloudEvent.golfersJson, []));
  const groups = asObjectArray(parseJsonField<any[]>(cloudEvent.groupsJson, []));
  const scorecards = asObjectArray(parseJsonField<any[]>(cloudEvent.scorecardsJson, []));

  return {
    id: cloudEvent.id,
    name: cloudEvent.name,
    date: cloudEvent.date,
    course: {
      courseId: cloudEvent.courseId || undefined,
      teeName: cloudEvent.teeName || undefined,
    },
    ownerProfileId: cloudEvent.ownerProfileId,
    isPublic: cloudEvent.isPublic || false,
    isCompleted: cloudEvent.isCompleted || false,
    shareCode: cloudEvent.shareCode || undefined,
    scorecardView: cloudEvent.scorecardView as any || 'individual',
    status: (cloudEvent as any).status as 'setup' | 'started' | 'completed' | undefined,
    hubType: normalizeHubType(cloudEvent),
    parentGroupId: (cloudEvent as any).parentGroupId || undefined,
    golfers,
    groups,
    scorecards,
    games: parseJsonField<any>(cloudEvent.gamesJson, {}),
    pinkyResults: parseJsonField<any>(cloudEvent.pinkyResultsJson, {}),
    greenieResults: parseJsonField<any>(cloudEvent.greenieResultsJson, {}),
    groupSettings: parseJsonField<any>((cloudEvent as any).groupSettingsJson, undefined),
    createdAt: cloudEvent.createdAt,
    lastModified: cloudEvent.lastModified || new Date().toISOString(),
    completedAt: cloudEvent.completedAt || undefined,
    chat: [],
  };
}

function normalizeHubType(cloudEvent: any): 'event' | 'group' {
  const raw = String(cloudEvent?.hubType || '').trim().toLowerCase();
  if (raw === 'group') return 'group';
  if (raw === 'event') return 'event';
  // Legacy fallback: records with group settings but missing/invalid hubType are groups.
  if (cloudEvent?.groupSettingsJson) return 'group';
  return 'event';
}

/**
 * Save a chat message to cloud (as individual record)
 */
export async function saveChatMessageToCloud(eventId: string, message: ChatMessage): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('💬 saveChatMessageToCloud: Saving message to event:', eventId, 'from:', message.senderName);
    
    const { data, errors } = await client.models.ChatMessage.create({
      id: message.id,
      eventId,
      profileId: message.profileId,
      senderName: message.senderName, // Save name snapshot for cross-device
      text: serializeCloudChatPayload(message),
      isBot: message.profileId === 'gimmies-bot',
    });
    
    if (errors) {
      console.error('❌ saveChatMessageToCloud: Error:', errors);
      return false;
    }
    
    console.log('✅ saveChatMessageToCloud: Message saved to cloud');
    return true;
  } catch (error) {
    console.error('❌ saveChatMessageToCloud: Exception:', error);
    return false;
  }
}

/**
 * Update an existing chat message in cloud.
 * Used for reactions, poll votes, soft-delete, and message edits.
 */
export async function updateChatMessageInCloud(eventId: string, message: ChatMessage): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    const { errors } = await client.models.ChatMessage.update({
      id: message.id,
      eventId,
      profileId: message.profileId,
      senderName: message.senderName,
      text: serializeCloudChatPayload(message),
      isBot: message.profileId === 'gimmies-bot',
    });

    if (errors) {
      console.error('❌ updateChatMessageInCloud: Error:', errors);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ updateChatMessageInCloud: Exception:', error);
    return false;
  }
}

/**
 * Load all chat messages for an event from cloud
 */
export async function loadChatMessagesFromCloud(eventId: string): Promise<ChatMessage[]> {
  try {
    const client = getClient();
    if (!client) return [];

    console.log('📥 loadChatMessagesFromCloud: Loading messages for event:', eventId);
    
    const { data: messages, errors } = await client.models.ChatMessage.list({
      filter: { eventId: { eq: eventId } }
    });
    
    if (errors) {
      console.error('❌ loadChatMessagesFromCloud: Error:', errors);
      return [];
    }
    
    const chatMessages = mapCloudChatMessages(messages || []);
    
    console.log('✅ loadChatMessagesFromCloud: Loaded', chatMessages.length, 'messages');
    return chatMessages;
  } catch (error) {
    console.error('❌ loadChatMessagesFromCloud: Exception:', error);
    return [];
  }
}

/**
 * Save event to cloud (DynamoDB)
 * Returns the share code if successful
 */
export async function saveEventToCloud(event: Event, currentProfileId: string): Promise<string | null> {
  try {
    const client = getClient();
    if (!client) return null;

    console.log('☁️ saveEventToCloud: Starting save for event:', event.id);
    console.log('☁️ saveEventToCloud: Golfers to save:', event.golfers.length, event.golfers.map(g => g.profileId || g.customName));

    // Generate share code if not exists
    const shareCode = event.shareCode || generateShareCode();

    const eventData = {
      id: event.id,
      name: event.name,
      date: event.date,
      courseId: event.course?.courseId || null,
      teeName: event.course?.teeName || null,
      ownerProfileId: event.ownerProfileId || currentProfileId,
      // "Public" means discoverable in Join Game lists. Private invite-only games can still have a shareCode.
      isPublic: !!event.isPublic,
      isCompleted: event.isCompleted || false,
      shareCode,
      scorecardView: event.scorecardView || 'individual',
      // Event lifecycle status - preserve undefined/null to maintain data integrity
      status: event.status || null,
      // Hub type: 'event' (default) or 'group' (chat crew)
      hubType: event.hubType || 'event',
      // Parent group ID - links events created from groups
      parentGroupId: event.parentGroupId || null,
      
      // Store complex objects as JSON strings
      golfersJson: JSON.stringify(event.golfers || []),
      groupsJson: JSON.stringify(event.groups || []),
      scorecardsJson: JSON.stringify(event.scorecards || []),
      gamesJson: JSON.stringify(event.games || {}),
      pinkyResultsJson: JSON.stringify(event.pinkyResults || {}),
      greenieResultsJson: JSON.stringify(event.greenieResults || {}),
      // Group-specific settings
      groupSettingsJson: event.hubType === 'group' ? JSON.stringify(event.groupSettings || {}) : null,
      // chatJson removed - using ChatMessage table instead
      
      lastModified: event.lastModified || new Date().toISOString(),
      completedAt: event.completedAt || null,
    };

    console.log('☁️ saveEventToCloud: golfersJson being saved:', eventData.golfersJson);

    // Try to update first (if exists), otherwise create
    console.log('☁️ saveEventToCloud: Attempting update...');
    const { data, errors } = await client.models.Event.update(eventData);

    console.log('☁️ saveEventToCloud: Update result - data:', data ? 'exists' : 'null', 'errors:', errors);

    if (errors || !data) {
      // Event doesn't exist, create it
      console.log('☁️ saveEventToCloud: Update failed/returned null, attempting create...');
      const createResult = await client.models.Event.create(eventData);
      
      console.log('☁️ saveEventToCloud: Create result - data:', createResult.data ? 'exists' : 'null', 'errors:', createResult.errors);
      
      if (createResult.errors) {
        console.error('❌ saveEventToCloud: BOTH UPDATE AND CREATE FAILED!');
        console.error('❌ saveEventToCloud: Create errors:', JSON.stringify(createResult.errors, null, 2));
        return null;
      }
      
      console.log('✅ saveEventToCloud: Event CREATED in cloud with', event.golfers.length, 'golfers');
      return shareCode;
    }

    console.log('✅ saveEventToCloud: Event UPDATED in cloud with', event.golfers.length, 'golfers');
    return shareCode;
  } catch (error) {
    console.error('❌ saveEventToCloud: Error saving event to cloud:', error);
    return null;
  }
}

/**
 * Save only selected event fields to cloud.
 * Prevents stale local snapshots from overwriting golfers/scorecards unintentionally.
 */
export async function saveEventPatchToCloud(
  event: Event,
  patch: Partial<Event>,
  currentProfileId: string
): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    const updateData: Record<string, any> = {
      id: event.id,
      lastModified: new Date().toISOString(),
    };

    if ('name' in patch) updateData.name = event.name;
    if ('date' in patch) updateData.date = event.date;
    if ('isPublic' in patch) updateData.isPublic = !!event.isPublic;
    if ('isCompleted' in patch) updateData.isCompleted = !!event.isCompleted;
    if ('scorecardView' in patch) updateData.scorecardView = event.scorecardView || 'individual';
    if ('status' in patch) updateData.status = event.status || null;
    if ('hubType' in patch) updateData.hubType = event.hubType || 'event';
    if ('parentGroupId' in patch) updateData.parentGroupId = event.parentGroupId || null;
    if ('completedAt' in patch) updateData.completedAt = event.completedAt || null;
    if ('ownerProfileId' in patch) updateData.ownerProfileId = event.ownerProfileId || currentProfileId;
    if ('shareCode' in patch) updateData.shareCode = event.shareCode || null;

    if ('course' in patch) {
      updateData.courseId = event.course?.courseId || null;
      updateData.teeName = event.course?.teeName || null;
    }
    if ('games' in patch) updateData.gamesJson = JSON.stringify(event.games || {});
    if ('pinkyResults' in patch) updateData.pinkyResultsJson = JSON.stringify(event.pinkyResults || {});
    if ('greenieResults' in patch) updateData.greenieResultsJson = JSON.stringify(event.greenieResults || {});
    if ('groupSettings' in patch) {
      updateData.groupSettingsJson = event.hubType === 'group'
        ? JSON.stringify(event.groupSettings || {})
        : null;
    }

    const { data, errors } = await client.models.Event.update(updateData as any);
    if (errors) {
      console.error('❌ saveEventPatchToCloud: update failed:', errors);
      return false;
    }

    // If update returns null (record not found), create full record.
    if (!data) {
      const shareCode = await saveEventToCloud(event, currentProfileId);
      return !!shareCode;
    }

    return true;
  } catch (error) {
    console.error('❌ saveEventPatchToCloud: exception:', error);
    return false;
  }
}

interface EventRealtimeSubscriptionHandlers {
  onEvent?: (event: Event) => void;
  onChat?: (messages: ChatMessage[]) => void;
  onError?: (scope: 'event' | 'chat', error: unknown) => void;
}

export function subscribeToEventRealtime(
  eventId: string,
  handlers: EventRealtimeSubscriptionHandlers
): () => void {
  const client = getClient();
  if (!client || !eventId) return () => {};

  const eventSubscription = client.models.Event.observeQuery({
    filter: { id: { eq: eventId } },
  }).subscribe({
    next: (snapshot: any) => {
      const normalized = normalizeCloudEventRecord(snapshot?.items?.[0]);
      if (normalized) handlers.onEvent?.(normalized);
    },
    error: (error: unknown) => {
      handlers.onError?.('event', error);
    },
  });

  const chatSubscription = client.models.ChatMessage.observeQuery({
    filter: { eventId: { eq: eventId } },
  }).subscribe({
    next: (snapshot: any) => {
      handlers.onChat?.(mapCloudChatMessages(snapshot?.items || []));
    },
    error: (error: unknown) => {
      handlers.onError?.('chat', error);
    },
  });

  return () => {
    eventSubscription.unsubscribe();
    chatSubscription.unsubscribe();
  };
}

/**
 * Load event from cloud by ID
 */
export async function loadEventById(eventId: string): Promise<Event | null> {
  try {
    const client = getClient();
    if (!client) return null;

    console.log('📥 loadEventById: Loading event from cloud by ID:', eventId);

    const { data: cloudEvent, errors } = await client.models.Event.get({ id: eventId });

    if (errors || !cloudEvent) {
      console.log('❌ loadEventById: Event not found with ID:', eventId);
      return null;
    }

    console.log('📥 loadEventById: Cloud event golfersJson:', cloudEvent.golfersJson);

    // Parse JSON fields back to objects
    const golfers = asObjectArray(parseJsonField<any[]>(cloudEvent.golfersJson, []));
    const groups = asObjectArray(parseJsonField<any[]>(cloudEvent.groupsJson, []));
    const scorecards = asObjectArray(parseJsonField<any[]>(cloudEvent.scorecardsJson, []));
    const games = parseJsonField<any>(cloudEvent.gamesJson, {});
    const pinkyResults = parseJsonField<any>(cloudEvent.pinkyResultsJson, {});
    const greenieResults = parseJsonField<any>(cloudEvent.greenieResultsJson, {});
    
    console.log('📥 loadEventById: Parsed golfers:', golfers);
    console.log('📥 loadEventById: Parsed scorecards:', scorecards);
    
    // Load chat messages from ChatMessage table (separate records)
    const chat = await loadChatMessagesFromCloud(eventId);
    console.log('📥 loadEventById: Loaded chat:', chat.length, 'messages');

    const groupSettings = parseJsonField<any>((cloudEvent as any).groupSettingsJson, undefined);
    
    const localEvent: Event = {
      id: cloudEvent.id,
      name: cloudEvent.name,
      date: cloudEvent.date,
      course: {
        courseId: cloudEvent.courseId || undefined,
        teeName: cloudEvent.teeName || undefined,
      },
      ownerProfileId: cloudEvent.ownerProfileId,
      isPublic: cloudEvent.isPublic || false,
      isCompleted: cloudEvent.isCompleted || false,
      shareCode: cloudEvent.shareCode || undefined,
      scorecardView: cloudEvent.scorecardView as any || 'individual',
      status: (cloudEvent as any).status as 'setup' | 'started' | 'completed' | undefined,
      hubType: normalizeHubType(cloudEvent),
      parentGroupId: (cloudEvent as any).parentGroupId || undefined,
      
      // Parse JSON strings back to objects
      golfers,
      groups,
      scorecards,
      games,
      pinkyResults,
      greenieResults,
      chat, // ✅ Use chat from cloud instead of empty array
      groupSettings,
      
      createdAt: cloudEvent.createdAt,
      lastModified: cloudEvent.lastModified || new Date().toISOString(),
      completedAt: cloudEvent.completedAt || undefined,
    };

    console.log('✅ loadEventById: Loaded event with', localEvent.golfers.length, 'golfers:', localEvent.golfers.map(g => g.profileId || g.customName));
    return localEvent;
  } catch (error) {
    console.error('❌ loadEventById: Error loading event from cloud by ID:', error);
    return null;
  }
}

/**
 * Load event from cloud by share code
 */
export async function loadEventByShareCode(shareCode: string): Promise<Event | null> {
  try {
    const client = getClient();
    if (!client) return null;

    const normalized = String(shareCode || '').trim().toUpperCase();
    console.log('Loading event from cloud with code:', normalized);

    // Query events by shareCode
    const { data: events, errors } = await client.models.Event.list({
      filter: {
        shareCode: { eq: normalized },
      },
    });

    if (errors || !events || events.length === 0) {
      console.log('Event not found with code:', shareCode);
      return null;
    }

    const cloudEvent = events[0];
    const chat = await loadChatMessagesFromCloud(cloudEvent.id);

    // Parse JSON fields back to objects
    const localEvent: Event = {
      id: cloudEvent.id,
      name: cloudEvent.name,
      date: cloudEvent.date,
      course: {
        courseId: cloudEvent.courseId || undefined,
        teeName: cloudEvent.teeName || undefined,
      },
      ownerProfileId: cloudEvent.ownerProfileId,
      isPublic: cloudEvent.isPublic || false,
      isCompleted: cloudEvent.isCompleted || false,
      shareCode: cloudEvent.shareCode || undefined,
      scorecardView: cloudEvent.scorecardView as any || 'individual',
      status: (cloudEvent as any).status as 'setup' | 'started' | 'completed' | undefined,
      hubType: normalizeHubType(cloudEvent),
      parentGroupId: (cloudEvent as any).parentGroupId || undefined,
      
      // Parse JSON strings back to objects
      golfers: asObjectArray(parseJsonField<any[]>(cloudEvent.golfersJson, [])),
      groups: asObjectArray(parseJsonField<any[]>(cloudEvent.groupsJson, [])),
      scorecards: asObjectArray(parseJsonField<any[]>(cloudEvent.scorecardsJson, [])),
      games: parseJsonField<any>(cloudEvent.gamesJson, {}),
      pinkyResults: parseJsonField<any>(cloudEvent.pinkyResultsJson, {}),
      greenieResults: parseJsonField<any>(cloudEvent.greenieResultsJson, {}),
      groupSettings: parseJsonField<any>((cloudEvent as any).groupSettingsJson, undefined),
      
      createdAt: cloudEvent.createdAt,
      lastModified: cloudEvent.lastModified || new Date().toISOString(),
      completedAt: cloudEvent.completedAt || undefined,
      chat,
    };

    console.log('✅ Event loaded from cloud:', localEvent);
    return localEvent;
  } catch (error) {
    console.error('Error loading event from cloud:', error);
    return null;
  }
}

/**
 * Load all events for current user from cloud
 */
export async function loadUserEventsFromCloud(): Promise<Event[]> {
  try {
    const client = getClient();
    if (!client) return [];

    console.log('Loading user events from cloud...');
    const events: any[] = [];
    let nextToken: string | null | undefined = undefined;
    let sawAnyData = false;
    do {
      const response = await client.models.Event.list(
        nextToken ? { nextToken } : undefined
      );
      const data = response.data;
      const errors = response.errors;
      const pageToken = response.nextToken as string | null | undefined;
      if (errors?.length) {
        // Amplify list can return partial data with record-level errors.
        // Keep good records instead of blanking Home.
        console.warn('loadUserEventsFromCloud: partial page errors:', errors);
      }
      if (data?.length) {
        events.push(...data);
        sawAnyData = true;
      }
      nextToken = pageToken;
    } while (nextToken);

    if (!sawAnyData) {
      console.warn('loadUserEventsFromCloud: no readable event records returned');
    }

    const localEvents: Event[] = [];
    for (const cloudEvent of events) {
      try {
        const normalized = normalizeCloudEventRecord(cloudEvent);
        if (normalized) localEvents.push(normalized);
      } catch (e) {
        console.warn('Skipping malformed cloud event record:', cloudEvent?.id, e);
      }
    }

    console.log(`✅ Loaded ${localEvents.length} events from cloud`);
    return localEvents;
  } catch (error) {
    console.error('Error loading events from cloud:', error);
    return [];
  }
}

/**
 * Load public (discoverable) events from cloud.
 * These are meant for the "Join Game" browse experience.
 */
export async function loadPublicEventsFromCloud(): Promise<Event[]> {
  try {
    const client = getClient();
    if (!client) return [];
    const events: any[] = [];
    let nextToken: string | null | undefined = undefined;
    do {
      const response = await client.models.Event.list({
        filter: { isPublic: { eq: true } },
        ...(nextToken ? { nextToken } : {}),
      });
      const data = response.data;
      const errors = response.errors;
      const pageToken = response.nextToken as string | null | undefined;

      if (errors?.length) {
        // Keep partial good data if some records are unreadable.
        console.warn('loadPublicEventsFromCloud: partial page errors:', errors);
      }
      if (data?.length) events.push(...data);
      nextToken = pageToken;
    } while (nextToken);

    const localEvents: Event[] = (events || [])
      .map((cloudEvent: any) => normalizeCloudEventRecord(cloudEvent))
      .filter((cloudEvent: Event | null): cloudEvent is Event => Boolean(cloudEvent))
      .filter((cloudEvent) => !cloudEvent.isCompleted)
      // Exclude groups (hubType === 'group') and group child events (have parentGroupId)
      .filter((cloudEvent) => normalizeHubType(cloudEvent) !== 'group')
      .filter((cloudEvent) => !(cloudEvent as any).parentGroupId)
      .map((cloudEvent) => ({
        ...cloudEvent,
        chat: [],
      }));

    return localEvents;
  } catch (error) {
    console.error('Error loading public events from cloud:', error);
    return [];
  }
}

/**
 * Delete event from cloud
 */
export async function deleteEventFromCloud(eventId: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('Deleting event from cloud:', eventId);

    const { errors } = await client.models.Event.delete({ id: eventId });

    if (errors) {
      console.error('Failed to delete event from cloud:', errors);
      return false;
    }

    console.log('✅ Event deleted from cloud');
    return true;
  } catch (error) {
    console.error('Error deleting event from cloud:', error);
    return false;
  }
}

/**
 * Generate a random 6-character share code
 */
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
