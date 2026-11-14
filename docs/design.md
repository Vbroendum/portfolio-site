# Design

The whole system is about 40 lines of tokens at the top of
`web/app/globals.css`. Read that file before adding UI; this page explains the
intent behind it.

## The idea

**Human words are set in a serif, machine words in mono.** Prose, headings and
project titles are Newsreader. Anything the machine owns - navigation, dates,
tech labels, file sizes, code, the whole CMS - is JetBrains Mono. That single
rule is where the site gets its character, so keep it consistent rather than
reaching for a third voice.

There is one accent, a desaturated lilac, and it is used only for interactive
and "you are here" states. Nothing decorative uses it. If a new element wants
the accent for emphasis alone, it does not get it.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--color-ink` | `#0e1013` | Page background |
| `--color-surface` | `#15181c` | Demo frames, code blocks |
| `--color-raised` | `#1b1f24` | Inline code, active editor tab |
| `--color-line` | `#262b31` | Every hairline and border |
| `--color-line-strong` | `#39404a` | Hover borders, scrollbar |
| `--color-fg` | `#e9e6e0` | Body text (warm, not pure white) |
| `--color-muted` | `#9aa1aa` | Secondary text |
| `--color-faint` | `#6b727c` | Metadata, timestamps |
| `--color-accent` | `#b3a4ff` | Links on hover, focus rings, active nav |
| `--color-accent-dim` | `#6f62b8` | Accent borders, selection |
| `--color-accent-wash` | `#1d1a33` | Primary button fill |
| `--color-ok` / `--warn` / `--danger` | green / amber / coral | CMS status only |
| `--measure` | `68ch` | Reading width for prose |

Tailwind v4 picks these up from `@theme`, so they are available as `bg-ink`,
`text-muted`, `border-line`, `max-w-[var(--measure)]` and so on. **Do not write
raw hex in a component** - add a token instead.

## Type scale

| Element | Size | Family |
| --- | --- | --- |
| Hero headline | `text-4xl` → `text-5xl` | serif, 500 |
| Page title | `text-3xl` | serif |
| Section heading | `text-xl` | serif |
| Body | `1.0625rem` / 1.7 | serif |
| Metadata, nav, chips | `13px` / `12px` / `11px` | mono |

Body line length is capped at `--measure`. Headings get `text-wrap: balance`.

## Structure

- **Lists, not card grids.** Projects and posts are horizontal bands separated
  by hairlines. The eye compares titles and taglines instead of thumbnails, and
  nothing needs a decorative image to look finished.
- **Left-aligned throughout.** No centred body copy.
- **One container width**, `max-w-5xl`, with `px-5` / `sm:px-8` gutters.
- **Borders over shadows.** There are no shadows in the design; depth comes
  from the surface ramp and hairlines.
- **Radius is 4-6px**, or none. Nothing is pill-shaped.

## Motion

One entrance animation, on the home hero (`.rise`). Everything else only moves
in response to a click or hover. `prefers-reduced-motion` is honoured globally
in `globals.css` - do not re-enable motion past it in a component.

## Accessibility floor

- Focus is always visible: a 2px accent outline, set once on `:focus-visible`.
- State is never carried by colour alone - the active nav item also has a rule
  under it, the gallery thumbnail also has `aria-current`.
- Alt text is editable in the media library because an image without it is a
  bug on the public site.
- Body text on `--color-ink` is comfortably above 4.5:1; if you introduce a new
  foreground colour, check it.

## When adding UI

1. Does an existing component do it? `components/ui.tsx` and
   `components/admin/fields.tsx` cover most of what the site needs.
2. Use tokens, not literals.
3. Pick the family by the rule above: is this a human sentence or machine data?
4. Check it at 360px wide.
5. Before shipping, remove one thing.
