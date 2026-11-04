# Hợp đồng API, dữ liệu và điểm nối — v1 đóng băng

Đọc cùng `PLAN.md`. Base path `/api`, JSON camelCase bên ngoài, SQLite snake_case bên trong. Tất cả thời gian và quyền dưới đây được thực thi tại server.

## 1. Quy ước HTTP và validation

Success luôn `{ "data": <DTO hoặc mảng hoặc null> }`. Danh sách rỗng là `{ "data": [] }`; không có pagination/envelope thứ hai. Lỗi luôn `{ "error": { "code": "CODE", "message": "Thông báo tiếng Việt", "fields": { "fieldName": "Lý do" } } }`; `fields` chỉ có khi validation có lỗi trường. Không trả stack, SQL, password hash hoặc session hash.

Status: GET/PATCH thành công 200; POST tạo mới 201; POST login/logout/change-password 200; attendance/payment gửi lại cùng yêu cầu 200. Logout trả `data:null`, không dùng 204. Không redirect API. `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` cho toàn bộ API. Không có DELETE trong v1.

Mã lỗi chuẩn:

| HTTP | code | Trường hợp |
|---|---|---|
| 400 | VALIDATION_ERROR | JSON/trường/query/ngày/tiền không hợp lệ, trường thừa |
| 401 | AUTH_REQUIRED | Thiếu phiên, hết hạn hoặc phiên bị thu hồi |
| 401 | INVALID_CREDENTIALS | Login/password sai, thông báo chung |
| 403 | FORBIDDEN | Vai trò không được thao tác hoặc query chọn người khác |
| 403 | CSRF_INVALID | Origin hoặc token CSRF không hợp lệ |
| 404 | NOT_FOUND | Không có resource, resource ngoài sở hữu, route không hỗ trợ |
| 409 | DUPLICATE_LOGIN | Login đã tồn tại |
| 409 | MEMBERSHIP_OVERLAP | Thẻ trùng ngày của một hội viên |
| 409 | NO_ACTIVE_MEMBERSHIP | Không có thẻ bao phủ ngày cần dùng |
| 409 | PACKAGE_INACTIVE | Mua gói ngừng bán |
| 409 | BOOKING_CONFLICT | Trùng lịch PT hoặc hội viên |
| 409 | INVALID_TRANSITION | Đổi trạng thái terminal/hoàn thành quá sớm/hủy quá muộn |
| 409 | OVERPAYMENT | Số tiền vượt số còn nợ |
| 409 | IDEMPOTENCY_CONFLICT | requestId đã được dùng với payload/người ghi khác |
| 413 | PAYLOAD_TOO_LARGE | Body vượt 16 KiB |
| 415 | UNSUPPORTED_MEDIA_TYPE | Mutation không gửi application/json |
| 429 | RATE_LIMITED | Quá số lần đăng nhập; có Retry-After giây |
| 500 | INTERNAL_ERROR | Lỗi ngoài dự kiến, response không có chi tiết nội bộ |

Unknown method/path trả 404 sau xác thực (trừ `/auth/*` và `/health`); không cần hệ thống 405. Chỉ chấp nhận những query liệt kê tại endpoint, không nhận key lặp. Body mutation phải là JSON object, không null/array; chỉ nhận trường được liệt kê. PATCH ít nhất một trường. Kiểm tra type trước khi trim/parse, không ép chuỗi thành số hoặc boolean. String trim, trừ mật khẩu giữ nguyên. Tên: 1–100 ký tự; phone 8–15 chữ số, tùy chọn một dấu `+` đầu; email `null` hoặc chuỗi tối đa 254 có dạng `x@y.z` (không xác thực gửi thư); note tối đa 500 ký tự, mặc định `""`.

ID path/query: chữ số thập phân dương, không dấu/chấm/số mũ, chuyển thành safe integer; body ID là JSON safe integer > 0. Tiền: JSON safe integer 1..1000000000 VND; giá gói được phép 0. Không nhận chuỗi `"300000"`, float, âm, Infinity hoặc phép làm tròn. Tổng tiền trả JSON safe integer; lỗi vượt khả năng biểu diễn trả 500 thay vì làm tròn.

