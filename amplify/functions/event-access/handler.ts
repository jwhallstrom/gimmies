import type { AppSyncResolverEvent } from 'aws-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';

import type { Schema } from '../../data/resource';

type IdentityLike = {
  sub?: string;
  username?: string;
  claims?: Record<string, unknown>;
};

const CLOUD_CHAT_PAYLOAD_PREFIX = '__GIMMIES_CHAT_V1__';

type EventRecord = {
  id: string;
  name: string;
  date: string;
  courseId?: string | null;
  teeName?: string | null;
  ownerProfileId: string;
  isPublic?: boolean | null;
  isCompleted?: boolean | null;
  hubType?: string | null;
  parentGroupId?: string | null;
  shareCode?: string | null;
  scorecardView?: string | null;
  status?: string | null;
  memberUserIds?: string[] | null;
  golfersJson?: unknown;
  groupsJson?: unknown;
  scorecardsJson?: unknown;
  gamesJson?: unknown;
  pinkyResultsJson?: unknown;
  greenieResultsJson?: unknown;
  groupSettingsJson?: unknown;
  createdAt?: string | null;
  lastModified?: string | null;
  completedAt?: string | null;
};

let configured = false;
let cachedClient: ReturnType<typeof generateClient<Schema>> | null = null;

async function getClient() {
  if (!configured) {
    const config = await getAmplifyDataClientConfig(process.env as any);
    Amplify.configure(config.resourceConfig, config.libraryOptions);
    configured = true;
  }

  if (!cachedClient) {
    cachedClient = generateClient<Schema>();
  }

  return cachedClient;
}

function getCallerUserId(identity: IdentityLike | null | undefined): string | null {
  if (!identity) return null;
  const claims = identity.claims || {};
  const sub = identity.sub || claims.sub;
  return typeof sub === 'string' && sub.trim() ? sub : null;
}

function getCallerMembershipKeys(identity: IdentityLike | null | undefined): string[] {
  if (!identity) return [];
  const claims = identity.claims || {};
  const sub = typeof (identity.sub || claims.sub) === 'string' ? String(identity.sub || claims.sub).trim() : '';
  const username =
    typeof identity.username === 'string' && identity.username.trim()
      ? identity.username.trim()
      : typeof claims['cognito:username'] === 'string'
        ? String(claims['cognito:username']).trim()
        : '';

  const candidates = [
    sub,
    username,
    sub && username ? `${sub}::${username}` : '',
    sub ? `${sub}::${sub}` : '',
    username ? `${username}::${username}` : '',
  ].filter(Boolean);

  return Array.from(new Set(candidates));
}

function asObjectArray(value: unknown): Record<string, any>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, any> => Boolean(item) && typeof item === 'object');
}

function normalizeHubType(record: Partial<EventRecord>): 'event' | 'group' {
  const raw = String(record.hubType || '').trim().toLowerCase();
  if (raw === 'group') return 'group';
  if (raw === 'event') return 'event';
  return record.groupSettingsJson ? 'group' : 'event';
}

function isMember(record: Partial<EventRecord>, membershipKeys: string[]): boolean {
  if (!Array.isArray(record.memberUserIds) || membershipKeys.length === 0) return false;
  return membershipKeys.some((key) => record.memberUserIds!.includes(key));
}

function groupSettings(record: Partial<EventRecord>) {
  const raw = record.groupSettingsJson;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, any>;
}

function deserializeCloudChatPayload(rawText: string) {
  if (!rawText || !rawText.startsWith(CLOUD_CHAT_PAYLOAD_PREFIX)) {
    return { text: rawText || '' };
  }

  try {
    return JSON.parse(rawText.slice(CLOUD_CHAT_PAYLOAD_PREFIX.length)) as Record<string, any>;
  } catch {
    return { text: rawText || '' };
  }
}

