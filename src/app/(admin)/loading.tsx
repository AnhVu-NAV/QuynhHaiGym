export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Đang tải dữ liệu">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border bg-white shadow-sm">
            <div className="m-5 h-4 w-2/3 rounded bg-slate-100" />
            <div className="mx-5 h-7 w-1/3 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border bg-white shadow-sm" />
    </div>
  )
}