Ngày: đúng `YYYY-MM-DD`, năm 2000..2100 và ngày lịch thật, không cho JS tự cuộn `2026-02-30`. Khoảng ngày có `from <= to`. Timestamp đầu vào buổi PT bắt buộc UTC canonical `YYYY-MM-DDTHH:mm:ss.sssZ`; parse và round-trip đúng nguyên chuỗi. DTO timestamp luôn dạng này. `date` nghiệp vụ là ngày Việt Nam UTC+7, không phụ thuộc timezone máy.

## 2. Interface nội bộ bắt buộc (Sol ↔ Terra)

Đây là chữ ký/hợp đồng, chưa phải mã triển khai. Không thêm dependency chéo từ core về management/index.

`server/core.mjs` phải export:

| Export | Đầu vào → đầu ra / hành vi |
|---|---|
| `createDatabase({filename = 'data/gym.sqlite', seed = false, now = Date.now} = {})` | Tạo thư mục cha nếu cần, mở `DatabaseSync`, PRAGMA, schema, seed tùy chọn; trả `db`. `filename: ':memory:'` được hỗ trợ. Không mở HTTP, không side effect khi chỉ import module |
| `fail(status, code, message, fields?)` | Throw `Error` có `.status`, `.code`, `.fields` tương ứng; index serialize chuẩn lỗi; validation thường status 400 |
| `requireRole(user, ...roles)` | Return void nếu `user.role` trong roles, còn lại throw 403 FORBIDDEN; user null throw 401 |
| `transaction(db, fn)` | `BEGIN IMMEDIATE`, gọi sync `fn()`, commit, return giá trị; mọi lỗi rollback và rethrow; không nested transaction/Promise |
| `parseMoney(value, {allowZero = false} = {})` | Validate quy tắc VND, trả nguyên number; fail 400 trường `amountVnd` (caller có thể thay fields để phù hợp priceVnd) |
| `parseDate(value)` | Validate ngày lịch theo §1, trả nguyên date string; fail 400 |
| `parseInstant(value)` | Validate timestamp canonical theo §1, trả nguyên string; fail 400 |
| `vietnamDate(epochMs)` | Trả YYYY-MM-DD ở UTC+7; không đọc clock ngầm |
| `addDays(date, days)` | Cộng số ngày nguyên theo lịch, trả YYYY-MM-DD; dùng UTC calendar, không thời gian local |
| `isoNow(epochMs)` | Trả timestamp UTC ISO canonical |
| `hashPassword(password)` | Validate length 10..128, tạo salt ngẫu nhiên/scrypt, trả chuỗi lưu password_hash |
| `verifyPassword(password, storedHash)` | Boolean, timing-safe; malformed hash trả false |
| `publicUser(db, userRow)` | Trả User DTO, tra member.id bằng users.id; không expose hash |
| `membershipView(db, membershipRow, nowMs)` | Trả Membership DTO §3, tính tổng thu/công nợ/trạng thái bằng ngày VN |
| `sessionView(db, ptSessionRow)` | Trả Session DTO §3, join tên member và PT |

Helper nội bộ khác được phép nhưng không trở thành yêu cầu cho Terra. SQL chuẩn bị bằng bound parameters. Terra tự viết mapper Member/Package/Attendance hoặc query trong chính management; không cần generic repository/service.

`server/management.mjs` export `handleManagement(ctx)` **đồng bộ**. Nhận:

```text
ctx = {
  db,                           // DatabaseSync đã mở và seed/schema xong
  user,                         // User DTO đã xác thực, không null
  method,                       // "GET" | "POST" | "PATCH" ...
  pathname,                     // ví dụ "/api/members/1", chưa kèm query
  query,                        // URLSearchParams, raw và đã có API §1 làm luật
  body,                         // object mutation, GET là null; index đã parse JSON
  now                           // number epoch milliseconds, chụp một lần/request
}
ResponseSpec = {status: number, data: DTO | DTO[] | null}
```

Trả `null` nếu route/method không thuộc mình. Route nhận được phải kiểm tra role/ownership/body/query, throw bằng `fail`. Không ghi cookie, không gửi response, không đọc stream request, không tính lại clock, không log thông tin nhạy cảm.

