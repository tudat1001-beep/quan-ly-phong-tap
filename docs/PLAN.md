# Kế hoạch MVP — quản lý một phòng tập Việt Nam

Trạng thái: **hợp đồng triển khai v1, đã chốt**. `docs/API.md` là nguồn chuẩn cho HTTP, SQL và interface giữa các tệp. Chỉ sửa hợp đồng sau khi coordinator thông báo cho cả ba người triển khai; không tự đổi tên trường hoặc xuất hàm riêng.

Nếu `DESIGN.md` có luồng hoặc dependency rộng hơn, chỉ dùng màu sắc/bố cục của nó; phạm vi, quyền, trường dữ liệu và luồng chức năng phải theo PLAN/API. Không triển khai các mục thiết kế không có trong hợp đồng này.

## Kết quả phải có

Ứng dụng chạy thật trên máy cục bộ, lưu SQLite qua lần khởi động lại, giao diện tiếng Việt cho chủ phòng tập (`owner`), nhân viên (`staff`), huấn luyện viên (`pt`) và hội viên (`member`). Không triển khai production, không tích hợp trả phí. Không dùng dữ liệu giả thay cho API sau khi backend hoàn thành.

Luồng nhỏ nhất nhưng hoàn chỉnh:

1. Đăng nhập, phục hồi phiên khi tải lại trang, đổi mật khẩu, đăng xuất. Backend kiểm tra quyền trên mọi request.
2. Chủ/nhân viên tạo tài khoản hội viên, sửa hồ sơ, tìm hội viên; chủ tạo/sửa/ngừng bán gói tập. Không xóa hồ sơ đã phát sinh nghiệp vụ.
3. Chủ/nhân viên bán gói thành thẻ hội viên có ngày đầu/ngày cuối và giá được chụp tại lúc bán; xem còn hạn, sắp hết hạn và công nợ. Một hội viên không có hai thẻ chồng ngày.
4. Chủ/nhân viên thu tiền VND, cho phép thu từng phần, sổ thu chỉ ghi thêm và chống gửi lặp. Hội viên xem thẻ/công nợ và khoản thu của mình.
5. Chủ/nhân viên điểm danh hội viên đủ điều kiện; mỗi hội viên một lần mỗi ngày Việt Nam. Hội viên xem lịch sử của mình.
6. Chủ/nhân viên hoặc chính hội viên đặt buổi PT với một PT có sẵn; ngăn trùng giờ của cả hội viên lẫn PT. PT chỉ xem/cập nhật trạng thái buổi của mình, hội viên chỉ xem/hủy buổi của mình.
7. Dashboard theo quyền: chủ/nhân viên xem hoạt động và tổng thu/công nợ; PT xem lịch và số buổi; hội viên xem thẻ, công nợ và lịch cá nhân.

Gói tập chỉ quy định số ngày và giá quyền vào phòng; mọi thẻ còn hạn cho phép đặt PT. Không có hạn mức buổi PT hoặc khoản thu PT riêng trong MVP.

## Phạm vi được chủ động bỏ

Không nhiều cơ sở, tự đăng ký, đặt lại mật khẩu qua email, OAuth, thanh toán trực tuyến, thuế/hóa đơn điện tử, hoàn tiền, giảm giá, xóa/sửa sổ thu, gia hạn tự động, đóng băng/chuyển thẻ, lịch nhóm, ca làm việc PT, lương/hoa hồng, QR/thiết bị chấm công, upload ảnh, chat, thông báo, export, lịch sử kiểm toán tổng quát hoặc quản trị tài khoản nhân sự. Bốn tài khoản nhân sự/demo có từ seed; hội viên mới được tạo trong ứng dụng. Không thêm framework backend, ORM, router UI hoặc thư viện state chỉ để phục vụ các màn hình này.

## Quyền và sở hữu dữ liệu

| Nghiệp vụ | owner | staff | pt | member |
|---|---|---|---|---|
| Hồ sơ hội viên | Xem/tạo/sửa tất cả | Xem/tạo/sửa tất cả | Không truy cập danh sách/hồ sơ | Xem hồ sơ mình |
| Gói tập | Xem/tạo/sửa/ngừng bán | Xem | Xem gói đang bán | Xem gói đang bán |
| Thẻ hội viên | Xem/tạo tất cả | Xem/tạo tất cả | Không xem | Xem của mình |
| Sổ thu/công nợ | Xem/ghi tất cả | Xem/ghi tất cả | Không xem | Chỉ xem của mình |
| Điểm danh | Xem/ghi tất cả | Xem/ghi tất cả | Không xem | Chỉ xem của mình |
| Buổi PT | Xem/đặt/hủy/hoàn thành tất cả | Như owner | Xem/hủy/hoàn thành buổi có `ptId = user.id` | Xem/đặt/hủy buổi có `memberId = user.memberId` |
| Dashboard | Toàn phòng | Toàn phòng | Cá nhân PT | Cá nhân hội viên |

