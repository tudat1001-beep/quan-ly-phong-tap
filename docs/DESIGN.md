# HƯỚNG DẪN THIẾT KẾ GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UX/UI SPECIFICATION)
## HỆ THỐNG QUẢN LÝ PHÒNG TẬP GYM (FITNESS MANAGEMENT SYSTEM - MVP)

> **Phiên bản:** 1.0.0 (MVP Đồng bộ theo `PLAN.md` & `API.md`)  
> **Ngôn ngữ:** Tiếng Việt  
> **Công nghệ giao diện:** React 19 + Vite 7 + Plain CSS (Không phụ thuộc Tailwind/Lucide bên ngoài)  
> **Phong cách thị giác:** Dark Sidebar / Light Content Body kết hợp nhận diện thể thao Emerald & Lime  

---

## 1. TỔNG QUAN & NGUYÊN TẮC THIẾT KẾ

### 1.1. Bối cảnh Sản phẩm
- Ứng dụng chạy trên mạng nội bộ phòng tập (Local Web Application).
- Vite Dev Server chạy tại `http://127.0.0.1:5180`, chuyển tiếp (proxy) các lệnh gọi API `/api` về backend Node 24 tại `http://127.0.0.1:3010`.
- Cơ sở dữ liệu SQLite duy nhất lưu trữ persistent cục bộ.
- Mọi điều khiển giao diện đều gọi API thật; máy chủ là nguồn dữ liệu chuẩn xác duy nhất (authoritative). Không dùng localStorage để lưu mock data hoặc tự phân quyền giả lập trên client.

### 1.2. Bốn vai trò người dùng (Roles)
1. **Chủ phòng tập (`owner`):** Xem bảng điều khiển tổng quan, quản lý danh sách hội viên, tạo/sửa/ngừng bán gói tập, bán thẻ, lập phiếu thu tiền, điểm danh và quản lý toàn bộ lịch PT.
2. **Nhân viên quầy lễ tân (`staff`):** Thao tác tác vụ hằng ngày: điểm danh hội viên, tạo và sửa thông tin hội viên, bán thẻ, lập phiếu thu, xem gói tập và lịch PT.
3. **Huấn luyện viên (`pt`):** Xem lịch dạy cá nhân, cập nhật trạng thái hoàn thành hoặc hủy buổi dạy được phân công; xem gói tập đang mở bán; không truy cập hồ sơ khách hàng ngoài buổi dạy và không xem số liệu tài chính.
4. **Hội viên (`member`):** Xem thông tin thẻ tập cá nhân, lịch sử điểm danh, lịch sử thanh toán, tự đặt và hủy lịch tập 1-1 với Huấn luyện viên thể hình.

---

## 2. HỆ THỐNG NHẬN DIỆN THỊ GIÁC (VISUAL DESIGN FOUNDATION)

### 2.1. Bảng màu (Plain CSS Custom Properties)
Được cấu hình bằng CSS Variables trong `src/styles.css`:

| Tên biến CSS | Mã màu Hex | Ý nghĩa & Vị trí sử dụng |
| :--- | :--- | :--- |
| `--primary-emerald` | `#10b981` | Màu thương hiệu chính, nút CTA, thanh tiến độ, icon kích hoạt |
| `--primary-emerald-hover` | `#059669` | Trạng thái hover của nút bấm chính |
| `--accent-lime` | `#84cc16` | Điểm nhấn năng lượng thể thao, huy hiệu vai trò, điểm nhấn viền thẻ |
| `--bg-sidebar` | `#0f172a` | Nền thanh bên Dark Sidebar cố định (Slate-900) |
| `--bg-sidebar-hover` | `#1e293b` | Nền mục menu khi rê chuột (Slate-800) |
| `--border-sidebar` | `#334155` | Đường viền ngăn cách thanh bên và chân trang |
| `--bg-body` | `#f8fafc` | Nền khu vực nội dung chính (Slate-50) |
| `--bg-card` | `#ffffff` | Nền thẻ thống kê, bảng dữ liệu, hộp thoại modal |
| `--border-color` | `#e2e8f0` | Đường viền bảng, khung ô nhập liệu |
| `--text-primary` | `#0f172a` | Văn bản tiêu đề, giá trị số liệu chính |
| `--text-secondary` | `#64748b` | Nhãn phụ, mô tả hướng dẫn |
| `--status-success` | `#059669` | Trạng thái hoạt động (`active`), hoàn thành (`completed`) |
| `--status-warning` | `#d97706` | Trạng thái sắp tới (`upcoming`), đã đặt lịch (`booked`), sắp hết hạn |
| `--status-danger` | `#e11d48` | Trạng thái hết hạn (`expired`), đã hủy (`cancelled`), thông báo lỗi |

