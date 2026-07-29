import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Timestamps are stored in the database as UTC and must stay that way.
// This is presentation-only: the app is operated from Riga, so every
// admin/operational timestamp is displayed in Europe/Riga local time
// regardless of the server's own timezone (Vercel runs functions in UTC).
// Using the IANA zone name — not a fixed +2/+3 offset — means DST is
// handled automatically by the runtime's timezone database.
const OPERATIONAL_TIME_ZONE = "Europe/Riga"

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: OPERATIONAL_TIME_ZONE,
  }).format(date)
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: OPERATIONAL_TIME_ZONE,
  }).format(date)
}

export function isPast(value: string) {
  return new Date(value).getTime() < Date.now()
}

/**
 * Riga's UTC offset (in minutes) at a given instant, via the IANA zone's
 * own DST rules — never a hardcoded +2/+3. Deliberately avoids round-
 * tripping through `new Date(someLocaleString)`, which silently uses the
 * *host's* local timezone to parse, not the zone the string was formatted
 * in — a common and easy-to-miss bug with the naive version of this trick.
 */
function rigaOffsetMinutes(atMs: number): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATIONAL_TIME_ZONE,
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date(atMs))
    .find((p) => p.type === "timeZoneName")?.value

  const match = part ? /GMT([+-])(\d+)(?::(\d+))?/.exec(part) : null
  if (!match) return 0
  const sign = match[1] === "-" ? -1 : 1
  const hours = Number(match[2])
  const minutes = match[3] ? Number(match[3]) : 0
  return sign * (hours * 60 + minutes)
}

/** Midnight in Riga, on the Riga calendar day containing `referenceMs`, as a UTC Date. */
export function startOfDayRiga(referenceMs: number): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(referenceMs))
    .split("-")
    .map(Number)

  const utcMidnightGuess = Date.UTC(y, m - 1, d, 0, 0, 0)
  return new Date(utcMidnightGuess - rigaOffsetMinutes(utcMidnightGuess) * 60_000)
}
