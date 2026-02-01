/**
 * Tournament Cloud Sync Utilities
 * Handles saving/loading tournaments to/from AWS Amplify DynamoDB
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { Tournament } from '../state/store';

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
 * Save tournament to cloud (DynamoDB)
 */
export async function saveTournamentToCloud(tournament: Tournament): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    const TournamentModel = (client.models as any)?.Tournament;
    if (!TournamentModel) {
      console.warn('🏆 saveTournamentToCloud: Tournament model not available in schema; skipping cloud save');
      return false;
    }

    console.log('🏆 saveTournamentToCloud: Saving tournament:', tournament.id, tournament.name);

    // startDate is required - use first date from array or today's date
    const startDate = tournament.dates[0] || new Date().toISOString().split('T')[0];
    const endDate = tournament.dates.length > 1 ? tournament.dates[tournament.dates.length - 1] : undefined;

    const cloudData = {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description || undefined,
      format: tournament.format,
      visibility: tournament.visibility,
      status: tournament.status,
      startDate: startDate,
      endDate: endDate,
      registrationDeadline: tournament.registrationDeadline || undefined,
      courseId: tournament.courseId || undefined,
      courseName: tournament.courseName || undefined,
      ownerProfileId: tournament.organizerId, // organizerId maps to ownerProfileId in cloud
      clubId: tournament.clubId || undefined,
      
      // Store complex objects as JSON
      configJson: JSON.stringify({
        rounds: tournament.rounds,
        maxPlayers: tournament.maxPlayers,
        entryFeeCents: tournament.entryFeeCents,
        entryFeeEnabled: tournament.entryFeeEnabled,
        earlyBirdFeeCents: tournament.earlyBirdFeeCents,
        earlyBirdDeadline: tournament.earlyBirdDeadline,
        prizePool: tournament.prizePool,
        rules: tournament.rules,
        waitlistEnabled: tournament.waitlistEnabled,
        clubName: tournament.clubName,
        isClubHosted: tournament.isClubHosted,
        // Betting overlay
        hasBettingOverlay: tournament.hasBettingOverlay,
        bettingGames: tournament.bettingGames,
        // Contact & branding
        contactEmail: tournament.contactEmail,
        contactPhone: tournament.contactPhone,
        bannerImage: tournament.bannerImage,
        sponsorLogos: tournament.sponsorLogos,
        // Full dates array preserved
        dates: tournament.dates,
      }),
      divisionsJson: JSON.stringify(tournament.divisions || []),
      teeTimesJson: JSON.stringify(tournament.teeTimes || []),
      registrationsJson: JSON.stringify(tournament.registrations || []),
      roundsJson: JSON.stringify(tournament.roundsData || []),
      standingsJson: JSON.stringify(tournament.standings || []),
    };

    // Try update first, then create if not exists
    const { data, errors } = await TournamentModel.update(cloudData);

    if (errors || !data) {
      console.log('🏆 saveTournamentToCloud: Update failed, attempting create...');
      const createResult = await TournamentModel.create(cloudData);
      
      if (createResult.errors) {
        console.error('❌ saveTournamentToCloud: Create failed:', createResult.errors);
        return false;
      }
      
      console.log('✅ saveTournamentToCloud: Tournament CREATED in cloud');
      return true;
    }

    console.log('✅ saveTournamentToCloud: Tournament UPDATED in cloud');
    return true;
  } catch (error) {
    console.error('❌ saveTournamentToCloud: Error:', error);
    return false;
  }
}

/**
 * Load tournament from cloud by ID
 */
export async function loadTournamentById(tournamentId: string): Promise<Tournament | null> {
  try {
    const client = getClient();
    if (!client) return null;

    const TournamentModel = (client.models as any)?.Tournament;
    if (!TournamentModel) {
      console.warn('📥 loadTournamentById: Tournament model not available in schema; returning null');
      return null;
    }

    console.log('📥 loadTournamentById: Loading tournament:', tournamentId);

    const { data: cloudTournament, errors } = await TournamentModel.get({ id: tournamentId });

    if (errors || !cloudTournament) {
      console.log('❌ loadTournamentById: Tournament not found');
      return null;
    }

    return cloudTournamentToLocal(cloudTournament);
  } catch (error) {
    console.error('❌ loadTournamentById: Error:', error);
    return null;
  }
}

/**
 * Load all tournaments for a profile (owned or registered)
 */
export async function loadTournamentsFromCloud(profileId: string): Promise<Tournament[]> {
  try {
    const client = getClient();
    if (!client) return [];

    const TournamentModel = (client.models as any)?.Tournament;
    if (!TournamentModel) {
      console.warn('📥 loadTournamentsFromCloud: Tournament model not available in schema; returning []');
      return [];
    }

    console.log('📥 loadTournamentsFromCloud: Loading tournaments for profile:', profileId);

    // Get all tournaments (we'll filter client-side for now)
    const { data: cloudTournaments, errors } = await TournamentModel.list();

    if (errors || !cloudTournaments) {
      console.error('❌ loadTournamentsFromCloud: Error:', errors);
      return [];
    }

    // Convert and filter - include owned OR registered
    const tournaments: Tournament[] = cloudTournaments
      .map((ct: any) => cloudTournamentToLocal(ct))
      .filter((t: Tournament) => 
        t.organizerId === profileId || 
        t.registrations.some((r: any) => r.profileId === profileId)
      );

    console.log(`✅ loadTournamentsFromCloud: Loaded ${tournaments.length} tournaments`);
    return tournaments;
  } catch (error) {
    console.error('❌ loadTournamentsFromCloud: Error:', error);
    return [];
  }
}

