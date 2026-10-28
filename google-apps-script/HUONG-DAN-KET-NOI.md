# Kết nối form đăng ký với Google Sheet và email tự động

Luồng hoạt động:

1. Khách bấm "Đăng ký tham gia" hoặc "Bắt đầu với khoá 2 ngày". Form hiện ngay trên trang.
2. Khách gửi form. Thông tin được ghi vào Google Sheet với trạng thái "Chờ thanh toán".
3. Trang hiện VietQR Techcombank có sẵn số tiền và nội dung `WIF21 HO TEN SDT` hoặc `WIF02 HO TEN SDT`.
4. Khách chuyển khoản. Dịch vụ đọc biến động số dư (SePay hoặc Casso) báo về Apps Script.
5. Apps Script khớp đơn theo mã khoá và số điện thoại, đổi trạng thái thành "Đã thanh toán", rồi gửi email xác nhận về Gmail của khách.
6. Trang web của khách tự chuyển sang màn hình "Thanh toán thành công".

## Bước 1. Dán code vào Google Sheet

1. Mở Google Sheet: https://docs.google.com/spreadsheets/d/1ToXiLGWr41MZ3bp6kRHB9U_cjq_H92RvhtKH1hInMAQ/edit
2. Vào menu **Tiện ích mở rộng › Apps Script**.
3. Xoá code mẫu, dán toàn bộ nội dung file `Code.gs` vào, rồi bấm Lưu.
4. Ở dòng `WEBHOOK_TOKEN`, đổi thành một chuỗi bí mật của riêng bạn, ví dụ `wif-8k2p9x`.

Đơn được ghi vào tab riêng **Đăng ký Landing 21 ngày**. Tab này tự được tạo kèm dòng tiêu đề ở lần ghi đầu tiên, các tab Google Form cũ giữ nguyên.

## Bước 2. Cấp quyền và chạy thử

1. Chọn hàm `testFlow` ở thanh trên cùng, rồi bấm **Chạy**.
2. Google sẽ hỏi quyền truy cập Sheet và quyền gửi email. Bấm Cho phép.
3. Kiểm tra trong Sheet sẽ có 1 dòng TEST ở trạng thái "Đã thanh toán", và Gmail của bạn nhận được 1 email mẫu. Xem xong thì xoá dòng TEST.

## Bước 3. Triển khai thành Web App

1. Bấm **Triển khai › Tùy chọn triển khai mới**.
2. Chọn loại **Ứng dụng web**.
3. Mục **Thực thi dưới dạng**: chọn Tôi. Mục **Người có quyền truy cập**: chọn Bất kỳ ai.
4. Bấm Triển khai, rồi sao chép URL có đuôi `/exec`.

## Bước 4. Dán URL vào trang web

Mở file `landing-page/assets/register.js`, dán URL vào dòng:

```
appsScriptUrl: 'https://script.google.com/macros/s/XXXX/exec',
```

Lưu file, rồi mở trang và đăng ký thử một lần. Kiểm tra dòng mới xuất hiện trong Sheet.

## Bước 5. Tự động xác nhận chuyển khoản (SePay hoặc Casso)

Trang web không tự biết khách đã chuyển tiền hay chưa. Cần một dịch vụ đọc biến động số dư tài khoản Techcombank 1669889999 (HOANG THU HA) rồi báo về Apps Script.

1. Đăng ký SePay (sepay.vn) hoặc Casso (casso.vn). Khi đăng ký, kiểm tra dịch vụ có hỗ trợ Techcombank rồi liên kết tài khoản 1669889999.
2. Tạo Webhook với:
   - URL: `URL_EXEC_CUA_BAN?token=CHUOI_BI_MAT_O_BUOC_1`
   - Phương thức: POST, kiểu JSON
3. Chuyển thử 1 khoản nhỏ với nội dung giống form, ví dụ `WIF02 TEST 09xxxxxxxx`, để kiểm tra.

Code đã hỗ trợ sẵn định dạng webhook của cả SePay và Casso. Nếu webhook gửi trùng, code sẽ bỏ qua nên không có email gửi hai lần.

## Bước 5B. Xác nhận bằng tay trên Sheet (đang dùng)

