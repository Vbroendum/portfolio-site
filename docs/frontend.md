# Frontend

Next.js 16, App Router, TypeScript, Tailwind v4. Dark only.

## Route map

```
proxy.ts                  locale redirects for unprefixed URLs (see i18n.md)
app/
  layout.tsx              fonts, <html lang>, metadataBase
  globals.css             design tokens, prose styles, syntax colours
  robots.ts  sitemap.ts
  feed.xml/route.ts       the English feed, for old subscribers
  api/revalidate/route.ts cache purge, authorised via the API

  [lang]/                 public pages, one tree per locale (en, da)
    layout.tsx            force-dynamic, header + footer, site metadata
    page.tsx              home
    projects/page.tsx     list
    projects/[slug]/      case study + demo
    blog/page.tsx         list, filterable by tag
    blog/[slug]/          post
    cv/page.tsx
    about/page.tsx
    feed.xml/route.ts     per-locale feed
    opengraph-image.tsx   per-locale link preview card
    not-found.tsx
    [...rest]/page.tsx    404s unknown paths inside the site chrome

  admin/
    login/page.tsx        outside the guard on purpose
    (cms)/
      layout.tsx          AuthGuard + AdminShell
      page.tsx            counts and shortcuts
      posts/              list + editor ([id], where id may be "new")
      projects/           list + editor
      cv/page.tsx         inline list editor
      media/page.tsx      library with inline alt text
      settings/page.tsx   site copy, about page, footer links
```

`/admin/login` sits *outside* the `(cms)` route group because layouts nest in
Next.js - a nested layout cannot opt out of its parent's `AuthGuard`, so putting
login inside would redirect to itself forever.

## Data access

Two clients, deliberately separate:

| File | Runs | Auth | Used by |
| --- | --- | --- | --- |
| `lib/api/server.ts` | Server only (`import "server-only"`) | none | Public pages |
| `lib/api/admin.ts` | Browser (`"use client"`) | session cookie | The CMS |

`lib/api/types.ts` mirrors the Go structs in `api/internal/models`. Nothing
enforces that at build time - when you change a field on one side, change it on
the other.

Server-side calls use `API_INTERNAL_URL` (the compose hostname). Browser calls
use `NEXT_PUBLIC_API_URL` (the public one). They differ in Docker and usually
match on a laptop.

## Caching

Public pages are `force-dynamic` (set once, in `app/[lang]/layout.tsx`), while
the `fetch` calls underneath them are cached and tagged.

The reason: pages are prerendered during `next build`, when the API is normally
not reachable. Fully static pages would bake "nothing published yet" into the
image and serve it until the first revalidation. Rendering per request avoids
that, and the tagged fetch cache means repeat traffic still costs one upstream
call per tag per minute, not one per visitor.

Tags are `posts`, `projects`, `cv`, `settings`, plus per-item `post:<slug>` and
`project:<slug>`. The default TTL is 60 seconds (`DEFAULT_REVALIDATE`).

After a successful save, the CMS calls `revalidate([...])`, which posts to
`/api/revalidate`. That route forwards the session cookie to the API's
`/auth/me` and only purges if the API says the caller is signed in - one
authorisation rule, in one place.

## The blog hides itself when empty

With no published post, the blog does not exist rather than existing and being
empty:

- the `writing` link is dropped from the header nav,
- `/blog` returns 404,
- `/feed.xml` returns 404 and the `<link rel="alternate">` is not emitted,
- the footer `rss` link is hidden,
- `/blog` is left out of `sitemap.xml`.

The switch is a single `getPosts({ limit: 1 }).total > 0` in
`app/[lang]/layout.tsx`, passed down as `showBlog` / `showRss`. It rides the
`posts` cache tag, so it costs nothing per visitor, and publishing the first
post brings everything back with no setting to remember.

A tag filter that matches nothing still renders the page with its empty state -
only a genuinely empty blog 404s, so the filter chips keep working.

One wrinkle: the very first request after the blog becomes empty (or stops
being empty) can serve the previous version of `/blog` while Next regenerates
it. Every request after that is correct.

## Components

| File | Purpose |
| --- | --- |
| `components/site-header.tsx` | Public nav; marks the active section with a rule, not colour alone |
| `components/site-footer.tsx` | Email, location, social links, RSS |
| `components/markdown.tsx` | The single markdown renderer, used by pages *and* the editor preview |
| `components/project-demo.tsx` | Switches on `demo_type`; shared frame and caption bar |
| `components/ui.tsx` | Chip, SectionHead, FormattedDate, EmptyState |
| `components/admin/fields.tsx` | Form primitives: Field, TextInput, TextArea, Select, Toggle, ListInput, Button, StatusLine |
| `components/admin/markdown-editor.tsx` | Write/preview tabs over a textarea |
| `components/admin/media-picker.tsx` | Library picker with upload, single or multi |
| `components/admin/auth-guard.tsx` | Client session gate and `useAuth()` |
| `components/admin/shell.tsx` | CMS sidebar and page header |

### Markdown

`react-markdown` + `remark-gfm` + `rehype-slug` + `rehype-highlight`. Raw HTML
is **not** enabled: the body is trusted content, but keeping HTML off means a
pasted snippet can never break the layout or inject a script. If you need an
embed, add a component rather than turning HTML on.

The editor preview imports the same `<Markdown>` component as the public page,
so what you see is literally what renders.

### Demo renderers

`demo_type` decides what the project page shows:

| Type | Renders | `demo_url` means |
| --- | --- | --- |
| `none` | nothing | - |
| `iframe` | Sandboxed iframe, **loaded on click** | The live site's URL |
| `video` | `<video>` with controls, muted, looping | Direct `.mp4`/`.webm` URL |
| `asciinema` | asciinema.org embed iframe | Cast URL or bare id |
| `gallery` | Image carousel with thumbnails | ignored |

The iframe loads on click rather than on page load so a page with several demos
does not drag several third-party sites down with it. The sandbox allows
scripts, same-origin, forms and popups - enough for a real app, not enough to
navigate the parent page.

## Security notes

- The CMS guard is convenience, not a boundary. The API rejects every
  unauthenticated admin request; `AuthGuard` only avoids rendering an empty
  shell.
- `/admin` and `/api` are disallowed in `robots.ts`, and the CMS layout sets
  `robots: { index: false }`.
- `next.config.ts` allows remote images only from the API's `/media/**`.

## Adding a public page

1. Create `app/[lang]/<name>/page.tsx` as an async Server Component, and resolve
   the locale with `localeFromParams(params)` from `lib/i18n/server.ts`.
2. Fetch through `lib/api/server.ts`, passing the locale - add a function there
   rather than calling `fetch` inline, so the tag stays with the query.
3. Give failures a fallback (`emptyList`, `FALLBACK_SETTINGS`) so a build
   without an API still succeeds.
4. Put its strings in both dictionaries in `lib/i18n/dictionaries.ts`, and
   build links with `localePath(locale, "/<name>")`.
5. Export `generateMetadata`, with `alternates: await alternatesFor(locale, "/<name>")`.
6. Add it to `NAV` in `components/site-header.tsx` and to `app/sitemap.ts`.
