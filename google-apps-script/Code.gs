/**
 * WI.FINANCE · Nhận đăng ký từ landing page, ghi vào Google Sheet,
 * nhận webhook thanh toán (SePay hoặc Casso) và tự gửi email xác nhận.
 *
 * Cách cài: xem file HUONG-DAN-KET-NOI.md cùng thư mục.
 */

// ===================== CẤU HÌNH =====================
var SHEET_ID  = '1ToXiLGWr41MZ3bp6kRHB9U_cjq_H92RvhtKH1hInMAQ';
// Đơn từ landing page được ghi vào tab riêng này (tự tạo nếu chưa có), không đụng các tab Google Form cũ.
var SHEET_NAME = 'Đăng ký Landing 21 ngày';

// Đổi thành một chuỗi bí mật bất kỳ, rồi gắn vào URL webhook: .../exec?token=CHUOI_NAY
var WEBHOOK_TOKEN = 'DOI-THANH-CHUOI-BI-MAT-CUA-BAN';
// Thanh toán bán tự động (Sếp Dũng duyệt 18/11/2026): TẮT nhận tín hiệu ngân hàng (SePay/Casso), giữ code.
// Khách bấm "Tôi đã chuyển khoản" → mail báo Hà → Hà đổi Trạng thái "Đã thanh toán" trên Sheet → máy gửi mail xác nhận.
var PAYMENT_WEBHOOK_ON = false;
var NOTIFY_TO = 'coachmethuha@gmail.com'; // Nhận mail "Cần xác nhận học phí"

var SENDER_NAME = 'WI.FINANCE · Hoàng Thu Hà';
// Khách bấm "Trả lời" email sẽ gửi về địa chỉ này.
var REPLY_TO = 'coachmethuha@gmail.com';

// Thông tin nhận tiền, dùng trong email hướng dẫn chuyển khoản.
var BANK = { name: 'VietinBank', account: '100881581999', holder: 'HOANG THU HA' };

// Gửi ngay email "Đã nhận đăng ký" kèm hướng dẫn chuyển khoản khi khách gửi form.
var SEND_REGISTER_EMAIL = false; // Tắt: trang web đã hiện hướng dẫn chuyển khoản
var REGISTER_EMAIL = {
  subject: 'WI.FINANCE · Đã nhận đăng ký {KhoaHoc}',
  html: '<p>Chào {HoTen},</p>'
      + '<p>WI.FINANCE đã nhận thông tin đăng ký khoá <b>{KhoaHoc}</b>. Mã đơn của bạn: <b>{MaDon}</b>.</p>'
      + '<p>Để hoàn tất, bạn chuyển khoản theo thông tin sau:</p>'
      + '<table cellpadding="6" style="border-collapse:collapse">'
      + '<tr><td>Ngân hàng</td><td><b>{NganHang}</b></td></tr>'
      + '<tr><td>Số tài khoản</td><td><b>{SoTaiKhoan}</b></td></tr>'
      + '<tr><td>Chủ tài khoản</td><td><b>{ChuTaiKhoan}</b></td></tr>'
      + '<tr><td>Số tiền</td><td><b>{SoTien}</b></td></tr>'
      + '<tr><td>Nội dung</td><td><b>{NoiDung}</b></td></tr>'
      + '</table>'
      + '<p>Lưu ý: chuyển đúng nội dung để hệ thống xác nhận nhanh. Khi nhận được học phí, WI.FINANCE sẽ gửi email xác nhận cho bạn.</p>'
      + '<p>Thân mến,<br>WI.FINANCE · Tài Chính Tâm Thức</p>'
};

var COURSES = {
  WIF21: { name: 'Bản Đồ Dòng Tiền', price: 2499000 },
  WIF02: { name: 'Kích Hoạt Dòng Tiền',        price: 199000 }
};

// Lớp khoá 21 ngày đang mở. Phải khớp với launch trong assets/register.js.
var LAUNCH = {
  code: 'WIF21',
  start: new Date('2026-11-23T20:00:00+07:00'), // Sau mốc này, đăng ký mới ghi "Chờ lớp sau"
  earlySeats: 30,                                // Số suất giá ưu đãi, đếm theo đơn "Đã thanh toán"
  fullPrice: 3890000                             // Giá khi đã hết suất ưu đãi
};

