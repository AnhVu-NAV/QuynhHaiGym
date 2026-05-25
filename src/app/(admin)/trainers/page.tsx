import { getTrainers } from "@/actions/trainer-actions"
import { TrainerDialog } from "@/components/trainers/trainer-dialog"
import { DeleteTrainerButton } from "@/components/trainers/delete-trainer-button"
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

export default async function TrainersPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20

  const { data: trainers, totalPages, totalItems } = await getTrainers(q, page, limit)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Huấn luyện viên</h2>
          <p className="text-muted-foreground mt-1">Quản lý hồ sơ Huấn luyện viên cá nhân (PT).</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput placeholder="Tìm tên hoặc SĐT..." />
          <TrainerDialog mode="create" />
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh sách Huấn luyện viên</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          {/* Mobile View */}
          <div className="grid gap-3 p-4 md:hidden">
            {trainers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Chưa có huấn luyện viên nào.
              </div>
            ) : (
              trainers.map((trainer) => (
                <Card key={trainer.id} className="p-4 shadow-sm border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    {trainer.isActive ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Hoạt động</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Nghỉ việc</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {trainer.avatarUrl ? (
                      <img src={trainer.avatarUrl} alt="avatar" className="w-14 h-14 rounded-full object-cover border" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-500">
                        {trainer.fullName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-800 text-lg">{trainer.fullName}</div>
                      <div className="text-sm text-muted-foreground">{trainer.phoneNumber}</div>
                      <div className="text-sm font-medium text-indigo-600 mt-0.5">{trainer.specialty || "Chưa cập nhật"}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                    <TrainerDialog mode="edit" trainerData={trainer} />
                    <DeleteTrainerButton id={trainer.id} />
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
                  <TableHead>Họ tên PT</TableHead>
                  <TableHead>Số điện thoại</TableHead>
                  <TableHead>Chuyên môn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Chưa có huấn luyện viên nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  trainers.map((trainer) => (
                    <TableRow key={trainer.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {trainer.avatarUrl ? (
                            <img src={trainer.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover border" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                              {trainer.fullName.charAt(0)}
                            </div>
                          )}
                          {trainer.fullName}
                        </div>
                      </TableCell>
                      <TableCell>{trainer.phoneNumber}</TableCell>
                      <TableCell>{trainer.specialty || "Chưa cập nhật"}</TableCell>
                      <TableCell>
                        {trainer.isActive ? (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">Hoạt động</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs font-medium">Nghỉ việc</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <TrainerDialog mode="edit" trainerData={trainer} />
                        <DeleteTrainerButton id={trainer.id} />
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
