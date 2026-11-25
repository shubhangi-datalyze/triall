# Datalyze site

## pravix/ is a separate app

`pravix/` is Pravix: a Vite + React SPA with an Express API and Google Cloud Functions, deployed by its own Vercel project (`pravix`, Root Directory `pravix`). It has its own package.json, lockfile, tsconfig, lint, tests and `pravix/vercel.json`, and is excluded from the site's tsconfig, ESLint and build. The site's content-in-JSON and SEO rules below don't apply inside it. Pravix's public landing page belongs on the site (www.joindatalyze.com/pravix) and follows those rules. Run Pravix's checks from inside `pravix/` (`npm run typecheck`, `npm test`). Don't import across the boundary in either direction.

## New pages follow docs/content-standard.md

Before writing or changing any public page or blog post, read `docs/content-standard.md`. Part 1 is the sixteen page rules (title = H1, answer under the H1, a table, FAQs with schema, byline to /about with an Updated date, Article schema, social tags, sources, internal links, sitemap and llms.txt). Part 2 is the voice, and applies everywhere.

Part 1 applies to playbook chapters, every page built from now on, and blog posts published from 2026-09-30. Pages that existed before are exempt, listed in `lib/data/seo-standard.ts`. Don't bring an exempt page up to the standard unless Ansh asks; when he does, remove it from `EXEMPT` in the same change. A new page is in scope by default; only add it to `EXEMPT` if Ansh says so.

For an in-scope page, run `npm run seo:check -- <path>` before calling it done, and tell Ansh which rules need a person to check (2, 3, 16).

## Page copy lives in content/*.json, and /admin edits it

Every visible string on a public page comes from a JSON file in `content/`, so the /admin editor can change it. Never hard-code copy in a component or page. `npm run content:check` fails the build if you do. It also fails if a public route has no content file.

### Adding or changing a page
1. **Copy** goes in `content/<page>.json`. Keys must be camelCase and alphanumeric; use arrays, not objects keyed by slugs. Start the file with an `$admin` block:
   ```json
   "$admin": { "label": "Pricing", "section": "Main pages", "livePath": "/pricing" }
   ```
   `section` is one of `PAGE_SECTIONS` in `lib/content/schema.ts`. Optional keys: `groups`/`labels`/`hints` (sidebar wording), `routes` (other routes this file supplies copy for, e.g. `/tools/[toolId]`), `preview` (a dedicated preview route, only when the live page can't show every state), `order`, `commitMessage`.
2. **Type and import:** add `lib/content/<page>.ts` exporting the content type and `json as <Type>`.
3. **Render** every string through `rich()` from `lib/content/rich.tsx`, with `data-ck="<dotted.path>"` on the element (for example `data-ck="team.members.1.bio"`). That attribute is how click-to-edit and live preview find the text. Content strings can use `*em*`, `**bold**`, `` `code` ``, `[text](/path)` and line breaks. Use `stripRich()` wherever you need plain text (JSON-LD, metadata, alt text).
4. **Register:** run `npm run content:registry`. `predev` and `prebuild` also run it. The page then appears in /admin and previews through its live route; no editor code is needed.

Every string in a content file is an editor field automatically. Leaves named `id`, `slug`, `src`, `logo`, `photo`, `image`, `avatar` or `thumbClass` are skipped.

- **Shared components:** labels in components used on several pages belong in `content/site.json` under `shared`.
- **Nav and footer:** these are `content/site.json` too.
- **Playbook chapters** are MDX in `content/playbook/`, not JSON. /admin edits them in a separate chapter editor (chapters are in the page picker): header fields, takeaways, FAQs, CTA line, SEO fields and the body text. Publishing writes the `.mdx` file, keeps every other frontmatter field, sets `updated` to today, and refuses a body that doesn't compile. `lib/playbook/chapter-file.ts` writes frontmatter in the files' exact style, so keep new chapters in that style (double-quoted strings, `  - ` lists).

### Limits
- **List length is fixed:** the editor can't add or remove list items. The publish guard requires the draft to keep the file's exact shape, so change list lengths in code.
- **Exemptions:** text that isn't page copy (illustration labels, the /ask chat UI) is exempted, with a reason, in `NOT_COPY_FILES` / `NOT_PAGE_COPY` in `scripts/content/check.ts`. Add to those lists only for the same kind of reason.

<!-- datalyze:start (written by the Datalyze Tracking Agent) -->
## Analytics tracking (Datalyze)

This repo's analytics tracking plan is in `analytics/registry/`. The Datalyze plugin for Claude Code (`datalyze`, offered by `.claude/settings.json`) knows how it works.

- What a branch or pull request needs includes its tracking: run `/datalyze:review` for that part. It writes the proposal to `.datalyze/proposals/`.
- To audit the tracking (the whole repo, an area, some events, or since a date), run `/datalyze:audit`.
- To build an approved proposal, run `/datalyze:implement`.
- Never edit `analytics/registry/_conventions.yaml`, `analytics/registry/_baseline.json` or `.datalyze/config.yaml` to make a check pass.

The plugin needs `DATALYZE_KEY` in your environment: your workspace key, from the Datalyze dashboard.
<!-- datalyze:end -->