Không tin `role`, `createdBy`, `recordedBy`, `checkedInBy`, giá bán hoặc ngày kết thúc từ trình duyệt. Server lấy từ phiên, gói trong DB và đồng hồ server. Resource ngoài phạm vi trả 404; bộ lọc cố tình chọn danh tính người khác trả 403. Mọi màn hình, badge và nút ẩn hiện theo quyền; ẩn nút không thay thế kiểm tra backend.

## Kiến trúc đã chọn

- Node **24.x**, ES modules `.mjs`, `node:http`, `node:sqlite` (`DatabaseSync`), `node:crypto`, `node:test` và `node:assert/strict`. Máy lập kế hoạch đã có Node `v24.18.0`.
- React + React DOM, Vite cho giao diện JavaScript/JSX, CSS thường. Sol chọn phiên bản tương thích Node 24 và khóa bằng `package-lock.json`; không phát sinh package ở nhánh UI.
- Một HTTP server, một connection SQLite, một tiến trình local. `PRAGMA foreign_keys=ON`, WAL, `busy_timeout=5000`. Mọi nghiệp vụ đọc-kiểm tra-ghi dùng transaction đồng bộ `BEGIN IMMEDIATE`, không `await` bên trong.
- DB mặc định `data/gym.sqlite`; tệp DB, WAL, SHM, `node_modules`, `dist` không đưa vào source control. Không tự reset khi khởi động.
- Backend chỉ bind `127.0.0.1:3010`; Vite chỉ local port 5180, `strictPort`, proxy `/api` về backend. UI gọi URL tương đối `/api/...`, dùng cookie HttpOnly; không lưu mật khẩu hoặc session token trong localStorage.
- Ngày nghiệp vụ: `Asia/Ho_Chi_Minh` (UTC+07:00). Ngày thẻ và ngày điểm danh là `YYYY-MM-DD`; timestamp truyền UTC ISO có `Z`. VND là số nguyên, không dùng float hay quy đổi đơn vị.
- Thiết kế visual và chiến lược QA chi tiết do worker khác phụ trách; tài liệu này chỉ khóa luồng và acceptance chức năng.

## Chia đúng ba task triển khai, không trùng tệp

| Người triển khai | Sở hữu duy nhất | Trách nhiệm |
|---|---|---|
| **Sol — server nền tảng** | `server/core.mjs`, `server/index.mjs`, `tests/core.test.mjs`, `package.json`, `package-lock.json`, `.gitignore` | Tất cả DDL, khởi tạo DB/seed, helper export; HTTP, phiên/CSRF/auth/RBAC; thẻ, sổ thu, PT; package/scripts và các test security/money/date/conflict |
| **Terra — quản lý nghiệp vụ** | `server/management.mjs`, `tests/management.test.mjs` | `handleManagement(ctx)`; hội viên, gói, điểm danh, dashboard; dùng schema/helper của Sol, không tự tạo DB/schema/seed và không sửa index |
| **Anti — UI** | `src/**`, `index.html`, `vite.config.mjs` | Toàn bộ React/CSS, API client, biểu mẫu/validation và luồng cho bốn vai trò; proxy Vite, nhập giờ Việt Nam và hiển thị VND |

Worker kế hoạch chỉ sở hữu `docs/PLAN.md`, `docs/API.md`. Coordinator sở hữu tài liệu khởi chạy/QA khác nếu cần. Không ai tự sửa tệp của người khác để tích hợp: báo thay đổi qua coordinator. Test chung chỉ đọc `core.mjs`/`createApp`; không ai sửa test của người khác.

Điểm nối đã khóa:

1. Sol xuất đầy đủ interface tại API §2 trước, có thể dùng body stub ngắn để Terra bắt đầu. Schema do Sol tạo một lần.
2. Terra xuất duy nhất `handleManagement(ctx) -> ResponseSpec | null`, đồng bộ. Sol gọi sau khi parse body và xác thực, trước fallback 404. Không tự gửi HTTP response trong management.
3. Anti dùng chính các DTO đã chốt. Có thể phát triển khi server chưa xong nhưng mọi luồng bàn giao phải gọi API thật; không cần share file types/generated client.
4. Sol import `handleManagement` bằng named import. Tích hợp cuối khi tệp Terra có mặt; không tạo bản thay thế rồi ghi đè.

## Lệnh chạy và kiểm tra bắt buộc

`package.json` có `type: module`, `private: true`, `engines.node: >=24 <25`, dependencies chỉ `react`, `react-dom`, devDependencies chỉ `vite`, `@vitejs/plugin-react`. Scripts phải là:

| Lệnh | Giá trị script / kết quả |
|---|---|
| `npm install` | Cài dependencies và tạo lock, chỉ Sol chạy khi khởi tạo |
| `npm ci` | Cài theo lock sau khi bàn giao |
| `npm run start` | `node server/index.mjs` — DB persistent, tự seed DB trống, API ở 3010 |
| `npm run dev` | `vite --host 127.0.0.1 --port 5180 --strictPort` — chạy ở terminal thứ hai |
| `npm run build` | `vite build` — kiểm tra UI build |
| `npm test` | `node --test tests/*.test.mjs` — test tự tạo DB memory/temp, không chạm DB thật |
| `npm run preview` | `vite preview --host 127.0.0.1 --port 5180 --strictPort` — preview có proxy API giống dev, backend vẫn phải chạy |

