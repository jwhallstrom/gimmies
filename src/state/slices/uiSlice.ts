/**
 * UI Slice
 * Handles toast notifications and UI state
 */

import { nanoid } from 'nanoid/non-secure';
import type { Toast } from '../types';

// ============================================================================
// State Interface
// ============================================================================

export interface UISliceState {
  toasts: Toast[];
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface UISliceActions {
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (toastId: string) => void;
}

export type UISlice = UISliceState & UISliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialUIState: UISliceState = {
  toasts: [],
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createUISlice = (
  set: (fn: (state: any) => any) => void,
  get: () => any
): UISliceActions => ({
  addToast: (message: string, type: Toast['type'] = 'info', duration: number = 4000) => {
    const toast: Toast = {
      id: nanoid(8),
      message,
      type,
      duration,
      createdAt: new Date().toISOString()
    };
    set((state: any) => ({ toasts: [...state.toasts, toast] }));
    
    // Auto-remove toast after duration (with cleanup to prevent memory leaks)
    setTimeout(() => {
      get().removeToast(toast.id);
    }, duration);
  },
  
  removeToast: (toastId: string) => {
    set((state: any) => ({
      toasts: state.toasts.filter((t: Toast) => t.id !== toastId)
    }));
  },
});