`server/index.mjs` export `createApp({dbPath = 'data/gym.sqlite', seed = true, now = Date.now} = {}) -> {server, db}`. `server` là `http.Server` **chưa listen**, `db` là DB mà app sử dụng; test gọi `server.listen(0, '127.0.0.1')`, chờ server.close rồi db.close trong cleanup. Import không listen/seed DB mặc định; chỉ gọi createApp mới tạo DB. Khi chạy trực tiếp, tạo app, listen `Number(process.env.PORT || 3010)` ở loopback và đọc `process.env.DB_PATH`. `now` là hàm trả epoch ms. Sol đóng DB sau server đóng khi nhận SIGINT/SIGTERM. Sol router auth/health/memberships/payments/trainers/sessions, rồi gọi Terra router, rồi 404.

## 3. DTO chính xác

Mọi field dưới đây có mặt; optional chỉ áp dụng request. Mảng success không bao giờ chứa password/session/CSRF; csrf chỉ tại auth payload.

```text
User = {id, login, fullName, role, memberId}
  role: "owner" | "staff" | "pt" | "member"
  memberId: integer | null  // chỉ role member có memberId
Auth = {user: User, csrfToken: string}

Member = {id, userId, login, fullName, phone, email, createdAt}
  email: string | null
Package = {id, name, durationDays, priceVnd, isActive, createdAt}
  isActive: boolean

Membership = {
  id, memberId, memberName, packageId, packageName,
  durationDays, priceVnd, startDate, endDate,
  paidVnd, balanceVnd, status, createdBy, createdAt
}
  status: "upcoming" | "active" | "expired"
  packageName/durationDays/priceVnd: snapshot lúc bán, không join giá hiện tại
  status: today < startDate => upcoming; today > endDate => expired; còn lại active
  paidVnd: tổng payment.amount_vnd; balanceVnd = priceVnd - paidVnd

Payment = {
  id, membershipId, memberId, memberName, amountVnd,
  method, note, requestId, recordedBy, createdAt
}
  method: "cash" | "bank_transfer"  // ghi nhận thủ công, không xác minh ngân hàng

Attendance = {id, memberId, memberName, date, checkedInAt, checkedInBy}
Trainer = {id, fullName}  // id chính là users.id, role pt
Session = {
  id, memberId, memberName, ptId, ptName, startsAt, endsAt,
  status, note, createdBy, createdAt, updatedAt
}
  status: "booked" | "completed" | "cancelled"
```

Các id/createdBy/recordedBy/checkedInBy là integer; tất cả `*At` là UTC timestamp; `startDate/endDate/date` là date string. Các counter/tiền đều number nguyên; không gửi BigInt.

## 4. Xác thực và bảo mật (Sol)

- Không self-register. Login normalize trim + lowercase; xác thực nhận regex `[a-z0-9._@-]{2,64}` để tài khoản seed `pt` đăng nhập được, còn tạo hội viên mới yêu cầu `[a-z0-9._@-]{3,64}`. Password 10..128 ký tự, không trim, không bắt complexity khác.
- Hash `scryptSync` với salt random 16 byte, key 64 byte, N=16384/r=8/p=1; encoded string `scrypt$16384$8$1$<salt hex>$<key hex>`. So sánh buffer bằng `timingSafeEqual` sau khi kiểm tra độ dài. Dummy scrypt khi login không tồn tại để tránh lộ danh tính qua timing.
- Session raw token 32 random byte, base64url; DB chỉ giữ SHA-256 hex của token. Cookie `gym_session`, `HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`, không Domain. Không `Secure` chỉ vì local HTTP; đây không phải cấu hình production. Phiên hết hạn tuyệt đối sau 8 giờ, không sliding. Cookie được xóa cùng Path khi logout/đổi mật khẩu.
- CSRF random 32 byte base64url lưu với session; login và GET me trả `csrfToken`; UI chỉ giữ trong memory. Mọi mutation đã login yêu cầu `X-CSRF-Token` khớp session, timing-safe. Login chưa cần CSRF token nhưng vẫn cần Origin.
- Tất cả POST/PATCH kiểm Origin chính xác trong allowlist `http://127.0.0.1:5180`, `http://localhost:5180`, `http://127.0.0.1:3010`, `http://localhost:3010`; Origin thiếu/null/khác => 403 CSRF_INVALID. Không bật CORS. Backend kiểm Host hostname chỉ `127.0.0.1` hoặc `localhost` (có thể kèm port test), không tin X-Forwarded-*; backend loopback only.
- Login rate-limit memory: tối đa 5 lần thất bại mỗi cặp IP+normalized login trong cửa sổ cố định 15 phút; lần tiếp theo 429. Thêm trần 30 lần login mỗi IP/15 phút, tính mọi attempt. Dọn key hết hạn khi xử lý; login thành công reset counter thất bại của cặp, không reset trần IP. Không khóa account vĩnh viễn, không persist bộ đếm, không log credentials.
- Không trả credential trong Member ngoài login; không trả hash, session token hoặc CSRF của người khác. Không nhúng input thành HTML. Statement parameterized; server limit body16KiB; API no-store; JSON lỗi thông báo tiếng Việt.

