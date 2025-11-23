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
      className={`w-full max-w-sm rounded-lg border-2 p-4 transition-all duration-300 transform shadow-lg ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
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
  const addToast = useStore(s => s.addToast);
  const [updateReady, setUpdateReady] = useState<null | (() => void)>(null);

  useEffect(() => {
    type RefreshDetail = {
      update: () => void;
    };

    const handleNeedRefresh = (event: Event) => {
      const detail = (event as CustomEvent<RefreshDetail>).detail;
      if (detail?.update) {
        setUpdateReady(() => detail.update);
      }
    };

    const handleOfflineReady = () => {
      addToast('App ready to work offline', 'success', 3000);
    };

    window.addEventListener('pwa:need-refresh', handleNeedRefresh as EventListener);
    window.addEventListener('pwa:offline-ready', handleOfflineReady as EventListener);

    return () => {
      window.removeEventListener('pwa:need-refresh', handleNeedRefresh as EventListener);
      window.removeEventListener('pwa:offline-ready', handleOfflineReady as EventListener);
    };
  }, [addToast]);

  return (
    <>
      {updateReady && (
        <div className="fixed bottom-24 right-4 z-[60] pointer-events-auto">
          <div className="bg-white/95 backdrop-blur border border-primary-900/15 shadow-xl rounded-lg p-4 max-w-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl">
                🔄
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-900 text-sm">Update available</h3>
                <p className="text-xs text-gray-600 mt-1">
                  A newer version of Gimmies is ready. Reload to apply the latest features and fixes.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end text-sm">
              <button
                className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                onClick={() => setUpdateReady(null)}
              >
                Later
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
                onClick={() => {
                  const doUpdate = updateReady;
                  setUpdateReady(null);
                  doUpdate?.();
                }}
              >
                Reload now
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed top-20 left-0 right-0 z-50 pointer-events-none flex justify-center">
        <div className="px-4 space-y-2 pointer-events-auto w-full max-w-sm">
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
    </>
  );
};

export default Toast;
