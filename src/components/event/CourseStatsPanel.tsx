import React from 'react';

export type CourseStatsPlayer = {
  name: string;
  totalStrokes: number;
  holesPlayed: number;
};

type HoleMeta = { number: number; par?: number };

type Props = {
  event: { scorecards: Array<{ scores?: Array<{ hole: number; strokes?: number | null }> }> };
  holes: HoleMeta[];
  holeParByNumber: Record<number, number>;
  playersWithScores: CourseStatsPlayer[];
  totalPar: number | null;
};

const CourseStatsPanel: React.FC<Props> = ({
  event,
  holes,
  holeParByNumber,
  playersWithScores,
  totalPar,
}) => {
  const holeNumbers = holes.map((h) => h.number).sort((a, b) => a - b);
  const front9 = holeNumbers.filter((h) => h <= 9);
  const back9 = holeNumbers.filter((h) => h >= 10);

  type HoleStat = {
    hole: number;
    par: number;
    scores: number[];
    avg: number;
    avgVsPar: number;
    eagles: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doubles: number;
    triples: number;
    rank?: number;
  };

  const holeStats: HoleStat[] = holeNumbers.map((h) => {
    const par = holeParByNumber[h] || 4;
    const scores: number[] = [];

    event.scorecards.forEach((sc) => {
      const s = sc.scores?.find((x) => x.hole === h);
      if (s?.strokes != null) scores.push(s.strokes);
    });

    let eagles = 0,
      birdies = 0,
      pars = 0,
      bogeys = 0,
      doubles = 0,
      triples = 0;
    scores.forEach((s) => {
      const diff = s - par;
      if (diff <= -2) eagles++;
      else if (diff === -1) birdies++;
      else if (diff === 0) pars++;
      else if (diff === 1) bogeys++;
      else if (diff === 2) doubles++;
      else triples++;
    });

    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : par;
    return { hole: h, par, scores, avg, avgVsPar: avg - par, eagles, birdies, pars, bogeys, doubles, triples };
  });

  const sorted = [...holeStats].sort((a, b) => b.avgVsPar - a.avgVsPar);
  sorted.forEach((h, i) => {
    h.rank = i + 1;
  });
  holeStats.forEach((h) => {
    h.rank = sorted.find((s) => s.hole === h.hole)?.rank;
  });

  const totals = holeStats.reduce(
    (acc, h) => ({
      eagles: acc.eagles + h.eagles,
      birdies: acc.birdies + h.birdies,
      pars: acc.pars + h.pars,
      bogeys: acc.bogeys + h.bogeys,
      doubles: acc.doubles + h.doubles,
      triples: acc.triples + h.triples,
    }),
    { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, triples: 0 }
  );

  const allScores = holeStats.flatMap((h) => h.scores);
  const fieldAvg =
    allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / playersWithScores.length : 0;
  const lowRound = playersWithScores.reduce(
    (best, p) => {
      if (!best || (p.totalStrokes > 0 && p.holesPlayed >= 18 && p.totalStrokes < best.totalStrokes))
        return p;
      return best;
    },
    null as CourseStatsPlayer | null
  );

  const front9Avg =
    front9.length > 0 ? holeStats.filter((h) => h.hole <= 9).reduce((s, h) => s + h.avg, 0) : null;
  const back9Avg =
    back9.length > 0 ? holeStats.filter((h) => h.hole >= 10).reduce((s, h) => s + h.avg, 0) : null;

  const hardestHole = sorted[0];
  const easiestHole = sorted[sorted.length - 1];

  const getDiffBg = (avgVsPar: number) => {
    if (avgVsPar <= -0.3) return 'bg-emerald-100 text-emerald-800';
    if (avgVsPar <= 0.1) return 'bg-slate-100 text-slate-700';
    if (avgVsPar <= 0.5) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const getBarWidth = (count: number, total: number) => (total > 0 ? Math.max(2, (count / total) * 100) : 0);

  const renderHalfStats = (holeRange: number[], label: string) => {
    const rangeStats = holeStats.filter((h) => holeRange.includes(h.hole));
    const rangePar = rangeStats.reduce((s, h) => s + h.par, 0);
    const rangeAvg = rangeStats.reduce((s, h) => s + h.avg, 0);
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
          <div className="text-[10px] text-slate-500">
            Par {rangePar} · Avg {rangeAvg.toFixed(1)}
          </div>
        </div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100/80">
                <th className="px-1.5 py-1 text-left font-bold text-slate-500 w-[38px]">Hole</th>
                <th className="px-1 py-1 text-center font-bold text-slate-500 w-[30px]">Par</th>
                <th className="px-1 py-1 text-center font-bold text-slate-500 w-[36px]">Avg</th>
                <th className="px-1 py-1 text-center font-bold text-slate-500 w-[32px]">+/-</th>
                <th className="px-1 py-1 text-center font-bold text-slate-500 w-[24px]">#</th>
                <th className="px-1.5 py-1 font-bold text-slate-500 text-left">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {rangeStats.map((h) => {
                const totalScored = h.scores.length;
                const isHardest = h.hole === hardestHole?.hole;
                const isEasiest = h.hole === easiestHole?.hole;
                return (
                  <tr
                    key={h.hole}
                    className={`border-t border-slate-100 ${isHardest ? 'bg-red-50/50' : isEasiest ? 'bg-emerald-50/50' : ''}`}
                  >
                    <td className="px-1.5 py-1.5 font-bold text-slate-700">
                      <div className="flex items-center gap-1">
                        {h.hole}
                        {isHardest && <span className="text-[8px] text-red-500 font-black">H</span>}
                        {isEasiest && <span className="text-[8px] text-emerald-500 font-black">E</span>}
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-center text-slate-600">{h.par}</td>
                    <td className="px-1 py-1.5 text-center font-mono font-bold text-slate-800">
                      {h.avg.toFixed(1)}
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <span
                        className={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${getDiffBg(h.avgVsPar)}`}
                      >
                        {h.avgVsPar >= 0 ? '+' : ''}
                        {h.avgVsPar.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-1 py-1.5 text-center text-slate-500 text-[10px]">{h.rank}</td>
                    <td className="px-1.5 py-1.5">
                      {totalScored > 0 ? (
                        <div className="flex h-3 rounded-full overflow-hidden bg-slate-200/60">
                          {h.eagles > 0 && (
                            <div
                              className="bg-amber-400"
                              style={{ width: `${getBarWidth(h.eagles, totalScored)}%` }}
                              title={`Eagles: ${h.eagles}`}
                            />
                          )}
                          {h.birdies > 0 && (
                            <div
                              className="bg-emerald-500"
                              style={{ width: `${getBarWidth(h.birdies, totalScored)}%` }}
                              title={`Birdies: ${h.birdies}`}
                            />
                          )}
                          {h.pars > 0 && (
                            <div
                              className="bg-slate-400"
                              style={{ width: `${getBarWidth(h.pars, totalScored)}%` }}
                              title={`Pars: ${h.pars}`}
                            />
                          )}
                          {h.bogeys > 0 && (
                            <div
                              className="bg-orange-400"
                              style={{ width: `${getBarWidth(h.bogeys, totalScored)}%` }}
                              title={`Bogeys: ${h.bogeys}`}
                            />
                          )}
                          {h.doubles > 0 && (
                            <div
                              className="bg-red-500"
                              style={{ width: `${getBarWidth(h.doubles, totalScored)}%` }}
                              title={`Doubles: ${h.doubles}`}
                            />
                          )}
                          {h.triples > 0 && (
                            <div
                              className="bg-red-800"
                              style={{ width: `${getBarWidth(h.triples, totalScored)}%` }}
                              title={`Triples+: ${h.triples}`}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-0">
      <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
            <div className="text-[10px] text-slate-500 font-semibold uppercase">Field Avg</div>
            <div className="text-lg font-black text-slate-800 dark:text-white">{fieldAvg.toFixed(1)}</div>
            {totalPar != null && (
              <div className="text-[10px] text-slate-500">
                {fieldAvg - totalPar >= 0 ? '+' : ''}
                {(fieldAvg - totalPar).toFixed(1)} vs par
              </div>
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
            <div className="text-[10px] text-slate-500 font-semibold uppercase">Low Round</div>
            <div className="text-lg font-black text-slate-800 dark:text-white">
              {lowRound && lowRound.holesPlayed >= 18 ? lowRound.totalStrokes : '-'}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {lowRound && lowRound.holesPlayed >= 18 ? lowRound.name : 'In progress'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
            <div className="text-[10px] text-slate-500 font-semibold uppercase">By Nine</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white leading-tight mt-0.5">
              {front9Avg != null ? front9Avg.toFixed(1) : '-'}{' '}
              <span className="text-slate-400 font-normal">/</span>{' '}
              {back9Avg != null ? back9Avg.toFixed(1) : '-'}
            </div>
            <div className="text-[10px] text-slate-500">Front / Back</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {totals.eagles > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Eagles {totals.eagles}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Birdies {totals.birdies}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> Pars {totals.pars}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
            <span className="w-2 h-2 rounded-full bg-orange-400" /> Bogeys {totals.bogeys}
          </span>
          {totals.doubles > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Doubles {totals.doubles}
            </span>
          )}
          {totals.triples > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-200 text-red-900 text-[10px] font-bold">
              <span className="w-2 h-2 rounded-full bg-red-800" /> Triple+ {totals.triples}
            </span>
          )}
        </div>
      </div>

      <div className="px-3 py-3">
        {front9.length > 0 && renderHalfStats(front9, 'Front 9')}
        {back9.length > 0 && renderHalfStats(back9, 'Back 9')}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <span className="text-[9px] text-slate-400 font-semibold uppercase">Key:</span>
          <span className="text-[9px] text-slate-400 font-semibold uppercase"># = Difficulty Rank</span>
          <span className="text-[8px] text-red-500 font-black">H</span>
          <span className="text-[9px] text-slate-500">Hardest</span>
          <span className="text-[8px] text-emerald-500 font-black">E</span>
          <span className="text-[9px] text-slate-500">Easiest</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            <span className="text-[9px] text-slate-500">Eagle</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-[9px] text-slate-500">Birdie</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
            <span className="text-[9px] text-slate-500">Par</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" />
            <span className="text-[9px] text-slate-500">Bogey</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
            <span className="text-[9px] text-slate-500">Dbl</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-800" />
            <span className="text-[9px] text-slate-500">Trpl+</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseStatsPanel;