| Method/path | Request | Success | Quyền/ghi chú |
|---|---|---|---|
| GET `/health` | không query/body | 200 `{data:{status:"ok"}}` | Public; không trả DB path/phiên bản |
| POST `/auth/login` | `{login,password}` | 200 `{data:Auth}`, Set-Cookie | Public, rate-limit và Origin; phiên mới, không nhận role/userId; nếu đã có cookie hợp lệ thì revoke phiên cũ trước khi cấp |
| GET `/auth/me` | không query/body | 200 `{data:Auth}` | Phiên còn hiệu lực; 401 nếu thiếu/hết hạn |
| POST `/auth/logout` | `{}` | 200 `{data:null}`, clear cookie | Cần phiên+CSRF, xóa session DB |
| POST `/auth/change-password` | `{currentPassword,newPassword}` | 200 `{data:null}`, clear cookie | Phiên+CSRF; sai currentPassword => 401 INVALID_CREDENTIALS; hash mới và xóa tất cả sessions của user trong một transaction |

Ví dụ login: `{"login":"owner","password":"Gym@2026Demo!"}`. Auth success có dạng `{"data":{"user":{"id":1,"login":"owner","fullName":"Nguyễn Minh Anh","role":"owner","memberId":null},"csrfToken":"<random>"}}`.

## 5. Hội viên và gói (Terra)

| Method/path | Query/body | Success | Quyền |
|---|---|---|---|
| GET `/members` | optional `q` string tối đa100 | 200 Member[] | owner/staff; q case-insensitive contains fullName/login/phone/email, không wildcard semantics cho `%`/`_`; sort id DESC |
| GET `/members/:id` | không query | 200 Member | owner/staff hoặc member đúng memberId; pt forbidden |
| POST `/members` | `{login,initialPassword,fullName,phone,email?}` | 201 Member | owner/staff; email mặc định null; atomic users(role member)+members, DUPLICATE_LOGIN409 không để user mồ côi |
| PATCH `/members/:id` | một phần `{fullName,phone,email}` | 200 Member | owner/staff; không sửa login/role/password, fullName lưu users |
| GET `/packages` | không query | 200 Package[] | owner/staff: tất cả; pt/member: chỉ isActive; sort id ASC |
| POST `/packages` | `{name,durationDays,priceVnd}` | 201 Package | owner; durationDays số nguyên1..366, priceVnd0..1e9; isActive mặc định true |
| PATCH `/packages/:id` | một phần `{name,durationDays,priceVnd,isActive}` | 200 Package | owner; boolean JSON thật; không sửa snapshot thẻ cũ |

Phone/email không bắt unique vì gia đình có thể dùng chung. Tìm `q` không phân biệt hoa thường tiếng Việt (có thể lọc tập kết quả local bằng `toLocaleLowerCase('vi')`), vẫn phân biệt dấu. PATCH hồ sơ cập nhật users và members trong cùng transaction. Không có GET user list hoặc endpoint thay role. Gói ngừng bán còn trong lịch sử thẻ và chỉ owner/staff thấy trong danh sách gói.

## 6. Thẻ hội viên (Sol)

| Method/path | Query/body | Success | Quyền |
|---|---|---|---|
| GET `/memberships` | optional `memberId` | 200 Membership[] | owner/staff: tất cả hoặc filter; member: chỉ mình, query người khác403; pt forbidden. Sort startDate DESC,id DESC |
| POST `/memberships` | `{memberId,packageId,startDate}` | 201 Membership | owner/staff; validate hai resource tồn tại, gói đang bán |

