// Chuyển mọi truy cập vào *.pages.dev sang tên miền chính, giữ nguyên đường dẫn và tham số.
const MAIN_HOST = 'bandotaichinh.wifinance.com.vn';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname.endsWith('.pages.dev')) {
    url.protocol = 'https:';
    url.hostname = MAIN_HOST;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
