# Quỳnh Hải AI26 Edge Relay

Cloudflare Worker này trả lời `checklive` và giữ hàng đợi lệnh trong một
SQLite-backed Durable Object riêng cho từng serial AI26. Các sự kiện thật
(`reg`, `sendlog`, `senduser` và phản hồi lệnh) vẫn được chuyển tới Vercel để
Neon là nguồn dữ liệu nghiệp vụ duy nhất.

Biến bí mật cần cấu hình ở cả Worker và Vercel:

```text
AI26_EDGE_SECRET=<chuỗi ngẫu nhiên tối thiểu 32 ký tự>
AI26_EDGE_URL=https://quynh-hai-ai26.<subdomain>.workers.dev
```

Triển khai:

```powershell
npm install
npx wrangler secret put AI26_EDGE_SECRET
npm run deploy
```

Sau khi web đã có hai biến môi trường và deploy thành công, đổi tên miền server
trên AI26 sang domain `workers.dev`, cổng `443`. Endpoint Vercel cũ vẫn giữ
nguyên để rollback.
