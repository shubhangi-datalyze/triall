import type { NextConfig } from 'next';
import { PLAYBOOK_REDIRECTS } from './lib/playbook/redirects';

// Ghost posts retired in favour of another page. Used twice in redirects():
// on www (/blog/<slug>) and on the old blog.joindatalyze.com host, so an old
// link reaches the final page in one hop. Sources carry no trailing slash:
// path-to-regexp matches both forms.
const RETIRED_BLOG_POSTS = [
  // Older posts retired in favour of a newer page on the same topic.
  { from: '/blog/overview-of-the-insights-report', to: '/blog/week-11-learning-mixpanel-insights/' },
  { from: '/blog/getting-start-with-mixpanel-the-basics', to: '/blog/week-1-learning-mixpanel-introduction/' },
  { from: '/blog/transforming-analytics-from-a-support', to: '/playbook/product-analyst-mindset' },
  // Merged into the page that replaced each one (seo-duplicate-audit.md §1),
  // with their unique content moved into the destination first.
  { from: '/blog/data-tracking-comparing-client-vs', to: '/resources/client-vs-proxy-vs-server-tracking' },
  { from: '/blog/mixpanel-setup-the-right-way', to: '/blog/how-to-set-up-product-analytics-the-right-way/' },
  { from: '/blog/developers-guide-to-implementing', to: '/blog/week-8-learning-mixpanel-setting/' },
  { from: '/blog/how-to-create-an-analytics-strategy', to: '/playbook/analytics-strategy' },
  { from: '/blog/how-to-create-a-tracking-plan-and', to: '/playbook/creating-a-tracking-plan' },
  { from: '/blog/creating-an-event-tracking-plan-for', to: '/playbook/creating-a-tracking-plan' },
  // Ghost's old members signup page. People there wanted the newsletter,
  // whose form is on the blog index.
  { from: '/blog/signup', to: '/blog/' },
];

// Renamed Ghost post slugs (Ghost doesn't redirect a renamed slug itself).
const RENAMED_BLOG_SLUGS = [
  { from: 'the-click-is-the-only-thing-your-ad-platfor-can-see', to: 'the-click-is-the-only-thing-your-ad-platform-can-see' },
  { from: 'week-9-learning-mixpanel-checking-6992b4900926b2001b6f6088', to: 'week-9-learning-mixpanel-checking-data-flow' },
];