function collaborativeChatOnlyChanged(currentText: string, nextText: string) {
  const current = deserializeCloudChatPayload(currentText);
  const next = deserializeCloudChatPayload(nextText);

  return JSON.stringify({
    text: current.text,
    type: current.type,
    replyTo: current.replyTo,
    metadata: current.metadata,
    pollQuestion: current.pollQuestion,
    pollClosed: current.pollClosed,
    editedAt: current.editedAt,
    isDeleted: current.isDeleted,
  }) === JSON.stringify({
    text: next.text,
    type: next.type,
    replyTo: next.replyTo,
    metadata: next.metadata,
    pollQuestion: next.pollQuestion,
    pollClosed: next.pollClosed,
    editedAt: next.editedAt,
    isDeleted: next.isDeleted,
  });
}

function buildScorecard(profileId: string, scorecards: Record<string, any>[]) {
  const firstExisting = scorecards[0];
  const holeCount = Array.isArray(firstExisting?.scores) && firstExisting.scores.length > 0
    ? firstExisting.scores.length
    : 18;
  return {
    golferId: profileId,
    scores: Array.from({ length: holeCount }, (_, index) => ({
      hole: index + 1,
      strokes: null,
    })),
  };
}

async function requireOwnedProfile(client: ReturnType<typeof generateClient<Schema>>, profileId: string, callerUserId: string) {
  const profileResult = await client.models.Profile.get({ id: profileId });
  const profile = profileResult.data;

  if (!profile || profile.userId !== callerUserId) {
    throw new Error('Profile access denied.');
  }

  return profile;
}

function publicHubSummaries(records: EventRecord[], hubType: 'event' | 'group') {
  return records
    .filter((record) => Boolean(record.isPublic))
    .filter((record) => Boolean(record.shareCode))
    .filter((record) => !record.isCompleted)
    .filter((record) => normalizeHubType(record) === hubType)
    .filter((record) => {
      if (hubType !== 'group') return !record.parentGroupId;
      const settings = groupSettings(record);
      return (settings.visibility || 'private') === 'public';
    })
    .map((record) => ({
      id: record.id,
      name: record.name,
      date: record.date,
      courseId: record.courseId || null,
      teeName: record.teeName || null,
      ownerProfileId: record.ownerProfileId,
      isPublic: Boolean(record.isPublic),
      isCompleted: Boolean(record.isCompleted),
      hubType: normalizeHubType(record),
      parentGroupId: record.parentGroupId || null,
      shareCode: record.shareCode || null,
      scorecardView: record.scorecardView || null,
      status: record.status || null,
      golfersJson: record.golfersJson || [],
      groupsJson: record.groupsJson || [],
      scorecardsJson: record.scorecardsJson || [],
      gamesJson: record.gamesJson || {},
      pinkyResultsJson: record.pinkyResultsJson || {},
      greenieResultsJson: record.greenieResultsJson || {},
      groupSettingsJson: record.groupSettingsJson || null,
      createdAt: record.createdAt || null,
      lastModified: record.lastModified || null,
      completedAt: record.completedAt || null,
    }));
}

async function listPublicEventRecords(client: ReturnType<typeof generateClient<Schema>>) {
  const all: EventRecord[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const response = await client.models.Event.list({
      filter: { isPublic: { eq: true } },
      ...(nextToken ? { nextToken } : {}),
    });
    if (response.data?.length) {
      all.push(...(response.data as EventRecord[]));
    }
    nextToken = response.nextToken as string | null | undefined;
  } while (nextToken);

  return all;
}

async function listAllEventRecords(client: ReturnType<typeof generateClient<Schema>>) {
  const all: EventRecord[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const response = await client.models.Event.list(
      nextToken ? { nextToken } : undefined
    );
    if (response.data?.length) {
      all.push(...(response.data as EventRecord[]));
    }
    nextToken = response.nextToken as string | null | undefined;
  } while (nextToken);

  return all;
}

async function touchEvent(client: ReturnType<typeof generateClient<Schema>>, eventId: string) {
  await client.models.Event.update({
    id: eventId,
    lastModified: new Date().toISOString(),
  });
}

async function handleListPublicEvents(client: ReturnType<typeof generateClient<Schema>>) {
  const events = await listPublicEventRecords(client);
  return publicHubSummaries(events, 'event');
}

