# Thiết lập Ronald Jack AI26 bằng máy Windows tại phòng gym

Hệ thống gồm ba phần:

1. Web Next.js chạy trên Vercel.
2. Neon lưu hội viên, lệnh thiết bị và check-in.
3. `device-gateway` chạy trên máy Windows cùng mạng LAN với AI26.

Gateway chủ động gọi HTTPS ra Vercel để lấy lệnh và gửi sự kiện. Không cần VPS,
IP public, mở cổng modem hoặc Cloudflare Tunnel. Không đổi cấu hình Yunatt trên
AI26 trước khi hoàn tất bước 1-4 và kiểm tra `/health` của Gateway.

## 1. Cập nhật cơ sở dữ liệu

Chạy nội dung file sau trong Neon SQL Editor:

```text
supabase/migrations/0002_ai26_integration.sql
```

Migration tạo bảng thiết bị, ánh xạ `enrollid`, lịch sử lệnh/sự kiện và bổ sung
metadata AI26 cho bảng `check_ins`. Migration không xóa dữ liệu hiện có.

## 2. Cấu hình web trên Vercel

Tạo một chuỗi bí mật ngẫu nhiên dài ít nhất 32 ký tự. Thêm biến môi trường phía
server rồi redeploy web:

```env
DEVICE_GATEWAY_SECRET=mot-chuoi-ngau-nhien-toi-thieu-32-ky-tu
```

Không đặt tiền tố `NEXT_PUBLIC_` cho secret.

Sau khi migration và redeploy, đăng nhập bằng admin, mở `/devices`, rồi lưu:

- Tên máy: `Máy cửa chính`
- Serial: `AYUD15044766`

## 3. Chạy Device Gateway trên Windows

Mở PowerShell trong thư mục `device-gateway`, tạo `.env` từ file mẫu rồi sửa các
giá trị:

```powershell
Copy-Item .env.example .env
npm install
npm run build
npm start
```

Nội dung `.env`:

```env
PORT=7792
WEB_APP_URL=https://ten-mien-web-vercel-cua-ban
DEVICE_GATEWAY_SECRET=phai-giong-het-secret-tren-web
AI26_ALLOWED_SERIALS=AYUD15044766
AI26_ACCESS_CONTROL_ENABLED=false
COMMAND_POLL_INTERVAL_MS=5000
```

Không thêm dấu `/` ở cuối `WEB_APP_URL`. Kiểm tra trên máy Windows:

```text
http://localhost:7792/health
```

Kết quả cần có `"success": true`. Cho phép TCP `7792` trong Windows Firewall ở
mạng Private để AI26 trong LAN kết nối được. Nên đặt DHCP Reservation trên modem
để IP của máy Windows không đổi.

## 4. Kiểm tra trước khi đổi máy

- Migration đã chạy thành công trên đúng Neon Production.
- Web `/devices` mở được.
- Gateway `http://localhost:7792/health` trả thành công.
- `DEVICE_GATEWAY_SECRET` ở hai nơi giống nhau.
- Allowlist có đúng `AYUD15044766`.
- Máy Windows và AI26 cùng mạng LAN.
- Có sẵn thông tin rollback của server Yunatt cũ.

## 5. Đổi AI26 sang Gateway

Trên AI26 vào `Cài đặt kết nối` → `Cài đặt máy chủ`:

- Yêu cầu máy chủ: Có
- Sử dụng tên miền: Không
- IP server: IPv4 LAN cố định của máy Windows, ví dụ `192.168.2.100`
- Số cổng Server: `7792`

Sau khi lưu, trang `/devices` phải chuyển sang `Đang kết nối` và hiển thị model,
firmware, thời gian nhìn thấy gần nhất.

## 6. Kiểm thử luồng hội viên

1. Tạo một hội viên thử nghiệm và đăng ký gói còn hạn.
2. Giữ chọn `Quét khuôn mặt trên AI26 sau khi lưu`.
3. Gateway lấy lệnh từ Vercel trong vài giây; AI26 yêu cầu hội viên nhìn camera.
4. Chờ trạng thái trên danh sách hội viên thành `Đã có khuôn mặt`.
5. Cho hội viên nhận diện lại để kiểm tra log xuất hiện trong `/check-ins`.
6. Thử thêm một hội viên không có gói để xác nhận hệ thống từ chối check-in.

## Rollback

Nếu Gateway không hoạt động, đặt lại máy về thông tin đã chụp trước đó:

- Tên miền: `global.yunatt.com`
- IP server: `8.219.14.147`
- Cổng: `7792`

## Giới hạn an toàn hiện tại

- Gateway loại ảnh check-in và chuỗi mẫu sinh trắc trước khi gọi web.
- Web chỉ lưu check-in và metadata cần thiết.
- Chưa kích hoạt mở cửa từ xa, reboot, xóa toàn bộ người dùng hoặc khởi tạo máy.
- Tín hiệu mở relay sau nhận diện mặc định cũng bị khóa bằng
  `AI26_ACCESS_CONTROL_ENABLED=false`.
- AI26 chỉ nói chuyện với Gateway trong mạng LAN. Không chuyển tiếp cổng `7792`
  trên modem ra Internet.
