"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Bell } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const notifications = useQuery(api.notifications.center, {
    includeRead: false,
  });
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const { language } = useLanguage();
  const count = notifications?.length ?? 0;
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={language === "es" ? "Notificaciones" : "Notifications"}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-600 px-1 text-xs text-white">
            {count}
          </span>
        )}
      </Button>
      {open && (
        <section
          id="notification-panel"
          role="dialog"
          aria-label={language === "es" ? "Notificaciones" : "Notifications"}
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-background p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">
              {language === "es" ? "Notificaciones" : "Notifications"}
            </h2>
            {count > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllRead()}>
                {language === "es" ? "Marcar leídas" : "Mark all read"}
              </Button>
            )}
          </div>
          <div className="mt-3 grid max-h-96 gap-2 overflow-auto">
            {notifications === undefined && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {notifications?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {language === "es"
                  ? "No hay alertas nuevas."
                  : "You are all caught up."}
              </p>
            )}
            {notifications?.map((notification) => (
              <Link
                key={notification._id}
                href={notification.link}
                onClick={() => {
                  markRead({ notificationId: notification._id });
                  setOpen(false);
                }}
                className="rounded-lg border p-3 text-sm hover:bg-muted"
              >
                <span className="block font-medium">
                  {notification.orderNumber}
                </span>
                <span className="text-muted-foreground">
                  {notification.message}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