### 2.2. Kiểu chữ & Khoảng cách (Typography & Spacing)
- **Font chữ:** Font sans-serif tiêu chuẩn hệ thống (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Thang kích thước:** Tiêu đề trang `20px` (bold), tiêu đề thẻ `15px` (bold), nội dung bảng & form `13.5px` - `14px`, nhãn phụ & badge `11.5px` - `12px`.
- **Định dạng số tiền:** Luôn là số nguyên VND, hiển thị qua `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`.
- **Định dạng thời gian:** Chuẩn múi giờ Việt Nam (`Asia/Ho_Chi_Minh`), hiển thị ngày `DD/MM/YYYY`, giờ `HH:mm`.

---

## 3. KIẾN TRÚC GIAO DIỆN & PHÂN QUYỀN ĐIỀU HƯỚNG

### 3.1. Bố cục ứng dụng (App Shell)
- **Desktop (>= 1024px):** Thanh bên Dark Sidebar rộng `250px` cố định bên trái; thanh TopBar phía trên cùng; vùng nội dung cuộn bên phải (`max-width: 1300px`).
- **Mobile (< 1024px):** Sidebar chuyển thành Slide Drawer trượt từ bên trái với phím mở Hamburger trên TopBar; hỗ trợ chạm nền mờ (backdrop) để đóng nhanh.
- **Tiêu chuẩn Trợ năng (Accessibility):**
  - Mọi nút bấm và trường nhập liệu có viền focus ring rõ ràng (`outline: 2px solid #10b981; outline-offset: 2px`).
  - Hộp thoại Modal khóa cuộn body khi mở và hỗ trợ đóng bằng phím ESC.
  - Chiều cao điều khiển cảm ứng tối thiểu `38px` - `48px`.

### 3.2. Ma trận hiển thị Menu theo vai trò

| Mục điều hướng | Quyền hiển thị | Hành vi |
| :--- | :---: | :--- |
| **Tổng quan (Dashboard)** | Tất cả 4 vai trò | Hiển thị số liệu thống kê được phân vùng nghiêm ngặt theo vai trò |
| **Điểm danh (Attendance)** | Owner, Staff, Member | Quầy check-in cho lễ tân / Lịch sử vào tập của hội viên |
| **Quản lý hội viên (Members)** | Owner, Staff | Tra cứu, tạo mới, chỉnh sửa hồ sơ hội viên |
| **Thẻ hội viên (Memberships)** | Owner, Staff, Member | Quản lý bán thẻ / Lịch sử thẻ tập cá nhân |
| **Gói tập (Packages)** | Tất cả 4 vai trò | Danh mục bảng giá; chỉ Owner có nút tạo/sửa gói |
| **Sổ thu tiền VND (Payments)** | Owner, Staff, Member | Lập phiếu thu tiền mặt/chuyển khoản; Member xem phiếu của mình |
| **Lịch PT (Sessions)** | Tất cả 4 vai trò | Lịch tập 1-1, đặt lịch mới, hoàn thành hoặc hủy buổi |

---

## 4. ĐẶC TẢ CÁC MÀN HÌNH CHỨC NĂNG

### 4.1. Màn hình Đăng nhập (`LoginView`)
- 4 nút chọn nhanh tài khoản Demo khởi tạo:
  - **Chủ phòng (`owner`):** Nguyễn Minh Anh
  - **Lễ tân (`staff`):** Trần Thu Hà
  - **Huấn luyện viên (`pt`):** Lê Hoàng Nam
  - **Hội viên (`member`):** Phạm Ngọc Linh
  - Mật khẩu mặc định: `Gym@2026Demo!`
- Nhập tài khoản, mật khẩu, xử lý phản hồi lỗi từ server (`INVALID_CREDENTIALS`, `RATE_LIMITED`).

### 4.2. Màn hình Tổng quan (`DashboardView`)
- **Owner & Staff:**
  - 4 thẻ KPI vận hành: Tổng số hội viên, Thẻ đang hoạt động, Thẻ sắp hết hạn trong 7 ngày, Lượt check-in hôm nay.
  - 4 thẻ KPI tài chính: Doanh thu hôm nay, Doanh thu tháng, Tổng công nợ, Lịch PT hôm nay.
  - Danh sách 5 buổi PT sắp diễn ra.
- **PT:**
  - Thẻ Buổi dạy hôm nay, Buổi hoàn thành trong tháng.
  - Danh sách lịch dạy sắp tới với học viên.
- **Member:**
  - Trạng thái điểm danh hôm nay (Đã vào tập / Chưa check-in).
  - Thẻ hội viên hiện tại (tên gói, ngày hiệu lực, trạng thái, số tiền đã đóng/còn nợ).
  - Công nợ cần thanh toán.
  - Danh sách lịch hẹn PT cá nhân.

### 4.3. Trạm Điểm danh Quầy (`AttendanceView`)
- Dành cho Owner/Staff: Khối "Điểm Danh Nhanh" với ô tìm kiếm và chọn hội viên.
- Gửi `POST /api/attendance` với `{ memberId }`:
  - Thành công (201): Hiển thị banner xanh báo điểm danh thành công kèm thời gian.
  - Đã điểm danh (200): Thông báo hội viên đã check-in hôm nay rồi (mỗi người 1 lượt/ngày).
  - Lỗi thẻ (409): Báo lỗi hội viên không có thẻ bao phủ ngày hôm nay.
- Bảng lịch sử điểm danh theo ngày Việt Nam.

### 4.4. Quản lý Hội viên (`MembersView`)
- Thanh tìm kiếm theo họ tên, số điện thoại, tên đăng nhập hoặc email.
- Modal "Đăng Ký Hội Viên Mới":
  - Tên đăng nhập (chữ thường, số, dấu chấm/gạch, 3..64 ký tự).
  - Mật khẩu khởi tạo (>= 10 ký tự).
  - Họ và tên, Số điện thoại (bắt buộc), Email (tùy chọn).
- Modal "Chỉnh Sửa Hồ Sơ": Cập nhật họ tên, số điện thoại, email.
- Nút tắt "+ Bán Thẻ" chuyển nhanh sang trang thẻ hội viên với mã hội viên được điền sẵn.

### 4.5. Danh mục Gói tập (`PackagesView`)
- Bảng danh mục gói: Mã gói, Tên gói, Thời hạn (ngày), Giá niêm yết (VND), Trạng thái mở bán.
- Dành cho Chủ phòng (Owner):
  - Modal "Tạo Gói Mới": Tên gói, thời hạn (1..366 ngày), giá tiền (0..1 tỷ VND).
  - Modal "Chỉnh Sửa Gói": Sửa thông tin và checkbox bật/tắt trạng thái mở bán (`isActive`).

### 4.6. Thẻ Hội viên & Bán Gói (`MembershipsView`)
- Danh sách thẻ tập: Hiển thị snapshot tên gói, thời hạn ngày, giá snapshot, ngày bắt đầu → ngày kết thúc, số tiền đã nộp, công nợ còn lại và trạng thái (`active`, `upcoming`, `expired`).
- Modal "Bán Gói Tập / Kích Hoạt Thẻ":
  - Chọn hội viên, chọn gói tập đang bán, chọn ngày bắt đầu hiệu lực.
  - Máy chủ tự tính ngày kết thúc và bảo đảm không có 2 thẻ trùng thời gian của cùng hội viên.
- Nút tắt "Thu tiền" dẫn sang màn hình thanh toán với thông tin thẻ được nạp sẵn.

### 4.7. Sổ Thu Tiền VND (`PaymentsView`)
- Danh sách các phiếu thu tiền: Mã phiếu, Hội viên, Thẻ liên quan, Số tiền, Hình thức thu, Ghi chú, Thời gian ghi nhận, Thu ngân.
- Modal "Lập Phiếu Thu Tiền":
  - Chọn thẻ cần thu tiền (hiển thị rõ số tiền còn nợ tối đa).
  - Nhập số tiền thu (VND, số nguyên dương, không được vượt quá số còn nợ).
  - Chọn hình thức: Tiền mặt (`cash`) hoặc Chuyển khoản ngân hàng (`bank_transfer`).
  - Giao diện tự động sinh `requestId` dạng UUIDv4 ngẫu nhiên bảo đảm chống gửi lặp (idempotent).

### 4.8. Quản lý Lịch Huấn luyện viên (`SessionsView`)
- Danh sách các buổi tập: Mã số, Hội viên, Huấn luyện viên, Giờ bắt đầu, Giờ kết thúc, Trạng thái (`booked`, `completed`, `cancelled`), Ghi chú.
- Modal "Đặt Lịch Buổi Tập":
  - Chọn hội viên (với role Member thì mặc định chính mình).
  - Chọn Huấn luyện viên thể hình (PT).
  - Chọn ngày tập, giờ bắt đầu (bước nhảy 15 phút), thời lượng (30, 45, 60, 90, 120, 180 phút).
  - Tự động chuyển đổi sang chuỗi canonical ISO UTC (`YYYY-MM-DDTHH:mm:00.000Z`).
- Thao tác:
  - Nút "Hoàn thành": Dành cho Owner/Staff/PT sau khi buổi tập đã kết thúc.
  - Nút "Hủy": Hủy buổi tập (giải phóng khung giờ cho PT và hội viên).

### 4.9. Hộp thoại Đổi Mật khẩu (`ChangePasswordModal`)
- Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 10 ký tự).
- Khi đổi mật khẩu thành công, toàn bộ phiên đăng nhập của người dùng sẽ bị thu hồi và giao diện tự động đưa về màn hình Đăng nhập.

