import { getInternalUsers } from "@/actions/user-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AddUserDialog } from "./_components/add-user-dialog"
import { UserActionsMenu } from "./_components/user-actions-menu"
import { Badge } from "@/components/ui/badge"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { clerkClient } from "@clerk/nextjs/server"

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20

  const { data: dbUsers, totalPages, totalItems } = await getInternalUsers(q, page, limit)
  
  const client = await clerkClient()
  const clerkUsersList = await client.users.getUserList()
  
  const users = dbUsers.map(dbUser => {
    const clerkUser = clerkUsersList.data.find(u => u.id === dbUser.id)
    return {
      ...dbUser,
      clerkData: clerkUser ? JSON.parse(JSON.stringify(clerkUser)) : null
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quản lý Nhân sự</h2>
          <p className="text-muted-foreground mt-1">Quản lý tài khoản và phân quyền cho nhân viên phòng tập.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput placeholder="Tìm tên hoặc email..." />
          <AddUserDialog />
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh sách Nhân sự</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          {/* Mobile View */}
          <div className="grid gap-3 p-4 md:hidden">
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Không tìm thấy dữ liệu.
              </div>
            ) : (
              users.map((u) => (
                <Card key={u.id} className="p-4 shadow-sm border-slate-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="font-semibold text-slate-800 text-lg truncate">{u.fullName}</div>
                      <div className="text-sm text-muted-foreground truncate">{u.email}</div>
                    </div>
                    <UserActionsMenu user={u} />
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    {u.role === "admin" ? (
                      <Badge variant="default" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">Quản trị viên</Badge>
                    ) : (
                      <Badge variant="secondary">Nhân viên</Badge>
                    )}
                    {u.clerkData?.banned ? (
                      <span className="flex items-center text-red-600 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                        Đã khóa
                      </span>
                    ) : (
                      <span className="flex items-center text-emerald-600 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                        Đang hoạt động
                      </span>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[500px] sm:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Email</TableHead>
                  <TableHead className="whitespace-nowrap">Họ tên</TableHead>
                  <TableHead className="whitespace-nowrap">Phân quyền</TableHead>
                  <TableHead className="whitespace-nowrap">Trạng thái</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium whitespace-nowrap">{u.email}</TableCell>
                    <TableCell className="whitespace-nowrap">{u.fullName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {u.role === "admin" ? (
                        <Badge variant="default" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Quản trị viên</Badge>
                      ) : (
                        <Badge variant="secondary">Nhân viên</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {u.clerkData?.banned ? (
                        <span className="flex items-center text-red-600 text-sm font-medium">
                          <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                          Đã khóa
                        </span>
                      ) : (
                        <span className="flex items-center text-emerald-600 text-sm font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                          Đang hoạt động
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <UserActionsMenu user={u} />
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Không tìm thấy dữ liệu.
                    </TableCell>
                  </TableRow>
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
