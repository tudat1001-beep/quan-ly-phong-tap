# Bàn giao backend nền tảng

Ngày kiểm chứng: 04/11/2026. Runtime Node `v24.18.0`, npm `11.16.0`. Backend nền tảng đã triển khai theo `API.md`; tài liệu này ghi bằng chứng kiểm tra và các phần tích hợp còn lại, không thay thế hợp đồng API.

## Tệp và chức năng đã hoàn thành

| Tệp | Kết quả |
|---|---|
| `server/core.mjs` | Đủ 16 export dùng chung; SQLite STRICT tám bảng, khóa ngoại/WAL/busy timeout; seed atomic khi users trống; scrypt và so sánh timing-safe; helper tiền/ngày/transaction; DTO User/Membership/Session |
| `server/index.mjs` | `createApp` không listen khi import; HTTP JSON, validation body/query, giới hạn 16 KiB, Host/Origin, CSRF, session token chỉ lưu hash; login/logout/me/đổi mật khẩu, rate limit; thẻ có snapshot/chống trùng ngày; sổ thu VND partial/idempotent; lịch PT chống trùng hai tài nguyên, ownership và chuyển trạng thái; tích hợp router Terra |
| `tests/core.test.mjs` | 13 test nhóm helper/persistence/security/money/membership/PT qua DB riêng và HTTP thật, clock inject; gồm gửi đồng thời thu tiền/đặt lịch |
| `package.json`, `package-lock.json` | React/React DOM 19, Vite 7/plugin React 5; không dependency backend; lệnh start/dev/test/build/preview; engines Node24 |
| `.gitignore` | Bỏ qua node_modules/dist/data và SQLite/WAL/SHM |
| `docs/API.md`, `docs/PLAN.md` | Điều chỉnh được coordinator cho phép: API3010/UI5180 tránh cổng ứng dụng khác; auth nhận login từ2ký tự để tài khoản seed pt hoạt động, tạo member mới vẫn từ3ký tự |

Không sửa `server/management.mjs`, `tests/management.test.mjs`, `src/**`, `index.html`, `vite.config.mjs` hoặc README trong phần việc backend này.

## Bằng chứng kiểm tra

Kiểm tra cuối sau khi cài lại dependencies theo lockfile:

```text
npm ci
  added 65 packages, audited 66 packages
  found 0 vulnerabilities

npm test
  tests 18
  pass 18
  fail 0
  cancelled 0
  skipped 0
  todo 0

npm run build
  vite v7.3.7
  45 modules transformed
  built successfully
```

18 test gồm13 test core và5 test management của Terra. Không có test dùng `data/gym.sqlite`. Test persistent dùng thư mục temp được kiểm tra giới hạn đường dẫn trước khi dọn; test HTTP dùng loopback port ngẫu nhiên và đóng server/DB sau mỗi test. Hai lỗi fixture ban đầu đã sửa: đóng DB trước khi xóa thư mục trên Windows, đăng nhập lại sau khi clock nhảy quá thời hạn8giờ.

Các hành vi đã được kiểm chứng tự động:

- Bốn tài khoản owner/staff/pt/member đăng nhập qua HTTP thật, nhận đúng vai trò và phạm vi. Cookie HttpOnly/SameSite; DB có SHA-256 của raw token, không lưu raw token; logout thu hồi cookie cũ.
- Origin lạ/thiếu, CSRF sai, JSON sai/array, body quá lớn, media type sai, key/query thừa hoặc query lặp bị từ chối. Thông tin SQL nội bộ không xuất hiện trong lỗi500.
- Đổi mật khẩu thu hồi mọi phiên, mật khẩu cũ không đăng nhập được; phiên còn hiệu lực tại8giờ trừ1ms và hết hiệu lực đúng8giờ. Rate limit5lần sai và reset cửa sổ15phút.
- VND từ chối số lẻ/âm/chuỗi/vượt giới hạn; thu từng phần, trả hết nợ, không cho overpay; cùng requestId/payload trả record cũ, đổi payload/người ghi trả409. Hai request đồng thời không làm vượt công nợ hoặc ghi hai lần cùng requestId.
- Ngày lịch thật/năm nhuận, biên17:00Z sang ngày Việt Nam, ngày cuối thẻ vẫn active; cấm trùng hai đầu ngày; nối thẻ ngày kế tiếp được; đổi gói không đổi snapshot lịch sử.
- PT conflict kiểm cả PT và hội viên; nối giờ được, cancelled giải phóng khung giờ, gửi đồng thời chỉ một booking thành công. Ownership chống sửa lịch người khác, member không complete; hoàn thành sớm/hủy muộn/đổi terminal đều bị chặn theo quyền và clock.
- Import module ở thư mục trống không tạo DB hoặc listen server; dữ liệu thay đổi tồn tại sau đóng/mở DB, seed không chạy lại; transaction lỗi rollback.