---

## 5. CẤU TRÚC THÀNH PHẦN MÃ NGUỒN FRONTEND (`src/**`)

```
src/
├── api.js                     # API client, xử lý CSRF token, formatters tiền & ngày
├── App.jsx                    # Root App controller, kiểm tra auth, điều phối views
├── icons.jsx                  # Tập hợp SVG icons vector cục bộ (không dùng CDN)
├── main.jsx                   # React 19 entry point
├── styles.css                 # Plain CSS stylesheet, Dark Sidebar & Emerald theme
├── components/
│   ├── Feedback.jsx           # AlertBanner, InlineError, EmptyState, Skeleton loaders
│   ├── Modal.jsx              # Accessible modal dialog wrapper
│   ├── Sidebar.jsx            # Dark sidebar navigation với phân quyền vai trò
│   ├── StatCard.jsx           # KPI stat card component
│   └── TopBar.jsx             # Top bar header với hiển thị ngày Việt Nam
└── views/
    ├── AttendanceView.jsx     # Trạm check-in & nhật ký điểm danh
    ├── ChangePasswordModal.jsx# Hộp thoại đổi mật khẩu tài khoản
    ├── DashboardView.jsx      # Bảng điều khiển phân quyền 4 vai trò
    ├── LoginView.jsx          # Màn hình đăng nhập & 4 nút chọn nhanh demo
    ├── MembershipsView.jsx    # Quản lý thẻ hội viên & bán gói
    ├── MembersView.jsx        # Quản lý danh sách & hồ sơ hội viên
    ├── PackagesView.jsx       # Danh mục bảng giá & gói tập
    ├── PaymentsView.jsx       # Sổ thu tiền VND & lập phiếu thu
    └── SessionsView.jsx       # Lịch huấn luyện viên PT & đặt buổi tập
```