// Thông tin lớp gửi trong email xác nhận khoá 21 ngày.
// Khi link còn trống, hệ thống KHÔNG gửi email và ghi "Chưa có link Zoom" vào cột Email xác nhận.
var ZOOM = {
  link: '',      // Link phòng Zoom, ví dụ https://us02web.zoom.us/j/...
  meetingId: '', // Không bắt buộc
  passcode: '',  // Không bắt buộc
  schedule: '20h00 đến 22h00 tối thứ Hai, thứ Tư, thứ Sáu. Khai giảng thứ Hai 23/11/2026, 9 buổi: 23, 25, 27, 30/11 và 2, 4, 7, 9, 11/12/2026'
};

// Học viên khoá 21 ngày vào app + link Zoom RIÊNG (Sếp Dũng duyệt 17/11/2026).
// Khi đơn "Đã thanh toán": gọi cổng cap-quyen-hoc-vien của app → Gmail thành Học viên 396 ngày (13 tháng),
// Zoom tạo link riêng theo tên (vào phòng là app tự điểm danh). Khoá bí mật để trong
// Cài đặt dự án → Thuộc tính tập lệnh: CAP_QUYEN_SECRET (không ghi vào code).
var APP = {
  capQuyenUrl: 'https://tkgbghgstkridfpkjypk.supabase.co/functions/v1/cap-quyen-hoc-vien',
  url: 'https://app.wifinance.com.vn',
  days: 396,          // Số ngày dùng app: 13 tháng (Sếp duyệt 18/11/2026)
  cohortCode: 'K21-01', // Mã khoá trong app (VD 'K21-01'); trống thì học viên tự chọn khoá trong app
  zoomMeetingId: ''   // Trống = dùng phòng mặc định đã cài trong app (ZOOM_MEETING_ID)
};

// Nội dung email sau khi thanh toán thành công.
// Có thể dùng các biến: {HoTen} {KhoaHoc} {SoTien} {MaDon} {Gmail} {SDT} {LichHoc} {ZoomLink} {ZoomInfo}
// Quà và tài liệu gửi kèm mail xác nhận khoá 21 ngày (Sếp duyệt 18/11/2026).
var QUA = {
  trangQua: 'https://bandodongtien.wifinance.com.vn/qua-tang/',
  workbook: 'https://drive.google.com/file/d/1DdeOmQ1izgCjzkwGqdPn21rkwoO6j1wH/view',
  huongDanApp: 'https://youtube.com/live/VL06pLI0qW0'
};
var BTN_ = 'display:inline-block;background:#0B2A5B;color:#ffffff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin:2px 0';
var EMAILS = {
  WIF21: {
    subject: 'WI.FINANCE · Xác nhận đăng ký và link Zoom khoá {KhoaHoc}',
    html: '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:600px">'
        + '<p>Chào {HoTen},</p>'
        + '<p>Hà đã nhận học phí <b>{SoTien}</b> cho khoá <b>{KhoaHoc}</b>. Mã đơn của bạn: <b>{MaDon}</b>.</p>'
        + '<p>Cảm ơn bạn đã chọn đồng hành cùng Hà trong hành trình này. Bạn làm lần lượt 4 bước dưới đây nhé:</p>'
        // Bước 1: vào lớp
        + '<h3 style="color:#0B2A5B;margin:22px 0 6px">① Vào lớp học Zoom</h3>'
        + '<p style="margin:0 0 8px">Lịch học: <b>{LichHoc}</b></p>{ZoomInfo}'
        + '<p><a href="{ZoomLink}" style="' + BTN_ + '">🎥 Vào phòng học</a></p>'
        + '<p style="font-size:13px;color:#6b7280">Link Zoom này là <b>của riêng bạn</b>, gắn với tên và Gmail của bạn. Mỗi lần vào lớp bằng link này, app tự điểm danh để tính điểm thi đua. '
        + 'Bạn không chia sẻ link cho người khác: link chỉ vào được một máy cùng lúc.</p>'
        // Bước 2: app
        + '<h3 style="color:#0B2A5B;margin:22px 0 6px">② Mở App Bản Đồ Dòng Tiền · dùng trọn 13 tháng</h3>'
        + '<p style="margin:0 0 8px">Đăng nhập bằng <b>đúng Gmail {Gmail}</b>. App tự nhận bạn là học viên, không cần nhập mã.</p>'
        + '<p><a href="{AppLink}" style="' + BTN_ + '">📱 Mở app</a></p>'
        // Bước 3: video hướng dẫn
        + '<h3 style="color:#0B2A5B;margin:22px 0 6px">③ Xem hướng dẫn sử dụng app</h3>'
        + '<p><a href="' + QUA.huongDanApp + '" style="' + BTN_ + '">▶️ Xem video hướng dẫn</a></p>'
        // Bước 4: quà + workbook
        + '<h3 style="color:#0B2A5B;margin:22px 0 6px">④ Nhận quà đồng hành và Workbook</h3>'
        + '<p style="margin:0 0 8px"><b>Workbook Bản Đồ Dòng Tiền 21 ngày</b>: luyện nội lực cùng chuyên gia mỗi ngày.</p>'
        + '<p><a href="' + QUA.workbook + '" style="' + BTN_ + '">📘 Tải Workbook</a> &nbsp; '
        + '<a href="' + QUA.trangQua + '" style="' + BTN_ + '">🎁 Nhận 3 phần quà</a></p>'
        + '<p style="font-size:13px;color:#6b7280">3 phần quà gồm: Bộ công cụ, Ebook và Sổ thực hành.</p>'
        + '<p>Bạn lưu email này lại để vào lớp đúng giờ. Nếu cần hỗ trợ, bạn trả lời email này hoặc gọi Hotline 0948387418.</p>'
        + '<p>Thân mến,<br>Hoàng Thu Hà<br>WI.FINANCE · Tài Chính Tâm Thức</p>'
        + '</div>'
  },
  WIF02: {
    subject: 'WI.FINANCE · Xác nhận thanh toán khoá {KhoaHoc}',
    html: '<p>Chào {HoTen},</p>'
        + '<p>WI.FINANCE đã nhận học phí <b>{SoTien}</b> cho khoá <b>{KhoaHoc}</b>. Mã đơn của bạn: <b>{MaDon}</b>.</p>'
        + '<p>[NỘI DUNG EMAIL KHOÁ 2 NGÀY SẼ CẬP NHẬT SAU]</p>'
        + '<p>Thân mến,<br>WI.FINANCE · Học Viện Tài Chính Tâm Thức</p>'
  }
};
// =====================================================