`npm ci` có cảnh báo chính sách allow-scripts của npm cho postinstall esbuild; cài đặt vẫn exit0 và Vite build sau đó thành công. Không đổi chính sách npm toàn máy.

## Khởi chạy

Hai terminal tại thư mục dự án:

```powershell
npm run start
npm run dev
```

Mở `http://127.0.0.1:5180`; API loopback `http://127.0.0.1:3010`. Backend đọc DB_PATH tùy chọn, mặc định `data/gym.sqlite`; chỉ seed khi users trống, không reset dữ liệu. Không cần thêm secrets, dịch vụ hoặc ORM. Không dừng tiến trình ứng dụng khác để giải phóng cổng.

Seed có owner/staff/pt/member, mật khẩu `Gym@2026Demo!`; đây là credential công khai cho local demo. Cookie không Secure vì HTTP local; không triển khai Internet với cấu hình này.

## Tích hợp UI còn lại — chưa sửa trong phạm vi backend

Các mục sau được xác nhận bằng đọc source, chưa chạy browser QA; cần task UI riêng theo phân công của coordinator:

1. **Ưu tiên cao — retry khoản thu:** `src/views/PaymentsView.jsx` tạo `crypto.randomUUID()` mới mỗi lần submit; `src/api.js` cũng có fallback tạo UUID. Nếu DB đã commit nhưng response mất, retry cùng khoản thu có thể ghi thêm phiếu mới khi còn công nợ. Cần giữ một requestId cho payload không đổi qua lỗi mạng/kết quả chưa rõ, chỉ đổi khi thành intent mới hoặc thao tác đã xác nhận thành công; thêm regression check cho mất response. Backend chống trùng đúng khi client dùng lại requestId.
2. **Trợ năng modal:** `src/components/Modal.jsx` hiện xử lý Escape/backdrop/khóa scroll nhưng chưa chuyển focus vào modal, trap Tab hoặc trả focus về nút mở sau đóng. Cần kiểm tra bàn phím và bổ sung trong component dùng chung.
3. **Hết phiên khi đang sử dụng:** `src/App.jsx` lấy phiên lúc mở app; `src/api.js` ném lỗi401 nhưng chưa có cơ chế chung xóa trạng thái user và đưa về login khi AUTH_REQUIRED phát sinh ở request sau đó. F5 phục hồi phiên đã có; cần regression cho hết phiên/thu hồi phiên trong lúc app đang mở.

Chưa kiểm thử visual/mobile/keyboard trong trình duyệt, chưa triển khai production và không xác nhận toàn ứng dụng sẵn sàng nhận dữ liệu thật khi các mục UI trên còn mở.

## Trạng thái điều phối

Dispatch implementation cũ được Orca ghi `failed` và terminal `user_owned` do `user_takeover`; lỗi `consumer_fenced` đã ngăn gửi lifecycle cũ. Sau chỉ đạo trực tiếp “tiếp” của người dùng, hoàn tất kiểm tra/báo cáo dưới quyền người dùng; không phát heartbeat hoặc worker_done bằng Task/Dispatch đã kết thúc. Kết quả code được chứng minh bằng các lệnh ở trên, độc lập trạng thái lifecycle cũ.
