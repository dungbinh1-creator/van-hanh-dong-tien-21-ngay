/* Đăng ký trên trang: form → lưu Google Sheet (qua Apps Script) → VietQR → chờ xác nhận thanh toán. */
window.WIF_CONFIG = {
  // Dán URL Web App của Google Apps Script (kết thúc bằng /exec) vào đây sau khi triển khai.
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbx6oOH3D2kSWa1DHiMsxZ3SHL8RcinEYFjqVQxetUHM4P9Xb5MV5fcNV0-GJHpC6_9m/exec',
  bank: {
    bin: '970407',
    short: 'TCB',
    name: 'Techcombank',
    account: '6990066666',
    holder: 'HOANG THU HA'
  },
  courses: {
    '21': { code: 'WIF21', name: 'Bản Đồ Tài Chính', price: 2499000 },
    '2':  { code: 'WIF02', name: 'Kích Hoạt Dòng Tiền', price: 199000 }
  },
  zalo: 'https://zalo.me/g/sk6vnppwxvvmqpdhlngc',
  pollEveryMs: 6000,
  pollForMs: 30 * 60 * 1000
};

(function () {
  var C = window.WIF_CONFIG;
  var modal = document.getElementById('reg');
  if (!modal) return;
  var form = document.getElementById('reg-form');
  var STORE = 'wif_pending_order';
  var pollTimer = null, pollStart = 0, lastFocus = null;

  function $(sel, el) { return (el || modal).querySelector(sel); }
  function money(n) { return n.toLocaleString('vi-VN').replace(/,/g, '.') + ' VND'; }
  function store(key, val) {
    try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
  }
  function phoneDigits(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.indexOf('84') === 0 && d.length === 11) d = '0' + d.slice(2);
    return d;
  }
  function showStep(n) {
    modal.querySelectorAll('.reg-step').forEach(function (s) { s.hidden = s.getAttribute('data-step') !== String(n); });
    modal.querySelectorAll('.reg-dots li').forEach(function (li, i) { li.classList.toggle('on', i < n); });
    $('.reg-panel').scrollTop = 0;
  }

  /* ---------- Mở / đóng ---------- */
  function open(course) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add('reg-lock');
    requestAnimationFrame(function () { modal.classList.add('show'); });
    var pending = store(STORE);
    if (pending && Date.now() - pending.ts < 48 * 3600 * 1000 && (!course || C.courses[course].code === pending.code)) {
      renderPayment(pending);
      return;
    }
    if (course) form.course.value = course;
    syncCourse();
    showStep(1);
    setTimeout(function () { form.fullname.focus(); }, 250);
  }
  function close() {
    modal.classList.remove('show');
    document.documentElement.classList.remove('reg-lock');
    setTimeout(function () { modal.hidden = true; }, 300);
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-course]');
    if (t) { e.preventDefault(); open(t.getAttribute('data-course')); return; }
    if (e.target.closest('[data-reg-close]')) close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });

  /* ---------- Bước 1: form ---------- */
  function syncCourse() {
    var c = C.courses[form.course.value];
    $('#reg-price').textContent = money(c.price);
    $('#reg-cname').textContent = c.name;
  }
  form.addEventListener('change', function (e) { if (e.target.name === 'course') syncCourse(); });

  function setErr(name, msg) {
    var f = form.querySelector('[data-field="' + name + '"]');
    if (!f) return;
    f.classList.toggle('err', !!msg);
    var m = f.querySelector('.msg'); if (m) m.textContent = msg || '';
  }
  function validate() {
    var ok = true;
    var name = form.fullname.value.trim();
    var phone = phoneDigits(form.phone.value);
    var mail = form.email.value.trim().toLowerCase();
    setErr('fullname', name.length >= 2 ? '' : 'Vui lòng nhập họ và tên.'); ok = ok && name.length >= 2;
    var pOk = /^0\d{9}$/.test(phone);
    setErr('phone', pOk ? '' : 'Số điện thoại gồm 10 số, ví dụ 0912345678.'); ok = ok && pOk;
    var mOk = /^[a-z0-9._%+-]+@gmail\.com$/.test(mail);
    setErr('email', mOk ? '' : 'Vui lòng dùng địa chỉ Gmail (kết thúc bằng @gmail.com).'); ok = ok && mOk;
    setErr('consent', form.consent.checked ? '' : 'Vui lòng xác nhận để tiếp tục.'); ok = ok && form.consent.checked;
    return ok;
  }

  function utm() {
    var p = new URLSearchParams(location.search), o = [];
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'].forEach(function (k) { if (p.get(k)) o.push(k + '=' + p.get(k)); });
    return o.join('&') || document.referrer || 'truc tiep';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) { var bad = form.querySelector('.err input, .err textarea'); if (bad) bad.focus(); return; }
    var c = C.courses[form.course.value];
    var name = form.fullname.value.trim().replace(/\s+/g, ' ');
    var phone = phoneDigits(form.phone.value);
    var cleanName = VietQR.cleanText(name).slice(0, 50 - c.code.length - phone.length - 2).trim();
    var order = {
      orderId: c.code + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      code: c.code, course: c.name, price: c.price,
      fullname: name, phone: phone, email: form.email.value.trim().toLowerCase(),
      city: form.city.value.trim(), wish: form.wish.value.trim(),
      transferNote: c.code + ' ' + cleanName + ' ' + phone,
      source: utm(), page: location.href.split('?')[0], ts: Date.now()
    };
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.classList.add('loading');
    $('#reg-send-err').hidden = true;

    send(order).then(function () {
      store(STORE, order);
      renderPayment(order);
    }).catch(function () {
      $('#reg-send-err').hidden = false;
    }).then(function () { btn.disabled = false; btn.classList.remove('loading'); });
  });

  function send(order) {
    if (!C.appsScriptUrl) { console.warn('[WI.FINANCE] Chưa cấu hình appsScriptUrl. Dữ liệu chưa được lưu vào Google Sheet.'); return Promise.resolve(); }
    var body = JSON.stringify(Object.assign({ action: 'register' }, order));
    var timeout = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 15000); });
    // text/plain + no-cors để gửi thẳng tới Apps Script mà không bị chặn CORS.
    return Promise.race([fetch(C.appsScriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body }), timeout]);
  }

  /* ---------- Bước 2: VietQR ---------- */
  function drawQR(text) {
    var qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), cell = 10, pad = 4 * cell, size = n * cell + pad * 2;
    var cv = document.createElement('canvas'); cv.width = cv.height = size;
    var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#0B2A5B';
    for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (qr.isDark(r, col)) g.fillRect(pad + col * cell, pad + r * cell, cell, cell);
    return cv.toDataURL('image/png');
  }
  function renderPayment(o) {
    var payload = VietQR.build({ bin: C.bank.bin, account: C.bank.account, amount: o.price, info: o.transferNote });
    var url = drawQR(payload);
    $('#reg-qr').src = url;
    var dl = $('#reg-qr-save'); dl.href = url; dl.download = 'VietQR-' + o.code + '-' + o.phone + '.png';
    $('#pay-course').textContent = o.course;
    $('#pay-amount').textContent = money(o.price);
    $('#pay-amount-copy').setAttribute('data-copy', String(o.price));
    $('#pay-note').textContent = o.transferNote;
    $('#pay-note-copy').setAttribute('data-copy', o.transferNote);
    $('#pay-email').textContent = o.email;
    $('#done-email').textContent = o.email;
    $('#pay-wait').hidden = !C.appsScriptUrl;
    showStep(2);
    startPolling(o);
  }
  modal.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var v = b.getAttribute('data-copy');
    var done = function () { b.classList.add('ok'); var t = b.textContent; b.textContent = 'Đã chép'; setTimeout(function () { b.textContent = t; b.classList.remove('ok'); }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, function () {});
    else { var ta = document.createElement('textarea'); ta.value = v; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (er) {} ta.remove(); }
  });
  $('#reg-restart').addEventListener('click', function () { stopPolling(); store(STORE, null); syncCourse(); showStep(1); });

  /* ---------- Bước 3: chờ xác nhận ---------- */
  function stopPolling() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null; }
  function startPolling(o) {
    stopPolling();
    if (!C.appsScriptUrl) return;
    pollStart = Date.now();
    (function tick() {
      fetch(C.appsScriptUrl + '?action=status&order=' + encodeURIComponent(o.orderId))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.paid) return;
          stopPolling(); store(STORE, null);
          if (modal.hidden) { modal.hidden = false; document.documentElement.classList.add('reg-lock'); requestAnimationFrame(function () { modal.classList.add('show'); }); }
          showStep(3);
        })
        .catch(function () {})
        .then(function () { if (!$('[data-step="2"]').hidden && Date.now() - pollStart < C.pollForMs) pollTimer = setTimeout(tick, C.pollEveryMs); });
    })();
  }

  $('#reg-zalo').href = C.zalo;
  if (location.hash === '#dang-ky' || location.hash === '#dang-ky-2') open(location.hash === '#dang-ky-2' ? '2' : '21');
})();
