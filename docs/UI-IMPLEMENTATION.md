# Báo Cáo Triển Khai Giao Diện Người Dùng (UI Implementation Report)

> **Dự án:** Quản Lý Phòng Tập Gym Local MVP  
> **Người thực hiện:** Antigravity (UI / Frontend Role)  
> **Nền tảng:** React 19 + Vite 7 + Plain CSS (Không sử dụng thư viện UI ngoài)  
> **Cổng dịch vụ:** Vite Dev Server `http://127.0.0.1:5180`, Backend API `http://127.0.0.1:3010` (Proxy `/api`)  

---

## 1. Danh Sách Tệp Triển Khai (Files Implemented)

### 1.1. Cấu hình & Khởi tạo gốc
- [`vite.config.mjs`](file:///E:/quản%20lý%20phòng%20tập/vite.config.mjs): Cấu hình Vite chạy ở cổng `5180` (host `127.0.0.1`, strictPort: true), thiết lập proxy `/api` chuyển tiếp đến backend `http://127.0.0.1:3010` với `changeOrigin: false` để giữ nguyên Origin hợp lệ (`http://127.0.0.1:5180`) cho bộ lọc bảo mật CSRF của backend.
- [`index.html`](file:///E:/quản%20lý%20phòng%20tập/index.html): HTML shell chuẩn trợ năng, nhúng favicon SVG cục bộ (icon Dumbbell thể thao), viewport chuẩn responsive, liên kết tệp khởi động `/src/main.jsx`.
- [`src/main.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/main.jsx): Khởi tạo React 19 Root gắn vào `#root` với `React.StrictMode`.
- [`src/styles.css`](file:///E:/quản%20lý%20phòng%20tập/src/styles.css): Toàn bộ mã định kiểu CSS thuần (Plain CSS) theo hệ thiết kế Dark Sidebar (`Slate-900`/`Slate-800`) kết hợp Light Content Body (`Slate-50`), nhận diện thương hiệu thể thao `Emerald-500` & `Lime-400`. Hỗ trợ responsive layout, mobile sidebar drawer, focus outlines chuẩn trợ năng, status badges, alert banners, modal backdrop và skeleton pulse animations.

### 1.2. Thư viện Icon & Lớp giao tiếp API
- [`src/icons.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/icons.jsx): Tập hợp các icon SVG thuần vector (Dumbbell, Users, Calendar, CheckSquare, CreditCard, LayoutDashboard, Package, LogOut, KeyRound, Plus, Search, Edit2, Check, X, AlertCircle, Clock, Menu, RefreshCw, DollarSign, Lock, User) hoàn toàn độc lập, không tải CDN hay tài nguyên mạng ngoài.
- [`src/api.js`](file:///E:/quản%20lý%20phòng%20tập/src/api.js): API Client module:
  - Lưu trữ `csrfToken` trong bộ nhớ ứng dụng (Memory), tự động đính kèm `X-CSRF-Token` cho tất cả mutation (`POST`, `PATCH`).
  - Gửi cookie phiên làm việc `credentials: 'same-origin'`.
  - Bóc tách chuẩn envelope `{ data }` và `{ error: { code, message, fields } }`.
  - Bộ định dạng tiền tệ `formatVnd(...)` sử dụng `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`.
  - Bộ chuyển đổi ngày giờ Việt Nam UTC+7 chuẩn canonical ISO cho lịch tập PT (`vnDateTimeToUtcIso`, `utcIsoToVnDateTime`, `formatDate`, `formatDateTime`).

### 1.3. Khung điều hướng & Thành phần dùng chung (Components)
- [`src/App.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/App.jsx): Bộ điều phối chính của ứng dụng; kiểm tra phiên đăng nhập `GET /api/auth/me` lúc mở trang, quản lý chuyển đổi view, phân quyền điều hướng theo vai trò (Role-based access view fallback), điều khiển modal đổi mật khẩu và menu di động.
- [`src/components/Sidebar.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/components/Sidebar.jsx): Thanh bên điều hướng Dark Theme, hiển thị menu tương ứng theo vai trò người dùng (Owner/Staff/PT/Member), thông tin tài khoản đang đăng nhập, nút Đổi mật khẩu và Đăng xuất.
- [`src/components/TopBar.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/components/TopBar.jsx): Thanh tiêu đề trang với nút mở menu trên mobile và huy hiệu ngày làm việc hiện tại theo múi giờ Việt Nam.
- [`src/components/Modal.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/components/Modal.jsx): Hộp thoại tương tác chuẩn trợ năng (khóa cuộn body, đóng bằng phím ESC, click backdrop).
- [`src/components/Feedback.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/components/Feedback.jsx): Các thành phần phản hồi trạng thái: `AlertBanner`, `InlineError`, `EmptyState`, `SkeletonRow`, `SkeletonCards`.
- [`src/components/StatCard.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/components/StatCard.jsx): Thẻ hiển thị chỉ số KPI tổng quan với icon và thanh viền màu trạng thái.

### 1.4. Màn hình chức năng (Views)
- [`src/views/LoginView.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/LoginView.jsx): Màn hình đăng nhập với 4 nút chọn nhanh tài khoản Demo (`owner`, `staff`, `pt`, `member` kèm mật khẩu `Gym@2026Demo!`), xử lý lỗi validation và rate-limit từ backend.
- [`src/views/DashboardView.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/DashboardView.jsx): Bảng điều khiển phân quyền 4 vai trò:
  - **Owner & Staff:** Tổng hội viên, thẻ hoạt động, thẻ sắp hết hạn (cảnh báo amber), check-in hôm nay, doanh thu hôm nay/tháng, công nợ tổng và danh sách 5 buổi PT sắp tới.
  - **PT:** Số buổi dạy hôm nay, số buổi hoàn thành trong tháng, danh sách học viên sắp dạy.
  - **Member:** Trạng thái điểm danh hôm nay, công nợ cá nhân, thẻ hội viên đang hoạt động/gần nhất, các buổi tập PT đã đặt.
- [`src/views/AttendanceView.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/AttendanceView.jsx): Trạm điểm danh quầy lễ tân tốc độ cao:
  - Ô tìm kiếm và chọn nhanh hội viên.
  - Ghi nhận `POST /api/attendance` với phản hồi tức thì (Thành công / Đã check-in hôm nay / Lỗi thẻ không bao phủ ngày hôm nay).
  - Bảng lịch sử điểm danh theo ngày Việt Nam. Hội viên xem lịch sử điểm danh của chính mình.
- [`src/views/MembersView.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/MembersView.jsx): Dành cho Owner/Staff: tra cứu hội viên theo từ khóa (tên, SĐT, login, email), tạo mới hội viên (nguyên tử tài khoản user + hồ sơ member), chỉnh sửa họ tên/SĐT/email, nút liên kết nhanh sang bán thẻ.
- [`src/views/PackagesView.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/PackagesView.jsx): Danh mục gói tập: hiển thị danh sách gói và thời hạn/giá niêm yết. Chủ phòng (Owner) có quyền tạo gói mới và chỉnh sửa thời hạn, giá VND hoặc bật/tắt ngừng bán (`isActive`).
- [`src/views/MembershipsView.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/MembershipsView.jsx): Quản lý thẻ tập và bán gói: chọn hội viên, gói tập, ngày bắt đầu (hệ thống tự động tính ngày kết thúc, kiểm tra chống trùng ngày). Hiển thị chi tiết tiền nộp, công nợ và huy hiệu trạng thái (`upcoming`, `active`, `expired`).
- [`src/views/PaymentsView.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/PaymentsView.jsx): Sổ thu tiền VND: lập phiếu thu tiền mặt hoặc chuyển khoản với `requestId` sinh ngẫu nhiên UUIDv4 chống ghi nhận kép (idempotent), kiểm tra số tiền nguyên dương và ngăn chặn thu vượt công nợ (`balanceVnd`).
- [`src/views/SessionsView.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/SessionsView.jsx): Quản lý lịch Huấn luyện viên: đặt lịch buổi tập theo khung 15 phút, tính toán chuyển đổi giờ Việt Nam sang chuẩn ISO UTC, kiểm tra xung đột trùng lịch; thao tác hoàn thành buổi tập (`completed`) cho PT/quản lý hoặc hủy lịch (`cancelled`).
- [`src/views/ChangePasswordModal.jsx`](file:///E:/quản%20lý%20phòng%20tập/src/views/ChangePasswordModal.jsx): Hộp thoại đổi mật khẩu tài khoản (tối thiểu 10 ký tự), tự động thu hồi toàn bộ phiên và đưa người dùng về màn hình đăng nhập.

---

## 2. Bằng Chứng Kiểm Thử & Biên Dịch (Test & Build Evidence)

### 2.1. Biên dịch ứng dụng UI (`npm run build`)
```
> gym-local@1.0.0 build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 45 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.83 kB │ gzip:  0.49 kB
dist/assets/index-BZbsIy0l.css   15.12 kB │ gzip:  3.47 kB
dist/assets/index-vIJv9SCA.js   308.45 kB │ gzip: 88.11 kB
✓ built in 1.48s
```
- Kết quả: Không có lỗi (0 errors), không có cảnh báo (0 warnings).

### 2.2. Kiểm thử API Backend (`npm test`)
```
> gym-local@1.0.0 test
> node --test tests/*.test.mjs

✔ member creation and update validate atomically and enforce scope (273.7214ms)
✔ packages enforce owner writes, strict values, and active visibility (196.0465ms)
✔ attendance uses Vietnam date, inclusive membership and idempotent daily check-in (180.765ms)
✔ dashboard counts and financial data are scoped by role (189.1299ms)
✔ dashboard does not expose other members or trainers (219.2073ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1211.345
```
- Kết quả: Toàn bộ 5/5 test suites của backend đều đạt (`pass 5`).

### 2.3. Kiểm tra tích hợp cả 4 vai trò người dùng (End-to-End Role Verification)
Đã thực thi kiểm tra thông qua script node kết nối trực tiếp với backend server:
1. **Vai trò Chủ phòng (`owner` / `Nguyễn Minh Anh`):**
   - Đăng nhập `POST /api/auth/login`: HTTP 200, cấp phát cookie `gym_session`.
   - Phục hồi phiên `GET /api/auth/me`: HTTP 200, vai trò `owner`.
   - Bảng điều khiển `GET /api/dashboard`: HTTP 200, trả về đầy đủ các trường thống kê tài chính và vận hành (`totalMembers`, `activeMemberships`, `expiringSoonCount`, `todayCheckIns`, `todaySessions`, `outstandingVnd`, `revenueTodayVnd`, `revenueMonthVnd`, `upcomingSessions`).
2. **Vai trò Lễ tân (`staff` / `Trần Thu Hà`):**
   - Đăng nhập `POST /api/auth/login`: HTTP 200.
   - Bảng điều khiển `GET /api/dashboard`: HTTP 200, số liệu vận hành và doanh thu phòng tập.
3. **Vai trò Huấn luyện viên (`pt` / `Lê Hoàng Nam`):**
   - Đăng nhập `POST /api/auth/login`: HTTP 200.
   - Bảng điều khiển `GET /api/dashboard`: HTTP 200, phạm vi cá nhân hóa đúng với quyền PT (`todaySessions`, `completedSessionsThisMonth`, `upcomingSessions`).
4. **Vai trò Hội viên (`member` / `Phạm Ngọc Linh`):**
   - Đăng nhập `POST /api/auth/login`: HTTP 200.
   - Bảng điều khiển `GET /api/dashboard`: HTTP 200, hiển thị đúng thẻ hội viên của cá nhân, trạng thái check-in hôm nay, số tiền nợ và lịch tập cá nhân.

---

## 3. Các Khoảng Trống & Lưu Ý (Known Gaps & Observations)
1. **Bảo vệ CSRF Origin:** Backend kiểm tra chặt chẽ `Origin` trong danh sách allowlist (`http://127.0.0.1:5180`). Khi chạy UI, lập trình viên và người dùng cần truy cập đúng URL `http://127.0.0.1:5180` (hoặc `http://localhost:5180`) theo đúng cấu hình trong `PLAN.md` và `package.json`.
2. **Quy tắc ngày giờ Việt Nam cho buổi PT:** Lịch tập PT yêu cầu thời lượng từ 30 đến 180 phút, chia hết cho 15, giây/mili-giây bằng 0 và kết thúc trong cùng ngày Việt Nam. Giao diện `SessionsView` đã tích hợp sẵn các bộ chọn bước nhảy (step 15 phút) để đảm bảo không vi phạm ràng buộc của backend.
3. **Phạm vi MVP đã được tuân thủ đúng yêu cầu:** Không sử dụng các dịch vụ trả phí, không sử dụng ảnh ngoài, không dùng localStorage để làm giả dữ liệu, toàn bộ trạng thái đều kiểm tra và đồng bộ qua API của máy chủ SQLite.
