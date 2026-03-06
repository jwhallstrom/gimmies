import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

const eventAccess = defineFunction({
  name: 'event-access',
  entry: '../functions/event-access/handler.ts',
});

/**
 * Gimmies Golf Data Schema - Amplify GraphQL API
 * Mirrors existing Dexie/Zustand structure for seamless migration
 */
const schema = a.schema({
  PublicHubSummary: a.customType({
    id: a.id().required(),
    name: a.string().required(),
    date: a.date().required(),
    courseId: a.string(),
    teeName: a.string(),
    ownerProfileId: a.id().required(),
    isPublic: a.boolean(),
    isCompleted: a.boolean(),
    hubType: a.string(),
    parentGroupId: a.string(),
    shareCode: a.string(),
    scorecardView: a.string(),
    status: a.string(),
    golfersJson: a.json(),
    groupsJson: a.json(),
    scorecardsJson: a.json(),
    gamesJson: a.json(),
    pinkyResultsJson: a.json(),
    greenieResultsJson: a.json(),
    groupSettingsJson: a.json(),
    createdAt: a.datetime(),
    lastModified: a.datetime(),
    completedAt: a.datetime(),
  }),

  JoinHubResult: a.customType({
    success: a.boolean().required(),
    eventId: a.id(),
    error: a.string(),
    hubType: a.string(),
  }),

  EventChatMessage: a.customType({
    id: a.id().required(),
    eventId: a.id().required(),
    profileId: a.string().required(),
    senderName: a.string(),
    text: a.string().required(),
    isBot: a.boolean(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }),

  EventChatMutationResult: a.customType({
    success: a.boolean().required(),
    error: a.string(),
  }),

  listPublicEvents: a
    .query()
    .returns(a.ref('PublicHubSummary').array())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(eventAccess)),

  listPublicGroups: a
    .query()
    .returns(a.ref('PublicHubSummary').array())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(eventAccess)),

  joinHubByShareCode: a
    .mutation()
    .arguments({
      shareCode: a.string().required(),
      profileId: a.id().required(),
      displayName: a.string(),
    })
    .returns(a.ref('JoinHubResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(eventAccess)),

  listEventChatMessages: a
    .query()
    .arguments({
      eventId: a.id().required(),
    })
    .returns(a.ref('EventChatMessage').array())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(eventAccess)),

  createEventChatMessage: a
    .mutation()
    .arguments({
      eventId: a.id().required(),
      messageId: a.id().required(),
      profileId: a.string().required(),
      senderName: a.string(),
      text: a.string().required(),
      isBot: a.boolean(),
    })
    .returns(a.ref('EventChatMutationResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(eventAccess)),

  updateEventChatMessage: a
    .mutation()
    .arguments({
      eventId: a.id().required(),
      messageId: a.id().required(),
      text: a.string().required(),
    })
    .returns(a.ref('EventChatMutationResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(eventAccess)),

  // User Profile - extends Cognito user attributes
  Profile: a.model({
    userId: a.string().required(), // Cognito user ID (for our reference)
    name: a.string().required(),
    firstName: a.string(),
    lastName: a.string(),
    email: a.string(),
    avatar: a.string(), // S3 URL or base64
    handicapIndex: a.float(),
    preferredTee: a.string(),
    
    // Stats (stored as JSON for flexibility) - made optional
    statsJson: a.string(), // Store as JSON string instead of json type
    preferencesJson: a.string(), // Store as JSON string instead of json type
    verifiedStatusJson: a.string(), // Store verified status as JSON string
    
    // Individual handicap rounds
    individualRounds: a.hasMany('IndividualRound', 'profileId'),
    
    // Events owned by this profile
    ownedEvents: a.hasMany('Event', 'ownerProfileId'),
    
    // Timestamps
    lastActive: a.datetime(),
  })
  .authorization(allow => [
    allow.owner().to(['read', 'create', 'update', 'delete']), // Amplify auto-manages owner field
    allow.authenticated().to(['read']), // Others can read profiles
    (allow as any).resource(eventAccess).to(['query']),
  ]),

  // Individual Handicap Round (for GHIN-style tracking)
  IndividualRound: a.model({
    profileId: a.id().required(),
    profile: a.belongsTo('Profile', 'profileId'),
    
    date: a.date().required(),
    courseId: a.string().required(),
    teeName: a.string().required(),
    
    grossScore: a.integer().required(),
    netScore: a.integer(),
    courseHandicap: a.integer(),
    scoreDifferential: a.float(),
    courseRating: a.float(),
    slopeRating: a.integer(),
    
    // Optional reference to event if this round came from a completed event
    eventId: a.string(),
    
    // Optional reference to CompletedRound if created from event completion
    completedRoundId: a.string(),
    
    // Hole-by-hole scores (stored as JSON)
    scoresJson: a.json(),
  })
  .authorization(allow => [
    allow.owner(),
  ]),

  // Golf Event (Round with multiple players) or Group (chat hub)
  Event: a.model({
    name: a.string().required(),
    date: a.date().required(),
    
    // Course selection
    courseId: a.string(),
    teeName: a.string(),
    
    // Event metadata
    ownerProfileId: a.id().required(),
    eventOwner: a.belongsTo('Profile', 'ownerProfileId'),
    isPublic: a.boolean().default(false),
    isCompleted: a.boolean().default(false),
    completedAt: a.datetime(),
    
    // Hub type: 'event' (golf round) or 'group' (chat crew)
    hubType: a.string().default('event'),
    
    // Parent group ID - links events created from groups
    parentGroupId: a.string(),
    
    // Share code for joining
    shareCode: a.string(),
    
    // Scorecard view permission
    scorecardView: a.enum(['individual', 'team', 'admin']),
    
    // Event lifecycle status: 'setup' (configuring), 'started' (locked/in progress), 'completed' (final)
    status: a.enum(['setup', 'started', 'completed']),
    
    // Related data (stored as JSON for flexibility)
    memberUserIds: a.string().array(),
    golfersJson: a.json(), // EventGolfer[]
    groupsJson: a.json(), // Group[]
    scorecardsJson: a.json(), // PlayerScorecard[]
    gamesJson: a.json(), // EventGameConfig (nassau, skins, pinky, greenie)
    pinkyResultsJson: a.json(), // Pinky game results by config ID
    greenieResultsJson: a.json(), // Greenie game results by config ID
    chatJson: a.json(), // ChatMessage[] - stored as JSON for quick sync
    
    // Group-specific settings (only for hubType === 'group')
    groupSettingsJson: a.json(), // GroupSettings { visibility, joinPolicy, membersCanInvite }
    
    // Chat messages for this event (relationship - not currently used, keeping for future)
    chatMessages: a.hasMany('ChatMessage', 'eventId'),
    
    // Timestamps
    lastModified: a.datetime(),
  })
  .authorization(allow => [
    allow.owner(), // Owner can CRUD
    allow.ownersDefinedIn('memberUserIds').to(['read', 'update']),
    (allow as any).resource(eventAccess).to(['query', 'mutate']),
  ]),

  // Chat Message (scoped to event)
  ChatMessage: a.model({
    eventId: a.id().required(),
    event: a.belongsTo('Event', 'eventId'),
    
    profileId: a.string().required(), // Sender profile ID
    senderName: a.string(), // Sender name snapshot (for cross-device display)
    text: a.string().required(),
    
    // Support for bot messages
    isBot: a.boolean().default(false),
  })
  .authorization(allow => [
    allow.owner().to(['read', 'update', 'delete']),
    (allow as any).resource(eventAccess).to(['query', 'mutate']),
  ]),

  // Completed Round (analytics/history)
  CompletedRound: a.model({
    eventId: a.string().required(),
    eventName: a.string().required(),
    datePlayed: a.date().required(),
    
    courseId: a.string(),
    courseName: a.string().required(),
    teeName: a.string(),
    
    golferId: a.string().required(), // Profile ID
    golferName: a.string().required(),
    handicapIndex: a.float(),
    
    finalScore: a.integer().required(),
    scoreToPar: a.integer(),
    holesPlayed: a.integer().required(),
    
    // Detailed data (stored as JSON)
    holeScoresJson: a.json(),
    gameResultsJson: a.json(),
    statsJson: a.json(),
  })
  .authorization(allow => [
    allow.owner(),
  ]),

  // Course Data (for admin management)
  Course: a.model({
    courseId: a.string().required(),
    name: a.string().required(),
    location: a.string(),
    
    // Course definition (holes, pars, etc.) - stored as JSON
    holesJson: a.json(),
    teesJson: a.json(),
    
    // Metadata
    isActive: a.boolean().default(true),
    lastUpdated: a.datetime(),
  })
  .authorization(allow => [
    allow.publicApiKey(), // Allow API key for all operations (courses are public data)
    allow.authenticated(), // Authenticated users can do anything
  ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool', // Cognito User Pool
    // Enable API key for initial testing (remove in production)
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