var HEADERS = ['Thời gian đăng ký', 'Mã đơn', 'Mã khoá', 'Khoá học', 'Học phí', 'Họ và tên', 'Số điện thoại',
  'Gmail', 'Tỉnh/thành', 'Mong muốn', 'Nội dung chuyển khoản', 'Nguồn', 'Trạng thái',
  'Thời gian thanh toán', 'Số tiền nhận', 'Mã giao dịch', 'Email xác nhận', 'Nhân mạch kết nối', 'SĐT nhân mạch',
  'Ngày sinh', 'Thách thức', 'Báo đã chuyển khoản'];
var COL = {}; HEADERS.forEach(function (h, i) { COL[h] = i + 1; });
var ST_WAIT = 'Chờ thanh toán', ST_PAID = 'Đã thanh toán', ST_SHORT = 'Chuyển thiếu, cần kiểm tra', ST_NEXT = 'Chờ lớp sau', ST_CANCEL = 'Đã hủy';

// Số đơn đã thanh toán của lớp đang mở (đơn đăng ký trước giờ khai giảng).
function paidCount_(sh) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  var data = sh.getRange(2, 1, n, HEADERS.length).getValues(), count = 0;
  data.forEach(function (r) { if (r[COL['Mã khoá'] - 1] === LAUNCH.code && r[COL['Trạng thái'] - 1] === ST_PAID) count++; });
  return count;
}

function seats_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('seats');
  if (hit) return JSON.parse(hit);
  var paid = paidCount_(sheet_());
  var res = { ok: true, total: LAUNCH.earlySeats, paid: paid, left: Math.max(LAUNCH.earlySeats - paid, 0), start: LAUNCH.start.getTime() };
  cache.put('seats', JSON.stringify(res), 60); // Giữ 60 giây cho đỡ tải Sheet
  return res;
}

function sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0B2A5B').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  // Sheet cũ thiếu cột mới thì tự thêm vào cuối, không đụng dữ liệu đã có.
  var lastCol = sh.getLastColumn();
  if (lastCol < HEADERS.length) {
    if (sh.getMaxColumns() < HEADERS.length) sh.insertColumnsAfter(sh.getMaxColumns(), HEADERS.length - sh.getMaxColumns());
    sh.getRange(1, lastCol + 1, 1, HEADERS.length - lastCol).setValues([HEADERS.slice(lastCol)])
      .setFontWeight('bold').setBackground('#0B2A5B').setFontColor('#FFFFFF');
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function money_(n) { return Number(n).toLocaleString('vi-VN') + ' VND'; }

// ---------- GET: trang web hỏi trạng thái thanh toán ----------
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'status' && p.order) {
    var sh = sheet_();
    var ids = sh.getRange(2, COL['Mã đơn'], Math.max(sh.getLastRow() - 1, 1), 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(p.order)) {
        var st = sh.getRange(i + 2, COL['Trạng thái']).getValue();
        return json_({ ok: true, paid: st === ST_PAID });
      }
    }
    return json_({ ok: true, paid: false });
  }
  if (p.action === 'seats') return json_(seats_());
  return json_({ ok: true, service: 'WI.FINANCE registration' });
}

// ---------- POST: đăng ký từ trang web hoặc webhook thanh toán ----------
function doPost(e) {
  var p = (e && e.parameter) || {};
  var body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) {}

  if (p.token !== undefined) {
    if (p.token !== WEBHOOK_TOKEN) return json_({ success: false, error: 'invalid token' });
    if (!PAYMENT_WEBHOOK_ON) return json_({ success: true, matched: 0, note: 'webhook tat, xac nhan tay' });
    return handlePayment_(body);
  }
  if (body.action === 'register') return handleRegister_(body);
  if (body.action === 'notify') return handleNotify_(body);
  return json_({ ok: false, error: 'unknown request' });
}

function clean_(v, max) { return String(v == null ? '' : v).replace(/^[=+\-@]/, "'$&").slice(0, max || 300); }

