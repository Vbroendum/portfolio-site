package store

import (
	"testing"

	"github.com/vbroendum/portfolio/api/internal/models"
)

func danishPost() *models.Post {
	return &models.Post{
		Title:          "Hello",
		Summary:        "English summary",
		BodyMarkdown:   "English body",
		ReadingMinutes: 1,
		Translations: map[models.Locale]models.PostTranslation{
			models.LocaleDA: {Title: "Hej", BodyMarkdown: "Dansk tekst med flere ord"},
		},
	}
}

func TestLocalizePostOverlaysAndFallsBack(t *testing.T) {
	p := danishPost()
	localizePost(p, models.LocaleDA)

	if p.Title != "Hej" {
		t.Errorf("title = %q, want the Danish one", p.Title)
	}
	if p.Summary != "English summary" {
		t.Errorf("empty Danish summary should fall back, got %q", p.Summary)
	}
	if p.BodyMarkdown != "Dansk tekst med flere ord" || p.Locale != models.LocaleDA {
		t.Errorf("body = %q locale = %q, want the Danish body", p.BodyMarkdown, p.Locale)
	}
	if p.Translations != nil {
		t.Error("public reads must not carry the translations map")
	}
}

func TestLocalizePostUntranslatedBodyReportsDefault(t *testing.T) {
	p := danishPost()
	p.Translations[models.LocaleDA] = models.PostTranslation{Title: "Hej"}
	localizePost(p, models.LocaleDA)
	if p.Locale != models.DefaultLocale {
		t.Errorf("locale = %q, want %q when the body fell back", p.Locale, models.DefaultLocale)
	}
}

func TestLocalizePostDefaultLocaleIgnoresTranslations(t *testing.T) {
	p := danishPost()
	localizePost(p, models.LocaleEN)
	if p.Title != "Hello" || p.Locale != models.LocaleEN || p.Translations != nil {
		t.Errorf("got title %q locale %q translations %v", p.Title, p.Locale, p.Translations)
	}
}

func TestLocalizePostRawKeepsTranslations(t *testing.T) {
	p := &models.Post{Title: "Hello"}
	localizePost(p, "")
	if p.Translations == nil || p.Locale != "" {
		t.Error("raw reads should keep a non-nil translations map and no locale")
	}
}

func TestLocalizeCVHighlightsFallBackAsAWhole(t *testing.T) {
	e := &models.CVEntry{
		Title:      "Developer",
		Highlights: []string{"one", "two"},
		Translations: map[models.Locale]models.CVEntryTranslation{
			models.LocaleDA: {Title: "Udvikler"},
		},
	}
	localizeCVEntry(e, models.LocaleDA)
	if e.Title != "Udvikler" || len(e.Highlights) != 2 {
		t.Errorf("got title %q highlights %v", e.Title, e.Highlights)
	}
}

func TestLocalizeSetting(t *testing.T) {
	v := map[string]any{
		"title":   "Portfolio",
		"tagline": "I build things",
		"links":   []any{"kept"},
		"translations": map[string]any{
			"da": map[string]any{
				"tagline": "Jeg bygger ting",
				"title":   "  ",
				"links":   "not a string field in the base, ignored",
			},
		},
	}
	localizeSetting(v, models.LocaleDA)

	if v["tagline"] != "Jeg bygger ting" {
		t.Errorf("tagline = %v", v["tagline"])
	}
	if v["title"] != "Portfolio" {
		t.Errorf("blank translation should fall back, title = %v", v["title"])
	}
	if _, isList := v["links"].([]any); !isList {
		t.Errorf("non-string base fields must not be overwritten, links = %v", v["links"])
	}
	if _, ok := v["translations"]; ok {
		t.Error("translations key should be stripped from public reads")
	}
}

func TestTranslationsJSONNilIsEmptyObject(t *testing.T) {
	got, err := translationsJSON[models.PostTranslation](nil)
	if err != nil || got != "{}" {
		t.Errorf("got %q, %v", got, err)
	}
}
