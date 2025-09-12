import React from 'react';
import useStore from '../../state/store';

type Props = { eventId: string };

const GroupsTab: React.FC<Props> = ({ eventId }) => {
  const { profiles } = useStore();
  const event = useStore((s: any) => s.events.find((e: any) => e.id === eventId));
  if (!event) return null;
  const group = event.groups[0];
  return (
    <div className="space-y-4 max-w-md">
      <div className="text-xs text-gray-600">All golfers are automatically placed into the single play group. Adjust tee time if needed.</div>
      {group && (
        <div className="bg-white border rounded shadow-sm p-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm">Group {group.id}</span>
            <input type="time" value={group.teeTime || ''} onChange={e => useStore.getState().setGroupTeeTime(eventId, group.id, e.target.value)} className="border rounded px-1 py-0.5 text-xs" />
          </div>
          <ul className="divide-y text-xs">
            {event.golfers.map((eventGolfer: any) => {
              const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
              const displayName = profile ? profile.name : eventGolfer.customName;
              const golferId = eventGolfer.profileId || eventGolfer.customName;
              if (!displayName) return null;
              
              return (
                <li key={golferId} className="flex items-center justify-between py-1">
                  <span>{displayName}</span>
                  <span className="text-[10px] text-primary-700">{eventGolfer.teeName || event.course.teeName || ''}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GroupsTab;
