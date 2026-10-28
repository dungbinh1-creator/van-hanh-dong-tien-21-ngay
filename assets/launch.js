/* Lớp khai giảng: đồng hồ đếm ngược, số suất ưu đãi còn lại, đổi giá khi hết suất, đóng đăng ký sau giờ khai giảng, nút thêm vào lịch. */
(function () {
  var C = window.WIF_CONFIG, L = C && C.launch;
  if (!L) return;
  var start = new Date(L.start).getTime();
  var course = C.courses[L.course], earlyPrice = course.price;
  var seatsLeft = null, applied = null, tickTimer = null;

  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function vnd(n) { return n.toLocaleString('vi-VN').replace(/,/g, '.') + 'đ'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function setText(sel, v) { $$(sel).forEach(function (el) { el.textContent = v; }); }
  function setHidden(sel, h) { $$(sel).forEach(function (el) { el.hidden = h; }); }

  // Xem thử trên máy: ?xem=con-suat, ?xem=het-suat hoặc ?xem=da-khai-giang (chỉ chạy ở localhost)
  var preview = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? new URLSearchParams(location.search).get('xem') : null;
  function now() { return preview === 'da-khai-giang' ? start + 1000 : Date.now(); }
  if (preview === 'het-suat') seatsLeft = 0;
  if (preview === 'con-suat') seatsLeft = 12;

  function state() {
    if (now() >= start) return 'closed';
    return seatsLeft === 0 ? 'full' : 'early';
  }

  /* ---------- Nhãn nút đăng ký ---------- */
  function label(a, st) {
    var t = null;
    for (var i = 0; i < a.childNodes.length; i++) if (a.childNodes[i].nodeType === 3 && a.childNodes[i].nodeValue.trim()) { t = a.childNodes[i]; break; }
    if (!t) return;
    if (a.dataset.label == null) a.dataset.label = t.nodeValue;
    var base = a.dataset.label, tail = base.match(/\s*$/)[0], txt = base.trim();
    if (st === 'closed') txt = a.classList.contains('btn-lg') ? 'Đăng ký chờ lớp sau' : 'Đăng ký lớp sau';
    else if (st === 'full') txt = txt.replace('giá ưu đãi', 'tham gia');
    t.nodeValue = txt + tail;
  }

  /* ---------- Áp trạng thái lên trang ---------- */
  function apply() {
    var st = state();
    var known = seatsLeft !== null;
    setText('[data-seats-left]', known ? seatsLeft : L.earlySeats);
    setHidden('[data-seats-line]', !(known && st === 'early'));
    setText('[data-seats-text]', st === 'full' ? 'Đã hết ' + L.earlySeats + ' suất ưu đãi'
      : known ? 'Còn ' + seatsLeft + '/' + L.earlySeats + ' suất giá ưu đãi' : 'Cho ' + L.earlySeats + ' suất đầu tiên');
    var short = st === 'full' ? 'Học phí ' + vnd(L.fullPrice) : (known && st === 'early' ? 'Còn ' + seatsLeft + '/' + L.earlySeats + ' suất ưu đãi' : '');
    setText('[data-seats-short]', short);
    setHidden('[data-seats-short]', !short || st === 'closed');

    if (st === applied) return;
    applied = st;
    C.state = st;
    course.price = st === 'full' ? L.fullPrice : earlyPrice;

    setText('[data-l-amount]', vnd(course.price));
    setText('[data-l-plabel]', st === 'early' ? 'Giá ưu đãi' : 'Học phí');
    setHidden('[data-l-was]', st !== 'early');
    setHidden('[data-l-early]', st !== 'early');
    setHidden('[data-l-full]', st !== 'full');
    setHidden('[data-l-closed]', st !== 'closed');
    setHidden('[data-l-price], [data-l-perks], [data-l-open]', st === 'closed');
    setHidden('[data-cd-label], .cd-clock', st === 'closed');
    setHidden('[data-cd-closed]', st !== 'closed');
    $$('[data-course="' + L.course + '"]').forEach(function (a) { label(a, st); });

    // Form đăng ký
    var closed = st === 'closed';
    setText('#reg-title', closed ? 'Đăng ký chờ lớp sau' : 'Đăng ký tham gia');
    setText('#reg-sub', closed ? 'Lớp khai giảng 23/11/2026 đã bắt đầu. Bạn để lại thông tin để được báo lịch lớp tiếp theo.'
      : 'Điền thông tin bên dưới. Sau khi gửi, mã VietQR thanh toán sẽ hiện ngay. Khai giảng 20h thứ Hai 23/11/2026.');
    setHidden('#reg-opts, #reg-total, .reg-dots', closed);
    setText('#reg-submit', closed ? 'Gửi thông tin' : 'Gửi thông tin và nhận mã QR');
    var price = document.getElementById('reg-price');
    if (price) price.textContent = course.price.toLocaleString('vi-VN').replace(/,/g, '.') + ' VND';

    setText('[data-lbar-t]', closed ? 'Đã khai giảng 23/11' : 'Khai giảng 20h 23/11 sau');
    if (closed) setText('[data-lbar-c]', 'Nhận lịch lớp sau');
  }

  /* ---------- Đồng hồ ---------- */
  function tick() {
    var left = Math.max(0, start - now());
    var d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
    setText('[data-cd-d]', pad(d)); setText('[data-cd-h]', pad(h)); setText('[data-cd-m]', pad(m)); setText('[data-cd-s]', pad(s));
    if (left > 0) setText('[data-lbar-c]', d + ' ngày ' + pad(h) + ':' + pad(m) + ':' + pad(s));
    if (left <= 0) { clearInterval(tickTimer); apply(); }
  }

  /* ---------- Số suất còn lại (đếm đơn Đã thanh toán trên Sheet) ---------- */
  function loadSeats() {
    if (preview || !C.appsScriptUrl || state() === 'closed') return;
    fetch(C.appsScriptUrl + '?action=seats')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || typeof d.left !== 'number') return; // Apps Script chưa có bản mới thì giữ chữ mặc định
        seatsLeft = Math.max(0, Math.min(L.earlySeats, d.left));
        apply();
      })
      .catch(function () {});
  }

  /* ---------- Thanh dính dưới màn hình ---------- */
  function initBar() {
    var bar = document.querySelector('[data-lbar]'), hero = document.querySelector('.hero');
    if (!bar || !hero || !('IntersectionObserver' in window)) return;
    var btn = bar.querySelector('a');
    new IntersectionObserver(function (es) {
      var show = !es[0].isIntersecting;
      bar.classList.toggle('show', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
      btn.tabIndex = show ? 0 : -1;
      document.documentElement.classList.toggle('has-lbar', show);
    }, { rootMargin: '0px 0px -40% 0px' }).observe(hero);
  }

  /* ---------- Thêm vào lịch ---------- */
  function initCalendar() {
    var cal = L.calendar, site = 'https://bandotaichinh.wifinance.com.vn/';
    var details = 'Link Zoom có trong email xác nhận gửi về Gmail của bạn. Hỗ trợ: Hotline 0948387418';
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WI.FINANCE//Ban Do Tai Chinh//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:wif21-' + cal.startUtc + '@wifinance.com.vn', 'DTSTAMP:' + stamp,
      'DTSTART:' + cal.startUtc, 'DTEND:' + cal.endUtc, 'RRULE:' + cal.rrule,
      'SUMMARY:' + cal.title, 'DESCRIPTION:' + details, 'URL:' + site,
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Sắp vào lớp Bản Đồ Tài Chính', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    $$('[data-ics]').forEach(function (a) {
      a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      a.download = 'lich-hoc-ban-do-tai-chinh.ics';
    });
    var g = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent(cal.title)
      + '&dates=' + cal.startUtc + '/' + cal.endUtc
      + '&details=' + encodeURIComponent(details + '\n' + site)
      + '&recur=' + encodeURIComponent('RRULE:' + cal.rrule)
      + '&ctz=Asia/Ho_Chi_Minh';
    $$('[data-gcal]').forEach(function (a) { a.href = g; });
  }

  apply();
  tick();
  if (state() !== 'closed') tickTimer = setInterval(tick, 1000);
  loadSeats();
  setInterval(loadSeats, 60000);
  initBar();
  initCalendar();
})();
