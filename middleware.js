import { NextResponse } from 'next/server';

export async function middleware(request) {
  const authCookie = request.cookies.get('auth')?.value;
  const { pathname } = request.nextUrl;

  // 白名单路径直接放行
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // 只判断 cookie 是否存在，具体有效性（管理员/临时密码、是否过期/吊销）交给 /api/data 校验
  // 原因：middleware 里拿不到 Cloudflare Pages 的运行时 env 和 DB 绑定
  if (authCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // 排除 API、静态资源，让 API 自己内部鉴权
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};