import React from 'react';

interface LeaderboardIconProps {
  className?: string;
  [key: string]: any;
}

export function LeaderboardIcon({ className = "w-6 h-6", ...props }: LeaderboardIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Scoreboard body - arched top like a Masters leaderboard */}
      <path
        d="M3 7 Q3 3 12 3 Q21 3 21 7 L21 19 Q21 20 20 20 L4 20 Q3 20 3 19 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* "LEADERS" header line */}
      <line x1="3" y1="8" x2="21" y2="8" stroke="currentColor" strokeWidth="1.2"/>
      {/* Score rows */}
      <line x1="5" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
      <line x1="5" y1="13.5" x2="19" y2="13.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
      <line x1="5" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
      <line x1="5" y1="18.5" x2="19" y2="18.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
      {/* Rank numbers column divider */}
      <line x1="7.5" y1="8" x2="7.5" y2="20" stroke="currentColor" strokeWidth="0.8"/>
      {/* "LEADERS" text hint - small bar in header */}
      <line x1="8" y1="5.5" x2="16" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
