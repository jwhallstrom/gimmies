/**
 * Data Audit Script
 * 
 * Run this to examine data inconsistencies for a user.
 * 
 * Usage: npx ts-node scripts/audit-data.ts
 * Or: Copy and paste the core logic into browser console
 */

// For browser console use, copy from here:
/*
// Get store state
const state = window.__ZUSTAND_STORE__ || JSON.parse(localStorage.getItem('gimmies-golf-storage') || '{}')?.state;

console.log('=== DATA AUDIT ===');

// Current Profile
const profile = state?.currentProfile;
console.log('\n📋 CURRENT PROFILE:');
console.log('  ID:', profile?.id);
console.log('  Name:', profile?.name);
console.log('  userId:', profile?.userId);
console.log('  Stats:');
console.log('    - roundsPlayed:', profile?.stats?.roundsPlayed);
console.log('    - averageScore:', profile?.stats?.averageScore);

// Individual Rounds (from profile)
const individualRounds = profile?.individualRounds || [];
console.log('\n🏌️ INDIVIDUAL ROUNDS (profile.individualRounds):');
console.log('  Count:', individualRounds.length);
individualRounds.forEach((r, i) => {
  console.log(`  ${i+1}. ${r.courseName} - Score: ${r.grossScore}, Date: ${r.playedAt}`);
});

// Completed Rounds (from store)
const completedRounds = state?.completedRounds || [];
console.log('\n✅ COMPLETED ROUNDS (store.completedRounds):');
console.log('  Count:', completedRounds.length);
const myCompletedRounds = completedRounds.filter(r => r.golferId === profile?.id);
console.log('  My rounds:', myCompletedRounds.length);
myCompletedRounds.forEach((r, i) => {
  console.log(`  ${i+1}. ${r.courseName} - Score: ${r.finalScore}, Date: ${r.date}`);
});

// Events
const events = state?.events || [];
const completedEvents = state?.completedEvents || [];
console.log('\n📅 EVENTS:');
console.log('  Active:', events.length);
console.log('  Completed:', completedEvents.length);

// My events
const allEvents = [...events, ...completedEvents];
const myEvents = allEvents.filter(e => e.golfers?.some(g => g.profileId === profile?.id));
console.log('  My events:', myEvents.length);
myEvents.forEach((e, i) => {
  console.log(`  ${i+1}. ${e.name} at ${e.course?.name} - ${e.isCompleted ? '✅ Completed' : '🔄 Active'}`);
});

// Discrepancy Analysis
console.log('\n⚠️ DISCREPANCY ANALYSIS:');
const statsRounds = profile?.stats?.roundsPlayed || 0;
const actualIndividualRounds = individualRounds.length;
const actualCompletedRounds = myCompletedRounds.length;
const totalActual = actualIndividualRounds + actualCompletedRounds;

console.log(`  Profile stats say: ${statsRounds} rounds`);
console.log(`  Individual rounds: ${actualIndividualRounds}`);
console.log(`  Completed rounds: ${actualCompletedRounds}`);
console.log(`  Total actual: ${totalActual}`);

if (statsRounds !== totalActual) {
  console.log(`  ❌ MISMATCH: Stats (${statsRounds}) != Actual (${totalActual})`);
} else {
  console.log('  ✅ Stats match actual rounds');
}

// Check for duplicates
console.log('\n🔍 DUPLICATE CHECK:');
const roundIds = [...individualRounds.map(r => r.id), ...myCompletedRounds.map(r => r.id)];
const uniqueIds = [...new Set(roundIds)];
if (roundIds.length !== uniqueIds.length) {
  console.log(`  ❌ Found ${roundIds.length - uniqueIds.length} duplicate round IDs!`);
} else {
  console.log('  ✅ No duplicate round IDs');
}
*/

// TypeScript version for ts-node (requires AWS setup)
import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);
const client = generateClient();

async function auditUserData(userId: string) {
  console.log('=== CLOUD DATA AUDIT ===');
  console.log('Looking for userId:', userId);

  // Find profile
  const { data: profiles } = await (client.models as any).Profile.list({
    filter: { userId: { eq: userId } }
  });

  console.log('\n📋 PROFILES FOUND:', profiles?.length || 0);
  profiles?.forEach((p: any) => {
    console.log(`  - ${p.name} (ID: ${p.id})`);
    console.log(`    handicapIndex: ${p.handicapIndex}`);
  });

  if (!profiles?.length) {
    console.log('No profiles found for this user!');
    return;
  }

  const profileId = profiles[0].id;

  // Find individual rounds
  const { data: rounds } = await (client.models as any).IndividualRound.list({
    filter: { profileId: { eq: profileId } }
  });

  console.log('\n🏌️ INDIVIDUAL ROUNDS:', rounds?.length || 0);
  rounds?.forEach((r: any) => {
    console.log(`  - ${r.courseName}: ${r.grossScore} (${r.playedAt})`);
  });

  // Find events with this golfer
  const { data: events } = await (client.models as any).Event.list();
  
  console.log('\n📅 ALL EVENTS:', events?.length || 0);
  const myEvents = events?.filter((e: any) => {
    try {
      const golfers = JSON.parse(e.golfersJson || '[]');
      return golfers.some((g: any) => g.profileId === profileId);
    } catch {
      return false;
    }
  });

  console.log('MY EVENTS:', myEvents?.length || 0);
  myEvents?.forEach((e: any) => {
    console.log(`  - ${e.name} (ID: ${e.id}) - ${e.isCompleted ? '✅ Completed' : '🔄 Active'}`);
  });
}

// Run with: npx ts-node scripts/audit-data.ts <userId>
const userId = process.argv[2];
if (userId) {
  auditUserData(userId).catch(console.error);
} else {
  console.log('Usage: npx ts-node scripts/audit-data.ts <userId>');
  console.log('\nOr paste the browser console version above into your browser dev tools.');
}
