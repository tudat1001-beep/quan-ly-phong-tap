# Quản lý phòng tập Gym

Ứng dụng web tiếng Việt cho một phòng tập, dành cho chủ phòng tập, nhân viên, PT và hội viên. Backend Node.js lưu dữ liệu SQLite; giao diện React chạy qua Vite.

## Chạy trên máy

Cài Node.js 24.x, mở terminal tại thư mục dự án:

```powershell
npm ci
npm run start
```

Giữ terminal backend chạy, mở terminal thứ hai:

```powershell
npm run dev
```

Truy cập <http://127.0.0.1:5180>. API chạy ở `127.0.0.1:3010`. Ứng dụng chỉ mở trên máy cục bộ.

## Tài khoản demo

Database trống được khởi tạo tự động với bốn tài khoản:

| Tên đăng nhập | Vai trò |
| --- | --- |
| `owner` | Chủ phòng tập |
| `staff` | Nhân viên |
| `pt` | Huấn luyện viên |
| `member` | Hội viên |

Mật khẩu ban đầu: `Gym@2026Demo!`. Đây là mật khẩu công khai dành cho demo; hãy đổi mật khẩu trước khi nhập dữ liệu thật. Đổi mật khẩu sẽ đăng xuất các phiên của tài khoản.

## Chức năng

- Chủ và nhân viên quản lý hồ sơ hội viên, đăng ký/gia hạn gói, ghi nhận thu tiền và điểm danh. Chủ quản lý danh mục gói tập.
- Thu tiền mặt hoặc ghi nhận chuyển khoản, có công nợ và chống ghi lặp. Ứng dụng không kết nối ngân hàng để xác nhận chuyển khoản.
- Đặt lịch PT, ngăn trùng giờ của PT và hội viên; PT quản lý các buổi của mình, hội viên xem/đặt/hủy lịch của mình.
- Hội viên xem gói tập, lịch sử điểm danh và thanh toán cá nhân. Dashboard hiển thị theo quyền.
- Ngày nghiệp vụ theo giờ Việt Nam; tiền lưu bằng số nguyên VND.

## Kiểm tra và build

```powershell
npm test
npm run build
```

Để xem bản build, chạy backend và `npm run preview` thay cho `npm run dev`.

## Dữ liệu

Database mặc định nằm tại `data/gym.sqlite`; khởi động lại không xóa dữ liệu hoặc tạo lại demo. Có thể đặt biến `DB_PATH` để dùng tệp SQLite khác. Bộ test dùng database riêng.

Để sao lưu đơn giản, dừng backend rồi sao chép thư mục `data` sang nơi an toàn. Không xóa database nếu muốn giữ lịch sử hội viên, thanh toán và điểm danh.

## Phân công và tài liệu

Dự án được điều phối bằng Orca: GPT 6.1 Sol lập kế hoạch và xử lý xác thực/phân quyền, thẻ hội viên, lịch PT, thanh toán; GPT 6.1 Terra xử lý quản lý hội viên/gói tập, điểm danh và thống kê; Antigravity thiết kế, làm UI và kiểm thử. Kết quả kiểm thử được chuyển về Sol để phân công sửa theo độ khó.

- [Kế hoạch và phạm vi](docs/PLAN.md)
- [Hợp đồng API và dữ liệu](docs/API.md)
- [Thiết kế giao diện](docs/DESIGN.md)
- [Ma trận kiểm thử](docs/QA-PLAN.md)

Đây là bản chạy cục bộ cho một cơ sở. Chưa có triển khai Internet, thanh toán trực tuyến, quản lý lương/hoa hồng hoặc thiết bị điểm danh.
