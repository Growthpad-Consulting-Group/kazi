"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import toast from "react-hot-toast";

export type Notification = {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
  link: string | null;
};

type NotificationsContextValue = {
  notifications: Notification[];
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  clearReadNotifications: () => Promise<void>;
};

const NotificationsContext = createContext<
  NotificationsContextValue | undefined
>(undefined);

const CACHE_KEY = "kazi_notifications_cache";

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body.notifications))
        throw new Error("Invalid response format");
      const formatted: Notification[] = body.notifications.map(
        (n: Record<string, unknown>) => ({
          id: n.id,
          message: n.message || "New notification",
          timestamp: n.created_at || new Date().toISOString(),
          read: n.read || false,
          link: n.link ?? null,
        }),
      );
      setNotifications(formatted);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: formatted, timestamp: Date.now() }),
      );
    } catch (error: unknown) {
      console.warn("Notifications endpoint error:", (error as Error).message);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markNotificationAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      localStorage.removeItem(CACHE_KEY);
    } catch (error: unknown) {
      toast.error(
        "Failed to mark notification as read: " + (error as Error).message,
      );
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      localStorage.removeItem(CACHE_KEY);
    } catch (error: unknown) {
      toast.error(
        "Failed to mark notifications as read: " + (error as Error).message,
      );
    }
  };

  const dismissNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== id),
      );
      localStorage.removeItem(CACHE_KEY);
    } catch (error: unknown) {
      toast.error(
        "Failed to dismiss notification: " + (error as Error).message,
      );
    }
  };

  const clearReadNotifications = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      setNotifications((prev) =>
        prev.filter((notification) => !notification.read),
      );
      localStorage.removeItem(CACHE_KEY);
    } catch (error: unknown) {
      toast.error(
        "Failed to clear read notifications: " + (error as Error).message,
      );
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        isLoading,
        fetchNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        dismissNotification,
        clearReadNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used within a NotificationsProvider",
    );
  return ctx;
};
