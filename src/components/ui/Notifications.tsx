import Link from "next/link";
import { Icon } from "@iconify/react";
import type { Notification } from "@/shared/contexts/NotificationsContext";

export default function Notifications({
  notifications,
  mode,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearRead,
  onNavigate,
}: {
  notifications: Notification[];
  mode: "light" | "dark";
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onDismiss: (id: string) => void;
  onClearRead?: () => void;
  onNavigate?: () => void;
}) {
  const isDark = mode === "dark";
  const hasUnread = notifications.some((n) => !n.read);
  const hasRead = notifications.some((n) => n.read);

  return (
    <div
      className={`rounded-xl p-4 ${isDark ? "text-white" : "text-[var(--text-hi)]"}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          Notifications
        </h3>
        <div className="flex items-center gap-3">
          {hasRead && <button onClick={onClearRead} className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-lo)] hover:text-[var(--text-hi)]">Clear read</button>}
          {hasUnread && <button onClick={onMarkAllAsRead} className="font-mono text-[11px] uppercase tracking-wide text-brand-500 hover:text-brand-600">Mark all read</button>}
        </div>
      </div>
      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Icon
            icon="mdi:loading"
            width={20}
            height={20}
            className="animate-spin text-brand-500"
          />
        </div>
      ) : notifications.length === 0 ? (
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          No notifications to display.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className="flex items-start gap-2.5 py-2.5"
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${notification.read ? "bg-transparent" : "bg-brand-500"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {notification.link ? (
                    <Link
                      href={notification.link}
                      onClick={() => {
                        if (!notification.read) onMarkAsRead(notification.id);
                        onNavigate?.();
                      }}
                      className="block truncate text-sm hover:text-brand-500 hover:underline"
                    >
                      {notification.message}
                    </Link>
                  ) : (
                    <p className="truncate text-sm">{notification.message}</p>
                  )}
                  <p
                    className={`font-mono text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
                  >
                    {new Date(notification.timestamp).toLocaleString()}
                  </p>
                </div>
                {!notification.read && (
                  <button
                    onClick={() => onMarkAsRead(notification.id)}
                    className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDismiss(notification.id)}
                  className="shrink-0 rounded-md p-1 text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
                  aria-label="Dismiss notification"
                  title="Dismiss"
                >
                  <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
