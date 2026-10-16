export type Notice = {
  id: string
  title: string
  body: string
  ts: number
  read: boolean
}

const KEY = "aero_notices"
const SEEN_KEY = "aero_notif_seen"
const MAX = 30

function load(): Notice[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as Notice[]) : []
    return Array.isArray(list) ? list.slice(0, MAX) : []
  } catch {
    return []
  }
}

function save(list: Notice[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* ignore */
  }
}

export function readNotices(): Notice[] {
  return load()
}

export function unreadCount(): number {
  return load().filter((n) => !n.read).length
}

export function pushNotice(title: string, body: string): Notice[] {
  const list = [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, body, ts: Date.now(), read: false },
    ...load(),
  ].slice(0, MAX)
  save(list)
  return list
}

export function markAllRead(): Notice[] {
  const list = load().map((n) => ({ ...n, read: true }))
  save(list)
  return list
}

export function seenHashes(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    const list = raw ? (JSON.parse(raw) as string[]) : []
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

export function addSeenHashes(hashes: string[]): void {
  try {
    const next = new Set(seenHashes())
    for (const h of hashes) next.add(h.toLowerCase())
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-200)))
  } catch {
    /* ignore */
  }
}