async function handleListPublicGroups(client: ReturnType<typeof generateClient<Schema>>) {
  const events = await listPublicEventRecords(client);
  return publicHubSummaries(events, 'group');
}

async function handleJoinHubByShareCode(
  client: ReturnType<typeof generateClient<Schema>>,
  callerMembershipKeys: string[],
  callerUserId: string,
  args: { shareCode: string; profileId: string; displayName?: string | null },
) {
  const normalizedCode = String(args.shareCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return { success: false, error: 'Please enter a valid join code.' };
  }

  const profile = await requireOwnedProfile(client, args.profileId, callerUserId);
  const allEvents = await listAllEventRecords(client);
  const event = allEvents.find((candidate) => String(candidate.shareCode || '').trim().toUpperCase() === normalizedCode) || null;

  if (!event) {
    console.warn('joinHubByShareCode: no event found for code', normalizedCode, 'visibleEvents', allEvents.length);
    return { success: false, error: 'Event not found or share code is invalid.' };
  }

  const hubType = normalizeHubType(event);
  const settings = groupSettings(event);
  if (hubType === 'group' && (settings.joinPolicy || 'open') !== 'open') {
    return {
      success: false,
      error: settings.joinPolicy === 'invite_only'
        ? 'This group is invite-only. Ask an admin to add you.'
        : 'This group requires join approval. Request flow is not enabled yet.',
      hubType,
    };
  }

  const nextMemberUserIds = Array.from(new Set([...(event.memberUserIds || []), ...callerMembershipKeys]));
  const golfers = asObjectArray(event.golfersJson);
  const groups = asObjectArray(event.groupsJson);
  const scorecards = asObjectArray(event.scorecardsJson);

  const alreadyInGolfers = golfers.some((golfer) => golfer.profileId === args.profileId);
  const alreadyInScorecards = scorecards.some((scorecard) => scorecard.golferId === args.profileId);

  const nextGolfers = alreadyInGolfers
    ? golfers
    : [
        ...golfers,
        {
          profileId: args.profileId,
          displayName: args.displayName || profile.name || 'Unknown',
          handicapSnapshot: profile.handicapIndex ?? null,
          gamePreference: 'all',
        },
      ];

  const nextScorecards = hubType === 'group' || alreadyInScorecards
    ? scorecards
    : [...scorecards, buildScorecard(args.profileId, scorecards)];

  const nextGroups = groups.length === 0
    ? [{ id: `grp-${args.profileId.slice(0, 6)}`, golferIds: [args.profileId] }]
    : groups.map((group) => ({
        ...group,
        golferIds: Array.from(new Set([...(Array.isArray(group.golferIds) ? group.golferIds : []), args.profileId])),
      }));

  await client.models.Event.update({
    id: event.id,
    memberUserIds: nextMemberUserIds,
    golfersJson: nextGolfers,
    scorecardsJson: nextScorecards,
    groupsJson: nextGroups,
    lastModified: new Date().toISOString(),
  });

  return {
    success: true,
    eventId: event.id,
    hubType,
  };
}

async function handleListEventChatMessages(
  client: ReturnType<typeof generateClient<Schema>>,
  callerMembershipKeys: string[],
  args: { eventId: string },
) {
  const eventResult = await client.models.Event.get({ id: args.eventId });
  const event = eventResult.data as EventRecord | null;

  if (!event || !isMember(event, callerMembershipKeys)) {
    throw new Error('Event access denied.');
  }

  const messages = await client.models.ChatMessage.list({
    filter: { eventId: { eq: args.eventId } },
  });

  return (messages.data || [])
    .map((message: any) => ({
      id: message.id,
      eventId: message.eventId,
      profileId: message.profileId,
      senderName: message.senderName || null,
      text: message.text,
      isBot: Boolean(message.isBot),
      createdAt: message.createdAt || null,
      updatedAt: message.updatedAt || null,
    }))
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
}

