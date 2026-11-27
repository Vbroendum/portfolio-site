# Using the CMS

For publishing, not for coding. Everything here happens at
`https://yourdomain.com/admin`.

## Signing in

There is no sign-up. Accounts are created on the server:

```bash
docker compose exec api adminctl create-user -email you@example.com -name "Your Name"
```

Forgot the password:

```bash
docker compose exec api adminctl set-password -email you@example.com
```

A session lasts seven days.

## How publishing works

Every post and project is **draft** or **published**.

- Drafts are invisible to the public site and to the API's public endpoints -
  a draft URL returns 404 even if someone guesses the slug.
- Saving a published item clears the site's cache immediately, so the change is
  live on the next page load.
- The CV, the about page and settings have no draft state. They are live as
  soon as you save.
- **While no post is published, the blog is hidden entirely**: no `writing` link
  in the nav, `/blog` and `/feed.xml` return 404, and neither appears in the
  sitemap. Publishing your first post brings all of it back by itself - there is
  no switch to flip. Unpublishing your last post hides it again.

## Writing in Danish

The site has an English version at `/en` and a Danish one at `/da`. Visitors
land on whichever their browser prefers, and the header has a switch.

Every editor with text in it (posts, projects, CV entries, settings) has an
**english | dansk** tab above the text fields. English is the main version:
write it first. Then switch to **dansk** and translate what you want to.

- **An empty Danish field shows the English text** on `/da`. The grey text in an
  empty field is exactly what visitors will see there. You can translate a
  title today and the body next week.
- A dot on the **dansk** tab means the record has some Danish text.
- When a Danish page shows an English body, it says so in one line above it, so
  a visitor is not surprised by the switch.
- Slugs, tags, dates, images, links and the publish status are shared by both
  languages. Publishing a post publishes it in both.
- The name, email and footer links in settings are the same in both languages.

The CMS itself is English only.

## Posts

**Posts → new post.**

| Field | What to put in it |
| --- | --- |
| Title | The headline. The slug is derived from it unless you set one. |
| Summary | One or two sentences. Shown in the list and used as the meta description, so write it for a stranger. |
| Body | Markdown. Fenced code blocks get syntax highlighting. |
| Status | draft until you mean it |
| Slug | Leave blank for auto. **Changing it later breaks existing links.** |
| Tags | Lowercase, few, reused. Tags are the blog's only filter. |
| Cover image | Optional. Used at the top of the post and in link previews. |
| Publish date | Blank means "now". A future date schedules the post. |

The editor has **write** and **preview** tabs. Preview uses the same renderer
as the live site, so there are no surprises.

Reading time is calculated for you.

### Scheduling

Set the status to published and the publish date to the future. The post stays
hidden until that moment, then appears on its own. No job runs - the query
simply starts matching - so it can show up up to a minute late.

## Projects

**Projects → new project.**

| Field | What to put in it |
| --- | --- |
| Title | The project's name as you'd say it |
| Tagline | One line. It carries the project in every list - spend time here. |
| Case study | Markdown. What problem it solves, how it works, what you learned. |
| Demo type | See the table below |
| Demo URL | Depends on the type |
| Gallery images | Screenshots, in order. Used by the gallery demo type. |
| Status | draft / published |
| Featured | The first featured project's demo sits in the home page hero |
| Sort order | Lower numbers come first, after featured ones |
| Tech | Short labels: `Go`, `Postgres`, `Next.js` |
| Repo / live URL | Shown as links under the title |
| Cover image | Used for link previews and as the video poster frame |

### Choosing a demo type

| Type | Best for | What to supply |
| --- | --- | --- |
| **iframe** | A deployed web app | The live URL. It loads on click, in a sandbox. Sites that refuse framing (`X-Frame-Options`) will not show - use video instead. |
| **video** | Anything with motion that cannot be framed | Upload an `.mp4`/`.webm` under Media, then paste its URL. Set a cover image as the poster. |
| **asciinema** | CLI and TUI projects | An asciinema.org URL, or just the cast id |
| **gallery** | Screenshots of anything | Upload images, pick them below; order matters |
| **none** | Libraries, experiments | nothing |

A rough rule: if someone can *use* it in a browser, iframe it. If they can only
*watch* it, record it.

## CV

**CV.** Entries are grouped by kind and sorted by the sort order you give them.

- **experience / education / certification** render as a timeline: dates on the
  left, role and organisation on the right.
- **skill** entries are whole categories, not single skills. Make one entry
  per category: the **category** field is its label (`Core stack`,
  `Familiar`, `Tools`) and **skills** is the list of chips under it, in the
  order you type them. To add a skill, edit its category and add a chip. Sort
  order arranges the categories. The form hides the dated fields for skills,
  since they would not show. In Danish, translate the label, and either
  translate the whole skills list or leave it empty to show the English one.
- Tick **still here** for your current role - it shows as "now".
- **Highlights** are short bullets. Two or three per role beats a paragraph.

## Media

**Media.** Upload images, video, PDFs. The library is shared by posts and
projects.

- **Write the alt text.** The field is right under each item. An image without
  it is a bug on the public site.
- Files are capped at 25 MB by default.
- Deleting media that is in use is allowed: covers become empty, gallery entries
  disappear. Nothing breaks, but the page loses the image.
- Uploaded files are cached forever by URL, so re-uploading a corrected image
  gives it a new URL rather than a stale one.

## Settings

**Settings** holds the copy that appears on every page.

| Group | Field | Where it shows |
| --- | --- | --- |
| site | name | Header, browser tab |
| site | headline | The first line on the home page |
| site | description | Under the headline, and the default meta description |
| site | email, location | Footer and CV page |
| about page | heading, body | `/about`, and the first two paragraphs on the home page |
| footer links | label + URL | Footer and `/about` |

Write the headline as a plain statement of what you build. It is the first
thing a stranger reads.

## When something looks wrong

- **A change is not live.** Reload once more; the cache clears on save but a
  failed purge falls back to a 60-second expiry.
- **An iframe demo is blank.** The site refuses to be framed. Record a video.
- **An upload is rejected.** The file type is not on the allowlist, or it is
  over the size cap.
- **You are signed out repeatedly.** The session is seven days; if it happens
  sooner, see the cookie notes in [configuration.md](configuration.md).
