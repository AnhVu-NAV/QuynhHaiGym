# Kết nối AI26 trực tiếp với Vercel (không cần Gateway)

AI26 dùng chế độ HTTP/HTTPS BS để **chủ động** gửi đăng ký, heartbeat, người dùng
và log chấm công tới Vercel. Vercel trả lệnh đang chờ ngay trong phản hồi
`checklive`. Vì kết nối đi từ máy ra Internet nên không cần VPS, IP tĩnh, mở cổng
modem hay máy Windows chạy 24/24.

> Chỉ đổi server trên AI26 sau khi đã deploy và kiểm tra endpoint. Khi đổi,
> máy sẽ ngừng đồng bộ với Yunatt cho tới khi cấu hình lại server Yunatt.

## 1. Chuẩn bị Neon

Chạy file sau trong Neon SQL Editor nếu chưa chạy:

```text
supabase/migrations/0002_ai26_integration.sql
```

Sau đó đăng nhập web bằng admin, mở `/devices` và lưu:

- Tên máy: `Máy cửa chính`
- Serial: `AYUD15044766`

## 2. Thêm biến môi trường trên Vercel

Trong Project → Settings → Environment Variables, thêm cho Production:

```env
AI26_DIRECT_MODE_ENABLED=true
AI26_ALLOWED_SERIALS=AYUD15044766
# Khuyến nghị khi đường truyền phòng gym có IP WAN tĩnh:
AI26_ALLOWED_IPS=203.0.113.10
AI26_ACCESS_CONTROL_ENABLED=false
AI26_POLL_SECONDS=10
```

Redeploy bản Production sau khi thêm biến. Không thêm tiền tố `NEXT_PUBLIC_`.
Nếu mạng phòng gym dùng IP động, để trống `AI26_ALLOWED_IPS`; endpoint vẫn giới
hạn serial, kích thước payload và tần suất request. Khi có IP tĩnh, bắt buộc điền
allowlist này để ngăn thiết bị giả mạo từ Internet.
`AI26_ACCESS_CONTROL_ENABLED=false` đảm bảo web chỉ ghi check-in, chưa cho phép
phản hồi của web kích relay mở cửa.

## 3. Kiểm tra endpoint trước khi đổi AI26

Thay domain trong lệnh dưới đây bằng domain Production thực tế:

```powershell
$body = '{"cmd":"reg","sn":"AYUD15044766"}'
Invoke-RestMethod -Method Post `
  -Uri "https://TEN-MIEN-CUA-BAN/" `
  -ContentType "application/json" `
  -Body $body
```

Kết quả đúng có `ret = reg`, `result = true`, `nosendimage = true`. Nếu trả về
404, kiểm tra `AI26_DIRECT_MODE_ENABLED`; nếu 403, kiểm tra serial allowlist.

## 4. Lưu cấu hình Yunatt để rollback

Theo ảnh hiện tại của máy:

- Tên miền: `global.yunatt.com`
- IP server: `8.219.14.147`
- Cổng server: `7792`
- Sử dụng tên miền: `Có`

Chụp lại toàn bộ màn hình cài đặt trước khi thay đổi.

## 5. Trỏ AI26 tới Vercel

Vào `Cài đặt kết nối` → `Cài đặt máy chủ`:

- Yêu cầu máy chủ: `Có`
- Sử dụng tên miền: `Có`
- Tên miền: chỉ nhập domain Production, ví dụ `gym-cua-ban.vercel.app`
- Số cổng Server: `443`
- Ủy quyền máy chủ: tạm để `Không`

Không nhập `https://` và không thêm đường dẫn. Firmware của AI26 tự gửi tới
đường dẫn cố định `/pub/api`; web cũng giữ tương thích với JSON POST tại `/`.

Sau khi lưu, chờ khoảng 20 giây rồi tải lại `/devices`. Máy phải hiện online và
có thời gian “nhìn thấy gần nhất”. Nếu không có kết nối sau 1–2 phút, rollback
ngay về Yunatt; firmware này có thể đang cố dùng WebSocket thay vì HTTP/HTTPS BS.

## 6. Kiểm thử đăng ký và check-in

1. Tạo một hội viên thử, có gói còn hiệu lực.
2. Chọn quét khuôn mặt sau khi lưu.
3. Đứng trước AI26 khi máy nhận lệnh `adduser` (tối đa khoảng thời gian poll).
4. Xem trạng thái khuôn mặt ở danh sách hội viên.
5. Nhận diện lại và kiểm tra bản ghi tại `/check-ins`.
6. Thử hội viên không có gói; web vẫn ghi audit nhưng không tạo check-in hợp lệ.

## Rollback

Nếu máy không online hoặc đăng ký không chạy, đặt lại:

```text
Tên miền: global.yunatt.com
IP server: 8.219.14.147
Cổng: 7792
```

## Giới hạn của bản thử nghiệm

- Giao thức thiết bị không cung cấp API key rõ ràng, nên endpoint được khóa bằng
  feature flag và allowlist serial. Không coi serial là một bí mật mạnh.
- Web không lưu ảnh chấm công hoặc mẫu khuôn mặt; `nosendimage=true` và payload
  audit cũng loại dữ liệu sinh trắc.
- Chưa bật mở cửa, reboot, nâng firmware, xóa toàn bộ dữ liệu hoặc lệnh nguy hiểm.
- HTTP/HTTPS BS là polling, nên lệnh không tức thời tuyệt đối. `10` giây là mức
  thử nghiệm; có thể tăng lên `20–30` giây để giảm số request.
- Polling liên tục cũng giữ kết nối Neon hoạt động thường xuyên. Theo dõi quota
  Vercel/Neon trong giai đoạn thử; tăng `AI26_POLL_SECONDS` nếu cần giảm tải.