Server tính `endDate = addDays(startDate, durationDays - 1)`; hai đầu đều bao gồm. Ngày kết thúc cũng phải nằm trong năm 2000..2100. Snapshot `packageName`, `durationDays`, `priceVnd` từ gói tại lúc bán. Có thể bán thẻ bắt đầu quá khứ/hôm nay/tương lai; không cần trả đủ trước khi dùng. Cấm mọi thẻ chồng nhau của cùng member: `existing.start_date <= new.endDate AND existing.end_date >= new.startDate`. Thẻ mới bắt đầu ngay ngày sau thẻ cũ kết thúc được phép. Check+insert cùng transaction. Không sửa/hủy/xóa thẻ trong MVP.

Ví dụ request `{"memberId":1,"packageId":1,"startDate":"2026-11-01"}` với gói30ngày tạo `endDate:"2026-11-30"`, `priceVnd:300000`, `paidVnd:0`, `balanceVnd:300000`.

## 7. Sổ thu VND (Sol)

| Method/path | Query/body | Success | Quyền |
|---|---|---|---|
| GET `/payments` | optional `memberId`, `membershipId` | 200 Payment[] | owner/staff: tất cả/filter; member: chỉ mình; pt forbidden. Hai filter nếu có cùng áp dụng; sort createdAt DESC,id DESC |
| POST `/payments` | `{membershipId,amountVnd,method,requestId,note?}` | 201 Payment, replay200 Payment | owner/staff; recordedBy/session và createdAt/server |

`requestId` bắt buộc UUIDv4 dạng lowercase canonical, UI dùng `crypto.randomUUID()` cho một thao tác thu và giữ nguyên UUID khi retry. Trong transaction, tìm requestId trước: nếu tồn tại và membershipId/amountVnd/method/note(normalized)/recordedBy đều giống thì trả chính record cũ 200, dù thẻ hiện đã đủ tiền; payload/người ghi khác => 409 IDEMPOTENCY_CONFLICT. Nếu chưa có, tính balance bằng SQL rồi chỉ cho `0 < amountVnd <= balanceVnd`; check+insert atomic. Thẻ giá0 không có khoản thu hợp lệ. Không nhận memberId/giá/balance/timestamp client. Có thể thu cho thẻ tương lai hoặc hết hạn để trả nợ. Không PATCH/DELETE/hoàn tiền; không có số âm, số tiền thập phân hoặc tổng thu tính từ giá gói.

## 8. Điểm danh (Terra)

| Method/path | Query/body | Success | Quyền |
|---|---|---|---|
| GET `/attendance` | optional `memberId`, `from`, `to` (date) | 200 Attendance[] | owner/staff: tất cả/filter; member: chỉ mình; pt forbidden. Nếu bỏ from/to thì không giới hạn phía đó; sort date DESC,id DESC |
| POST `/attendance` | `{memberId}` | 201 Attendance, duplicate200 Attendance | owner/staff; không backdate hoặc nhận date từ client |

Ngày là `vietnamDate(ctx.now)`. Trong transaction kiểm member tồn tại, tìm attendance cùng member/date (nếu có trả200), rồi yêu cầu thẻ bao phủ ngày đó; không phụ thuộc đã trả đủ tiền. `UNIQUE(member_id,date)` chống tạo đôi. Server tự điền checkedInAt/checkedInBy. Không check-out hoặc sửa/xóa lượt vào.

## 9. PT và lịch (Sol)

| Method/path | Query/body | Success | Quyền |
|---|---|---|---|
| GET `/trainers` | không query | 200 Trainer[] | Mọi user login; users role pt, sort id ASC |
| GET `/sessions` | optional `memberId`, `ptId`, `from`, `to` (date) | 200 Session[] | owner/staff: tất cả/filter; pt chỉ ptId mình; member chỉ memberId mình; query chống phạm vi403; sort startsAt ASC,id ASC |
| POST `/sessions` | `{memberId,ptId,startsAt,endsAt,note?}` | 201 Session | owner/staff hoặc member tự đặt; pt không tạo buổi |
| PATCH `/sessions/:id` | `{status:"completed"}` hoặc `{status:"cancelled"}` | 200 Session | owner/staff; pt nếu ptId mình; member nếu memberId mình và chỉ cancelled |

