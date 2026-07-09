/**
 * Event Cloud Sync Utilities
 * Handles saving/loading events to/from AWS Amplify DynamoDB
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { Event, ChatMessage } from '../state/store';
import useStore from '../state/store';

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
  let current: unknown = value;

  // Some cloud fields are double-encoded JSON strings. Unwrap them a couple
  // of times so arrays/objects survive normalization instead of being dropped.
  for (let i = 0; i < 3 && typeof current === 'string'; i++) {
    try {
      current = JSON.parse(current);
    } catch {
      return fallback;
    }
  }

  return ((current as T) == null ? fallback : (current as T));
}

function asObjectArray(value: unknown): any[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
}

function normalizeEventGames(value: unknown): Event['games'] {
  const raw = (value && typeof value === 'object') ? (value as Record<string, unknown>) : {};
  return {
    nassau: Array.isArray(raw.nassau) ? raw.nassau as any[] : [],
    skins: Array.isArray(raw.skins) ? raw.skins as any[] : [],
    pinky: Array.isArray(raw.pinky) ? raw.pinky as any[] : [],
    greenie: Array.isArray(raw.greenie) ? raw.greenie as any[] : [],
    stableford: Array.isArray(raw.stableford) ? raw.stableford as any[] : [],
    ninePoint: Array.isArray(raw.ninePoint) ? raw.ninePoint as any[] : [],
    bingoBangoBongo: Array.isArray(raw.bingoBangoBongo) ? raw.bingoBangoBongo as any[] : [],
    wolf: Array.isArray(raw.wolf) ? raw.wolf as any[] : [],
    dots: Array.isArray(raw.dots) ? raw.dots as any[] : [],
  } as Event['games'];
}

function buildMembershipKeys(userId?: string | null): string[] {
  const normalized = String(userId || '').trim();
  if (!normalized) return [];
  return Array.from(new Set([
    normalized,
    `${normalized}::${normalized}`,
  ]));
}

function deriveEventMemberUserIds(event: Event, currentProfileId?: string): string[] {
  const state = useStore.getState();
  const profileIds = new Set<string>();

  if (event.ownerProfileId) profileIds.add(event.ownerProfileId);
  if (currentProfileId) profileIds.add(currentProfileId);

  for (const golfer of event.golfers || []) {
    if (golfer.profileId) profileIds.add(golfer.profileId);
  }

  const membershipKeys = new Set<string>();
  for (const profileId of profileIds) {
    const profile = state.profiles.find((candidate: any) => candidate.id === profileId);
    for (const key of buildMembershipKeys(profile?.userId)) {
      membershipKeys.add(key);
    }
  }

  if (!membershipKeys.size && state.currentProfile?.userId) {
    for (const key of buildMembershipKeys(state.currentProfile.userId)) {
      membershipKeys.add(key);
    }
  }

  return Array.from(membershipKeys);
}

async function resolveEventMemberUserIds(
  client: ReturnType<typeof generateClient<Schema>>,
  event: Event,
  currentProfileId?: string,
  mergeExistingCloudMembers: boolean = true
): Promise<string[]> {
  const membershipKeys = new Set<string>(deriveEventMemberUserIds(event, currentProfileId));
  const state = useStore.getState();

  const missingProfileIds = new Set<string>();
  for (const golfer of event.golfers || []) {
    if (!golfer.profileId) continue;
    const profile = state.profiles.find((candidate: any) => candidate.id === golfer.profileId);
    if (!profile?.userId) {
      missingProfileIds.add(golfer.profileId);
    }
  }

  for (const profileId of missingProfileIds) {
    try {
      const profileResult = await client.models.Profile.get({ id: profileId });
      for (const key of buildMembershipKeys((profileResult.data as any)?.userId)) {
        membershipKeys.add(key);
      }
    } catch (error) {
      console.warn('⚠️ resolveEventMemberUserIds: failed to load profile for membership merge', profileId, error);
    }
  }

  try {
    if (!mergeExistingCloudMembers) {
      return Array.from(membershipKeys);
    }
    const currentEvent = await client.models.Event.get({ id: event.id });
    for (const key of ((currentEvent.data as any)?.memberUserIds || [])) {
      if (typeof key === 'string' && key.trim()) {
        membershipKeys.add(key.trim());
      }
    }
  } catch (error) {
    console.warn('⚠️ resolveEventMemberUserIds: failed to merge existing cloud members', event.id, error);
  }

  return Array.from(membershipKeys);
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
    games: normalizeEventGames(parseJsonField<any>(cloudEvent.gamesJson, {})),
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

    const { data, errors } = await client.mutations.createEventChatMessage({
      messageId: message.id,
      eventId,
      profileId: message.profileId,
      senderName: message.senderName, // Save name snapshot for cross-device
      text: serializeCloudChatPayload(message),
      isBot: message.profileId === 'gimmies-bot',
    });

    if (errors || !data?.success) {
      console.error('❌ saveChatMessageToCloud: Error:', errors || data?.error || 'unknown failure');
      return false;
    }
    
    console.log('✅ saveChatMessageToCloud: Message saved to cloud');
    return true;
  } catch (error) {
    console.error('❌ saveChatMessageToCloud: Exception:', error);
    return false;
  }
}

export type InvitePreview = {
  found: boolean;
  eventId?: string;
  name?: string;
  date?: string;
  courseId?: string | null;
  teeName?: string | null;
  hubType?: string;
  isPublic?: boolean;
  golferCount?: number;
  error?: string;
};

export async function fetchInvitePreview(args: {
  shareCode?: string;
  eventId?: string;
}): Promise<InvitePreview> {
  try {
    const client = getClient();
    if (!client) return { found: false, error: 'Cloud sync unavailable.' };

    const { data, errors } = await client.queries.getHubInvitePreview(
      {
        shareCode: args.shareCode ? String(args.shareCode).trim().toUpperCase() : undefined,
        eventId: args.eventId ? String(args.eventId).trim() : undefined,
      },
      { authMode: 'apiKey' },
    );

    if (errors?.length) {
      return { found: false, error: errors[0].message };
    }

    if (!data) {
      return { found: false, error: 'Could not load invite details.' };
    }

    return {
      found: !!data.found,
      eventId: data.eventId || undefined,
      name: data.name || undefined,
      date: data.date || undefined,
      courseId: data.courseId || null,
      teeName: data.teeName || null,
      hubType: data.hubType || undefined,
      isPublic: data.isPublic ?? undefined,
      golferCount: data.golferCount ?? undefined,
      error: data.error || undefined,
    };
  } catch (error) {
    console.error('❌ fetchInvitePreview: Exception:', error);
    return { found: false, error: 'Could not load invite details.' };
  }
}

export async function joinHubByShareCodeInCloud(
  shareCode: string,
  profileId: string,
  displayName?: string
): Promise<{ success: boolean; eventId?: string; error?: string; hubType?: string }> {
  try {
    const client = getClient();
    if (!client) return { success: false, error: 'Cloud sync unavailable.' };

    const { data, errors } = await client.mutations.joinHubByShareCode({
      shareCode: String(shareCode || '').trim().toUpperCase(),
      profileId,
      displayName: displayName || undefined,
    });

    if (errors?.length) {
      return { success: false, error: errors[0].message };
    }

    return {
      success: !!data?.success,
      eventId: data?.eventId || undefined,
      error: data?.error || undefined,
      hubType: data?.hubType || undefined,
    };
  } catch (error) {
    console.error('❌ joinHubByShareCodeInCloud: Exception:', error);
    return { success: false, error: 'Could not join right now.' };
  }
}

export async function joinHubByEventIdInCloud(
  eventId: string,
  profileId: string,
  displayName?: string
): Promise<{ success: boolean; eventId?: string; error?: string; hubType?: string }> {
  try {
    const client = getClient();
    if (!client) return { success: false, error: 'Cloud sync unavailable.' };

    const { data, errors } = await client.mutations.joinHubByEventId({
      eventId: String(eventId || '').trim(),
      profileId,
      displayName: displayName || undefined,
    });

    if (errors?.length) {
      return { success: false, error: errors[0].message };
    }

    return {
      success: !!data?.success,
      eventId: data?.eventId || undefined,
      error: data?.error || undefined,
      hubType: data?.hubType || undefined,
    };
  } catch (error) {
    console.error('❌ joinHubByEventIdInCloud: Exception:', error);
    return { success: false, error: 'Could not join right now.' };
  }
}

export async function leaveHubInCloud(
  eventId: string,
  profileId: string
): Promise<{ success: boolean; eventId?: string; error?: string; hubType?: string }> {
  try {
    const client = getClient();
    if (!client) return { success: false, error: 'Cloud sync unavailable.' };

    const { data, errors } = await client.mutations.leaveHub({
      eventId,
      profileId,
    });

    if (errors?.length) {
      return { success: false, error: errors[0].message };
    }

    return {
      success: !!data?.success,
      eventId: data?.eventId || undefined,
      error: data?.error || undefined,
      hubType: data?.hubType || undefined,
    };
  } catch (error) {
    console.error('❌ leaveHubInCloud: Exception:', error);
    return { success: false, error: 'Could not leave right now.' };
  }
}

export async function removeHubMemberInCloud(
  eventId: string,
  actorProfileId: string,
  targetProfileId: string
): Promise<{ success: boolean; eventId?: string; error?: string; hubType?: string }> {
  try {
    const client = getClient();
    if (!client) return { success: false, error: 'Cloud sync unavailable.' };

    const { data, errors } = await client.mutations.removeHubMember({
      eventId,
      actorProfileId,
      targetProfileId,
    });

    if (errors?.length) {
      return { success: false, error: errors[0].message };
    }

    return {
      success: !!data?.success,
      eventId: data?.eventId || undefined,
      error: data?.error || undefined,
      hubType: data?.hubType || undefined,
    };
  } catch (error) {
    console.error('❌ removeHubMemberInCloud: Exception:', error);
    return { success: false, error: 'Could not remove member right now.' };
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

    const { data, errors } = await client.mutations.updateEventChatMessage({
      eventId,
      messageId: message.id,
      text: serializeCloudChatPayload(message),
    });

    if (errors || !data?.success) {
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

    const { data, errors } = await client.queries.listEventChatMessages({
      eventId,
    });

    if (errors) {
      console.error('❌ loadChatMessagesFromCloud: Error:', errors);
      return [];
    }

    const chatMessages = mapCloudChatMessages((data as any[]) || []);
    
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
export async function saveEventToCloud(
  event: Event,
  currentProfileId: string,
  options?: { preserveExistingMembers?: boolean }
): Promise<string | null> {
  try {
    const client = getClient();
    if (!client) return null;

    console.log('☁️ saveEventToCloud: Starting save for event:', event.id);
    console.log('☁️ saveEventToCloud: Golfers to save:', event.golfers.length, event.golfers.map(g => g.profileId || g.customName));

    // Generate share code if not exists
    const shareCode = event.shareCode || generateShareCode();

    const memberUserIds = await resolveEventMemberUserIds(
      client,
      event,
      currentProfileId,
      options?.preserveExistingMembers !== false
    );

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
      memberUserIds,
      
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
    if ('ownerProfileId' in patch) {
      updateData.ownerProfileId = event.ownerProfileId || currentProfileId;
      updateData.memberUserIds = deriveEventMemberUserIds(event, currentProfileId);
    }
    if ('shareCode' in patch) updateData.shareCode = event.shareCode || null;

    if ('course' in patch) {
      updateData.courseId = event.course?.courseId || null;
      updateData.teeName = event.course?.teeName || null;
    }
    if ('games' in patch) updateData.gamesJson = JSON.stringify(event.games || {});
    if ('golfers' in patch) updateData.golfersJson = JSON.stringify(event.golfers || []);
    if ('groups' in patch) updateData.groupsJson = JSON.stringify(event.groups || []);
    if ('scorecards' in patch) updateData.scorecardsJson = JSON.stringify(event.scorecards || []);
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

  let isUnsubscribed = false;

  const eventSubscription = client.models.Event.observeQuery({
    filter: { id: { eq: eventId } },
  }).subscribe({
    next: (snapshot: any) => {
      if (isUnsubscribed) return;
      try {
        const normalized = normalizeCloudEventRecord(snapshot?.items?.[0]);
        if (normalized) {
          handlers.onEvent?.(normalized);
          void loadChatMessagesFromCloud(eventId)
            .then((messages) => {
              if (!isUnsubscribed) handlers.onChat?.(messages);
            })
            .catch((error) => {
              if (!isUnsubscribed) handlers.onError?.('chat', error);
            });
        }
      } catch (err) {
        console.error('[subscribeToEventRealtime] Error processing snapshot:', err);
        if (!isUnsubscribed) handlers.onError?.('event', err);
      }
    },
    error: (error: unknown) => {
      if (!isUnsubscribed) handlers.onError?.('event', error);
    },
  });

  return () => {
    isUnsubscribed = true;
    eventSubscription.unsubscribe();
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

    const { data: cloudEvent, errors } = await client.queries.getAccessibleHubById({ eventId });

    if (errors || !cloudEvent?.id) {
      console.log('❌ loadEventById: Event not found with ID:', eventId);
      return null;
    }

    console.log('📥 loadEventById: Cloud event golfersJson:', cloudEvent.golfersJson);

    // Parse JSON fields back to objects
    const golfers = asObjectArray(parseJsonField<any[]>(cloudEvent.golfersJson, []));
    const groups = asObjectArray(parseJsonField<any[]>(cloudEvent.groupsJson, []));
    const scorecards = asObjectArray(parseJsonField<any[]>(cloudEvent.scorecardsJson, []));
    const games = normalizeEventGames(parseJsonField<any>(cloudEvent.gamesJson, {}));
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
      
      createdAt: String(cloudEvent.createdAt || new Date().toISOString()),
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
      games: normalizeEventGames(parseJsonField<any>(cloudEvent.gamesJson, {})),
      pinkyResults: parseJsonField<any>(cloudEvent.pinkyResultsJson, {}),
      greenieResults: parseJsonField<any>(cloudEvent.greenieResultsJson, {}),
      groupSettings: parseJsonField<any>((cloudEvent as any).groupSettingsJson, undefined),
      
      createdAt: cloudEvent.createdAt || new Date().toISOString(),
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
    const { data, errors } = await client.queries.listAccessibleHubs();
    if (errors?.length) {
      console.warn('loadUserEventsFromCloud: errors:', errors);
    }

    const events = (data as any[]) || [];
    if (!events.length) {
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
    const { data, errors } = await client.queries.listPublicEvents();
    if (errors?.length) {
      console.warn('loadPublicEventsFromCloud: errors:', errors);
    }

    const localEvents: Event[] = ((data as any[]) || [])
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
 * Load public (discoverable) groups from cloud.
 * These are meant for the browse/join experience, similar to public events.
 */
export async function loadPublicGroupsFromCloud(): Promise<Event[]> {
  try {
    const client = getClient();
    if (!client) return [];
    const { data, errors } = await client.queries.listPublicGroups();
    if (errors?.length) {
      console.warn('loadPublicGroupsFromCloud: errors:', errors);
    }

    const localGroups: Event[] = ((data as any[]) || [])
      .map((cloudEvent: any) => normalizeCloudEventRecord(cloudEvent))
      .filter((cloudEvent: Event | null): cloudEvent is Event => Boolean(cloudEvent))
      .filter((cloudEvent) => normalizeHubType(cloudEvent) === 'group')
      .filter((cloudEvent) => {
        const settings = cloudEvent.groupSettings;
        return (settings?.visibility || 'private') === 'public';
      })
      .map((cloudEvent) => ({
        ...cloudEvent,
        chat: [],
      }));

    return localGroups;
  } catch (error) {
    console.error('Error loading public groups from cloud:', error);
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
