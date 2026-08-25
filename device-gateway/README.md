# AI26 Device Gateway

Dịch vụ giữ kết nối WebSocket lâu dài với Ronald Jack AI26 và chuyển metadata
sự kiện sang web Gym qua HTTPS. Ảnh chấm công và chuỗi mẫu sinh trắc bị xóa ngay
tại Gateway, trước khi gửi lên web hoặc Neon.

Web ghi lệnh đăng ký/xóa người dùng vào Neon. Gateway chủ động gọi HTTPS tới web
Vercel định kỳ để lấy lệnh mới rồi gửi xuống AI26. Vì mọi kết nối cloud đều
đi từ Gateway ra ngoài, máy Windows không cần IP public, mở port modem hay
Cloudflare Tunnel. Gateway chỉ chấp nhận một allowlist lệnh đã kiểm soát; không
bật lệnh mở cửa, khởi động lại hoặc khôi phục máy. Lệnh `cleanlog` chỉ được web
xếp sau khi AI26 vừa xác nhận không còn bản ghi chưa đồng bộ.

`AI26_ACCESS_CONTROL_ENABLED` mặc định là `false`, vì vậy nhận diện chỉ ghi
check-in và không trả tín hiệu mở relay cửa. Chỉ đổi thành `true` sau khi chủ
phòng gym xác nhận đấu nối cửa và hoàn tất kiểm thử an toàn.

## Cấu hình

Sao chép `.env.example` thành `.env`. `DEVICE_GATEWAY_SECRET` phải
giống hệt biến trên web; `AI26_ALLOWED_SERIALS` là các serial được phép kết nối.
`COMMAND_POLL_INTERVAL_MS` mặc định là 5000 ms và không được thấp hơn 2000 ms.

```bash
npm install
npm run build
npm start
```

Khi đang phát triển có thể dùng:

```bash
npm run dev
```

Trên chính máy Windows, kiểm tra tại `http://localhost:7792/health`.
