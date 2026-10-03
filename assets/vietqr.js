/* Tạo chuỗi VietQR (chuẩn EMVCo / NAPAS 247) có sẵn số tiền và nội dung chuyển khoản. */
(function (root) {
  function tlv(id, value) {
    var len = String(value.length);
    return id + (len.length < 2 ? '0' + len : len) + value;
  }

  function crc16(str) {
    var crc = 0xFFFF;
    for (var i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /* Bỏ dấu tiếng Việt, chỉ giữ chữ, số và khoảng trắng để ngân hàng đọc đúng nội dung. */
  function cleanText(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[^A-Za-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function build(opts) {
    var bank = tlv('00', opts.bin) + tlv('01', opts.account);
    var merchant = tlv('00', 'A000000727') + tlv('01', bank) + tlv('02', 'QRIBFTTA');
    var hasAmount = opts.amount > 0;
    var p = tlv('00', '01') + tlv('01', hasAmount ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
    if (hasAmount) p += tlv('54', String(Math.round(opts.amount)));
    p += tlv('58', 'VN');
    if (opts.info) p += tlv('62', tlv('08', cleanText(opts.info).slice(0, 50)));
    p += '6304';
    return p + crc16(p);
  }

  var api = { build: build, cleanText: cleanText, crc16: crc16 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VietQR = api;
})(this);
