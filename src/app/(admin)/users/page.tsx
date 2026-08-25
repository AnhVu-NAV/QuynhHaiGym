import { getInternalUsers } from "@/actions/user-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AddUserDialog } from "./_components/add-user-dialog"
import { UserActionsMenu } from "./_components/user-actions-menu"
import { Badge } from "@/components/ui/badge"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { QueryFilter } from "@/components/ui/query-filter"

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : ""
  const page = typeof params.page === "string" ? Number(params.page) : 1
  const limit = typeof params.limit === "string" ? Number(params.limit) : 20
  const role = typeof params.role === "string" ? params.role : "all"
  const accountStatus = typeof params.status === "string" ? params.status : "all"
  const { data: users, totalPages, totalItems } = await getInternalUsers(q, page, limit, role, accountStatus)

  const status = (locked: boolean) => locked ? (
    <span className="flex items-center text-sm font-medium text-red-600"><span className="mr-2 h-2 w-2 rounded-full bg-red-500" />Đã khóa</span>
  ) : (
    <span className="flex items-center text-sm font-medium text-emerald-600"><span className="mr-2 h-2 w-2 rounded-full bg-emerald-500" />Đang hoạt động</span>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quản lý Nhân sự</h2>
          <p className="mt-1 text-muted-foreground">Quản lý tài khoản và phân quyền cho nhân viên phòng tập.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="min-w-56 flex-1"><SearchInput placeholder="Tìm tên, SĐT, chức danh..." /></div>
          <QueryFilter param="role" label="Phân quyền" options={[{ value: "all", label: "Mọi quyền" }, { value: "admin", label: "Quản trị viên" }, { value: "staff", label: "Nhân viên" }]} />
          <QueryFilter param="status" label="Trạng thái" options={[{ value: "all", label: "Mọi trạng thái" }, { value: "active", label: "Đang hoạt động" }, { value: "locked", label: "Đã khóa" }]} />
          <AddUserDialog />
        </div>
      </div>
      <Card className="border-muted shadow-sm">
        <CardHeader><CardTitle>Danh sách Nhân sự</CardTitle></CardHeader>
        <CardContent className="overflow-hidden p-0 sm:p-6">
          <div className="grid gap-3 p-4 md:hidden">
            {users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="mb-3 flex justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold">{user.fullName}</div>
                    <div className="truncate text-sm text-muted-foreground">{user.email || user.username}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{user.jobTitle || "Nhân viên"}{user.phoneNumber ? ` · ${user.phoneNumber}` : ""}</div>
                  </div>
                  <UserActionsMenu user={user} />
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role === "admin" ? "Quản trị viên" : "Nhân viên"}</Badge>
                  {status(user.isLocked)}
                </div>
              </Card>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Nhân viên</TableHead><TableHead>Liên hệ</TableHead><TableHead>Chức danh</TableHead><TableHead>Phân quyền</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell><div className="font-medium">{user.fullName}</div><div className="text-xs text-muted-foreground">{user.username ? `@${user.username}` : ""}</div></TableCell>
                    <TableCell><div>{user.phoneNumber || "—"}</div><div className="text-xs text-muted-foreground">{user.email || ""}</div></TableCell>
                    <TableCell>{user.jobTitle || "Nhân viên"}</TableCell>
                    <TableCell><Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role === "admin" ? "Quản trị viên" : "Nhân viên"}</Badge></TableCell>
                    <TableCell>{status(user.isLocked)}</TableCell>
                    <TableCell className="text-right"><UserActionsMenu user={user} /></TableCell>
                  </TableRow>
                ))}
                {!users.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Không tìm thấy dữ liệu.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <PaginationWithLimit totalPages={totalPages} totalItems={totalItems} />
        </CardContent>
      </Card>
    </div>
  )
}
