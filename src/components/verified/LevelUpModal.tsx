/**
 * LevelUpModal - Celebration modal when user reaches a new tier
 * 
 * Shows a fun, celebratory modal with confetti effect when 
 * a user levels up in the verified status system.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatusTier } from '../../state/types';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldTier: StatusTier;
  newTier: StatusTier;
  verifiedRounds: number;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({
  isOpen,
  onClose,
  oldTier,
  newTier,
  verifiedRounds
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti animation
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <span 
                className="text-2xl"
                style={{ 
                  transform: `rotate(${Math.random() * 360}deg)`,
                  opacity: 0.8 + Math.random() * 0.2
                }}
              >
                {['⭐', '🏆', '🎉', '✨', '🎊', '🏌️', '⛳'][Math.floor(Math.random() * 7)]}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-bounce-in">
        {/* Header with gradient */}
        <div className={`${newTier.badgeColor} px-6 py-8 text-center text-white relative overflow-hidden`}>
          {/* Glow effect */}
          <div className="absolute inset-0 bg-white/10 animate-pulse" />
          
          <div className="relative">
            <div className="text-6xl mb-3 animate-bounce-slow">{newTier.emoji}</div>
            <h2 className="text-2xl font-black mb-1">LEVEL UP!</h2>
            <p className="text-white/90 font-medium">You've reached a new tier</p>
          </div>
        </div>
        
        {/* Tier transition */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* Old tier */}
            <div className="text-center opacity-50">
              <span className="text-2xl">{oldTier.emoji}</span>
              <div className="text-xs text-gray-500 mt-1">{oldTier.name}</div>
            </div>
            
            {/* Arrow */}
            <div className="text-2xl text-gray-300">→</div>
            
            {/* New tier */}
            <div className="text-center">
              <span className="text-4xl">{newTier.emoji}</span>
              <div className="text-sm font-bold text-gray-900 mt-1">{newTier.name}</div>
            </div>
          </div>
          
          {/* Description */}
          <p className="text-center text-gray-600 mb-4">
            {newTier.description}
          </p>
          
          {/* Stats */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-black text-gray-900">{verifiedRounds}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Verified Rounds</div>
            </div>
          </div>
          
          {/* New Perks */}
          {newTier.perks.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                Unlocked Perks
              </div>
              <div className="space-y-2">
                {newTier.perks.map((perk, i) => (
                  <div key={i} className="flex items-center gap-2 justify-center">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Action Button */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className={`w-full ${newTier.badgeColor} text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity`}
          >
            Awesome! 🎉
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LevelUpModal;
