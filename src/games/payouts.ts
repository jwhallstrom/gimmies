import { Event } from '../state/store';
import { computeAllNassau } from './nassau';
import { computeSkins } from './skins';
import { computeAllPinky } from './pinky';
import { computeAllGreenie } from './greenie';

export interface EventPayouts {
  nassau: ReturnType<typeof computeAllNassau>;
  skins: (ReturnType<typeof computeSkins> | null)[];
  pinky: ReturnType<typeof computeAllPinky>;
  greenie: ReturnType<typeof computeAllGreenie>;
  totalByGolfer: Record<string, number>;
}

export function calculateEventPayouts(event: Event, profiles: any[]): EventPayouts {
  const nassau = computeAllNassau(event, profiles);
  const skins = (event.games.skins || []).map(cfg => computeSkins(event, cfg, profiles));
  const pinky = computeAllPinky(event, event.pinkyResults || {});
  const greenie = computeAllGreenie(event, event.greenieResults || {});
  const totalByGolfer: Record<string, number> = {};
  event.golfers.forEach(g => {
    const golferId = g.profileId || g.customName;
    if (golferId) totalByGolfer[golferId] = 0;
  });
  nassau.forEach(n => {
    Object.entries(n.winningsByGolfer).forEach(([gid, amt]) => (totalByGolfer[gid] += amt));
  });
  skins.forEach(s => {
    if (!s) return;
    Object.entries(s.winningsByGolfer).forEach(([gid, amt]) => (totalByGolfer[gid] += amt));
  });
  pinky.forEach(p => {
    Object.entries(p.owingsByGolfer).forEach(([gid, amt]) => (totalByGolfer[gid] += amt));
  });
  greenie.forEach(g => {
    Object.entries(g.owingsByGolfer).forEach(([gid, amt]) => (totalByGolfer[gid] += amt));
  });
  return { nassau, skins, pinky, greenie, totalByGolfer };
}
