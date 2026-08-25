import { Activity, Cpu, Database, Server, ShieldCheck } from "lucide-react"
import { getDeviceDashboard } from "@/actions/device-actions"
import { DeviceControls } from "@/components/devices/device-controls"
import { DeviceSetupForm } from "@/components/devices/device-setup-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"

export default async function DevicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin()
  const params = await searchParams
  const numberParam = (name: string, fallback: number) => typeof params[name] === "string" && Number(params[name]) > 0 ? Number(params[name]) : fallback
  const { devices, commands, events, checkedAt, pagination } = await getDeviceDashboard({
    devicePage: numberParam("devicePage", 1),
    deviceLimit: numberParam("deviceLimit", 20),
    commandPage: numberParam("commandPage", 1),
    commandLimit: numberParam("commandLimit", 10),
    eventPage: numberParam("eventPage", 1),
    eventLimit: numberParam("eventLimit", 10),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Máy nhận diện AI26</h1>
        <p className="mt-1 text-muted-foreground">Kết nối, đăng ký khuôn mặt và nhận check-in từ máy Ronald Jack.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Khai báo thiết bị</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <DeviceSetupForm />
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Chỉ đổi máy sang server mới sau khi Gateway báo hoạt động. Ảnh check-in và mẫu sinh trắc bị loại bỏ tại Gateway, không lưu vào Neon.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {devices.length === 0 ? (
          <Card className="lg:col-span-2"><CardContent className="py-12 text-center text-muted-foreground">Chưa khai báo thiết bị.</CardContent></Card>
        ) : devices.map((device) => {
          const online = device.status === "online"
            && Boolean(device.lastSeenAt)
            && checkedAt - new Date(device.lastSeenAt!).getTime() < 90_000
          const logStatsFresh = Boolean(device.logStatsAt)
            && checkedAt - new Date(device.logStatsAt!).getTime() < 10 * 60_000
          const logPercent = device.logCapacity && device.usedLogCount !== null
            ? Math.min(100, Math.round(device.usedLogCount / device.logCapacity * 100))
            : null
          const canCleanLogs = online
            && logStatsFresh
            && Boolean(device.lastLogSyncedAt)
            && device.unsyncedLogCount === 0
            && Boolean(device.usedLogCount && device.usedLogCount > 0)
          const cleanDisabledReason = !online
            ? "Máy đang ngoại tuyến"
            : !logStatsFresh
              ? "Cần kết nối lại AI26 để lấy số liệu mới"
              : !device.lastLogSyncedAt
                ? "Chưa có lần lưu nhật ký AI26 thành công vào web"
              : device.unsyncedLogCount !== 0
                ? "Máy vẫn còn nhật ký chưa đồng bộ"
                : "Máy không có nhật ký cần dọn"
          return (
            <Card key={device.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5" /> {device.name}</CardTitle>
                  <Badge variant={online ? "default" : "secondary"}>{online ? "Đang kết nối" : "Ngoại tuyến"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <dl className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="text-muted-foreground">Serial</dt><dd className="font-mono">{device.serialNumber}</dd>
                  <dt className="text-muted-foreground">Model</dt><dd>{device.modelName || "Chưa nhận"}</dd>
                  <dt className="text-muted-foreground">Firmware</dt><dd className="break-all">{device.firmware || "Chưa nhận"}</dd>
                  <dt className="text-muted-foreground">Lần cuối</dt><dd>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString("vi-VN") : "Chưa kết nối"}</dd>
                  <dt className="text-muted-foreground">Khuôn mặt</dt><dd>{device.memberMappings.filter((item) => item.faceStatus === "registered").length} hội viên</dd>
                </dl>
                <div className="rounded-xl border bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-medium"><Database className="h-4 w-4" /> Nhật ký trên AI26</div>
                    <Badge variant={logPercent !== null && logPercent >= 80 ? "destructive" : "secondary"}>
                      {logPercent === null ? "Chưa có số liệu" : `${logPercent}%`}
                    </Badge>
                  </div>
                  {logPercent === null ? (
                    <p className="mt-2 text-xs text-muted-foreground">Kết nối lại máy để nhận dung lượng nhật ký.</p>
                  ) : (
                    <>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${logPercent >= 80 ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${logPercent}%` }}
                        />
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>Đã dùng: {device.usedLogCount?.toLocaleString("vi-VN")} / {device.logCapacity?.toLocaleString("vi-VN")}</span>
                        <span>Chưa đồng bộ: {device.unsyncedLogCount?.toLocaleString("vi-VN")}</span>
                        <span>Cập nhật: {device.logStatsAt ? new Date(device.logStatsAt).toLocaleString("vi-VN") : "—"}</span>
                        <span>Lưu web gần nhất: {device.lastLogSyncedAt ? new Date(device.lastLogSyncedAt).toLocaleString("vi-VN") : "Chưa có"}</span>
                        <span>Dọn gần nhất: {device.lastLogCleanupAt ? new Date(device.lastLogCleanupAt).toLocaleString("vi-VN") : "Chưa từng"}</span>
                      </div>
                    </>
                  )}
                  <p className="mt-2 text-xs text-emerald-700">Tự dọn ở mức 80% chỉ khi máy báo đã đồng bộ hết.</p>
                </div>
                <DeviceControls
                  deviceId={device.id}
                  online={online}
                  canCleanLogs={canCleanLogs}
                  cleanDisabledReason={cleanDisabledReason}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
      <PaginationWithLimit totalPages={pagination.devices.totalPages} totalItems={pagination.devices.totalItems} pageParam="devicePage" limitParam="deviceLimit" />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Lệnh gần đây <Badge variant="secondary">Lưu 7 ngày</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {commands.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có lệnh.</p> : commands.map((command) => (
              <div key={command.id} className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0">
                <div><div className="font-medium">{command.command} · {command.device.name}</div><div className="text-xs text-muted-foreground">{new Date(command.createdAt).toLocaleString("vi-VN")}</div></div>
                <Badge variant={command.status === "failed" ? "destructive" : command.status === "completed" ? "default" : "secondary"}>{command.status}</Badge>
              </div>
            ))}
            <PaginationWithLimit totalPages={pagination.commands.totalPages} totalItems={pagination.commands.totalItems} pageParam="commandPage" limitParam="commandLimit" defaultLimit={10} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Sự kiện thiết bị <Badge variant="secondary">Lưu 7 ngày</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có sự kiện.</p> : events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0">
                <div><div className="font-medium">{event.eventType} · {event.device.name}</div><div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("vi-VN")}</div></div>
                <Badge variant="outline">Đã lọc dữ liệu nhạy cảm</Badge>
              </div>
            ))}
            <PaginationWithLimit totalPages={pagination.events.totalPages} totalItems={pagination.events.totalItems} pageParam="eventPage" limitParam="eventLimit" defaultLimit={10} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
