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
