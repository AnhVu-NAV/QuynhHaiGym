export function addCalendarMonthsClamped(date: Date, months: number) {
  const result = new Date(date)
  const originalDay = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() + months)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(originalDay, lastDay))
  return result
}

export type HolidayDateRange = {
  startDate: string
  endDate: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function parseDateOnlyToDayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) throw new Error("Ngày nghỉ không hợp lệ")
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

function dateToUtcDayNumber(value: Date) {
  return Math.floor(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  ) / DAY_MS)
}

function addUtcDays(value: Date, days: number) {
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

/**
 * Extends a package by every distinct gym-closure day in its validity window.
 * The fixed-point loop also handles a closure that falls inside days added by
 * an earlier closure. Overlapping holiday ranges are de-duplicated.
 */
export function addHolidayPreservationDays(
  startDate: Date,
  baseEndDate: Date,
  holidayRanges: HolidayDateRange[],
) {
  const closedDays = new Set<number>()
  for (const holiday of holidayRanges) {
    const first = parseDateOnlyToDayNumber(holiday.startDate)
    const last = parseDateOnlyToDayNumber(holiday.endDate)
    for (let day = first; day <= last; day += 1) closedDays.add(day)
  }

  const subscriptionStart = dateToUtcDayNumber(startDate)
  let creditedDays = -1
  let adjustedEndDate = new Date(baseEndDate)

  while (true) {
    const adjustedEnd = dateToUtcDayNumber(adjustedEndDate)
    const nextCredit = [...closedDays].reduce(
      (total, day) => total + (day >= subscriptionStart && day <= adjustedEnd ? 1 : 0),
      0,
    )
    if (nextCredit === creditedDays) break
    creditedDays = nextCredit
    adjustedEndDate = addUtcDays(baseEndDate, creditedDays)
  }

  return { endDate: adjustedEndDate, creditedDays: Math.max(0, creditedDays) }
}
