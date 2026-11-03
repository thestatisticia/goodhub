'use client';

import type { ActivityCategory, DashboardActivityEvent } from '@/hooks/useDashboardActivity';

export type NotificationPreferences = Record<ActivityCategory, boolean>;

const CATEGORIES: ActivityCategory[] = ['task', 'campaign', 'tip', 'spin'];
const DEFAULT_PREFERENCES: NotificationPreferences = {
  task: true,
  campaign: true,
  tip: true,
  spin: true,
};

function storageKey(wallet: string, type: string) {
  return `ghub:${type}:${wallet.toLowerCase()}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function notifyChange() {
  window.dispatchEvent(new Event('ghub-notifications-updated'));
}

export function getNotificationPreferences(wallet: string): NotificationPreferences {
  const stored = readJson<Partial<NotificationPreferences>>(
    storageKey(wallet, 'notification-preferences'),
    {},
  );
  return { ...DEFAULT_PREFERENCES, ...stored };
}

export function setNotificationPreference(
  wallet: string,
  category: ActivityCategory,
  enabled: boolean,
) {
  const preferences = { ...getNotificationPreferences(wallet), [category]: enabled };
  window.localStorage.setItem(storageKey(wallet, 'notification-preferences'), JSON.stringify(preferences));
  notifyChange();
}

export function syncNotifications(wallet: string, events: DashboardActivityEvent[]) {
  const eventsKey = storageKey(wallet, 'notification-events');
  const readKey = storageKey(wallet, 'notification-read');
  const previous = readJson<DashboardActivityEvent[] | null>(eventsKey, null);
  const readIds = new Set(readJson<string[]>(readKey, []));

  if (!previous) {
    const historyCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const event of events) {
      const eventTime = Date.parse(event.createdAt);
      if (!Number.isFinite(eventTime) || eventTime < historyCutoff) readIds.add(event.id);
    }
  } else {
    const previousIds = new Set(previous.map((event) => event.id));
    for (const event of events) {
      if (!previousIds.has(event.id)) readIds.delete(event.id);
    }
  }

  window.localStorage.setItem(eventsKey, JSON.stringify(events));
  window.localStorage.setItem(readKey, JSON.stringify([...readIds]));
  notifyChange();
  return getUnreadNotificationCount(wallet);
}

export function markNotificationRead(wallet: string, id: string) {
  const readKey = storageKey(wallet, 'notification-read');
  const readIds = new Set(readJson<string[]>(readKey, []));
  readIds.add(id);
  window.localStorage.setItem(readKey, JSON.stringify([...readIds]));
  notifyChange();
}

export function markAllNotificationsRead(wallet: string) {
  const events = readJson<DashboardActivityEvent[]>(
    storageKey(wallet, 'notification-events'),
    [],
  );
  window.localStorage.setItem(
    storageKey(wallet, 'notification-read'),
    JSON.stringify(events.map((event) => event.id)),
  );
  notifyChange();
}

export function getReadNotificationIds(wallet: string) {
  return readJson<string[]>(storageKey(wallet, 'notification-read'), []);
}

export function getUnreadNotificationCount(wallet: string) {
  const events = readJson<DashboardActivityEvent[]>(
    storageKey(wallet, 'notification-events'),
    [],
  );
  const readIds = new Set(readJson<string[]>(storageKey(wallet, 'notification-read'), []));
  const preferences = getNotificationPreferences(wallet);
  return events.filter((event) => preferences[event.category] && !readIds.has(event.id)).length;
}

export function getNotificationCategories(): ActivityCategory[] {
  return [...CATEGORIES];
}