// Content-Security-Policy for the whole site, /blog included: the blog is
// rendered by Next.js from the Ghost Content API, so Ghost's theme scripts and
// their CDN no longer load here. Post images come from Ghost's storage CDN and
// are covered by img-src https:. 'unsafe-inline'/'unsafe-eval' are required -
// Next.js static output and our inline JSON-LD ship inline scripts, and
// there's no nonce path for statically rendered pages.
// The value is still meaningful: it blocks script/frame loads from any origin
// not on the allowlist, and adds frame-ancestors/object-src/base-uri hardening.
// Firebase Auth (Google sign-in on /mcp): the popup flow loads Google's api.js,
// embeds a helper iframe from the project's auth domain (<project>.firebaseapp.com
// by default, or NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN if it is a custom domain), and
// calls the Google identity endpoints to exchange and refresh tokens.
// Tracking Agent review and setup: GitHub calls go through Datalyze's own
// relay ('self'), which adds the person's token on the server, so the page
// never talks to api.github.com.
const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  ? ` https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`
  : '';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.rocketsdr.ai https://*.snitcher.com https://cdn.mxpnl.com https://*.mxpnl.com https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://calendly.com https://assets.calendly.com https://js.stripe.com https://*.js.stripe.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://assets.calendly.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://mixpanel.com https://eu.mixpanel.com https://in.mixpanel.com https://us.posthog.com https://eu.posthog.com https://api.mixpanel.com https://api-js.mixpanel.com https://*.mxpnl.com https://www.rocketsdr.ai https://*.snitcher.com https://*.google-analytics.com https://*.googletagmanager.com https://*.analytics.google.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://*.calendly.com https://vitals.vercel-insights.com https://api.stripe.com https://checkout.stripe.com https://m.stripe.network https://q.stripe.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
  `frame-src 'self' https://calendly.com https://*.calendly.com https://www.youtube.com https://www.youtube-nocookie.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://m.stripe.network https://*.firebaseapp.com https://accounts.google.com https://www.browserbase.com${firebaseAuthDomain}`,
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://calendly.com https://github.com",
  "worker-src 'self' blob:",
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  // The Tracking Agent package (tracking-agent/) is NodeNext TypeScript: its
  // relative imports end in .js and mean the .ts file. The review UI and
  // browser setup import its pure modules (proposal schema, setup core).
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = {
      ...(webpackConfig.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return webpackConfig;
  },
  // Gated playbook downloads live outside public/ so they cannot be fetched by
  // URL. They are read with fs at request time, which means Next has to be told
  // to ship them - nothing imports them, so tracing cannot infer it.
  outputFileTracingIncludes: {
    '/api/playbook/download/[id]': ['./assets/playbook/**'],
    // The knowledge-base sync reads the chapters from disk (lib/kb/sources/playbook.ts).
    '/api/kb/sync': ['./content/playbook/**'],
    // The analytics agent MCP reads its instruction files and knowledge
    // (chunks, documents, embeddings) from analytics-agent/ at request time.
    '/api/datalyze/mcp': ['./analytics-agent/**/*'],
    // Workflow and step names for the usage page; the knowledge files aren't needed.
    '/api/mcp/usage': ['./analytics-agent/*.md', './analytics-agent/workflows/*', './analytics-agent/modules/*', './analytics-agent/suspects/*'],
    // The knowledge endpoint serves the Tracking Agent's knowledge files, read from disk.
    '/api/tracking-agent/knowledge': ['./tracking-agent/knowledge/*.md'],
  },
  // Blog URLs end in a slash (they are Ghost's URLs, indexed that way), and
  // Next would strip it site-wide. Skip the auto-redirect; middleware.ts adds
  // the slash on /blog and the redirect below removes it everywhere else.
  skipTrailingSlashRedirect: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  transpilePackages: ['jwks-rsa', 'jose'],

  // Middleware gets the request's URL as sent (request.url). Without this, Next
  // rewrites any loopback host anywhere in it to "localhost", query included,
  // which broke MCP clients' redirect_uri=http://127.0.0.1:… on the site → app
  // redirect (middleware.ts). The rest of the setting is about Pages Router
  // data requests, which this site doesn't have.
  skipMiddlewareUrlNormalize: true,

  async headers() {
    return [
      {
        // Security/trust headers across all routes. CSP is intentionally omitted
        // here - it needs a per-site policy designed against the actual asset
        // origins (Ghost CDN, Calendly, etc.) and a wrong CSP breaks the page.
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // The app hosts are never indexed, page or file, whether or not the split
      // is on (lib/hosts.ts APP_HOSTNAMES; robots.txt there disallows all too).
      ...['app.joindatalyze.com', 'app-staging.joindatalyze.com'].map((host) => ({
        source: '/:path*',
        has: [{ type: 'host' as const, value: host }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
      {
        // Brand images carry a version in the name (datalyze-mark-v1.png), so
        // a change ships under a new name and these can be cached for good.
        source: '/brand/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  async rewrites() {
    return [
      // Browsers and some crawlers ask for /favicon.ico whatever the <link>
      // tags say. Serve the app icon instead of a 404.
      { source: '/favicon.ico', destination: '/icon.png' },
      // Serve the self-contained retention microsite at a clean, no-.html URL.
      {
        source: '/resources/improve-app-retention',
        destination: '/resources/retention-demo.html',
      },
    ];
  },
  async redirects() {
    return [
      // Legacy blog subdomain -> subdirectory, slug preserved. Fires only for
      // the blog.* host (now pointed at Vercel). These come FIRST: the
      // Learning Mixpanel and slash-stripping rules below don't check the
      // host, so when they ran first on blog.* they took a hop of their own,
      // and the week rule sent /week-N-.../ to blog.*/blog/week-N-.../, which
      // this rule then turned into www/blog/blog/... (a 404, GSC 20 Nov 2026).
      //
      // Retired or renamed posts go straight to their final page, so an old
      // blog.* link is one hop, never two.
      //
      // Every blog.* rule is written twice, without and with the trailing
      // slash. Next's dev server matches both forms with one source, but on
      // Vercel the match is strict, so the slash form fell through to the
      // slash-stripping rule and took a second hop.
      ...[...RETIRED_BLOG_POSTS, ...RENAMED_BLOG_SLUGS.map(({ from, to }) => ({ from: `/blog/${from}`, to: `/blog/${to}/` }))].flatMap(
        ({ from, to }) => {
          const source = from.replace(/^\/blog/, '');
          return [source, `${source}/`].map((s) => ({
            source: s,
            has: [{ type: 'host' as const, value: 'blog.joindatalyze.com' }],
            destination: `https://www.joindatalyze.com${to}`,
            permanent: true,
          }));
        },
      ),
      // Split into root + path rules so we can re-append the trailing slash that
      // ':path*' drops. Ghost serves every post/tag/author URL canonically WITH
      // a trailing slash, so targeting the slash form is a single hop to the 200.
      {
        // Bare subdomain root -> canonical blog index. Separate rule because
        // ':path+' below requires >=1 segment, and appending '/' to an empty
        // capture would emit '/blog//'.
        source: '/',
        has: [{ type: 'host', value: 'blog.joindatalyze.com' }],
        destination: 'https://www.joindatalyze.com/blog/',
        permanent: true,
      },
      {
        // The slash form, matched explicitly (see above).
        source: '/:path+/',
        has: [{ type: 'host', value: 'blog.joindatalyze.com' }],
        destination: 'https://www.joindatalyze.com/blog/:path+/',
        permanent: true,
      },
      {
        // ':path+' (one-or-more segments) excludes the root handled above. The
        // capture never includes the trailing slash, so we append one.
        source: '/:path+',
        has: [{ type: 'host', value: 'blog.joindatalyze.com' }],
        destination: 'https://www.joindatalyze.com/blog/:path+/',
        permanent: true,
      },

      // Learning Mixpanel posts requested at the site root, e.g.
      // /week-26-learning-mixpanel-mastering/ (a link written relative to the
      // old blog.joindatalyze.com host). Covers every week, with or without
      // the slash. It has to come before the slash-stripping rule below, or
      // that rule sends the slash form to a bare root URL that 404s.
      {
        source: '/:slug(week-\\d+-learning-mixpanel-[a-z0-9-]+)',
        destination: '/blog/:slug/',
        permanent: true,
      },
      // The slash form too. Locally the rule above matches both, but on
      // Vercel it doesn't, and the slash-stripping rule took a first hop.
      {
        source: '/:slug(week-\\d+-learning-mixpanel-[a-z0-9-]+)/',
        destination: '/blog/:slug/',
        permanent: true,
      },
      // Consolidated duplicates (seo-duplicate-audit.md and
      // seo-indexing-fixes.md, 2026-10-14). Each source covered the same
      // search topic as its destination; the destination is the one page kept
      // for that topic. Listed before the slash-stripping rule so "/ask/x/" is
      // one hop, not two. Blog sources carry no trailing slash: path-to-regexp
      // matches both forms, and these run before middleware.ts adds one.
      ...[
        // /ask answers, each folded into the page it summarised. The answers
        // are retired in lib/data/ask-answers.ts (RETIRED_ASKS).
        { from: '/ask/client-vs-server-side-tracking', to: '/resources/client-vs-proxy-vs-server-tracking' },
        { from: '/ask/how-to-set-up-mixpanel-properly', to: '/blog/how-to-set-up-product-analytics-the-right-way/' },
        { from: '/ask/how-do-i-set-up-mixpanel-properly', to: '/blog/how-to-set-up-product-analytics-the-right-way/' },
        { from: '/ask/how-to-build-an-analytics-strategy', to: '/playbook/analytics-strategy' },
        { from: '/ask/what-is-an-event-tracking-plan', to: '/playbook/creating-a-tracking-plan' },
        { from: '/ask/what-is-marketing-mix-modeling', to: '/playbook/media-mix-modelling' },
        { from: '/ask/incrementality-testing-for-d2c', to: '/blog/d2c-playbook-6-incrementality-testing/' },
        { from: '/ask/why-do-my-conversions-look-too-good', to: '/blog/d2c-playbook-3-why-your-conversions-look-too-good/' },
        { from: '/ask/are-branded-search-conversions-real', to: '/blog/70-of-your-branded-search-conversions-would-have-happened-anyway/' },
        { from: '/ask/how-to-measure-retention', to: '/blog/solving-retention-problems-a-strategic/' },
        { from: '/ask/what-is-analytics-debt', to: '/blog/analytics-debt-the-silent-killer-nobody-talks-about-until-series-b/' },
        { from: '/ask/how-to-find-your-aha-moment', to: '/blog/finding-the-aha-moment-for-your-product/' },
        { from: '/ask/mixpanel-vs-ga4', to: '/blog/why-its-time-to-switch-from-ga-to/' },
        { from: '/ask/events-vs-properties-in-mixpanel', to: '/blog/what-are-events-and-properties-in/' },
        { from: '/ask/what-are-super-properties', to: '/blog/what-are-events-and-properties-in/' },
        { from: '/ask/why-nobody-trusts-our-data', to: '/blog/you-have-data-flowing-everywhere-and-trust-none-of-it/' },
        { from: '/ask/what-is-lexicon-in-mixpanel', to: '/blog/week-3-learning-mixpanel-introduction/' },

        // Retired Ghost posts (RETIRED_BLOG_POSTS, top of this file).
        ...RETIRED_BLOG_POSTS,

        // The Next.js D2C playbook section, removed 2026-06-18 when the series
        // moved to Ghost as the Indian D2C Playbook.
        { from: '/indian-d2c-playbook', to: '/blog/tag/indian-d2c-playbook/' },
        { from: '/indian-d2c-playbook/metrics-that-lie', to: '/blog/d2c-playbook-3-why-your-conversions-look-too-good/' },
        { from: '/indian-d2c-playbook/why-your-numbers-never-match', to: '/blog/d2c-playbook-3-why-your-conversions-look-too-good/' },
        { from: '/indian-d2c-playbook/questions-your-data-must-answer', to: '/blog/d2c-playbook-1-the-data-foundation/' },

        // The Tracking Agent's mobile docs page, removed 2026-10-22 with the
        // mobile typed trackers and tests. The analytics page notes the languages.
        { from: '/tracking-agent/docs/mobile', to: '/tracking-agent/docs' },
      ].map(({ from, to }) => ({ source: from, destination: to, permanent: true })),

      // One URL per Next.js page: "/about/" 308s to "/about". Next would do this
      // itself, but skipTrailingSlashRedirect (above) turns it off site-wide for
      // the sake of Ghost, so every page answered 200 on both forms. The regex
      // needs the trailing slash to match, so it can never catch "/about" and
      // loop, and it leaves /blog (slash-canonical URLs), /api, /mp
      // (the Mixpanel proxy), /admin and Next's own assets alone.
      {
        // It also skips root-level Learning Mixpanel URLs: on Vercel this rule
        // beat the week rule above for the slash form, a two-hop chain.
        source: '/:path((?!blog(?:/|$)|api/|mp/|_next/|admin/|week-\\d+-learning-mixpanel-).+)/',
        // Never on the old blog host: its own rules at the top handle it.
        missing: [{ type: 'host', value: 'blog.joindatalyze.com' }],
        destination: '/:path',
        permanent: true,
      },
      // (The blog.joindatalyze.com rules are at the top of this list.)
      // Note: /blog -> /blog/ (and every other /blog URL missing its slash)
      // is handled in middleware.ts, NOT here. A config redirect with source
      // '/blog' also matches '/blog/' (path-to-regexp is lenient about the
      // trailing slash, especially with skipTrailingSlashRedirect), so it
      // 308-loops /blog/ onto itself. Middleware compares the exact pathname.

      // Ghost split its sitemap into an index and child sitemaps. The blog now
      // has one (app/blog/sitemap.xml); send anything still asking for a child
      // there.
      {
        source: '/blog/sitemap-:kind(posts|pages|tags|authors).xml',
        destination: '/blog/sitemap.xml',
        permanent: true,
      },

      // Renamed Ghost post slugs. Ghost does NOT create a redirect when a
      // published post's slug changes, and /blog only knows current slugs, so
      // a rename needs a line here. Without
      // these, every existing inbound link and indexed result for the old slugs
      // dies. Each rule is listed once; path-to-regexp matches the trailing
      // -slash and bare forms alike, and the destination carries the slash
      // because that's the form Ghost serves canonically.
      ...RENAMED_BLOG_SLUGS.map(({ from, to }) => ({
        source: `/blog/${from}`,
        destination: `/blog/${to}/`,
        // Emits 308, which search engines treat exactly as a permanent 301.
        permanent: true,
      })),

      // Renamed playbook chapters. A chapter's slug is its identity in search,
      // so a rename has to leave a permanent redirect behind rather than a 404.
      ...PLAYBOOK_REDIRECTS.map(({ from, to }) => ({
        source: `/playbook/${from}`,
        destination: `/playbook/${to}`,
        permanent: true,
      })),

      // Tracking Agent docs pages for v1's parts, retired with v1: each goes to the page
      // that now covers what it answered.
      ...[
        ['concepts', 'reference'],
        ['method', ''],
        ['reviewing', 'pr-check'],
        ['verification', 'pr-check'],
        ['user-properties', 'reference'],
        ['analytics', 'setup'],
        ['models', 'setup'],
      ].map(([from, to]) => ({
        source: `/tracking-agent/docs/${from}`,
        destination: `/tracking-agent/docs${to ? `/${to}` : ''}`,
        permanent: true,
      })),

      // Retired pages. /how-it-works now lives as the Method section on the
      // homepage, and the pricing tiers are answered on /faqs. /ai-analytics-agent
      // goes to the Tracking Agent, its successor: a redirect to the homepage
      // reads to Google as a soft 404. Kept as permanent redirects so inbound
      // links and indexed results land somewhere useful instead of 404ing.
      { source: '/how-it-works', destination: '/#how-it-works', permanent: true },
      { source: '/pricing', destination: '/faqs', permanent: true },
      { source: '/ai-analytics-agent', destination: '/tracking-agent', permanent: true },
      // The services and industries hubs were retired: each page is reached
      // from the header's hover menus instead. The five-stage overview the
      // services hub carried lives on as the Method section on the homepage.
      { source: '/services', destination: '/#how-it-works', permanent: true },
      { source: '/industries', destination: '/', permanent: true },
      // The free tools hub merged into /resources. Each tool keeps its own
      // /tools/<id> page; only the hub moved.
      { source: '/tools', destination: '/resources#tools', permanent: true },
      // One sign-in for every product (docs/app-subdomain-plan.md): the MCP's
      // own sign-in pages go to /account/*. A `next` the link already carries
      // passes through with the rest of the query (Next appends it); without
      // one, the person lands on the MCP dashboard. The has-rules come first so
      // a link never ends up with two `next`s. Temporary until the app-host
      // move settles, so a rollback isn't stuck in browsers' redirect caches.
      { source: '/mcp/login', has: [{ type: 'query', key: 'next' }], destination: '/account/login', permanent: false },
      { source: '/mcp/login', destination: '/account/login?next=/mcp/dashboard', permanent: false },
      { source: '/mcp/signup', has: [{ type: 'query', key: 'next' }], destination: '/account/signup', permanent: false },
      { source: '/mcp/signup', destination: '/account/signup?next=/mcp/dashboard', permanent: false },
      { source: '/mcp/get-started', destination: '/account/signup?next=/mcp/dashboard', permanent: false },
      // Billing and Profile are one page each for every product (app/(signed-in)).
      { source: '/mcp/billing', destination: '/billing?product=mcp', permanent: false },
      { source: '/tracking-agent/dashboard/billing', destination: '/billing?product=tracking_agent', permanent: false },
      { source: '/mcp/profile', destination: '/profile', permanent: false },
      // Pravix is the products page (/pravix), over one page per tool: /tracking-agent,
      // /alerting and /mcp. Exact paths only: the MCP's sign-in, consent and
      // account pages live under /mcp/*.
      { source: '/mcp/connect', destination: '/mcp', permanent: false },
      { source: '/products', destination: '/pravix', permanent: false },
      // The paid app's Setup page moved out from under the dashboard.
      // Only the page itself: the old wizard's /admin preview stays until §7 removes it.
      { source: '/tracking-agent/dashboard/setup', destination: '/tracking-agent/setup', permanent: true },
      // The audit screen moved from under the review pages to the dashboard, then (25 Nov 2026) to
      // Audits, which replaced the dashboard as the app's home.
      { source: '/tracking-agent/review/:owner/:repo/audit', destination: '/tracking-agent/audits/:owner/:repo', permanent: true },
      { source: '/tracking-agent/dashboard', destination: '/tracking-agent/audits', permanent: true },
      { source: '/tracking-agent/dashboard/audit', destination: '/tracking-agent/audits', permanent: true },
      { source: '/tracking-agent/dashboard/audit/:owner/:repo', destination: '/tracking-agent/audits/:owner/:repo', permanent: true },

    ];
  },
};

export default config;
