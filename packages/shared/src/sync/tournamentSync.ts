/**
 * Tournament Cloud Sync
 * Shared tournament sync utilities
 */

import { getAmplifyClient } from './amplifyClient';
import type { Tournament } from '../types';

/**
 * Save tournament to cloud
 */
export async function saveTournamentToCloud(tournament: Tournament): Promise<boolean> {
  try {
    const client = getAmplifyClient();
    if (!client) return false;

    console.log('🏆 saveTournamentToCloud:', tournament.id, tournament.name);

    const startDate = tournament.dates[0] || new Date().toISOString().split('T')[0];
    const endDate = tournament.dates.length > 1 ? tournament.dates[tournament.dates.length - 1] : undefined;

    const cloudData = {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description || undefined,
      format: tournament.format,
      visibility: tournament.visibility,
      status: tournament.status,
      startDate,
      endDate,
      registrationDeadline: tournament.registrationDeadline || undefined,
      courseId: tournament.courseId || undefined,
      courseName: tournament.courseName || undefined,
      ownerProfileId: tournament.organizerId,
      clubId: tournament.clubId || undefined,
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
        hasBettingOverlay: tournament.hasBettingOverlay,
        bettingGames: tournament.bettingGames,
        contactEmail: tournament.contactEmail,
        contactPhone: tournament.contactPhone,
        bannerImage: tournament.bannerImage,
        sponsorLogos: tournament.sponsorLogos,
        dates: tournament.dates,
      }),
      divisionsJson: JSON.stringify(tournament.divisions || []),
      teeTimesJson: JSON.stringify(tournament.teeTimes || []),
      registrationsJson: JSON.stringify(tournament.registrations || []),
      roundsJson: JSON.stringify(tournament.roundsData || []),
      standingsJson: JSON.stringify(tournament.standings || []),
    };

    const { data, errors } = await (client.models as any).Tournament.update(cloudData);

    if (errors || !data) {
      const createResult = await (client.models as any).Tournament.create(cloudData);
      if (createResult.errors) {
        console.error('❌ Tournament create failed:', createResult.errors);
        return false;
      }
      console.log('✅ Tournament CREATED');
      return true;
    }

    console.log('✅ Tournament UPDATED');
    return true;
  } catch (error) {
    console.error('❌ saveTournamentToCloud error:', error);
    return false;
  }
}

/**
 * Load tournaments for a profile
 */
export async function loadTournamentsFromCloud(profileId: string): Promise<Tournament[]> {
  try {
    const client = getAmplifyClient();
    if (!client) return [];

    const { data: cloudTournaments, errors } = await (client.models as any).Tournament.list();

    if (errors || !cloudTournaments) {
      console.error('❌ loadTournamentsFromCloud error:', errors);
      return [];
    }

    const tournaments: Tournament[] = cloudTournaments
      .map((ct: any) => cloudTournamentToLocal(ct))
      .filter((t: Tournament) => 
        t.organizerId === profileId || 
        t.registrations.some(r => r.profileId === profileId)
      );

    console.log(`✅ Loaded ${tournaments.length} tournaments`);
    return tournaments;
  } catch (error) {
    console.error('❌ loadTournamentsFromCloud error:', error);
    return [];
  }
}

/**
 * Load public tournaments
 */
export async function loadPublicTournaments(): Promise<Tournament[]> {
  try {
    const client = getAmplifyClient();
    if (!client) return [];

    const { data: cloudTournaments, errors } = await (client.models as any).Tournament.list({
      filter: {
        visibility: { eq: 'public' },
        status: { ne: 'draft' },
      }
    });

    if (errors || !cloudTournaments) return [];

    return cloudTournaments.map((ct: any) => cloudTournamentToLocal(ct));
  } catch (error) {
    console.error('❌ loadPublicTournaments error:', error);
    return [];
  }
}

/**
 * Delete tournament from cloud
 */
export async function deleteTournamentFromCloud(tournamentId: string): Promise<boolean> {
  try {
    const client = getAmplifyClient();
    if (!client) return false;

    const { errors } = await (client.models as any).Tournament.delete({ id: tournamentId });
    if (errors) {
      console.error('❌ deleteTournamentFromCloud error:', errors);
      return false;
    }

    console.log('✅ Tournament deleted');
    return true;
  } catch (error) {
    console.error('❌ deleteTournamentFromCloud error:', error);
    return false;
  }
}

/**
 * Convert cloud tournament to local format
 */
function cloudTournamentToLocal(ct: any): Tournament {
  const config = ct.configJson ? JSON.parse(ct.configJson) : {};
  const dates = config.dates || [ct.startDate, ct.endDate].filter(Boolean);

  return {
    id: ct.id,
    name: ct.name,
    organizerId: ct.ownerProfileId,
    clubId: ct.clubId || undefined,
    clubName: config.clubName || undefined,
    isClubHosted: config.isClubHosted || false,
    courseId: ct.courseId || undefined,
    courseName: ct.courseName || undefined,
    dates,
    rounds: config.rounds || 1,
    format: ct.format || 'stroke',
    visibility: ct.visibility || 'private',
    passcode: undefined,
    entryFeeCents: config.entryFeeCents || 0,
    entryFeeEnabled: config.entryFeeEnabled || false,
    earlyBirdFeeCents: config.earlyBirdFeeCents,
    earlyBirdDeadline: config.earlyBirdDeadline,
    prizePool: config.prizePool || { totalCents: 0, distribution: [], sidePots: [] },
    maxPlayers: config.maxPlayers || 0,
    waitlistEnabled: config.waitlistEnabled || false,
    registrationDeadline: ct.registrationDeadline || undefined,
    status: ct.status || 'draft',
    divisions: ct.divisionsJson ? JSON.parse(ct.divisionsJson) : [],
    teeTimes: ct.teeTimesJson ? JSON.parse(ct.teeTimesJson) : [],
    registrations: ct.registrationsJson ? JSON.parse(ct.registrationsJson) : [],
    roundsData: ct.roundsJson ? JSON.parse(ct.roundsJson) : [],
    standings: ct.standingsJson ? JSON.parse(ct.standingsJson) : [],
    hasBettingOverlay: config.hasBettingOverlay || false,
    bettingGames: config.bettingGames,
    description: ct.description || undefined,
    rules: config.rules,
    contactEmail: config.contactEmail,
    contactPhone: config.contactPhone,
    bannerImage: config.bannerImage,
    sponsorLogos: config.sponsorLogos,
    createdAt: ct.createdAt,
    updatedAt: ct.updatedAt,
  };
}
