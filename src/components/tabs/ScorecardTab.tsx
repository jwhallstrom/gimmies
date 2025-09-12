import React, { useState, useEffect } from 'react';
import useStore from '../../state/store';
import { courseMap } from '../../data/courses';
import { strokesForHole, courseHandicap } from '../../games/handicap';

type Props = { eventId: string };

const ScorecardTab: React.FC<Props> = ({ eventId }) => {
  const { events, profiles, currentProfile, updateScore } = useStore();
  const event = events.find((e: any) => e.id === eventId);
  if (!event) return null;
  const holes = event.course.courseId ? courseMap[event.course.courseId].holes : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4 }));
  const front = holes.slice(0, 9);
  const back = holes.slice(9);
  const [view, setView] = useState<'front'|'back'|'full'>('full');
  // On very small screens default to front to avoid horizontal scroll.
  useEffect(()=>{
    if (typeof window !== 'undefined' && window.innerWidth < 640) setView('front');
  },[]);
  const showFront = view === 'front' || view === 'full';
  const showBack = view === 'back' || view === 'full';
  return (
  <div className="overflow-x-auto rounded-lg shadow-inner bg-white/95 backdrop-blur border border-primary-900/10">
      <div className="flex items-center justify-between px-3 pt-2 pb-1 gap-2 flex-wrap">
        <div className="flex gap-1 text-[11px] font-medium rounded-md overflow-hidden border border-primary-200 bg-primary-50">
          {(['front','back','full'] as const).map(v => (
            <button key={v} onClick={()=>setView(v)}
              className={`px-2 py-1 capitalize tracking-wide ${view===v? 'bg-primary-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>{v}</button>
          ))}
        </div>
        <div className="text-[10px] sm:text-[11px] flex flex-wrap gap-2 leading-tight">
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-fuchsia-600 block"></span> ≤ -3</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-500 block"></span> -2</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-green-500 block"></span> -1</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-neutral-200 border border-neutral-300 block"></span> E</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-orange-200 block"></span> +1</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-300 block"></span> +2</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-600 block"></span> 3+</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-[10px] sm:text-[11px] border-collapse min-w-full">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left bg-primary-50 sticky left-0 z-10 min-w-[100px] sm:min-w-[120px]">Golfer</th>
              {showFront && front.map((h: any) => (
                <th key={h.number} className="border px-0.5 py-0.5 text-center w-7 sm:w-8 md:w-9 bg-primary-50/60">{h.number}</th>
              ))}
              {view!=='back' && showFront && <th className="border px-1 py-1 text-center w-7 sm:w-9 md:w-10 bg-primary-100/70">Out</th>}
              {showBack && back.map((h: any) => (
                <th key={h.number} className="border px-0.5 py-0.5 text-center w-7 sm:w-8 md:w-9 bg-primary-50/60">{h.number}</th>
              ))}
              {view!=='front' && showBack && <th className="border px-1 py-1 text-center w-7 sm:w-9 md:w-10 bg-primary-100/70">In</th>}
              {view==='full' && <th className="border px-1 py-1 text-center w-9 sm:w-10 md:w-12 bg-primary-100/70">Total</th>}
            </tr>
            <tr>
              <th className="border px-2 py-1 text-left bg-primary-50 sticky left-0 z-10">Par</th>
              {showFront && front.map((h: any) => (
                <th key={h.number} className="border px-0.5 py-0.5 text-center">{h.par}</th>
              ))}
              {view!=='back' && showFront && <th className="border px-0.5 py-0.5 text-center font-semibold bg-primary-50/60">{front.reduce((a:any,h:any)=>a+h.par,0)}</th>}
              {showBack && back.map((h: any) => (
                <th key={h.number} className="border px-0.5 py-0.5 text-center">{h.par}</th>
              ))}
              {view!=='front' && showBack && <th className="border px-0.5 py-0.5 text-center font-semibold bg-primary-50/60">{back.reduce((a:any,h:any)=>a+h.par,0)}</th>}
              {view==='full' && <th className="border px-0.5 py-0.5 text-center font-semibold bg-primary-50">{holes.reduce((a:any,h:any)=>a+h.par,0)}</th>}
            </tr>
          </thead>
        <tbody>
          {event.golfers.map((eventGolfer: any) => {
            const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
            const displayName = profile ? profile.name : eventGolfer.customName;
            if (!displayName) return null;
            
            const sc = event.scorecards.find((s: any) => s.golferId === (eventGolfer.profileId || eventGolfer.customName))!;
            const frontScores = sc.scores.slice(0,9).map((s:any)=>s.strokes);
            const backScores = sc.scores.slice(9).map((s:any)=>s.strokes);
            const completeFront = frontScores.every((v:any)=>v!=null);
            const completeBack = backScores.every((v:any)=>v!=null);
            const frontSum = completeFront ? frontScores.reduce((a:number,b:number)=>a+b,0) : null;
            const backSum = completeBack ? backScores.reduce((a:number,b:number)=>a+b,0) : null;
            const totalSum = (frontSum!=null && backSum!=null) ? frontSum + backSum : null;
            return (
              <tr key={eventGolfer.profileId || eventGolfer.customName}>
                <td className="border px-2 py-1 bg-white sticky left-0 z-10 shadow-sm align-top">
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium text-[11px]">{displayName}</span>
                    {(() => { 
                      const handicap = eventGolfer.handicapOverride ?? (profile?.handicapIndex ?? null);
                      return handicap != null ? <span className="text-[9px] text-primary-700 font-semibold">CH {courseHandicap(event, eventGolfer.profileId || eventGolfer.customName, profiles)?.toFixed(1) || 'N/A'}</span> : null; 
                    })()}
                  </div>
                </td>
                {showFront && sc.scores.slice(0,9).map((s: any) => {
                  const holeMeta = holes.find((h:any)=>h.number===s.hole);
                  const par = holeMeta?.par ?? 4;
                  const hcpStrokes = strokesForHole(event, eventGolfer.profileId || eventGolfer.customName, s.hole, profiles);
                  const gross = s.strokes;
                  const net = gross != null ? gross - hcpStrokes : null;
                  const diff = gross != null ? gross - par : null; // relation to par
                  let colorClass = '';
                  if (diff != null) {
                    if (diff <= -3) colorClass = 'bg-fuchsia-600 text-white font-semibold';
                    else if (diff === -2) colorClass = 'bg-amber-500 text-black font-semibold';
                    else if (diff === -1) colorClass = 'bg-green-500 text-white font-semibold';
                    else if (diff === 0) colorClass = 'bg-neutral-50';
                    else if (diff === 1) colorClass = 'bg-orange-200';
                    else if (diff === 2) colorClass = 'bg-red-300 text-red-900 font-semibold';
                    else if (diff >= 3) colorClass = 'bg-red-600 text-white font-semibold';
                  }
                  return (
                    <td key={s.hole} className={`border p-0 relative ${colorClass}`}>
                      {hcpStrokes > 0 && (
                        <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-10">
                          {Array.from({ length: hcpStrokes }).map((_, i) => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary-700 block"></span>
                          ))}
                        </div>
                      )}
                      <input
                        className={`w-8 sm:w-9 h-7 px-0.5 py-0 bg-transparent text-center text-[10px] sm:text-[11px] outline-none focus:ring-2 focus:ring-primary-300 focus:bg-primary-50/70 transition ${hcpStrokes > 0 ? 'pl-3' : ''}`}
                        value={gross ?? ''}
                        inputMode="numeric"
                        data-golfer={eventGolfer.profileId || eventGolfer.customName}
                        data-hole={s.hole}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          const val = raw === '' ? '' : raw;
                          const numeric = val === '' ? null : parseInt(val, 10);
                          updateScore(eventId, eventGolfer.profileId || eventGolfer.customName, s.hole, numeric);
                          const shouldAdvance = (val.length === 1 && val !== '1') || val.length === 2;
                          if (shouldAdvance) {
                            const next = document.querySelector(`input[data-golfer='${eventGolfer.profileId || eventGolfer.customName}'][data-hole='${s.hole + 1}']`) as HTMLInputElement | null;
                            if (next) {
                              requestAnimationFrame(() => { next.focus(); next.select(); });
                            }
                          }
                        }}
                      />
                      {net != null && net !== gross && (
                        <span className="absolute bottom-0.5 right-0.5 text-[9px] leading-none font-semibold bg-white/80 text-primary-700 rounded px-0.5 ring-1 ring-primary-200">{net}</span>
                      )}
                    </td>
                  );
                })}
                {view!=='back' && showFront && <td className="border px-1 py-1 text-center font-semibold bg-white/60">{frontSum ?? ''}</td>}
                {showBack && sc.scores.slice(9).map((s: any) => {
                  const holeMeta = holes.find((h:any)=>h.number===s.hole);
                  const par = holeMeta?.par ?? 4;
                  const hcpStrokes = strokesForHole(event, eventGolfer.profileId || eventGolfer.customName, s.hole, profiles);
                  const gross = s.strokes;
                  const net = gross != null ? gross - hcpStrokes : null;
                  const diff = gross != null ? gross - par : null;
                  let colorClass = '';
                  if (diff != null) {
                    if (diff <= -3) colorClass = 'bg-fuchsia-600 text-white font-semibold';
                    else if (diff === -2) colorClass = 'bg-amber-500 text-black font-semibold';
                    else if (diff === -1) colorClass = 'bg-green-500 text-white font-semibold';
                    else if (diff === 0) colorClass = 'bg-neutral-50';
                    else if (diff === 1) colorClass = 'bg-orange-200';
                    else if (diff === 2) colorClass = 'bg-red-300 text-red-900 font-semibold';
                    else if (diff >= 3) colorClass = 'bg-red-600 text-white font-semibold';
                  }
                  return (
                    <td key={s.hole} className={`border p-0 relative ${colorClass}`}>
                      {hcpStrokes > 0 && (
                        <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-10">
                          {Array.from({ length: hcpStrokes }).map((_, i) => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary-700 block"></span>
                          ))}
                        </div>
                      )}
                      <input
                        className={`w-8 sm:w-9 h-7 px-0.5 py-0 bg-transparent text-center text-[10px] sm:text-[11px] outline-none focus:ring-2 focus:ring-primary-300 focus:bg-primary-50/70 transition ${hcpStrokes > 0 ? 'pl-3' : ''}`}
                        value={gross ?? ''}
                        inputMode="numeric"
                        data-golfer={eventGolfer.profileId || eventGolfer.customName}
                        data-hole={s.hole}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          const val = raw === '' ? '' : raw;
                          const numeric = val === '' ? null : parseInt(val, 10);
                          updateScore(eventId, eventGolfer.profileId || eventGolfer.customName, s.hole, numeric);
                          const shouldAdvance = (val.length === 1 && val !== '1') || val.length === 2;
                          if (shouldAdvance) {
                            const next = document.querySelector(`input[data-golfer='${eventGolfer.profileId || eventGolfer.customName}'][data-hole='${s.hole + 1}']`) as HTMLInputElement | null;
                            if (next) {
                              requestAnimationFrame(() => { next.focus(); next.select(); });
                            }
                          }
                        }}
                      />
                      {net != null && net !== gross && (
                        <span className="absolute bottom-0.5 right-0.5 text-[9px] leading-none font-semibold bg-white/80 text-primary-700 rounded px-0.5 ring-1 ring-primary-200">{net}</span>
                      )}
                    </td>
                  );
                })}
                {view!=='front' && showBack && <td className="border px-1 py-1 text-center font-semibold bg-white/60">{backSum ?? ''}</td>}
                {view==='full' && <td className="border px-1 py-1 text-center font-semibold bg-white">{totalSum ?? ''}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default ScorecardTab;