/**
 * Load public/published tournaments for discovery
 */
export async function loadPublicTournaments(): Promise<Tournament[]> {
  try {
    const client = getClient();
    if (!client) return [];

    const TournamentModel = (client.models as any)?.Tournament;
    if (!TournamentModel) {
      console.warn('📥 loadPublicTournaments: Tournament model not available in schema; returning []');
      return [];
    }

    console.log('📥 loadPublicTournaments: Loading public tournaments...');

    const { data: cloudTournaments, errors } = await TournamentModel.list({
      filter: {
        visibility: { eq: 'public' },
        status: { ne: 'draft' },
      }
    });

    if (errors || !cloudTournaments) {
      console.error('❌ loadPublicTournaments: Error:', errors);
      return [];
    }

    const tournaments = cloudTournaments.map((ct: any) => cloudTournamentToLocal(ct));
    console.log(`✅ loadPublicTournaments: Loaded ${tournaments.length} public tournaments`);
    return tournaments;
  } catch (error) {
    console.error('❌ loadPublicTournaments: Error:', error);
    return [];
  }
}

/**
 * Delete tournament from cloud
 */
export async function deleteTournamentFromCloud(tournamentId: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    const TournamentModel = (client.models as any)?.Tournament;
    if (!TournamentModel) {
      console.warn('🗑️ deleteTournamentFromCloud: Tournament model not available in schema; skipping delete');
      return false;
    }

    console.log('🗑️ deleteTournamentFromCloud: Deleting tournament:', tournamentId);

    const { errors } = await TournamentModel.delete({ id: tournamentId });

    if (errors) {
      console.error('❌ deleteTournamentFromCloud: Error:', errors);
      return false;
    }

    console.log('✅ deleteTournamentFromCloud: Tournament deleted');
    return true;
  } catch (error) {
    console.error('❌ deleteTournamentFromCloud: Error:', error);
    return false;
  }
}

/**
 * Convert cloud tournament to local format
 */
function cloudTournamentToLocal(cloudTournament: any): Tournament {
  // Parse config JSON
  const config = cloudTournament.configJson 
    ? JSON.parse(cloudTournament.configJson as string) 
    : {};

  // Reconstruct dates array from cloud data or config
  const dates = config.dates || [cloudTournament.startDate, cloudTournament.endDate].filter(Boolean);

  return {
    id: cloudTournament.id,
    name: cloudTournament.name,
    organizerId: cloudTournament.ownerProfileId, // ownerProfileId maps to organizerId locally
    
    // Club integration
    clubId: cloudTournament.clubId || undefined,
    clubName: config.clubName || undefined,
    isClubHosted: config.isClubHosted || false,
    
    courseId: cloudTournament.courseId || undefined,
    courseName: cloudTournament.courseName || undefined,
    dates: dates,
    rounds: config.rounds || 1,
    format: cloudTournament.format || 'stroke',
    visibility: cloudTournament.visibility || 'private',
    passcode: undefined, // Not stored in cloud for security
    
    // Entry fee & payments
    entryFeeCents: config.entryFeeCents || 0,
    entryFeeEnabled: config.entryFeeEnabled || false,
    earlyBirdFeeCents: config.earlyBirdFeeCents,
    earlyBirdDeadline: config.earlyBirdDeadline,
    
    // Prize pool
    prizePool: config.prizePool || { totalCents: 0, distribution: [], sidePots: [] },
    
    // Registration
    maxPlayers: config.maxPlayers || 0,
    waitlistEnabled: config.waitlistEnabled || false,
    registrationDeadline: cloudTournament.registrationDeadline || undefined,
    
    status: cloudTournament.status || 'draft',
    
    // Parse JSON arrays
    divisions: cloudTournament.divisionsJson 
      ? JSON.parse(cloudTournament.divisionsJson as string) 
      : [],
    teeTimes: cloudTournament.teeTimesJson 
      ? JSON.parse(cloudTournament.teeTimesJson as string) 
      : [],
    registrations: cloudTournament.registrationsJson 
      ? JSON.parse(cloudTournament.registrationsJson as string) 
      : [],
    roundsData: cloudTournament.roundsJson 
      ? JSON.parse(cloudTournament.roundsJson as string) 
      : [],
    standings: cloudTournament.standingsJson 
      ? JSON.parse(cloudTournament.standingsJson as string) 
      : [],
    
    // Betting overlay
    hasBettingOverlay: config.hasBettingOverlay || false,
    bettingGames: config.bettingGames,
    
    description: cloudTournament.description || undefined,
    rules: config.rules,
    
    // Contact & branding
    contactEmail: config.contactEmail,
    contactPhone: config.contactPhone,
    bannerImage: config.bannerImage,
    sponsorLogos: config.sponsorLogos,
    
    createdAt: cloudTournament.createdAt,
    updatedAt: cloudTournament.updatedAt,
  };
}
