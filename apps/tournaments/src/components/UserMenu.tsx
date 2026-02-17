import React, { useState } from 'react';
import { signOut } from 'aws-amplify/auth';

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-500"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-xl border border-white/10 z-50">
            <div className="py-2">
              <a
                href="https://app.golfwithgimmies.com/profile"
                className="block px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Edit Profile
              </a>
              <a
                href="https://app.golfwithgimmies.com"
                className="block px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Gimmies App
              </a>
              <hr className="my-2 border-white/10" />
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10"
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
