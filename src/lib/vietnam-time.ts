export const VIETNAM_LOCALE = "vi-VN"
export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh"

type DateValue = Date | string | number

function asDate(value: DateValue) {
  return value instanceof Date ? value : new Date(value)
}

export function formatInVietnam(value: DateValue, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(VIETNAM_LOCALE, {
    ...options,
    timeZone: VIETNAM_TIME_ZONE,
  }).format(asDate(value))
}

export function formatVietnamDate(value: DateValue) {
  return formatInVietnam(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatVietnamTime(value: DateValue) {
  return formatInVietnam(value, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatVietnamDateTime(value: DateValue) {
  return formatInVietnam(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function vietnamDateKey(value: DateValue = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate(value))
}

export function vietnamDayOfMonth(value: DateValue) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    day: "numeric",
  }).formatToParts(asDate(value))
  return parts.find((part) => part.type === "day")?.value || ""
}

export function parseVietnamDateInput(value: string) {
  return new Date(`${value}T00:00:00+07:00`)
}

export function vietnamDayStart(value: DateValue = new Date()) {
  return parseVietnamDateInput(vietnamDateKey(value))
}
