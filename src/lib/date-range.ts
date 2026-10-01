import { parseVietnamDateInput, vietnamDateKey } from "@/lib/vietnam-time"

export type DatePeriod = "all" | "today" | "7d" | "30d" | "this_month" | "last_month"

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function monthBoundary(offset: number) {
  const [year, month] = vietnamDateKey().split("-").map(Number)
  const normalized = new Date(Date.UTC(year, month - 1 + offset, 1))
  return parseVietnamDateInput(
    `${normalized.getUTCFullYear()}-${String(normalized.getUTCMonth() + 1).padStart(2, "0")}-01`
  )
}

export function resolveDateRange(period: string = "all", from?: string, to?: string) {
  if (from || to) {
    const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? parseVietnamDateInput(from) : undefined
    const inclusiveEnd = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? parseVietnamDateInput(to) : undefined
    return {
      start: start && !Number.isNaN(start.getTime()) ? start : undefined,
      end: inclusiveEnd && !Number.isNaN(inclusiveEnd.getTime()) ? addDays(inclusiveEnd, 1) : undefined,
    }
  }

  const today = parseVietnamDateInput(vietnamDateKey())
  switch (period as DatePeriod) {
    case "today":
      return { start: today, end: addDays(today, 1) }
    case "7d":
      return { start: addDays(today, -6), end: addDays(today, 1) }
    case "30d":
      return { start: addDays(today, -29), end: addDays(today, 1) }
    case "this_month":
      return { start: monthBoundary(0), end: monthBoundary(1) }
    case "last_month":
      return { start: monthBoundary(-1), end: monthBoundary(0) }
    default:
      return { start: undefined, end: undefined }
  }
}
