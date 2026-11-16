package store

import (
	"encoding/json"
	"strings"

	"github.com/vbroendum/portfolio/api/internal/models"
)

// Localization lives in the store for the same reason draft filtering does: a
// new public endpoint built on these methods cannot forget to apply it.
//
// Every public read takes a locale:
//   - "" means "raw": the record as stored, with its Translations map. Admin
//     endpoints use this so the CMS can edit every language.
//   - any valid locale means "localized": translated fields are overlaid onto
//     the default-locale text, empty ones fall back to it, and Translations is
//     dropped from the response.

// pick returns the translation when it has content, else the fallback.
func pick(translated, fallback string) string {
	if strings.TrimSpace(translated) == "" {
		return fallback
	}
	return translated
}

func localizePost(p *models.Post, loc models.Locale) {
	if loc == "" {
		if p.Translations == nil {
			p.Translations = map[models.Locale]models.PostTranslation{}
		}
		return
	}
	p.Locale = models.DefaultLocale
	if t, ok := p.Translations[loc]; ok && loc.Translated() {
		p.Title = pick(t.Title, p.Title)
		p.Summary = pick(t.Summary, p.Summary)
		if strings.TrimSpace(t.BodyMarkdown) != "" {
			p.BodyMarkdown = t.BodyMarkdown
			p.ReadingMinutes = ReadingMinutes(t.BodyMarkdown)
			p.Locale = loc
		}
	}
	p.Translations = nil
}

func localizeProject(p *models.Project, loc models.Locale) {
	if loc == "" {
		if p.Translations == nil {
			p.Translations = map[models.Locale]models.ProjectTranslation{}
		}
		return
	}
	p.Locale = models.DefaultLocale
	if t, ok := p.Translations[loc]; ok && loc.Translated() {
		p.Title = pick(t.Title, p.Title)
		p.Tagline = pick(t.Tagline, p.Tagline)
		if strings.TrimSpace(t.BodyMarkdown) != "" {
			p.BodyMarkdown = t.BodyMarkdown
			p.Locale = loc
		}
	}
	p.Translations = nil
}

func localizeCVEntry(e *models.CVEntry, loc models.Locale) {
	if loc == "" {
		if e.Translations == nil {
			e.Translations = map[models.Locale]models.CVEntryTranslation{}
		}
		return
	}
	if t, ok := e.Translations[loc]; ok && loc.Translated() {
		e.Title = pick(t.Title, e.Title)
		e.Organization = pick(t.Organization, e.Organization)
		e.Location = pick(t.Location, e.Location)
		e.DescriptionMarkdown = pick(t.DescriptionMarkdown, e.DescriptionMarkdown)
		if len(t.Highlights) > 0 {
			e.Highlights = t.Highlights
		}
	}
	e.Translations = nil
}

// settingsTranslationsKey is where a settings blob keeps its other languages:
//
//	{"title": "Portfolio", "translations": {"da": {"tagline": "..."}}}
//
// Only top-level string fields are translated; anything else (the socials
// link list, the avatar id) is shared by every locale.
const settingsTranslationsKey = "translations"

func localizeSetting(v map[string]any, loc models.Locale) {
	if loc == "" {
		return
	}
	if all, ok := v[settingsTranslationsKey].(map[string]any); ok && loc.Translated() {
		if tr, ok := all[string(loc)].(map[string]any); ok {
			for key, val := range tr {
				s, isString := val.(string)
				_, baseIsString := v[key].(string)
				_, baseExists := v[key]
				if isString && strings.TrimSpace(s) != "" && (baseIsString || !baseExists) {
					v[key] = s
				}
			}
		}
	}
	delete(v, settingsTranslationsKey)
}

// translationsJSON encodes a translations map for a JSONB column. A nil map
// becomes {} rather than SQL NULL, which the column does not allow.
func translationsJSON[T any](m map[models.Locale]T) (string, error) {
	if m == nil {
		return "{}", nil
	}
	b, err := json.Marshal(m)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
