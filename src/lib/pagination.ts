export function normalizePagination(page: number, limit: number, defaultLimit = 20) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : defaultLimit
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit }
}