async function handleCreateEventChatMessage(
  client: ReturnType<typeof generateClient<Schema>>,
  callerMembershipKeys: string[],
  args: { eventId: string; messageId: string; profileId: string; senderName?: string | null; text: string; isBot?: boolean | null },
) {
  const eventResult = await client.models.Event.get({ id: args.eventId });
  const event = eventResult.data as EventRecord | null;
  if (!event || !isMember(event, callerMembershipKeys)) {
    return { success: false, error: 'Event access denied.' };
  }

  if (!args.isBot) {
    await requireOwnedProfile(client, args.profileId, callerUserId);
  }

  const createResult = await client.models.ChatMessage.create({
    id: args.messageId,
    eventId: args.eventId,
    profileId: args.profileId,
    senderName: args.senderName || null,
    text: args.text,
    isBot: Boolean(args.isBot),
  });

  if (createResult.errors?.length) {
    return { success: false, error: createResult.errors[0].message };
  }

  await touchEvent(client, args.eventId);
  return { success: true };
}

async function handleUpdateEventChatMessage(
  client: ReturnType<typeof generateClient<Schema>>,
  callerMembershipKeys: string[],
  args: { eventId: string; messageId: string; text: string },
) {
  const eventResult = await client.models.Event.get({ id: args.eventId });
  const event = eventResult.data as EventRecord | null;
  if (!event || !isMember(event, callerMembershipKeys)) {
    return { success: false, error: 'Event access denied.' };
  }

  const messageResult = await client.models.ChatMessage.get({ id: args.messageId });
  const message = messageResult.data;
  if (!message) {
    return { success: false, error: 'Message not found.' };
  }

  if (message.eventId !== args.eventId) {
    return { success: false, error: 'Message does not belong to this event.' };
  }

  const isSystemBotMessage = Boolean(message.isBot) && message.profileId === 'gimmies-bot';
  const messageOwner = !isSystemBotMessage
    ? await requireOwnedProfile(client, message.profileId, callerUserId).then(() => true).catch(() => false)
    : false;

  const collaborativeUpdate = collaborativeChatOnlyChanged(message.text, args.text);

  if (!messageOwner && !isSystemBotMessage && !collaborativeUpdate) {
    return { success: false, error: 'Message access denied.' };
  }

  const updateResult = await client.models.ChatMessage.update({
    id: args.messageId,
    eventId: args.eventId,
    profileId: message.profileId,
    senderName: message.senderName || null,
    text: args.text,
    isBot: Boolean(message.isBot),
  });

  if (updateResult.errors?.length) {
    return { success: false, error: updateResult.errors[0].message };
  }

  await touchEvent(client, args.eventId);
  return { success: true };
}

export const handler = async (event: AppSyncResolverEvent<Record<string, any>>) => {
  const client = await getClient();
  const callerUserId = getCallerUserId(event.identity as IdentityLike);
  const callerMembershipKeys = getCallerMembershipKeys(event.identity as IdentityLike);
  const fieldName =
    (event as any)?.info?.fieldName ||
    (event as any)?.fieldName ||
    (event as any)?.typeName ||
    (event as any)?.requestContext?.fieldName ||
    null;

  if (!callerUserId) {
    throw new Error('Authentication required.');
  }

  if (!fieldName) {
    console.error('event-access: unsupported event shape', JSON.stringify({
      keys: Object.keys((event as any) || {}),
      sample: event,
    }));
    throw new Error('Unsupported event shape.');
  }

  switch (fieldName) {
    case 'listPublicEvents':
      return handleListPublicEvents(client);
    case 'listPublicGroups':
      return handleListPublicGroups(client);
    case 'joinHubByShareCode':
      return handleJoinHubByShareCode(client, callerMembershipKeys, callerUserId, event.arguments as any);
    case 'listEventChatMessages':
      return handleListEventChatMessages(client, callerMembershipKeys, event.arguments as any);
    case 'createEventChatMessage':
      return handleCreateEventChatMessage(client, callerMembershipKeys, event.arguments as any);
    case 'updateEventChatMessage':
      return handleUpdateEventChatMessage(client, callerMembershipKeys, event.arguments as any);
    default:
      throw new Error(`Unsupported field: ${fieldName}`);
  }
};
