import { useMemo } from 'react';
import useStore from '../state/store';
import { calculateEventPayouts } from '../games/payouts';
import { getParticipantsForConfig } from '../games/participants';

export interface GameMoneyLine {
  name: string;
  amount: number;
}

export function useMyEventPayout(eventId: string) {
  const event = useStore((s) =>
    s.events.find((e) => e.id === eventId) || s.completedEvents.find((e) => e.id === eventId)
  );
  const profiles = useStore((s) => s.profiles);
  const currentProfile = useStore((s) => s.currentProfile);
  const myGolferId = currentProfile?.id;

  const games = event?.games;
  const nassau = games?.nassau || [];
  const skins = games?.skins || [];
  const pinky = games?.pinky || [];
  const greenie = games?.greenie || [];
  const stableford = games?.stableford || [];
  const ninePoint = games?.ninePoint || [];
  const bbb = games?.bingoBangoBongo || [];
  const wolf = games?.wolf || [];
  const dots = games?.dots || [];

  const hasAnyGames =
    nassau.length +
      skins.length +
      pinky.length +
      greenie.length +
      stableford.length +
      ninePoint.length +
      bbb.length +
      wolf.length +
      dots.length >
    0;

  const payouts = useMemo(() => {
    if (!event || !hasAnyGames) return null;
    return calculateEventPayouts(event as any, profiles);
  }, [event, profiles, hasAnyGames]);

  const allScoresComplete = event?.scorecards?.every((sc: any) =>
    sc.scores?.every((s: any) => s.strokes != null)
  );
  const hasAnyScoresEntered = event?.scorecards?.some((sc: any) =>
    sc.scores?.some((s: any) => s.strokes != null)
  );
  const canPreviewPayouts = Boolean(
    event?.isCompleted ||
      hasAnyScoresEntered
  );

  const result = useMemo(() => {
    if (!event || !myGolferId || !payouts) {
      return {
        hasAnyGames,
        canPreviewPayouts,
        myNet: null as number | null,
        myBuyin: 0,
        myWinnings: 0,
        buyinBreakdown: [] as GameMoneyLine[],
        winningsBreakdown: [] as GameMoneyLine[],
      };
    }

    const isParticipant = (cfg: any, game: 'nassau' | 'skins' | 'stableford') =>
      getParticipantsForConfig(event as any, cfg, game, {
        restrictToGroup: game === 'nassau',
        assignedTeamsOnly: game === 'nassau' && Array.isArray(cfg?.teams) && cfg.teams.length >= 2,
      }).includes(myGolferId);

    let buyin = 0;
    const buyinBreakdown: GameMoneyLine[] = [];

    nassau.forEach((n: any, idx: number) => {
      if (!isParticipant(n, 'nassau')) return;
      const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
      const cost = (fees.out || 0) + (fees.in || 0) + (fees.total || 0);
      buyin += cost;
      buyinBreakdown.push({ name: nassau.length > 1 ? `Nassau ${idx + 1}` : 'Nassau', amount: cost });
    });

    skins.forEach((s: any, idx: number) => {
      if (!isParticipant(s, 'skins')) return;
      const cost = s.fee || 0;
      buyin += cost;
      buyinBreakdown.push({ name: skins.length > 1 ? `Skins ${idx + 1}` : 'Skins', amount: cost });
    });

    stableford.forEach((s: any, idx: number) => {
      if (!isParticipant(s, 'stableford')) return;
      const cost = s.fee || 0;
      buyin += cost;
      buyinBreakdown.push({ name: stableford.length > 1 ? `Stableford ${idx + 1}` : 'Stableford', amount: cost });
    });

    const winnings = payouts.totalByGolfer[myGolferId] || 0;
    const winningsBreakdown: GameMoneyLine[] = [];

    const pushIfGame = (name: string, amount: number, configured: boolean) => {
      if (!configured) return;
      winningsBreakdown.push({ name, amount });
    };

    pushIfGame(
      'Nassau',
      (payouts.nassau || []).reduce((t: number, n: any) => t + (n?.winningsByGolfer?.[myGolferId] || 0), 0),
      nassau.length > 0
    );
    pushIfGame(
      'Skins',
      (payouts.skins || []).reduce((t: number, s: any) => t + (s?.winningsByGolfer?.[myGolferId] || 0), 0),
      skins.length > 0
    );
    pushIfGame(
      'Pinky',
      (payouts.pinky || []).reduce((t: number, p: any) => t + (p?.owingsByGolfer?.[myGolferId] || 0), 0),
      pinky.length > 0
    );
    pushIfGame(
      'Greenie',
      (payouts.greenie || []).reduce((t: number, g: any) => t + (g?.owingsByGolfer?.[myGolferId] || 0), 0),
      greenie.length > 0
    );
    pushIfGame(
      'Stableford',
      (payouts.stableford || []).reduce((t: number, s: any) => t + (s?.winningsByGolfer?.[myGolferId] || 0), 0),
      stableford.length > 0
    );
    pushIfGame(
      '9-Point',
      (payouts.ninePoint || []).reduce((t: number, np: any) => t + (np?.owingsByGolfer?.[myGolferId] || 0), 0),
      ninePoint.length > 0
    );
    pushIfGame(
      'BBB',
      (payouts.bingoBangoBongo || []).reduce((t: number, b: any) => t + (b?.owingsByGolfer?.[myGolferId] || 0), 0),
      bbb.length > 0
    );
    pushIfGame(
      'Wolf',
      (payouts.wolf || []).reduce((t: number, w: any) => t + (w?.owingsByGolfer?.[myGolferId] || 0), 0),
      wolf.length > 0
    );
    pushIfGame(
      'Dots',
      (payouts.dots || []).reduce((t: number, d: any) => t + (d?.owingsByGolfer?.[myGolferId] || 0), 0),
      dots.length > 0
    );

    return {
      hasAnyGames,
      canPreviewPayouts,
      myNet: winnings - buyin,
      myBuyin: buyin,
      myWinnings: winnings,
      buyinBreakdown,
      winningsBreakdown,
    };
  }, [
    event,
    myGolferId,
    payouts,
    hasAnyGames,
    canPreviewPayouts,
    nassau.length,
    skins.length,
    pinky.length,
    greenie.length,
    stableford.length,
    ninePoint.length,
    bbb.length,
    wolf.length,
    dots.length,
  ]);

  return {
    ...result,
    allScoresComplete,
    showMoneyChip: hasAnyGames && canPreviewPayouts,
  };
}

export function formatSignedMoney(amount: number): string {
  const abs = Math.abs(amount).toFixed(2);
  if (amount > 0) return `+$${abs}`;
  if (amount < 0) return `−$${abs}`;
  return '$0.00';
}