Không cần SePay hay Casso. Bạn kiểm tra tiền về trên app ngân hàng, rồi đổi ô **Trạng thái** của đơn đó thành **Đã thanh toán**. Email xác nhận kèm link Zoom sẽ tự gửi cho khách.

Cài một lần:

1. Trong trình soạn Apps Script, dán toàn bộ `CODE-DAN-VAO-APPS-SCRIPT.gs` đè lên code cũ.
2. Điền phần `ZOOM` ở đầu code: `link` (bắt buộc), `meetingId`, `passcode`, `schedule`.
3. Chọn hàm `thuGuiEmailXacNhan`, bấm **Chạy**. Một email mẫu sẽ về Gmail của bạn, Sheet không bị ghi gì.
4. Chọn hàm `caiDatGuiEmailTheoSheet`, bấm **Chạy**, rồi cấp quyền khi Google hỏi. Ô Trạng thái sẽ thành danh sách chọn.
5. Vào **Triển khai › Quản lý triển khai › bút chì › Phiên bản mới › Triển khai** để form trên trang dùng code mới.

Khi vận hành:

- Cột **Email xác nhận** sẽ ghi "Đã gửi …" kèm giờ gửi. Mỗi đơn chỉ gửi một lần, đổi qua đổi lại cũng không gửi trùng.
- Nếu cột này ghi "Chưa có link Zoom, chưa gửi", bạn điền `ZOOM.link`, xoá ô đó rồi chọn lại "Đã thanh toán".
- Muốn gửi lại cho một khách, bạn xoá ô Email xác nhận của dòng đó rồi chọn lại "Đã thanh toán".
- Các ô Thời gian thanh toán, Số tiền nhận (lấy theo học phí) và Mã giao dịch ("Xác nhận tay") tự điền nếu đang trống.

## Bước 5C. Lớp khai giảng 23/11/2026 (đồng hồ, suất ưu đãi, chờ lớp sau)

- Phần `LAUNCH` trong `Code.gs` và `launch` trong `assets/register.js` phải khớp nhau: giờ khai giảng, 30 suất ưu đãi, giá gốc 3.890.000đ.
- Trang gọi `?action=seats` để lấy số suất còn lại. Số này đếm các đơn WIF21 có Trạng thái "Đã thanh toán", giữ trong bộ đệm 60 giây, và tự làm mới khi bạn đổi Trạng thái.
- Khi đủ 30 đơn đã thanh toán, đơn mới được ghi học phí 3.890.000đ. Sau 20h ngày 23/11/2026, đơn mới được ghi Trạng thái "Chờ lớp sau" và không có học phí.
- Mở lớp mới: đổi `LAUNCH.start` (và `launch` trong `register.js`, lịch trong `calendar`), tạo phiên bản mới cho Apps Script, rồi push trang.
- Xem thử trên máy (chỉ chạy ở localhost): thêm `?xem=con-suat`, `?xem=het-suat` hoặc `?xem=da-khai-giang` vào đường dẫn.

## Bước 6. Nội dung email xác nhận

Sửa phần `EMAILS` trong `Code.gs`, có 2 mẫu cho WIF21 và WIF02. Có thể dùng các biến `{HoTen}` `{KhoaHoc}` `{SoTien}` `{MaDon}` `{Gmail}` `{SDT}` `{LichHoc}` `{ZoomLink}` `{ZoomInfo}`.

Mỗi lần sửa code, vào **Triển khai › Quản lý triển khai › biểu tượng bút chì › Phiên bản: Phiên bản mới › Triển khai**. URL giữ nguyên, không cần dán lại.

## Lưu ý vận hành

- Tài khoản Gmail thường gửi được khoảng 100 email mỗi ngày qua Apps Script. Google Workspace gửi được nhiều hơn.
- Đơn chuyển thiếu tiền sẽ có trạng thái "Chuyển thiếu, cần kiểm tra". Hệ thống không gửi email, bạn xử lý thủ công.
- Nếu khách tự sửa nội dung chuyển khoản và bỏ mất số điện thoại, đơn sẽ không khớp tự động. Khi đó bạn đối chiếu trong Sheet rồi đổi trạng thái thủ công.
- Trong dịch vụ webhook, một số lần gửi có thể hiện là thất bại, do Apps Script luôn trả về một lệnh chuyển hướng. Code vẫn chạy bình thường, bạn chỉ cần xem cột "Trạng thái" trong Sheet.
