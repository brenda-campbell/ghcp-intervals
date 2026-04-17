/** In-memory player presence tracking (per Azure Functions instance) */

interface PresenceEntry {
  userId: string;
  displayName: string;
  lastSeen: number;
}

const onlinePlayers = new Map<string, PresenceEntry>();
const PRESENCE_TIMEOUT_MS = 45_000; // 45 seconds (one missed heartbeat grace at 30s interval)

export function registerPlayer(userId: string, displayName: string): void {
  onlinePlayers.set(userId, { userId, displayName, lastSeen: Date.now() });
}

export function removePlayer(userId: string): void {
  onlinePlayers.delete(userId);
}

export function cleanStalePresence(): void {
  const cutoff = Date.now() - PRESENCE_TIMEOUT_MS;
  for (const [id, entry] of onlinePlayers) {
    if (entry.lastSeen < cutoff) {
      onlinePlayers.delete(id);
    }
  }
}

export function getOnlineCount(): number {
  return onlinePlayers.size;
}

export function getOnlinePlayersList(): { userId: string; displayName: string; lastSeen: string }[] {
  return Array.from(onlinePlayers.values()).map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    lastSeen: new Date(p.lastSeen).toISOString(),
  }));
}

/** Reset presence store (for testing) */
export function _resetPresence(): void {
  onlinePlayers.clear();
}
