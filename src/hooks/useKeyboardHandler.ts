import { useState, useEffect, useCallback } from 'react';

const isTouchDevice = () =>
  'ontouchstart' in window || navigator.maxTouchPoints > 0;

export const useKeyboardHandler = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardHeight(Math.max(0, heightDiff));
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  // Hide footer when virtual keyboard is visible OR input is focused.
  // This handles both overlay keyboards (keyboardHeight > 0) and 
  // resizing viewports (keyboardHeight ~ 0 but focused).
  useEffect(() => {
    if (keyboardHeight > 0 || isFocused) {
      document.body.classList.add('chat-input-focused');
    } else {
      document.body.classList.remove('chat-input-focused');
    }
    return () => {
      document.body.classList.remove('chat-input-focused');
    };
  }, [keyboardHeight, isFocused]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Short delay to prevent flickering when switching focus
    setTimeout(() => {
      if (!document.activeElement || (document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT')) {
        setIsFocused(false);
      }
    }, 150);
  }, []);

  return { keyboardHeight, handleFocus, handleBlur };
};
