import React from 'react';

interface GroupAvatarProps {
  avatar?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-9 h-9 text-base',
  md: 'w-14 h-14 text-2xl',
  lg: 'w-20 h-20 text-3xl',
};

const GroupAvatar: React.FC<GroupAvatarProps> = ({ avatar, name, size = 'md', className = '' }) => {
  const sizeClass = sizeMap[size];

  if (avatar && (avatar.startsWith('data:') || avatar.startsWith('http'))) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  if (avatar) {
    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 ${className}`}>
        <span>{avatar}</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 ${className}`}>
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
};

export default GroupAvatar;
