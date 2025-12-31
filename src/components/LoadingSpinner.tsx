import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

/**
 * Reusable loading spinner for Suspense fallbacks and loading states.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 'md',
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-3',
    lg: 'h-12 w-12 border-4'
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div 
        className={`animate-spin rounded-full border-primary-200 border-t-primary-600 ${sizeClasses[size]}`}
      />
      {message && (
        <p className="text-gray-500 text-sm">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-green-100">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  );
};

export default LoadingSpinner;
