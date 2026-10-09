// Chuyển mọi truy cập vào *.pages.dev sang tên miền chính, giữ nguyên đường dẫn và tham số.
// Đồng thời bắt trình duyệt kiểm tra lại file .js mỗi lần, tránh chạy script cũ sau khi sửa.
const MAIN_HOST = 'bandotaichinh.wifinance.com.vn';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname.endsWith('.pages.dev')) {
    url.protocol = 'https:';
    url.hostname = MAIN_HOST;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  const res = await context.next();
  if (url.pathname.endsWith('.js')) {
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return out;
  }
  return res;
}
