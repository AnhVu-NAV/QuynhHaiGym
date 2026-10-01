import { ArrowDownLeft, ArrowUpRight, Banknote, PiggyBank, RotateCcw } from "lucide-react"
import { getTransactions } from "@/actions/transaction-actions"
import { CashflowEntryDialog } from "@/components/transactions/cashflow-entry-dialog"
import { RefundDialog } from "@/components/transactions/refund-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { QueryFilter } from "@/components/ui/query-filter"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { requireUser } from "@/lib/auth"
import { formatVietnamDateTime } from "@/lib/vietnam-time"

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })
const categoryLabels: Record<string, string> = {
  membership: "Hội phí",
  refund: "Hoàn tiền",
  rent: "Mặt bằng",
  utilities: "Điện nước",
  salary: "Lương",
  equipment: "Thiết bị",
  other: "Khác",
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const currentUser = await requireUser()
  const params = await searchParams
  const value = (key: string, fallback = "") => typeof params[key] === "string" ? params[key] as string : fallback
  const q = value("q")
  const page = Number(value("page", "1"))
  const limit = Number(value("limit", "10"))
  const filters = {
    paymentMethod: value("payment", "all"),
    direction: value("direction", "all"),
    category: value("category", "all"),
    period: value("period", "this_month"),
    from: value("from"),
    to: value("to"),
  }
  const { data: transactions, totalPages, totalItems, summary } = await getTransactions(q, page, limit, filters)
  const metrics = [
    { label: "Tổng thu", value: summary.income, icon: ArrowDownLeft, tone: "text-emerald-700", box: "bg-emerald-50" },
    { label: "Tổng chi", value: summary.expense, icon: ArrowUpRight, tone: "text-rose-700", box: "bg-rose-50" },
    { label: "Đã hoàn", value: summary.refunds, icon: RotateCcw, tone: "text-amber-700", box: "bg-amber-50" },
    { label: "Còn lại", value: summary.net, icon: PiggyBank, tone: summary.net >= 0 ? "text-cyan-700" : "text-rose-700", box: summary.net >= 0 ? "bg-cyan-50" : "bg-rose-50" },
  ]

  return (
    <div className="w-full min-w-0 space-y-5 pb-6 sm:space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Banknote className="size-5" /></span>
          <div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Quản lý thu chi</h1><p className="mt-1 text-sm text-slate-500 sm:text-base">Theo dõi doanh thu, chi phí và hoàn tiền minh bạch.</p></div>
        </div>
        {currentUser.role === "admin" && <CashflowEntryDialog />}
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((item) => <Card key={item.label} className="gap-2 border-0 p-4 shadow-sm ring-1 ring-slate-200/80 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-500 sm:text-sm">{item.label}</p><span className={`grid size-8 place-items-center rounded-xl ${item.box} ${item.tone}`}><item.icon className="size-4" /></span></div><p className={`truncate text-base font-black sm:text-xl ${item.tone}`}>{money.format(item.value)}</p></Card>)}
      </section>

      <Card className="min-w-0 gap-0 overflow-hidden border-0 py-0 shadow-sm ring-1 ring-slate-200/80">
        <CardHeader className="gap-4 border-b border-slate-100 px-3 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-lg">Sổ thu chi</CardTitle><p className="mt-1 text-sm text-slate-500">Mặc định hiển thị tháng hiện tại, 10 dòng mỗi trang.</p></div><div className="w-full lg:w-80"><SearchInput placeholder="Mã, hội viên hoặc nội dung..." /></div></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <QueryFilter param="period" label="Thời gian" defaultValue="this_month" options={[{ value: "all", label: "Mọi thời gian" }, { value: "today", label: "Hôm nay" }, { value: "7d", label: "7 ngày gần đây" }, { value: "30d", label: "30 ngày gần đây" }, { value: "this_month", label: "Tháng này" }, { value: "last_month", label: "Tháng trước" }]} />
            <QueryFilter param="direction" label="Loại dòng tiền" options={[{ value: "all", label: "Tất cả thu chi" }, { value: "income", label: "Khoản thu" }, { value: "expense", label: "Khoản chi" }]} />
            <QueryFilter param="category" label="Nhóm" options={[{ value: "all", label: "Tất cả nhóm" }, ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))]} />
            <QueryFilter param="payment" label="Phương thức" options={[{ value: "all", label: "Mọi phương thức" }, { value: "cash", label: "Tiền mặt" }, { value: "transfer", label: "Chuyển khoản" }]} />
          </div>
          <DateRangeFilter />
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          <div className="grid gap-3 p-3 md:hidden">
            {transactions.length === 0 ? <div className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">Không có giao dịch phù hợp bộ lọc.</div> : transactions.map((tx) => {
              const refundable = currentUser.role === "admin" && tx.direction === "income" && ["registration", "renewal"].includes(tx.type) && tx.subscriptionId && tx.subscription?.status !== "cancelled" && tx.refunds.length === 0
              return <Card key={tx.id} className="gap-3 border-slate-200 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{tx.member?.fullName || tx.description || "Thu chi phòng tập"}</p><p className="mt-1 text-xs text-slate-500">#{tx.id} · {formatVietnamDateTime(tx.transactionDate)}</p></div><span className={`shrink-0 text-base font-black ${tx.direction === "expense" ? "text-rose-600" : "text-emerald-700"}`}>{tx.direction === "expense" ? "−" : "+"}{money.format(tx.amount)}</span></div><p className="text-sm text-slate-600">{tx.description}</p><div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><div className="flex flex-wrap gap-1.5"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{categoryLabels[tx.category] || tx.category}</span><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{tx.paymentMethod === "transfer" ? "Chuyển khoản" : "Tiền mặt"}</span></div>{refundable && <RefundDialog transactionId={tx.id} memberName={tx.member?.fullName || "Hội viên"} amount={tx.amount} paymentMethod={tx.paymentMethod} />}</div></Card>
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[980px]"><TableHeader className="bg-slate-50/80"><TableRow><TableHead className="pl-5">Thời gian</TableHead><TableHead>Nội dung</TableHead><TableHead>Nhóm</TableHead><TableHead>Phương thức</TableHead><TableHead className="text-right">Thu / Chi</TableHead><TableHead className="pr-5 text-right">Thao tác</TableHead></TableRow></TableHeader><TableBody>
              {transactions.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-500">Không có giao dịch phù hợp bộ lọc.</TableCell></TableRow> : transactions.map((tx) => {
                const refundable = currentUser.role === "admin" && tx.direction === "income" && ["registration", "renewal"].includes(tx.type) && tx.subscriptionId && tx.subscription?.status !== "cancelled" && tx.refunds.length === 0
                return <TableRow key={tx.id}><TableCell className="pl-5 text-sm"><p>{formatVietnamDateTime(tx.transactionDate)}</p><p className="text-xs text-slate-400">#{tx.id}</p></TableCell><TableCell><p className="max-w-72 truncate font-semibold text-slate-800">{tx.member?.fullName || tx.description || "Thu chi phòng tập"}</p><p className="max-w-72 truncate text-xs text-slate-500">{tx.description}</p></TableCell><TableCell><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{categoryLabels[tx.category] || tx.category}</span></TableCell><TableCell className="text-sm">{tx.paymentMethod === "transfer" ? "Chuyển khoản" : "Tiền mặt"}</TableCell><TableCell className={`text-right font-black ${tx.direction === "expense" ? "text-rose-600" : "text-emerald-700"}`}>{tx.direction === "expense" ? "−" : "+"}{money.format(tx.amount)}</TableCell><TableCell className="pr-5 text-right">{refundable ? <RefundDialog transactionId={tx.id} memberName={tx.member?.fullName || "Hội viên"} amount={tx.amount} paymentMethod={tx.paymentMethod} /> : tx.category === "refund" ? <span className="text-xs font-medium text-amber-700">Đã hoàn</span> : <span className="text-xs text-slate-400">—</span>}</TableCell></TableRow>
              })}
            </TableBody></Table>
          </div>
          <div className="px-3 sm:px-5"><PaginationWithLimit totalPages={totalPages} totalItems={totalItems} /></div>
        </CardContent>
      </Card>
    </div>
  )
}