function handleRegister_(b) {
  var course = COURSES[b.code];
  if (!course) return json_({ ok: false, error: 'invalid course' });
  if (!/^[a-z0-9._%+-]+@gmail\.com$/i.test(b.email || '')) return json_({ ok: false, error: 'invalid gmail' });
  if (!/^0\d{9}$/.test(b.phone || '')) return json_({ ok: false, error: 'invalid phone' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var waitlist = false;
  try {
    var sh = sheet_();
    var price = course.price, now = new Date();
    if (b.code === LAUNCH.code) {
      // Máy chủ tự quyết giá và trạng thái, không tin giá trang web gửi lên.
      waitlist = now >= LAUNCH.start;
      if (!waitlist && paidCount_(sh) >= LAUNCH.earlySeats) price = LAUNCH.fullPrice;
    }
    var row = [];
    row[COL['Thời gian đăng ký'] - 1] = now;
    row[COL['Mã đơn'] - 1] = clean_(b.orderId, 40);
    row[COL['Mã khoá'] - 1] = b.code;
    row[COL['Khoá học'] - 1] = course.name + (waitlist ? ' (lớp sau)' : '');
    row[COL['Học phí'] - 1] = waitlist ? '' : price;
    row[COL['Họ và tên'] - 1] = clean_(b.fullname, 120);
    row[COL['Số điện thoại'] - 1] = "'" + b.phone;
    row[COL['Gmail'] - 1] = clean_(b.email, 120);
    row[COL['Tỉnh/thành'] - 1] = clean_(b.city, 80);
    row[COL['Mong muốn'] - 1] = clean_(b.wish, 1000);
    row[COL['Ngày sinh'] - 1] = /^\d{2}\/\d{2}\/\d{4}$/.test(b.dob || '') ? "'" + b.dob : '';
    row[COL['Thách thức'] - 1] = clean_(b.challenge, 1000);
    row[COL['Nhân mạch kết nối'] - 1] = clean_(b.refName, 120);
    row[COL['SĐT nhân mạch'] - 1] = /^0\d{9}$/.test(b.refPhone || '') ? "'" + b.refPhone : '';
    row[COL['Nội dung chuyển khoản'] - 1] = clean_(b.transferNote, 80);
    row[COL['Nguồn'] - 1] = clean_(b.source, 300);
    row[COL['Trạng thái'] - 1] = waitlist ? ST_NEXT : ST_WAIT;
    for (var i = 0; i < HEADERS.length; i++) if (row[i] === undefined) row[i] = '';
    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  if (SEND_REGISTER_EMAIL && !waitlist) sendRegister_(b, course);
  return json_({ ok: true });
}

// ---------- Khách bấm "Tôi đã chuyển khoản": báo Hà 1 lần duy nhất ----------
// Chỉ nhận khi mã đơn + Gmail khớp một dòng đang "Chờ thanh toán" và cột "Báo đã chuyển khoản" còn trống.
function handleNotify_(b) {
  var orderId = String(b.orderId || '').trim(), email = String(b.email || '').trim().toLowerCase();
  if (!orderId || !email) return json_({ ok: false, error: 'missing' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(), n = sh.getLastRow() - 1;
    if (n < 1) return json_({ ok: false, error: 'not found' });
    var data = sh.getRange(2, 1, n, HEADERS.length).getValues();
    for (var i = n - 1; i >= 0; i--) {
      var r = data[i];
      if (String(r[COL['Mã đơn'] - 1]) !== orderId) continue;
      if (String(r[COL['Gmail'] - 1]).trim().toLowerCase() !== email) return json_({ ok: false, error: 'not found' });
      if (r[COL['Trạng thái'] - 1] !== ST_WAIT) return json_({ ok: true, status: r[COL['Trạng thái'] - 1] });
      if (r[COL['Báo đã chuyển khoản'] - 1]) return json_({ ok: true, repeat: true });
      var rowNo = i + 2;
      sh.getRange(rowNo, COL['Báo đã chuyển khoản']).setValue(new Date());
      SpreadsheetApp.flush();
      sendNotifyHa_(r, rowNo, sh.getSheetId());
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'not found' });
  } finally {
    lock.releaseLock();
  }
}

function sendNotifyHa_(r, rowNo, gid) {
  function v(h) { return esc_(r[COL[h] - 1]); }
  var name = String(r[COL['Họ và tên'] - 1] || ''), order = String(r[COL['Mã đơn'] - 1] || '');
  var amount = money_(Number(r[COL['Học phí'] - 1]) || 0);
  var link = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit#gid=' + gid + '&range=A' + rowNo;
  var row = function (k, val) { return '<tr><td style="color:#6b7280;padding:4px 12px 4px 0;vertical-align:top">' + k + '</td><td><b>' + (val || '—') + '</b></td></tr>'; };
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:600px">'
    + '<p>Học viên vừa báo <b>đã chuyển khoản</b> khoá <b>' + v('Khoá học') + '</b>.</p>'
    + '<table style="border-collapse:collapse">'
    + row('Họ và tên', v('Họ và tên'))
    + row('SĐT Zalo', String(r[COL['Số điện thoại'] - 1]).replace(/\D/g, ''))
    + row('Gmail', v('Gmail'))
    + row('Ngày sinh', v('Ngày sinh'))
    + row('Số tiền cần nhận', esc_(amount))
    + row('Nội dung chuyển khoản', v('Nội dung chuyển khoản'))
    + row('Mã đơn', esc_(order) + ' · dòng ' + rowNo)
    + row('Mong muốn', v('Mong muốn'))
    + row('Thách thức', v('Thách thức'))
    + row('Nhân mạch', [v('Nhân mạch kết nối'), String(r[COL['SĐT nhân mạch'] - 1] || '').replace(/\D/g, '')].filter(String).join(' · '))
    + '</table>'
    + '<p style="margin-top:18px"><b>Việc của Hà:</b> mở app VietinBank đối chiếu. Đã nhận đủ thì mở Sheet, dòng của học viên, '
    + 'đổi cột <b>Trạng thái</b> thành <b>"Đã thanh toán"</b>. Máy tự gửi email xác nhận cho học viên.</p>'
    + '<p><a href="' + link + '" style="' + BTN_ + '">📄 Mở Sheet đăng ký</a></p>'
    + '<p style="font-size:13px;color:#6b7280">Sau khi đổi, cột "Email xác nhận" hiện "Đã gửi …" là xong. Hiện chữ khác thì chọn lại "Đã thanh toán" để máy thử lại.</p>'
    + '</div>';
  try {
    MailApp.sendEmail({ to: NOTIFY_TO, subject: '💰 Cần xác nhận học phí: ' + name + ' · ' + amount + ' · ' + order,
      htmlBody: html, name: 'WI.FINANCE · Landing 21 ngày' });
  } catch (err) {
    console.error(err);
  }
}

function sendRegister_(b, course) {
  var vars = {
    '{HoTen}': b.fullname, '{KhoaHoc}': course.name, '{MaDon}': b.orderId, '{SoTien}': money_(course.price),
    '{NoiDung}': b.transferNote, '{NganHang}': BANK.name, '{SoTaiKhoan}': BANK.account, '{ChuTaiKhoan}': BANK.holder
  };
  function fill(s) { Object.keys(vars).forEach(function (k) { s = s.split(k).join(String(vars[k] == null ? '' : vars[k])); }); return s; }
  try {
    MailApp.sendEmail({ to: b.email, subject: fill(REGISTER_EMAIL.subject), htmlBody: fill(REGISTER_EMAIL.html), name: SENDER_NAME, replyTo: REPLY_TO });
  } catch (err) {
    console.error(err);
  }
}

// Chuẩn hoá giao dịch từ SePay (1 giao dịch) hoặc Casso ({ data: [...] }).
function transactions_(b) {
  if (b && b.data && b.data.length) {
    return b.data.map(function (t) {
      return { id: 'casso-' + (t.id || t.tid), amount: Number(t.amount), content: String(t.description || ''), time: t.when || '' };
    });
  }
  if (b && (b.transferAmount !== undefined || b.content !== undefined)) {
    if (b.transferType && b.transferType !== 'in') return [];
    return [{ id: 'sepay-' + (b.id || b.referenceCode), amount: Number(b.transferAmount), content: String(b.content || b.description || ''), time: b.transactionDate || '' }];
  }
  return [];
}

function handlePayment_(b) {
  var txs = transactions_(b);
  if (!txs.length) return json_({ success: true, matched: 0 });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var matched = 0;
  try {
    var sh = sheet_();
    var n = sh.getLastRow() - 1;
    if (n < 1) return json_({ success: true, matched: 0 });
    var data = sh.getRange(2, 1, n, HEADERS.length).getValues();

    txs.forEach(function (tx) {
      if (!(tx.amount > 0)) return;
      // Bỏ qua giao dịch đã xử lý (webhook gửi lại nhiều lần).
      for (var k = 0; k < n; k++) if (String(data[k][COL['Mã giao dịch'] - 1]) === tx.id) return;

      var text = tx.content.toUpperCase().replace(/\s+/g, ' ');
      var digits = tx.content.replace(/\D/g, '');
      var code = /WIF\s?21/.test(text) ? 'WIF21' : (/WIF\s?0?2(?!\d)/.test(text) ? 'WIF02' : null);
      if (!code) return;

      // Tìm đơn mới nhất đang chờ, cùng mã khoá và có số điện thoại nằm trong nội dung chuyển khoản.
      for (var i = n - 1; i >= 0; i--) {
        var r = data[i];
        var phone = String(r[COL['Số điện thoại'] - 1]).replace(/\D/g, '');
        if (r[COL['Mã khoá'] - 1] !== code || r[COL['Trạng thái'] - 1] !== ST_WAIT) continue;
        if (phone.length < 9 || digits.indexOf(phone.slice(-9)) === -1) continue;

        var rowNo = i + 2, price = Number(r[COL['Học phí'] - 1]);
        var paid = tx.amount >= price;
        sh.getRange(rowNo, COL['Trạng thái']).setValue(paid ? ST_PAID : ST_SHORT);
        sh.getRange(rowNo, COL['Thời gian thanh toán']).setValue(new Date());
        sh.getRange(rowNo, COL['Số tiền nhận']).setValue(tx.amount);
        sh.getRange(rowNo, COL['Mã giao dịch']).setValue(tx.id);
        data[i][COL['Trạng thái'] - 1] = paid ? ST_PAID : ST_SHORT;
        data[i][COL['Mã giao dịch'] - 1] = tx.id;
        if (paid) {
          sh.getRange(rowNo, COL['Email xác nhận']).setValue(sendConfirm_(r, code, tx.amount));
        }
        CacheService.getScriptCache().remove('seats');
        matched++;
        break;
      }
    });
  } finally {
    lock.releaseLock();
  }
  return json_({ success: true, matched: matched });
}

function esc_(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Gửi email xác nhận, trả về chữ ghi vào cột "Email xác nhận".
function sendConfirm_(r, code, amount, xemThu) {
  var tpl = EMAILS[code];
  if (!tpl) return 'Không có mẫu email cho mã ' + code;
  var to = String(r[COL['Gmail'] - 1]).trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return 'Gmail không hợp lệ, chưa gửi';
  var zoomLink = ZOOM.link;
  if (code === 'WIF21' && xemThu) {
    zoomLink = 'https://zoom.us/'; // xem thử: không cấp quyền, không tạo link Zoom
  } else if (code === 'WIF21') {
    // Cấp quyền app + lấy link Zoom riêng. Lỗi thì KHÔNG gửi mail (tránh gửi link chung), chọn lại "Đã thanh toán" để thử lại.
    var cap = capQuyen_(r, to);
    if (!cap.ok) return 'Lỗi cấp quyền app, chưa gửi: ' + cap.error;
    if (cap.zoom_join_url) zoomLink = cap.zoom_join_url;
    else return 'Chưa có link Zoom riêng (' + (cap.zoom_error || 'chưa cài Zoom') + '), đã cấp quyền app, chưa gửi mail';
  }
  var info = (ZOOM.meetingId ? '<p style="margin:0 0 4px">Meeting ID: <b>' + esc_(ZOOM.meetingId) + '</b></p>' : '')
           + (ZOOM.passcode ? '<p style="margin:0 0 4px">Mật khẩu: <b>' + esc_(ZOOM.passcode) + '</b></p>' : '');
  var vars = {
    '{HoTen}': esc_(r[COL['Họ và tên'] - 1]), '{KhoaHoc}': esc_(r[COL['Khoá học'] - 1]), '{SoTien}': money_(amount),
    '{MaDon}': esc_(r[COL['Mã đơn'] - 1]), '{Gmail}': esc_(to), '{SDT}': String(r[COL['Số điện thoại'] - 1]).replace(/\D/g, ''),
    '{LichHoc}': esc_(ZOOM.schedule || 'Hà sẽ gửi lịch cụ thể qua Zalo'), '{ZoomLink}': esc_(zoomLink), '{ZoomInfo}': info,
    '{AppLink}': esc_(APP.url)
  };
  function fill(s) { Object.keys(vars).forEach(function (k) { s = s.split(k).join(vars[k]); }); return s; }
  try {
    MailApp.sendEmail({ to: to, subject: (xemThu ? '[XEM THỬ] ' : '') + fill(tpl.subject).replace(/&amp;/g, '&'), htmlBody: fill(tpl.html), name: SENDER_NAME, replyTo: REPLY_TO });
    return 'Đã gửi ' + new Date().toLocaleString('vi-VN');
  } catch (err) {
    console.error(err);
    return 'Lỗi gửi email';
  }
}

// Gọi cổng cấp quyền của app. Gọi lại cùng mã đơn không cấp hai lần, chỉ trả lại link đã có.
function capQuyen_(r, email) {
  var secret = PropertiesService.getScriptProperties().getProperty('CAP_QUYEN_SECRET');
  if (!secret) return { ok: false, error: 'chưa cài CAP_QUYEN_SECRET' };
  try {
    var res = UrlFetchApp.fetch(APP.capQuyenUrl, {
      method: 'post', contentType: 'application/json; charset=utf-8', muteHttpExceptions: true,
      headers: { 'x-wif-secret': secret },
      payload: JSON.stringify({
        email: email, full_name: String(r[COL['Họ và tên'] - 1] || '').trim(), order_id: String(r[COL['Mã đơn'] - 1] || '').trim(),
        days: APP.days, cohort_code: APP.cohortCode, zoom_meeting_id: APP.zoomMeetingId || undefined
      })
    });
    var body = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() !== 200 || !body.ok) return { ok: false, error: body.error || ('mã ' + res.getResponseCode()) };
    return body;
  } catch (err) {
    console.error(err);
    return { ok: false, error: String(err).slice(0, 120) };
  }
}

// ---------- Cách B: đổi Trạng thái trên Sheet thành "Đã thanh toán" thì tự gửi email ----------
// Chạy hàm này MỘT LẦN trong trình soạn Apps Script để bật tính năng (Google sẽ hỏi cấp quyền).
function caiDatGuiEmailTheoSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onStatusEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(ss).onEdit().create();
  // Ô Trạng thái thành danh sách chọn, tránh gõ sai chữ.
  var sh = sheet_();
  var rule = SpreadsheetApp.newDataValidation().requireValueInList([ST_WAIT, ST_PAID, ST_SHORT, ST_NEXT, ST_CANCEL], true).setAllowInvalid(true).build();
  sh.getRange(2, COL['Trạng thái'], sh.getMaxRows() - 1, 1).setDataValidation(rule);
  console.log('Đã bật: đổi Trạng thái thành "' + ST_PAID + '" sẽ tự gửi email xác nhận.');
}

function onStatusEdit(e) {
  var rg = e && e.range;
  if (!rg) return;
  var sh = rg.getSheet();
  if (sh.getName() !== SHEET_NAME) return;
  var c = COL['Trạng thái'];
  if (rg.getColumn() > c || rg.getLastColumn() < c || rg.getLastRow() < 2) return;
  CacheService.getScriptCache().remove('seats'); // Số suất còn lại cập nhật ngay

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var first = Math.max(rg.getRow(), 2), count = rg.getLastRow() - first + 1;
    var data = sh.getRange(first, 1, count, HEADERS.length).getValues();
    data.forEach(function (r, i) {
      if (r[c - 1] !== ST_PAID || String(r[COL['Email xác nhận'] - 1]).indexOf('Đã gửi') === 0) return;
      var rowNo = first + i;
      var code = String(r[COL['Mã khoá'] - 1]);
      var amount = Number(r[COL['Số tiền nhận'] - 1]) || Number(r[COL['Học phí'] - 1]);
      if (!r[COL['Thời gian thanh toán'] - 1]) sh.getRange(rowNo, COL['Thời gian thanh toán']).setValue(new Date());
      if (!r[COL['Số tiền nhận'] - 1]) sh.getRange(rowNo, COL['Số tiền nhận']).setValue(amount);
      if (!r[COL['Mã giao dịch'] - 1]) sh.getRange(rowNo, COL['Mã giao dịch']).setValue('Xác nhận tay');
      sh.getRange(rowNo, COL['Email xác nhận']).setValue(sendConfirm_(r, code, amount));
    });
  } finally {
    lock.releaseLock();
  }
}

// Gửi thử email xác nhận khoá 21 ngày về chính Gmail đang mở trình soạn, không ghi gì vào Sheet.
function thuGuiEmailXacNhan() {
  var r = [];
  r[COL['Họ và tên'] - 1] = 'Học Viên Thử';
  r[COL['Khoá học'] - 1] = COURSES.WIF21.name;
  r[COL['Mã đơn'] - 1] = 'TEST-' + Date.now();
  r[COL['Gmail'] - 1] = Session.getActiveUser().getEmail();
  r[COL['Số điện thoại'] - 1] = '0900000000';
  console.log(sendConfirm_(r, 'WIF21', COURSES.WIF21.price));
}

// Kiểm cổng cấp quyền mà không gửi mail: cấp quyền + link Zoom riêng cho Gmail đang mở trình soạn.
function thuCapQuyenApp() {
  var r = [];
  r[COL['Họ và tên'] - 1] = 'Học Viên Thử';
  r[COL['Mã đơn'] - 1] = 'TEST-CAP-QUYEN';
  console.log(JSON.stringify(capQuyen_(r, Session.getActiveUser().getEmail())));
}

// Gửi thử mail xác nhận khoá 21 ngày về Gmail của mình (không cấp quyền app, không tạo link Zoom, không ghi Sheet).
function thuMailXacNhan21() {
  var r = [];
  r[COL['Họ và tên'] - 1] = 'Học Viên Thử';
  r[COL['Khoá học'] - 1] = 'Bản Đồ Dòng Tiền 21 ngày';
  r[COL['Mã đơn'] - 1] = 'XEM-THU';
  r[COL['Gmail'] - 1] = Session.getActiveUser().getEmail();
  r[COL['Số điện thoại'] - 1] = '';
  console.log(sendConfirm_(r, 'WIF21', 2499000, true));
}

// Chạy thử trong trình soạn Apps Script: tạo 1 đơn mẫu rồi giả lập thanh toán SePay.
function testFlow() {
  handleRegister_({ code: 'WIF02', orderId: 'TEST-' + Date.now(), fullname: 'Hoc Vien Thu', phone: '0900000000',
    email: Session.getActiveUser().getEmail(), transferNote: 'WIF02 HOC VIEN THU 0900000000', source: 'test' });
  var res = handlePayment_({ id: 'TEST' + Date.now(), transferType: 'in', transferAmount: 199000, content: 'WIF02 HOC VIEN THU 0900000000' });
  console.log(res.getContent());
}

// Bản bán tự động · 18/11/2026