Mở `http://127.0.0.1:5180`. `DB_PATH` là tùy chọn duy nhất cho đường dẫn DB; `PORT` là tùy chọn backend cho test/tình huống local khác (mặc định 3010, proxy mặc định vẫn 3010). Không cần `.env`, secrets trả phí, Docker hay migration CLI. Không có lệnh deploy.

## Seed và dữ liệu demo

Seed thực hiện atomic chỉ khi `users` trống; nếu DB đã có dữ liệu thì giữ nguyên mọi record. Không dùng `INSERT OR REPLACE`. Hash mật khẩu với salt riêng cho mỗi user; tài khoản được ghi vào DB, không phải auth hardcode.

| user.id | login | role | Tên | Mật khẩu demo |
|---|---|---|---|---|
| 1 | `owner` | owner | Nguyễn Minh Anh | `Gym@2026Demo!` |
| 2 | `staff` | staff | Trần Thu Hà | `Gym@2026Demo!` |
| 3 | `pt` | pt | Lê Hoàng Nam | `Gym@2026Demo!` |
| 4 | `member` | member | Phạm Ngọc Linh | `Gym@2026Demo!` |

- Member id 1 liên kết user 4, phone `0901234567`, email `linh@example.test`.
- Gói id 1: `Cơ bản 30 ngày`, 30 ngày, 300000 VND. Gói id 2: `Tiết kiệm 90 ngày`, 90 ngày, 800000 VND. Đều đang bán.
- Thẻ id 1: member 1/gói 1, bắt đầu ngày Việt Nam hôm nay trừ 10 ngày, kết thúc hôm nay cộng 19 ngày; snapshot giá 300000 và tên gói; người tạo owner.
- Payment id 1: thẻ 1, 150000 VND, `cash`, ghi hôm nay; công nợ còn 150000. `requestId = 00000000-0000-4000-8000-000000000001`.
- Attendance id 1: member 1 hôm nay, staff ghi; PT session id 1 ngày mai 09:00–10:00 giờ Việt Nam, member 1/PT user 3, trạng thái booked.
- Tất cả ngày tương đối dùng cùng đồng hồ `now` được truyền lúc seed, không hardcode ngày lập tài liệu. Khởi động lại không tạo thêm demo.

Mật khẩu công khai chỉ phục vụ local demo; màn đổi mật khẩu có thật. Đổi mật khẩu thu hồi mọi phiên và đưa về đăng nhập. Không công bố hoặc bind ứng dụng này ra Internet.

## Điều kiện hoàn thành

- `npm ci`, `npm test`, `npm run build` thành công trên Node 24. Test không cần mạng hoặc Vite đang chạy.
- Bốn tài khoản đăng nhập được, F5 giữ phiên, logout vô hiệu hóa cookie cũ; mật khẩu/hash/session không rò trong JSON/log.
- Owner/staff tạo hội viên, bán gói, thu hai lần đúng tổng; từ chối phần thu vượt nợ, số lẻ/âm/chuỗi và gửi lặp không cộng hai lần. Thay giá gói không thay thẻ cũ.
- Một điểm danh/ngày; từ chối thẻ chưa tới hạn/hết hạn. Ngày cuối thẻ vẫn hợp lệ.
- Đặt PT hai lần trùng PT hoặc hội viên trả 409, hai buổi nối đuôi được chấp nhận; canceled giải phóng khung giờ. Hội viên/PT không đọc hoặc sửa buổi người khác bằng cách đổi ID.
- Dashboard khớp SQLite và phạm vi quyền; tổng thu dựa trên ngày thu, không phải ngày bán thẻ; ngày và tiền hiển thị tiếng Việt.
- Tắt/mở backend giữ các record vừa tạo; mọi API chưa có quyền trả lỗi nhất quán và UI hiện lỗi rõ ràng.

Node test tối thiểu của Sol: mật khẩu sai/đúng, revoke/expiry, CSRF và IDOR; số nguyên VND, partial/overpay/idempotency/rollback; ngày lịch thật, năm nhuận, biên ngày Việt Nam và ngày cuối thẻ; conflict của hai tài nguyên, tiếp giáp, canceled và rollback. Terra kiểm tra tạo/sửa hồ sơ atomically, quyền sửa gói, không mutation snapshot, unique attendance/eligibility, số liệu dashboard theo quyền. Không dùng giờ máy không kiểm soát trong test: inject `now()`.

## Nguồn kỹ thuật đã đối chiếu

Node 24 là runtime cố định; dùng primitives của [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html) cho scrypt, random và so sánh hash. [Vite guide](https://vite.dev/guide/) mô tả dev server/build và yêu cầu runtime; coordinator kiểm chứng phiên bản được khóa bằng `npm ci`/build. Không có yêu cầu triển khai cloud.
