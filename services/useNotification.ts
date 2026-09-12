/**
 * useNotifications.ts — v4
 *
 * Loads preferences from AsyncStorage, exposes updatePref(),
 * and syncs user location into prefs.lat / prefs.lng.
 *
 * Deep-links: notification tap → Expo Router navigation
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import {
  NotificationPrefs,
  CustomReminder,
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
  applyAllNotificationPrefs,
  requestNotificationPermission,
  scheduleCustomReminder,
  cancelCustomReminder,
} from "../services/notificationService";

import { usePanchangLocation } from "../services/panchangService";

export interface UseNotificationsReturn {
  prefs: NotificationPrefs;
  loading: boolean;
  permissionGranted: boolean;
  updatePref: <K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K],
  ) => Promise<void>;
  addCustomReminder: (r: CustomReminder) => Promise<void>;
  removeCustomReminder: (id: string) => Promise<void>;
  toggleCustomReminder: (id: string, enabled: boolean) => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export function useNotifications(): UseNotificationsReturn {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    ...DEFAULT_PREFS,
  });

  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermission] = useState(false);

  const notifListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Same location source CalendarScreen uses
  const { location } = usePanchangLocation();

  // ── Load prefs on mount ────────────────────
  useEffect(() => {
    (async () => {
      const [loaded, granted] = await Promise.all([
        loadPrefs(),
        requestNotificationPermission(),
      ]);

      setPrefs(loaded);
      setPermission(granted);
      setLoading(false);
    })();
  }, []);

  // ── Sync location into prefs whenever it resolves ──
  useEffect(() => {
    if (!location?.latitude || !location?.longitude) return;

    setPrefs((prev) => {
      const updated = {
        ...prev,
        lat: location.latitude,
        lng: location.longitude,
      };

      // Persist silently
      savePrefs(updated).catch(() => {});

      return updated;
    });
  }, [location?.latitude, location?.longitude]);

  // ── Notification listeners ─────────────────
  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(
      () => {
        // Foreground notification received.
        // Notification handler controls the alert.
      },
    );

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as {
          screen?: string;
        };

        if (!data?.screen) return;

        try {
          // Expo Router navigation
          router.push(data.screen as any);
        } catch (error) {
          console.warn("Notification navigation failed:", error);
        }
      });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // ── Update single pref ─────────────────────
  const updatePref = useCallback(
    async <K extends keyof NotificationPrefs>(
      key: K,
      value: NotificationPrefs[K],
    ) => {
      setPrefs((prev) => {
        const updated = {
          ...prev,
          [key]: value,
        };

        savePrefs(updated)
          .then(() => applyAllNotificationPrefs(updated))
          .catch(console.error);

        return updated;
      });
    },
    [],
  );

  // ── Add custom reminder ────────────────────
  const addCustomReminder = useCallback(async (reminder: CustomReminder) => {
    setPrefs((prev) => {
      const updated: NotificationPrefs = {
        ...prev,
        customReminders: [...prev.customReminders, reminder],
      };

      savePrefs(updated).catch(console.error);

      if (reminder.enabled) {
        scheduleCustomReminder(reminder, updated).catch(console.error);
      }

      return updated;
    });
  }, []);

  // ── Remove custom reminder ─────────────────
  const removeCustomReminder = useCallback(async (id: string) => {
    await cancelCustomReminder(id);

    setPrefs((prev) => {
      const updated: NotificationPrefs = {
        ...prev,
        customReminders: prev.customReminders.filter((r) => r.id !== id),
      };

      savePrefs(updated).catch(console.error);

      return updated;
    });
  }, []);

  // ── Toggle custom reminder ─────────────────
  const toggleCustomReminder = useCallback(
    async (id: string, enabled: boolean) => {
      setPrefs((prev) => {
        const updated: NotificationPrefs = {
          ...prev,
          customReminders: prev.customReminders.map((r) =>
            r.id === id ? { ...r, enabled } : r,
          ),
        };

        savePrefs(updated).catch(console.error);

        const rem = updated.customReminders.find((r) => r.id === id);

        if (rem) {
          (enabled
            ? scheduleCustomReminder(rem, updated)
            : cancelCustomReminder(id)
          ).catch(console.error);
        }

        return updated;
      });
    },
    [],
  );

  // ── Request notification permission ────────
  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();

    setPermission(granted);

    return granted;
  }, []);

  return {
    prefs,
    loading,
    permissionGranted,
    updatePref,
    addCustomReminder,
    removeCustomReminder,
    toggleCustomReminder,
    requestPermission,
  };
}
