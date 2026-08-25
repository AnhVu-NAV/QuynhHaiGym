# Quỳnh Hải Gym - Management System 🏋️‍♂️

Hướng dẫn tích hợp máy Ronald Jack AI26:

- Trực tiếp AI26 → Vercel, không cần máy Windows: [docs/AI26_DIRECT_VERCEL_SETUP.md](docs/AI26_DIRECT_VERCEL_SETUP.md)
- Qua Gateway Windows trong mạng LAN: [docs/AI26_SETUP.md](docs/AI26_SETUP.md)

Một hệ thống phần mềm quản trị phòng tập Gym toàn diện, hiện đại và chuyên nghiệp được xây dựng bằng **Next.js 16 (App Router)**, kết hợp cùng **Drizzle ORM**, **Neon Database** (Serverless Postgres), và hệ thống xác thực nội bộ.

Hệ thống được thiết kế tối ưu cho trải nghiệm người dùng (UX/UI) với giao diện Dark/Light mode linh hoạt, đem lại tốc độ nhanh và tính ổn định cao nhất cho chủ phòng tập và nhân viên.

---

## 🌟 Tính năng nổi bật

### 1. 👥 Quản lý Hội viên
- Quản lý danh sách hội viên chi tiết (Họ tên, SĐT, Giới tính, Ảnh đại diện).
- Theo dõi trạng thái thẻ tập (Đang hoạt động, Sắp hết hạn, Đã hết hạn).
- **Thẻ ảo (Virtual Card):** Mỗi hội viên có một trang thẻ điện tử riêng biệt (có chứa mã QR Code) thay thế hoàn toàn thẻ nhựa truyền thống. Không tốn phí SMS/Zalo.

### 2. 📦 Quản lý Gói tập (Membership Packages)
- Tạo, sửa, xoá và cấu hình linh hoạt các loại gói tập (Theo tháng, Theo năm).
- Đăng ký gia hạn gói tập cho khách nhanh chóng, tính toán ngày hết hạn tự động theo cơ chế cộng dồn (Stacking).

### 3. 💳 Quản lý Doanh thu & Giao dịch
- Ghi nhận tự động các khoản thu từ việc Đăng ký gói mới, Gia hạn.
- Hỗ trợ đánh dấu phương thức thanh toán (Tiền mặt, Chuyển khoản ngân hàng).
- Biểu đồ thống kê doanh thu theo thời gian thực (Real-time Analytics).

### 4. 📲 Hệ thống Check-in bằng QR Code
- Nhân viên/Lễ tân có thể mở giao diện quét mã QR bằng Camera máy tính/điện thoại.
- Hội viên đưa mã QR trên Thẻ Ảo để Check-in vào cửa tự động.

### 5. 👨‍🏫 Quản lý Huấn luyện viên (PT) & Lịch tập
- Quản lý hồ sơ Huấn luyện viên (Avatar, Chuyên môn).
- Lên lịch dạy học (PT Sessions) 1-kèm-1 cho hội viên.
- Lịch tập tự động đồng bộ vào Thẻ Ảo của hội viên để nhắc lịch.

### 6. 🛡️ Nhật ký hệ thống (Audit Logs) & Bảo mật
- **Xác thực nội bộ:** Đăng nhập bằng email/username, mật khẩu băm scrypt, session cookie được ký và phân quyền Admin/Staff.
- **Audit Logs:** Lưu vết mọi thao tác (Thêm, sửa, xoá) của toàn bộ nhân viên, chống thất thoát và gian lận dữ liệu.

### 7. ⚠️ Cảnh báo tự động
- Dashboard (Bảng điều khiển) thông minh tự động trích xuất và hiển thị danh sách hội viên **sắp hết hạn trong vòng 7 ngày** hoặc đã quá hạn, hỗ trợ Sale chủ động gọi điện chốt khách.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Framework:** Next.js 15 (React 19)
- **Styling:** Tailwind CSS + Shadcn UI
- **Database:** PostgreSQL (Lưu trữ trên Neon.tech)
- **ORM:** Drizzle ORM
- **Authentication:** Internal credentials + signed HTTP-only cookie
- **Image Storage:** Cloudinary
- **Icons:** Lucide React
- **Charts:** Recharts

---

## 🚀 Hướng dẫn cài đặt (Local Development)

### Bước 1: Clone project và cài đặt thư viện
```bash
git clone <repository_url>
cd quynh-hai-gym
npm install
```

### Bước 2: Thiết lập biến môi trường
Tạo file `.env` ở thư mục gốc và điền các thông tin sau (liên hệ Admin để lấy API Key):
```env
# Neon Database Connection
DATABASE_URL=postgresql://...

# Internal Authentication (tạo chuỗi ngẫu nhiên tối thiểu 32 ký tự)
SESSION_SECRET=replace-with-a-long-random-secret


# Cloudinary (Lưu ảnh đại diện)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Bước 3: Đồng bộ cơ sở dữ liệu
```bash
npx drizzle-kit push
```

### Bước 4: Chạy dự án
```bash
npm run dev
```
Truy cập vào [http://localhost:3000](http://localhost:3000) để sử dụng hệ thống.

---

## 🔒 Phân quyền (Roles)
- **Admin:** Toàn quyền truy cập, chỉnh sửa hệ thống, cấu hình giá, xem nhật ký Audit Logs và quản lý tài khoản nhân viên.
- **Staff (Lễ tân/Sale):** Được phép tạo hội viên, đăng ký gói tập, quét mã Check-in và xem danh sách khách hàng. Không được xoá gói tập, không được cấp quyền cho người khác.

---
*Developed for Quỳnh Hải Gym.*
