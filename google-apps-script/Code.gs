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

var SENDER_NAME = 'WI.FINANCE · Coach Hoàng Thu Hà';
// Khách bấm "Trả lời" email sẽ gửi về địa chỉ này.
var REPLY_TO = 'coachmethuha@gmail.com';

// Thông tin nhận tiền, dùng trong email hướng dẫn chuyển khoản.
var BANK = { name: 'Techcombank', account: '6990066666', holder: 'HOANG THU HA' };

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
  WIF21: { name: 'Bản Đồ Tài Chính', price: 2499000 },
  WIF02: { name: 'Kích Hoạt Dòng Tiền',        price: 199000 }
};

// Nội dung email sau khi thanh toán thành công. Bạn thay nội dung thật vào đây.
// Có thể dùng các biến: {HoTen} {KhoaHoc} {SoTien} {MaDon} {Gmail} {SDT}
var EMAILS = {
  WIF21: {
    subject: 'WI.FINANCE · Xác nhận thanh toán khoá {KhoaHoc}',
    html: '<p>Chào {HoTen},</p>'
        + '<p>WI.FINANCE đã nhận học phí <b>{SoTien}</b> cho khoá <b>{KhoaHoc}</b>. Mã đơn của bạn: <b>{MaDon}</b>.</p>'
        + '<p>[NỘI DUNG EMAIL KHOÁ 21 NGÀY SẼ CẬP NHẬT SAU]</p>'
        + '<p>Thân mến,<br>WI.FINANCE · Học Viện Tài Chính Tâm Thức</p>'
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
  'Thời gian thanh toán', 'Số tiền nhận', 'Mã giao dịch', 'Email xác nhận'];
var COL = {}; HEADERS.forEach(function (h, i) { COL[h] = i + 1; });
var ST_WAIT = 'Chờ thanh toán', ST_PAID = 'Đã thanh toán', ST_SHORT = 'Chuyển thiếu, cần kiểm tra';

function sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0B2A5B').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
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
  return json_({ ok: true, service: 'WI.FINANCE registration' });
}

// ---------- POST: đăng ký từ trang web hoặc webhook thanh toán ----------
function doPost(e) {
  var p = (e && e.parameter) || {};
  var body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) {}

  if (p.token !== undefined) {
    if (p.token !== WEBHOOK_TOKEN) return json_({ success: false, error: 'invalid token' });
    return handlePayment_(body);
  }
  if (body.action === 'register') return handleRegister_(body);
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
  try {
    var sh = sheet_();
    var row = [];
    row[COL['Thời gian đăng ký'] - 1] = new Date();
    row[COL['Mã đơn'] - 1] = clean_(b.orderId, 40);
    row[COL['Mã khoá'] - 1] = b.code;
    row[COL['Khoá học'] - 1] = course.name;
    row[COL['Học phí'] - 1] = course.price;
    row[COL['Họ và tên'] - 1] = clean_(b.fullname, 120);
    row[COL['Số điện thoại'] - 1] = "'" + b.phone;
    row[COL['Gmail'] - 1] = clean_(b.email, 120);
    row[COL['Tỉnh/thành'] - 1] = clean_(b.city, 80);
    row[COL['Mong muốn'] - 1] = clean_(b.wish, 1000);
    row[COL['Nội dung chuyển khoản'] - 1] = clean_(b.transferNote, 80);
    row[COL['Nguồn'] - 1] = clean_(b.source, 300);
    row[COL['Trạng thái'] - 1] = ST_WAIT;
    for (var i = 0; i < HEADERS.length; i++) if (row[i] === undefined) row[i] = '';
    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  if (SEND_REGISTER_EMAIL) sendRegister_(b, course);
  return json_({ ok: true });
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
          sh.getRange(rowNo, COL['Email xác nhận']).setValue(sendConfirm_(r, code, tx.amount) ? 'Đã gửi ' + new Date().toLocaleString('vi-VN') : 'Lỗi gửi email');
        }
        matched++;
        break;
      }
    });
  } finally {
    lock.releaseLock();
  }
  return json_({ success: true, matched: matched });
}

function sendConfirm_(r, code, amount) {
  var tpl = EMAILS[code];
  var vars = {
    '{HoTen}': r[COL['Họ và tên'] - 1], '{KhoaHoc}': r[COL['Khoá học'] - 1], '{SoTien}': money_(amount),
    '{MaDon}': r[COL['Mã đơn'] - 1], '{Gmail}': r[COL['Gmail'] - 1], '{SDT}': String(r[COL['Số điện thoại'] - 1]).replace(/\D/g, '')
  };
  function fill(s) { Object.keys(vars).forEach(function (k) { s = s.split(k).join(vars[k]); }); return s; }
  try {
    MailApp.sendEmail({ to: vars['{Gmail}'], subject: fill(tpl.subject), htmlBody: fill(tpl.html), name: SENDER_NAME, replyTo: REPLY_TO });
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// Chạy thử trong trình soạn Apps Script: tạo 1 đơn mẫu rồi giả lập thanh toán SePay.
function testFlow() {
  handleRegister_({ code: 'WIF02', orderId: 'TEST-' + Date.now(), fullname: 'Hoc Vien Thu', phone: '0900000000',
    email: Session.getActiveUser().getEmail(), transferNote: 'WIF02 HOC VIEN THU 0900000000', source: 'test' });
  var res = handlePayment_({ id: 'TEST' + Date.now(), transferType: 'in', transferAmount: 199000, content: 'WIF02 HOC VIEN THU 0900000000' });
  console.log(res.getContent());
}
