import { getTransactions } from "@/actions/transaction-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { QueryFilter } from "@/components/ui/query-filter"

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20
  const paymentMethod = typeof awaitedParams.payment === 'string' ? awaitedParams.payment : "all"

  const { data: transactions, totalPages, totalItems } = await getTransactions(q, page, limit, paymentMethod)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Thanh toán</h2>
          <p className="text-muted-foreground mt-1">Lịch sử thu tiền hội phí và bán gói tập.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="min-w-52 flex-1"><SearchInput placeholder="Tìm mã GD hoặc tên HV..." /></div>
          <QueryFilter param="payment" label="Phương thức" options={[{ value: "all", label: "Mọi phương thức" }, { value: "cash", label: "Tiền mặt" }, { value: "transfer", label: "Chuyển khoản" }]} />
        </div>
      </div>
      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Lịch sử giao dịch</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          {/* Mobile View */}
          <div className="grid gap-3 p-4 md:hidden">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Chưa có giao dịch nào.
              </div>
            ) : (
              transactions.map((tx) => (
                <Card key={tx.id} className="p-4 shadow-sm border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-mono text-slate-500">#{tx.id}</span>
                    <span className="text-xs text-slate-500 font-medium">{new Date(tx.transactionDate).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="font-semibold text-slate-800 text-base mb-1">{tx.member.fullName}</div>
                  <div className="text-sm text-slate-600 mb-3">{tx.description}</div>
                  <div className="flex justify-between items-center mt-2 pt-3 border-t">
                    {tx.paymentMethod === 'cash' ? (
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-medium">Tiền mặt</span>
                    ) : (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">Chuyển khoản</span>
                    )}
                    <span className="font-bold text-emerald-600 text-lg">
                      +{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tx.amount)}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[600px] sm:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Mã GD</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Hội viên</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Phương thức</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      Chưa có giao dịch nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium text-slate-500">#{tx.id}</TableCell>
                      <TableCell>{new Date(tx.transactionDate).toLocaleString('vi-VN')}</TableCell>
                      <TableCell className="font-medium">{tx.member.fullName}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>
                        {tx.paymentMethod === 'cash' ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-medium">Tiền mặt</span>
                        ) : (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">Chuyển khoản</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        +{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationWithLimit totalPages={totalPages} totalItems={totalItems} />
        </CardContent>
      </Card>
    </div>
  )
}
