/**
 * Event Cloud Sync Utilities
 * Handles saving/loading events to/from AWS Amplify DynamoDB
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { Event, ChatMessage } from '../state/store';

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

/**
 * Save a chat message to cloud (as individual record)
 */
export async function saveChatMessageToCloud(eventId: string, message: ChatMessage): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('💬 saveChatMessageToCloud: Saving message to event:', eventId, 'from:', message.senderName);
    
    const { data, errors } = await client.models.ChatMessage.create({
      eventId,
      profileId: message.profileId,
      senderName: message.senderName, // Save name snapshot for cross-device
      text: message.text,
      isBot: false,
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
    
    // Convert cloud messages to local format
    const chatMessages: ChatMessage[] = (messages || []).map(m => ({
      id: m.id,
      profileId: m.profileId,
      senderName: m.senderName || m.profileId, // Use snapshot or fallback to ID
      text: m.text,
      createdAt: m.createdAt,
    })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
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
    const golfers = cloudEvent.golfersJson ? JSON.parse(cloudEvent.golfersJson as string) : [];
    const groups = cloudEvent.groupsJson ? JSON.parse(cloudEvent.groupsJson as string) : [];
    const scorecards = cloudEvent.scorecardsJson ? JSON.parse(cloudEvent.scorecardsJson as string) : [];
    const games = cloudEvent.gamesJson ? JSON.parse(cloudEvent.gamesJson as string) : {};
    const pinkyResults = cloudEvent.pinkyResultsJson ? JSON.parse(cloudEvent.pinkyResultsJson as string) : {};
    const greenieResults = cloudEvent.greenieResultsJson ? JSON.parse(cloudEvent.greenieResultsJson as string) : {};
    
    console.log('📥 loadEventById: Parsed golfers:', golfers);
    console.log('📥 loadEventById: Parsed scorecards:', scorecards);
    
    // Load chat messages from ChatMessage table (separate records)
    const chat = await loadChatMessagesFromCloud(eventId);
    console.log('📥 loadEventById: Loaded chat:', chat.length, 'messages');

    const groupSettings = (cloudEvent as any).groupSettingsJson ? JSON.parse((cloudEvent as any).groupSettingsJson as string) : undefined;
    
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
      hubType: ((cloudEvent as any).hubType as 'event' | 'group') || 'event',
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

    console.log('Loading event from cloud with code:', shareCode);

    // Query events by shareCode
    const { data: events, errors } = await client.models.Event.list({
      filter: {
        shareCode: { eq: shareCode },
      },
    });

    if (errors || !events || events.length === 0) {
      console.log('Event not found with code:', shareCode);
      return null;
    }

    const cloudEvent = events[0];

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
      hubType: ((cloudEvent as any).hubType as 'event' | 'group') || 'event',
      parentGroupId: (cloudEvent as any).parentGroupId || undefined,
      
      // Parse JSON strings back to objects
      golfers: cloudEvent.golfersJson ? JSON.parse(cloudEvent.golfersJson as string) : [],
      groups: cloudEvent.groupsJson ? JSON.parse(cloudEvent.groupsJson as string) : [],
      scorecards: cloudEvent.scorecardsJson ? JSON.parse(cloudEvent.scorecardsJson as string) : [],
      games: cloudEvent.gamesJson ? JSON.parse(cloudEvent.gamesJson as string) : {},
      pinkyResults: cloudEvent.pinkyResultsJson ? JSON.parse(cloudEvent.pinkyResultsJson as string) : {},
      greenieResults: cloudEvent.greenieResultsJson ? JSON.parse(cloudEvent.greenieResultsJson as string) : {},
      groupSettings: (cloudEvent as any).groupSettingsJson ? JSON.parse((cloudEvent as any).groupSettingsJson as string) : undefined,
      
      createdAt: cloudEvent.createdAt,
      lastModified: cloudEvent.lastModified || new Date().toISOString(),
      completedAt: cloudEvent.completedAt || undefined,
      chat: [], // Chat messages loaded separately
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

    const { data: events, errors } = await client.models.Event.list();

    if (errors) {
      console.error('Failed to load events from cloud:', errors);
      return [];
    }

    const localEvents: Event[] = events.map((cloudEvent) => ({
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
      hubType: ((cloudEvent as any).hubType as 'event' | 'group') || 'event',
      parentGroupId: (cloudEvent as any).parentGroupId || undefined,
      
      golfers: cloudEvent.golfersJson ? JSON.parse(cloudEvent.golfersJson as string) : [],
      groups: cloudEvent.groupsJson ? JSON.parse(cloudEvent.groupsJson as string) : [],
      scorecards: cloudEvent.scorecardsJson ? JSON.parse(cloudEvent.scorecardsJson as string) : [],
      games: cloudEvent.gamesJson ? JSON.parse(cloudEvent.gamesJson as string) : {},
      pinkyResults: cloudEvent.pinkyResultsJson ? JSON.parse(cloudEvent.pinkyResultsJson as string) : {},
      greenieResults: cloudEvent.greenieResultsJson ? JSON.parse(cloudEvent.greenieResultsJson as string) : {},
      groupSettings: (cloudEvent as any).groupSettingsJson ? JSON.parse((cloudEvent as any).groupSettingsJson as string) : undefined,
      
      createdAt: cloudEvent.createdAt,
      lastModified: cloudEvent.lastModified || new Date().toISOString(),
      completedAt: cloudEvent.completedAt || undefined,
      chat: [], // Chat messages loaded separately
    }));

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

    const { data: events, errors } = await client.models.Event.list({
      filter: { isPublic: { eq: true } },
    });

    if (errors) {
      console.error('Failed to load public events from cloud:', errors);
      return [];
    }

    const localEvents: Event[] = (events || [])
      .filter((cloudEvent) => !cloudEvent.isCompleted)
      // Exclude groups (hubType === 'group') and group child events (have parentGroupId)
      .filter((cloudEvent) => (cloudEvent as any).hubType !== 'group')
      .filter((cloudEvent) => !(cloudEvent as any).parentGroupId)
      .map((cloudEvent) => ({
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
        scorecardView: (cloudEvent.scorecardView as any) || 'individual',
        hubType: ((cloudEvent as any).hubType as 'event' | 'group') || 'event',

        golfers: cloudEvent.golfersJson ? JSON.parse(cloudEvent.golfersJson as string) : [],
        groups: cloudEvent.groupsJson ? JSON.parse(cloudEvent.groupsJson as string) : [],
        scorecards: cloudEvent.scorecardsJson ? JSON.parse(cloudEvent.scorecardsJson as string) : [],
        games: cloudEvent.gamesJson ? JSON.parse(cloudEvent.gamesJson as string) : {},
        pinkyResults: cloudEvent.pinkyResultsJson ? JSON.parse(cloudEvent.pinkyResultsJson as string) : {},
        greenieResults: cloudEvent.greenieResultsJson ? JSON.parse(cloudEvent.greenieResultsJson as string) : {},
        groupSettings: (cloudEvent as any).groupSettingsJson ? JSON.parse((cloudEvent as any).groupSettingsJson as string) : undefined,

        createdAt: cloudEvent.createdAt,
        lastModified: cloudEvent.lastModified || new Date().toISOString(),
        completedAt: cloudEvent.completedAt || undefined,
        chat: [], // loaded separately if/when user opens the event
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
