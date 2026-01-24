import React, { useMemo, useState } from 'react';
import { useEventGroupsAdapter } from '../../adapters';

type Props = { eventId: string };

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const GroupsTab: React.FC<Props> = ({ eventId }) => {
  const {
    event,
    profiles,
    currentProfile,
    groups,
    golfers,
    setGroupTeeTime,
    removeGolferFromEvent,
  } = useEventGroupsAdapter(eventId);
  if (!event) return null;

  const group = groups[0]; // store currently behaves like a single play group
  const isOwner = currentProfile?.id === event.ownerProfileId;

  const roster = useMemo(() => {
    return golfers
      .map((g: any) => {
        const profile = g.profileId ? profiles.find((p) => p.id === g.profileId) : null;
        const displayName = profile?.name || g.displayName || g.customName || 'Unknown';
        const golferId = g.profileId || g.customName;
        return {
          golferId,
          displayName,
          avatar: profile?.avatar as string | undefined,
          teeName: g.teeName || event.course.teeName || '',
        };
      })
      .filter((x) => !!x.golferId);
  }, [golfers, profiles, event.course.teeName]);

  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  return (
    <div className="space-y-4 max-w-md">
      <div className="text-xs text-primary-100/80">
        Groups are event-level in this app. Right now, everyone is in one play group (simple + fast). Set a tee time and manage the roster below.
      </div>

      {group && (
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-primary-900/10 overflow-hidden">
          <div className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase">
                Play Group
              </div>
              <div className="text-lg font-extrabold text-gray-900 truncate">Group {group.id}</div>
              <div className="text-xs text-gray-600 mt-0.5">
                {event.course?.teeName ? `Tee: ${event.course.teeName}` : 'Tee not set'}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase mb-2">
                Tee time
              </div>
              <input
                type="time"
                value={group.teeTime || ''}
                onChange={(e) => setGroupTeeTime(group.id, e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
              />
              <div className="text-[11px] text-gray-500 mt-2">
                {group.teeTime ? `Set for ${group.teeTime}` : 'Not set yet'}
              </div>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase">
                Golfers ({roster.length})
              </div>
              {!isOwner && (
                <div className="text-[11px] text-gray-500">Only the event owner can remove golfers</div>
              )}
            </div>

            <div className="space-y-2">
              {roster.map((p) => (
                <div
                  key={p.golferId}
                  className="rounded-2xl border border-gray-200 bg-white flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-600/15 border border-primary-900/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {p.avatar ? (
                        <img src={p.avatar} alt={p.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary-900 font-extrabold text-xs">{initials(p.displayName)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{p.displayName}</div>
                      <div className="text-xs text-gray-600 truncate">{p.teeName || '—'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner && (
                      <button
                        onClick={async () => {
                          if (!p.golferId) return;
                          if (!window.confirm(`Remove ${p.displayName} from this event?`)) return;
                          try {
                            setIsRemoving(p.golferId);
                            await removeGolferFromEvent(p.golferId);
                          } finally {
                            setIsRemoving(null);
                          }
                        }}
                        disabled={isRemoving === p.golferId}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {isRemoving === p.golferId ? 'Removing…' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {roster.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  No golfers found for this event.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsTab;
