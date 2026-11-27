package main

import (
	"context"
	"fmt"

	"github.com/vbroendum/portfolio/api/internal/models"
	"github.com/vbroendum/portfolio/api/internal/store"
)

// cmdSeed inserts a small set of demo content so a fresh database renders a
// complete-looking site. It is idempotent-ish: slugs collide on a second run,
// which is reported and skipped rather than treated as a failure.
func cmdSeed(ctx context.Context) error {
	st, closeFn, err := connect(ctx)
	if err != nil {
		return err
	}
	defer closeFn()

	posts := []store.PostInput{{
		Title:   "Hello, world",
		Summary: "Why I built this site, and what I plan to write about here.",
		Tags:    []string{"meta"},
		Status:  models.StatusPublished,
		BodyMarkdown: `This is the first post on my new site.

I built it with a Go API and a Next.js frontend, mostly because I wanted a
CMS that does exactly what I need and nothing else.

## What you will find here

- Notes on things I build
- The occasional debugging story
- Short posts about tools I like
`,
		Translations: map[models.Locale]models.PostTranslation{
			models.LocaleDA: {
				Title:   "Hej, verden",
				Summary: "Hvorfor jeg byggede siden, og hvad jeg vil skrive om her.",
				BodyMarkdown: `Dette er det første indlæg på min nye side.

Jeg byggede den med et Go-API og en Next.js-frontend, mest fordi jeg ville
have et CMS, der gør præcis det, jeg har brug for, og intet andet.

## Hvad du finder her

- Noter om ting, jeg bygger
- En fejlfindingshistorie en gang imellem
- Korte indlæg om værktøjer, jeg kan lide
`,
			},
		},
	}, {
		Title:        "A draft that nobody can see",
		Summary:      "Drafts are only visible in the admin UI.",
		Tags:         []string{"meta"},
		Status:       models.StatusDraft,
		BodyMarkdown: "Still thinking about this one.",
	}}

	for _, p := range posts {
		if _, err := st.CreatePost(ctx, p); err != nil {
			fmt.Printf("skip post %q: %v\n", p.Title, err)
			continue
		}
		fmt.Printf("seeded post %q\n", p.Title)
	}

	projects := []store.ProjectInput{{
		Title:    "todo-tui",
		Tagline:  "A keyboard-driven todo list that lives in your terminal.",
		Tech:     []string{"Go", "Bubble Tea"},
		RepoURL:  "https://github.com/your-handle/todo-tui",
		DemoType: models.DemoAsciinema,
		DemoURL:  "https://asciinema.org/a/000000",
		Featured: true,
		Status:   models.StatusPublished,
		BodyMarkdown: `## The problem

Every todo app I tried wanted to be a lifestyle.

## How it works

A single binary, a flat file, and vim keybindings.`,
		Translations: map[models.Locale]models.ProjectTranslation{
			models.LocaleDA: {
				Tagline: "En tastaturstyret todo-liste, der bor i din terminal.",
				BodyMarkdown: `## Problemet

Hver todo-app, jeg prøvede, ville være en livsstil.

## Sådan virker den

Én binær fil, en flad fil og vim-genveje.`,
			},
		},
	}, {
		// Deliberately untranslated, so the seeded site shows the English
		// fallback on /da.
		Title:        "weather-cli",
		Tagline:      "Weather in your terminal, with no API key required.",
		Tech:         []string{"Go", "CLI"},
		RepoURL:      "https://github.com/your-handle/weather-cli",
		DemoType:     models.DemoNone,
		Status:       models.StatusPublished,
		BodyMarkdown: "Small, fast, and it caches responses for an hour.",
	}}

	for _, p := range projects {
		if _, err := st.CreateProject(ctx, p); err != nil {
			fmt.Printf("skip project %q: %v\n", p.Title, err)
			continue
		}
		fmt.Printf("seeded project %q\n", p.Title)
	}

	start := "2023-01-01"
	cv := []store.CVEntryInput{{
		Kind:         models.CVExperience,
		Title:        "Software Developer",
		Organization: "Example A/S",
		Location:     "Copenhagen, Denmark",
		StartDate:    &start,
		IsCurrent:    true,
		Highlights:   []string{"Shipped the thing", "Mentored two juniors"},
		SortOrder:    0,
		Translations: map[models.Locale]models.CVEntryTranslation{
			models.LocaleDA: {
				Title:      "Softwareudvikler",
				Location:   "København, Danmark",
				Highlights: []string{"Fik tingen i produktion", "Var mentor for to juniorer"},
			},
		},
	}, {
		// A skill entry is one category: the title labels it, the highlights
		// are its skills.
		Kind:       models.CVSkill,
		Title:      "Core stack",
		Highlights: []string{"Go", "TypeScript", "Postgres"},
		SortOrder:  0,
		Translations: map[models.Locale]models.CVEntryTranslation{
			models.LocaleDA: {Title: "Kernestak"},
		},
	}}

	for _, e := range cv {
		if _, err := st.CreateCVEntry(ctx, e); err != nil {
			fmt.Printf("skip cv entry %q: %v\n", e.Title, err)
			continue
		}
		fmt.Printf("seeded cv entry %q\n", e.Title)
	}

	if _, err := st.PutSetting(ctx, "site", map[string]any{
		"title":       "Your Name",
		"tagline":     "Developer",
		"description": "I build small, sharp tools.",
		"email":       "you@example.com",
		"location":    "Denmark",
		"translations": map[string]any{
			"da": map[string]any{
				"tagline":     "Udvikler",
				"description": "Jeg bygger små, skarpe værktøjer.",
				"location":    "Danmark",
			},
		},
	}); err != nil {
		return err
	}
	if _, err := st.PutSetting(ctx, "about", map[string]any{
		"heading":       "About me",
		"body_markdown": "I am a developer who likes terminals, Postgres and small binaries.",
		"translations": map[string]any{
			"da": map[string]any{
				"heading":       "Om mig",
				"body_markdown": "Jeg er udvikler og holder af terminaler, Postgres og små binære filer.",
			},
		},
	}); err != nil {
		return err
	}
	if _, err := st.PutSetting(ctx, "socials", map[string]any{
		"links": []map[string]string{
			{"label": "GitHub", "url": "https://github.com/your-handle"},
			{"label": "LinkedIn", "url": "https://linkedin.com/in/your-handle"},
		},
	}); err != nil {
		return err
	}
	fmt.Println("seeded settings")
	return nil
}
