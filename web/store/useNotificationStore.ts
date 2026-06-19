import { create } from "zustand";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
}

interface DialogState {
  isOpen: boolean;
  type: "confirm" | "prompt" | "alert";
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: any) => void;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  // Dialog State
  dialog: DialogState | null;

  // Actions
  addNotification: (notif: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  
  // Dialog Actions
  confirm: (options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
  prompt: (options: { title: string; message: string; placeholder?: string; defaultValue?: string; confirmLabel?: string }) => Promise<string | null>;
  alert: (options: { title: string; message: string }) => Promise<void>;
  closeDialog: (value: any) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  dialog: null,

  addNotification: (notif) => {
    const newNotif: Notification = {
      ...notif,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      read: false,
    };
    set((state) => ({
      notifications: [newNotif, ...state.notifications].slice(0, 50), // Keep last 50
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: (id) => {
    set((state) => {
      const notifs = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: notifs,
        unreadCount: notifs.filter((n) => !n.read).length,
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  // --- Promise-based Dialogs ---

  confirm: ({ title, message, confirmLabel, cancelLabel }) => {
    return new Promise((resolve) => {
      const currentDialog = get().dialog;
      if (currentDialog) currentDialog.resolve(false);
      
      set({
        dialog: {
          isOpen: true,
          type: "confirm",
          title,
          message,
          confirmLabel: confirmLabel || "Confirm",
          cancelLabel: cancelLabel || "Cancel",
          resolve,
        },
      });
    });
  },

  prompt: ({ title, message, placeholder, defaultValue, confirmLabel }) => {
    return new Promise((resolve) => {
      const currentDialog = get().dialog;
      if (currentDialog) currentDialog.resolve(null);

      set({
        dialog: {
          isOpen: true,
          type: "prompt",
          title,
          message,
          placeholder,
          defaultValue: defaultValue || "",
          confirmLabel: confirmLabel || "Save",
          resolve,
        },
      });
    });
  },

  alert: ({ title, message }) => {
    return new Promise((resolve) => {
      const currentDialog = get().dialog;
      if (currentDialog) currentDialog.resolve(undefined);

      set({
        dialog: {
          isOpen: true,
          type: "alert",
          title,
          message,
          confirmLabel: "OK",
          resolve,
        },
      });
    });
  },

  closeDialog: (value) => {
    const dialog = get().dialog;
    if (dialog) dialog.resolve(value);
    set({ dialog: null });
  },
}));
