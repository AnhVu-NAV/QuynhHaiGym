# AI26 Edge Relay

## Mục tiêu

AI26 vẫn gọi `checklive` khoảng 10 giây một lần, nhưng Cloudflare Worker trả lời
heartbeat ngay tại edge. Neon chỉ được gọi khi có nghiệp vụ thật như check-in,
đăng ký khuôn mặt, đồng bộ người dùng hoặc phản hồi lệnh quản trị.

## Luồng hoạt động

1. AI26 gửi `checklive` tới Worker.
2. Durable Object cập nhật trạng thái online và trả lệnh đang chờ nếu có.
3. Nếu không có lệnh, Worker trả giờ Việt Nam mà không gọi Vercel/Neon.
4. Các sự kiện thật được Worker chuyển tiếp tới `/api/device/bs` trên Vercel.
5. Nếu Worker không truy cập được origin, yêu cầu được thử lại qua origin; máy có
   thể đổi lại domain Vercel cũ để rollback ngay.

## Bảo vệ

- Chỉ serial trong allowlist hoặc được cấp quyền từ trang Thiết bị mới được dùng.
- Payload tối đa 2 MiB.
- Tối đa 20 heartbeat/phút/serial; nhịp thực tế 10 giây chỉ khoảng 6 lần/phút.
- API quản trị relay bắt buộc `AI26_EDGE_SECRET`.
- Hàng đợi tối đa 50 lệnh/máy và tự gửi lại lệnh chưa được xác nhận sau 2 phút.

## Biến môi trường

Worker:

- `AI26_EDGE_SECRET`: secret ngẫu nhiên, tối thiểu 32 ký tự.
- `ORIGIN_URL`: `https://quynhhaigym.vercel.app`.
- `AI26_ALLOWED_SERIALS`: danh sách serial bootstrap, phân cách bằng dấu phẩy.

Vercel:

- `AI26_EDGE_URL`: URL `workers.dev` của relay.
- `AI26_EDGE_SECRET`: cùng secret trên Worker.

Nếu hai biến Vercel chưa có, web tự dùng cơ chế Vercel/Neon cũ nên việc triển
khai code trước không làm gián đoạn máy.

## Rollback

Đổi `Tên miền` trên AI26 về `quynhhaigym.vercel.app`, cổng `443`. Không cần đổi
database và không mất lệnh đang chờ vì lệnh vẫn được giữ ở Neon cho tới khi máy
xác nhận đã xử lý.