Session list mặc định không giới hạn ngày; `from/to` nếu có lọc **ngày Việt Nam của startsAt**, bao gồm hai đầu. Không lộ lịch PT khác cho hội viên: member chỉ nhận buổi của mình; khi chọn khung bị chiếm, POST trả BOOKING_CONFLICT mà không trả danh tính người chiếm.

Tạo buổi: member tồn tại, ptId là users.role pt; startsAt >= ctx.now; duration30..180 phút, chia hết15; cả hai timestamp có giây/millisecond0 và phút chia hết15; cùng ngày Việt Nam. Phải có thẻ bao phủ ngày buổi học. memberId do member gửi phải đúng user.memberId, sai403. Không yêu cầu trả đủ nợ. Mặc định status booked, createdBy=actor, note mặc định rỗng.

Conflict trong một transaction: mọi session không cancelled, thỏa `old.starts_at < new.endsAt AND old.ends_at > new.startsAt` và `(old.pt_id = new.ptId OR old.member_id = new.memberId)` => 409 BOOKING_CONFLICT. Đây là interval nửa mở: 09:00–10:00 và 10:00–11:00 được phép. Cấm trùng cả hai tài nguyên, không chỉ PT. Không có check rồi await trước insert.

Chuyển trạng thái chỉ booked→completed hoặc booked→cancelled. Completed chỉ owner/staff/PT sở hữu, `endsAt <= now`; member không được complete. Member chỉ được cancel trước startsAt; owner/staff/PT sở hữu được cancel kể cả sau giờ bắt đầu để ghi nhận không diễn ra. Terminal không đổi tiếp, kể cả gửi cùng status lại =>409 INVALID_TRANSITION. Resource ngoài sở hữu404 trước khi xem transition. Không đổi member/pt/giờ/note qua PATCH; dời lịch bằng hủy rồi đặt mới. Buổi cancelled không chiếm khung, completed vẫn giữ lịch sử.

## 10. Dashboard (Terra)

GET `/dashboard`, không query/body, cần login; 200 `{data:<một trong ba shape>}`. Tất cả tính trên DB với cùng ctx.now; `today` là ngày Việt Nam, tháng là từ ngày01 đến cuối tháng địa phương. Không tính giờ theo UTC hoặc dựa vào đồng hồ trình duyệt.

```text
// owner hoặc staff
{
  role: "owner" | "staff",
  totalMembers,               // count members
  activeMemberships,          // count thẻ bao phủ today
  expiringSoonCount,          // thẻ active, endDate trong [today, today+7 ngày]
  todayCheckIns,              // attendance.date = today
  todaySessions,              // buổi startsAt có ngày VN=today, status != cancelled
  outstandingVnd,            // SUM mọi membership.price - mọi payment.amount
  revenueTodayVnd,            // SUM payment theo ngày VN createdAt=today
  revenueMonthVnd,            // SUM payment theo tháng VN createdAt
  upcomingSessions: Session[] // tối đa5, booked và startsAt>=now, sort startsAt,id
}

// pt: luôn scope pt_id = user.id
{
  role: "pt", todaySessions,
  completedSessionsThisMonth, // status completed, tháng theo startsAt ở VN
  upcomingSessions: Session[] // tối đa5 buổi của PT, cùng quy tắc ở trên
}

// member: luôn scope member_id = user.memberId
{
  role: "member",
  membership: Membership | null, // thẻ active; nếu không có thì thẻ upcoming gần nhất;
                                 // nếu không có nữa thì thẻ expired kết thúc gần nhất
  todayCheckedIn: boolean,
  outstandingVnd,                // tất cả thẻ của chính member, không chỉ thẻ đang hiển thị
  upcomingSessions: Session[]    // tối đa5 buổi của member, cùng quy tắc ở trên
}
```

Mọi aggregate rỗng phải trả0. Không JOIN nhân bản payment khi đếm attendance/session. staff thấy các tổng tài chính như owner, pt không nhận các trường này. Membership dashboard chọn tie bằng id DESC (ngày không overlap nên ít khi cần).

## 11. SQL schema chuẩn (Sol tạo duy nhất)

