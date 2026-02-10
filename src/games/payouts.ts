import { Event } from '../state/store';
import { computeAllNassau } from './nassau';
import { computeSkins } from './skins';
import { computeAllPinky } from './pinky';
import { computeAllGreenie } from './greenie';
import { computeAllStableford, type StablefordSummary } from './stableford';
import { computeAllNinePoint, type NinePointSummary } from './ninePoint';
import { computeAllBingoBangoBongo, type BingoBangoBongoSummary } from './bingoBangoBongo';
import { computeAllWolf, type WolfSummary } from './wolf';
import { computeAllDots, type DotsSummary } from './dots';

export interface EventPayouts {
  nassau: ReturnType<typeof computeAllNassau>;
  skins: (ReturnType<typeof computeSkins> | null)[];
  pinky: ReturnType<typeof computeAllPinky>;
  greenie: ReturnType<typeof computeAllGreenie>;
  stableford: StablefordSummary[];
  ninePoint: NinePointSummary[];
  bingoBangoBongo: BingoBangoBongoSummary[];
  wolf: WolfSummary[];
  dots: DotsSummary[];
  totalByGolfer: Record<string, number>;
}

export function calculateEventPayouts(event: Event, profiles: any[]): EventPayouts {
  const nassau = computeAllNassau(event, profiles);
  const skins = (event.games.skins || []).map(cfg => computeSkins(event, cfg, profiles));
  const pinky = computeAllPinky(event, event.pinkyResults || {});
  const greenie = computeAllGreenie(event, event.greenieResults || {});
  const stableford = computeAllStableford(event, profiles);
  const ninePoint = computeAllNinePoint(event, profiles);
  const bingoBangoBongo = computeAllBingoBangoBongo(event, event.bbbResults || {});
  const wolf = computeAllWolf(event, event.wolfResults || {});
  const dots = computeAllDots(event, event.dotsResults || {});

  const totalByGolfer: Record<string, number> = {};
  event.golfers.forEach(g => {
    const golferId = g.profileId || g.customName;
    if (golferId) totalByGolfer[golferId] = 0;
  });

  // Pot-based games (winningsByGolfer)
  nassau.forEach(n => {
    Object.entries(n.winningsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });
  skins.forEach(s => {
    if (!s) return;
    Object.entries(s.winningsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });
  stableford.forEach(s => {
    Object.entries(s.winningsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });

  // Peer-to-peer games (owingsByGolfer)
  pinky.forEach(p => {
    Object.entries(p.owingsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });
  greenie.forEach(g => {
    Object.entries(g.owingsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });
  ninePoint.forEach(np => {
    Object.entries(np.owingsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });
  bingoBangoBongo.forEach(b => {
    Object.entries(b.owingsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });
  wolf.forEach(w => {
    Object.entries(w.owingsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });
  dots.forEach(d => {
    Object.entries(d.owingsByGolfer).forEach(([gid, amt]) => {
      totalByGolfer[gid] = (totalByGolfer[gid] || 0) + amt;
    });
  });

  return { nassau, skins, pinky, greenie, stableford, ninePoint, bingoBangoBongo, wolf, dots, totalByGolfer };
}
