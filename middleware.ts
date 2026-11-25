import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, isAdminConfigured, verifySession } from '@/lib/admin/auth';
import { PLAYBOOK_LIVE } from '@/lib/playbook/live';
import { hostRoute, pravixUpstreamUrl } from '@/lib/hosts';

/**
 * Five jobs, scoped by `matcher` so the rest of the site never runs this:
 *
 * P. Pravix on the app host (lib/hosts.ts pravixUpstreamUrl): once
 *    NEXT_PUBLIC_PRAVIX_IN_APP=1, /pravix and below are served from Pravix's
 *    own deployment (PRAVIX_UPSTREAM), path unchanged, telling it which host
 *    the browser is on. On www /pravix never runs this: it's the site's page.
 *
 * H. The two hosts (lib/hosts.ts hostRoute, docs/app-subdomain-plan.md). On
 *    the app host: app pages and /pravix pass, `/` shows /home, everything
 *    else goes to the site. On the site, once NEXT_PUBLIC_APP_ORIGIN is set,
 *    app pages go to the app. Checked first; inert until the split is on,
 *    apart from the app host always sending site pages to the site.
 *
 * 0. While PLAYBOOK_LIVE (lib/playbook/live.ts) is false, /playbook and
 *    /api/playbook answer 404.
 * 1. /blog URLs end in a slash. They are Ghost's URLs, already indexed with
 *    it, so /blog/some-post 301s to /blog/some-post/ in one hop. Done here and
 *    not in next.config: a config redirect from '/blog/:path' also matches the
 *    slash form (path-to-regexp is lenient about it), which loops. Files
 *    (/blog/sitemap.xml) are left alone.
 * 2. Gate for the content editor. Everything under /admin and /api/admin needs
 *    a valid session cookie, apart from the login page and the login endpoint
 *    that hand one out.
 */

const PUBLIC_PATHS = ['/admin/login', '/api/admin/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The query from the raw URL, never request.nextUrl: Next rewrites any
  // loopback host in the URL to "localhost", query included, which turned an
  // MCP client's redirect_uri=http://127.0.0.1:… into one it never registered.
  // request.url is the raw URL because next.config sets skipMiddlewareUrlNormalize.
  const { search } = new URL(request.url);
  const host = request.headers.get('host');

  const pravix = pravixUpstreamUrl(host, pathname, search, {
    on: process.env.NEXT_PUBLIC_PRAVIX_IN_APP === '1',
    upstream: process.env.PRAVIX_UPSTREAM,
  });
  if (pravix) {
    // Pravix builds its return URLs (Stripe, OAuth) from the host the browser
    // is on, not its own. x-datalyze-app-host is the same value under a name
    // the platform won't rewrite on the way out.
    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', host ?? '');
    headers.set('x-forwarded-proto', 'https');
    headers.set('x-datalyze-app-host', host ?? '');
    return NextResponse.rewrite(pravix, { request: { headers } });
  }

  const route = hostRoute(host, pathname, search);
  if (route.kind === 'redirect') return NextResponse.redirect(route.url, route.status);
  if (route.kind === 'rewrite') {
    const to = request.nextUrl.clone();
    to.pathname = route.pathname;
    return NextResponse.rewrite(to);
  }
  // An app page on either host: nothing else here applies to it.
  if (route.noindex || !/^\/(playbook|blog|admin|api\/(admin|playbook))(\/|$)/.test(pathname)) return NextResponse.next();

  // The playbook is hidden until PLAYBOOK_LIVE: rewriting to a route that
  // doesn't exist renders the site's not-found page with a 404.
  if (pathname === '/playbook' || pathname.startsWith('/playbook/') || pathname.startsWith('/api/playbook/')) {
    if (PLAYBOOK_LIVE) return NextResponse.next();
    const missing = request.nextUrl.clone();
    missing.pathname = '/playbook-unavailable';
    return NextResponse.rewrite(missing, { status: 404 });
  }

  if (pathname === '/blog' || pathname.startsWith('/blog/')) {
    if (pathname.endsWith('/') || /\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();
    // A plain URL, not request.nextUrl: NextURL strips a trailing slash on the
    // way out (trailingSlash is off), which would redirect to itself forever.
    const url = new URL(request.url);
    url.pathname = `${pathname}/`;
    return NextResponse.redirect(url.toString(), 301);
  }

  // Without a password set there is no way to authenticate, so refuse rather
  // than expose an unprotected editor.
  if (!isAdminConfigured()) {
    return new NextResponse(
      'The content editor is not configured. Set ADMIN_PASSWORD to enable it.',
      { status: 503, headers: { 'content-type': 'text/plain' } },
    );
  }

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  if (await verifySession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = '/admin/login';
  login.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(login);
}

// A matcher must be literal (Next reads it at build), so the hosts are written
// out here. Keep them in step with APP_HOSTNAMES in lib/hosts.ts.
// - App hosts: every page except /api, /mp, /.well-known, /_next, /_vercel,
//   /pravix (Pravix's own app) and files, which both hosts serve as they are.
// - Site hosts: only the app pages, so marketing pages never run this.
export const config = {
  matcher: [
    { source: '/((?!(?:api|_next|mp|\\.well-known|_vercel|pravix)(?:/|$))(?!.*\\.[A-Za-z0-9]+$).*)', has: [{ type: 'host', value: 'app.joindatalyze.com' }] },
    { source: '/((?!(?:api|_next|mp|\\.well-known|_vercel|pravix)(?:/|$))(?!.*\\.[A-Za-z0-9]+$).*)', has: [{ type: 'host', value: 'app-staging.joindatalyze.com' }] },
    { source: '/((?!(?:api|_next|mp|\\.well-known|_vercel|pravix)(?:/|$))(?!.*\\.[A-Za-z0-9]+$).*)', has: [{ type: 'host', value: 'app.localhost' }] },
    // Pravix (job P), app hosts only: files and all, since the whole path is Pravix's.
    { source: '/pravix/:path*', has: [{ type: 'host', value: 'app.joindatalyze.com' }] },
    { source: '/pravix/:path*', has: [{ type: 'host', value: 'app-staging.joindatalyze.com' }] },
    { source: '/pravix/:path*', has: [{ type: 'host', value: 'app.localhost' }] },
    '/account',
    '/account/:path*',
    '/home',
    '/welcome',
    '/billing',
    '/profile',
    '/mcp/:sub(login|signup|authorize|dashboard|billing|usage|profile)/:rest*',
    '/tracking-agent/:sub(dashboard|audits|review|start|setup|github|plan|verify)/:rest*',
    '/blog',
    '/blog/:path*',
    '/admin/:path*',
    '/api/admin/:path*',
    '/playbook',
    '/playbook/:path*',
    '/api/playbook/:path*',
  ],
};
