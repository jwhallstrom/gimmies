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
  /**
   * Notification read tracking (persists across sessions).
   * Keyed by notification id (e.g. "settle-...", "chat-...", etc).
   */
  notificationReadAt: Record<string, string>;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface UISliceActions {
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (toastId: string) => void;
  markNotificationRead: (id: string) => void;
  markNotificationsRead: (ids: string[]) => void;
  clearNotificationReads: () => void;
}

export type UISlice = UISliceState & UISliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialUIState: UISliceState = {
  toasts: [],
  notificationReadAt: {},
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

  markNotificationRead: (id: string) => {
    const now = new Date().toISOString();
    set((state: any) => ({
      notificationReadAt: { ...(state.notificationReadAt || {}), [id]: now },
    }));
  },

  markNotificationsRead: (ids: string[]) => {
    const now = new Date().toISOString();
    set((state: any) => {
      const prev = (state.notificationReadAt || {}) as Record<string, string>;
      const next = { ...prev };
      ids.forEach((id) => {
        if (id) next[id] = now;
      });
      return { notificationReadAt: next };
    });
  },

  clearNotificationReads: () => {
    set(() => ({ notificationReadAt: {} }));
  },
});