DDL sau là hợp đồng tĩnh cho người triển khai; tài liệu không tạo hoặc chạy DB. Các bảng dùng `STRICT`; ID INTEGER PRIMARY KEY, không cần AUTOINCREMENT. Tất cả FK mặc định NO ACTION, không cascade xóa lịch sử. Boolean SQLite là 0/1 và mapper đổi thành boolean JSON. Tính đúng ngày/type/ownership ở API; CHECK bổ sung bảo vệ trực tiếp các invariant đơn giản.

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL CHECK(length(full_name) BETWEEN 1 AND 100),
  role TEXT NOT NULL CHECK(role IN ('owner','staff','pt','member')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  phone TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  duration_days INTEGER NOT NULL CHECK(duration_days BETWEEN 1 AND 366),
  price_vnd INTEGER NOT NULL CHECK(price_vnd BETWEEN 0 AND 1000000000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  package_id INTEGER NOT NULL REFERENCES packages(id),
  package_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK(duration_days BETWEEN 1 AND 366),
  price_vnd INTEGER NOT NULL CHECK(price_vnd BETWEEN 0 AND 1000000000),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL CHECK(end_date >= start_date),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_memberships_member_dates
  ON memberships(member_id,start_date,end_date);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  membership_id INTEGER NOT NULL REFERENCES memberships(id),
  amount_vnd INTEGER NOT NULL CHECK(amount_vnd BETWEEN 1 AND 1000000000),
  method TEXT NOT NULL CHECK(method IN ('cash','bank_transfer')),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 500),
  request_id TEXT NOT NULL UNIQUE,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_payments_membership ON payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  date TEXT NOT NULL,
  checked_in_at TEXT NOT NULL,
  checked_in_by INTEGER NOT NULL REFERENCES users(id),
  UNIQUE(member_id,date)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

CREATE TABLE IF NOT EXISTS pt_sessions (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  pt_id INTEGER NOT NULL REFERENCES users(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL CHECK(ends_at > starts_at),
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK(status IN ('booked','completed','cancelled')),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 500),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_pt_sessions_pt_time
  ON pt_sessions(pt_id,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_member_time
  ON pt_sessions(member_id,starts_at,ends_at);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```

Tên `sessions` dành cho phiên đăng nhập; buổi PT luôn `pt_sessions`. Server bảo đảm member.user_id liên kết role member và pt_sessions.pt_id liên kết role pt; không có endpoint sửa role nên invariant không bị thay sau tạo. Không lưu balance/status của thẻ, không lưu tổng dashboard. Không có migration engine hoặc bảng extra trong v1; chỉ schema fresh/local và không phá DB sẵn có. Seed theo PLAN nằm cùng transaction; không có tệp seed riêng do Terra/UI quản lý.

## 12. Ràng buộc UI và test tại ranh giới

- UI lấy Auth bằng GET me lúc mở trang, chuyển tới login nếu401; token CSRF từ Auth, `credentials:'same-origin'`, gửi `X-CSRF-Token` cho mutation sau login. Mọi action hiện loading, khóa gửi đôi, hiện message/fields tiếng Việt; không nuốt lỗi409. Với payment, giữ requestId khi kết quả mạng chưa rõ.
- Định dạng tiền bằng `Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND',maximumFractionDigits:0})`; input lấy integer number, không gửi chuỗi có dấu phân tách. Không dùng giá hiển thị để tính khoản thu server.
- Hiển thị timestamp qua `Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',...})`. Input datetime-local được hiểu rõ là giờ Việt Nam, chuyển bằng offset `+07:00` sang `.toISOString()`, không dùng timezone máy trình duyệt. Ngày thẻ giữ string, không convert thành timestamp rồi hiển thị lùi ngày.
- Test HTTP gửi đúng Origin, Cookie và CSRF như browser. Inject clock giúp thử 16:59:59Z/17:00:00Z (sang ngày VN), năm nhuận, hết phiên và ngày cuối thẻ. Test DB mới `:memory:`/temp, never dùng `data/gym.sqlite`.
- Test Sol phủ security/money/date/conflict và helper exports; test Terra phủ CRUD/attendance/dashboard, dùng cùng createApp hoặc core DB nhưng không stub quyền. QA worker khác quyết định smoke/browser chi tiết; acceptance nền tại PLAN không thay thế kiểm tra API.
