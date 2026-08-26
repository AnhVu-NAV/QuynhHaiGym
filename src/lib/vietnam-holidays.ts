export type VietnamHolidaySuggestion = {
  key: string
  name: string
  startDate: string
  endDate: string
  note: string
}

const DAY_MS = 86_400_000
const vietnameseLunarCalendar = new Intl.DateTimeFormat("en-u-ca-chinese", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "numeric",
  day: "numeric",
})

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function findLunarDate(gregorianYear: number, lunarMonth: number, lunarDay: number) {
  const first = utcDate(gregorianYear, 1, 1)
  const last = utcDate(gregorianYear, 12, 31)
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const parts = vietnameseLunarCalendar.formatToParts(date)
    const month = Number(parts.find((part) => part.type === "month")?.value)
    const day = Number(parts.find((part) => part.type === "day")?.value)
    const relatedYear = Number(parts.find((part) => String(part.type) === "relatedYear")?.value)
    if (relatedYear === gregorianYear && month === lunarMonth && day === lunarDay) return date
  }
  return null
}

export function getUpcomingVietnamHolidaySuggestions(referenceDate = new Date()) {
  const today = utcDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    referenceDate.getDate(),
  )
  const suggestions: VietnamHolidaySuggestion[] = []

  for (let year = today.getUTCFullYear(); year <= today.getUTCFullYear() + 2; year += 1) {
    const newYear = utcDate(year, 1, 1)
    suggestions.push({
      key: `new-year-${year}`,
      name: `Tết Dương lịch ${year}`,
      startDate: toDateOnly(newYear),
      endDate: toDateOnly(newYear),
      note: "Ngày nghỉ lễ cố định 01/01.",
    })

    const lunarNewYear = findLunarDate(year, 1, 1)
    if (lunarNewYear) {
      suggestions.push({
        key: `lunar-new-year-${year}`,
        name: `Tết Nguyên Đán ${year}`,
        startDate: toDateOnly(addDays(lunarNewYear, -2)),
        endDate: toDateOnly(addDays(lunarNewYear, 2)),
        note: "Gợi ý 5 ngày quanh mùng 1 Tết; hãy chỉnh theo lịch đóng cửa thực tế.",
      })
    }

    const hungKings = findLunarDate(year, 3, 10)
    if (hungKings) {
      suggestions.push({
        key: `hung-kings-${year}`,
        name: `Giỗ Tổ Hùng Vương ${year}`,
        startDate: toDateOnly(hungKings),
        endDate: toDateOnly(hungKings),
        note: "Mùng 10 tháng 3 Âm lịch.",
      })
    }

    suggestions.push({
      key: `reunification-labour-${year}`,
      name: `Lễ 30/4 – 1/5/${year}`,
      startDate: `${year}-04-30`,
      endDate: `${year}-05-01`,
      note: "Ngày Chiến thắng và Quốc tế Lao động.",
    })

    suggestions.push({
      key: `national-day-${year}`,
      name: `Quốc khánh 2/9/${year}`,
      startDate: `${year}-09-01`,
      endDate: `${year}-09-02`,
      note: "Mặc định 01–02/09; có thể chỉnh theo lịch nghỉ thực tế từng năm.",
    })
  }

  const cutoff = addDays(today, 450)
  return suggestions
    .filter((holiday) => {
      const end = new Date(`${holiday.endDate}T12:00:00Z`)
      const start = new Date(`${holiday.startDate}T12:00:00Z`)
      return end >= today && start <= cutoff
    })
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .slice(0, 6)
}
