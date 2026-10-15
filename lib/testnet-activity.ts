export type ActivityItem = {
  label: string
  amount: string
  hash: string
  ts: number
  to?: string
  memo?: string
}

const KEY = "aero_activity"
const MAX = 20

export function readActivity(): ActivityItem[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as ActivityItem[]
    return Array.isArray(list) ? list.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushActivity(item: Omit<ActivityItem, "ts">): void {
  try {
    const list = [{ ...item, ts: Date.now() }, ...readActivity()].slice(0, MAX)
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
}
