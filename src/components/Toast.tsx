import React, { useEffect, useState } from 'react';
import useStore from '../state/store';

interface ToastProps {
  message: string;
  type: 'achievement' | 'info' | 'success' | 'error';
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, duration = 4000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 100);

    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for slide-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getToastStyles = () => {
    switch (type) {
      case 'achievement':
        return 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-900 shadow-lg';
      case 'success':
        return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-900 shadow-lg';
      case 'error':
        return 'bg-gradient-to-r from-red-50 to-red-50 border-red-200 text-red-900 shadow-lg';
      default:
        return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-900 shadow-lg';
    }
  };

  return (
    <div
      className={`fixed top-20 right-4 z-50 max-w-sm rounded-lg border-2 p-4 transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${getToastStyles()}`}
    >
      <div className="flex items-start gap-3">
        {type === 'achievement' && (
          <span className="text-2xl">🎯</span>
        )}
        <div className="flex-1">
          <p className="font-semibold text-sm whitespace-pre-wrap">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Toast Manager Component
export const ToastManager: React.FC = () => {
  const toasts = useStore(s => s.toasts || []);
  const removeToast = useStore(s => s.removeToast);

  return (
    <div className="fixed top-0 right-0 z-50 pointer-events-none">
      <div className="p-4 space-y-2 pointer-events-auto">
        {toasts.map((toast: any) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default Toast;