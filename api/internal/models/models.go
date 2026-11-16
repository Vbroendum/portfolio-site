// Package models holds the domain types shared by the store and HTTP layers.
//
// JSON tags here are the API's public contract - the Next.js frontend types in
// web/lib/api/types.ts mirror them field for field. Change one, change both.
package models

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusDraft     Status = "draft"
	StatusPublished Status = "published"
)

func (s Status) Valid() bool { return s == StatusDraft || s == StatusPublished }

type DemoType string

const (
	DemoNone      DemoType = "none"
	DemoIframe    DemoType = "iframe"
	DemoVideo     DemoType = "video"
	DemoAsciinema DemoType = "asciinema"
	DemoGallery   DemoType = "gallery"
)

func (d DemoType) Valid() bool {
	switch d {
	case DemoNone, DemoIframe, DemoVideo, DemoAsciinema, DemoGallery:
		return true
	}
	return false
}

type CVKind string

const (
	CVExperience    CVKind = "experience"
	CVEducation     CVKind = "education"
	CVSkill         CVKind = "skill"
	CVCertification CVKind = "certification"
	CVOther         CVKind = "other"
)

func (k CVKind) Valid() bool {
	switch k {
	case CVExperience, CVEducation, CVSkill, CVCertification, CVOther:
		return true
	}
	return false
}

// Locale is a language the public site is served in.
//
// The default locale lives in each table's ordinary columns. Every other
// locale is stored in that row's `translations` column and overlaid onto the
// default when a public endpoint is asked for it (see store/i18n.go).
type Locale string

const (
	LocaleEN Locale = "en"
	LocaleDA Locale = "da"
)

// DefaultLocale is what an unprefixed request, or a request without ?lang=,
// is served in. Its text is in the base columns, never in `translations`.
const DefaultLocale = LocaleEN

// Valid reports whether the site is served in this locale at all.
func (l Locale) Valid() bool { return l == LocaleEN || l == LocaleDA }

// Translated reports whether this locale's text lives in `translations`.
func (l Locale) Translated() bool { return l.Valid() && l != DefaultLocale }

// PostTranslation holds the translatable fields of a post. An empty field
// falls back to the default locale's text.
type PostTranslation struct {
	Title        string `json:"title"`
	Summary      string `json:"summary"`
	BodyMarkdown string `json:"body_markdown"`
}

type ProjectTranslation struct {
	Title        string `json:"title"`
	Tagline      string `json:"tagline"`
	BodyMarkdown string `json:"body_markdown"`
}

// CVEntryTranslation: an empty Highlights list falls back as a whole, not
// bullet by bullet.
type CVEntryTranslation struct {
	Title               string   `json:"title"`
	Organization        string   `json:"organization"`
	Location            string   `json:"location"`
	DescriptionMarkdown string   `json:"description_markdown"`
	Highlights          []string `json:"highlights"`
}

type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Media struct {
	ID          uuid.UUID `json:"id"`
	StorageKey  string    `json:"-"`
	URL         string    `json:"url"`
	Filename    string    `json:"filename"`
	ContentType string    `json:"content_type"`
	SizeBytes   int64     `json:"size_bytes"`
	Width       *int      `json:"width,omitempty"`
	Height      *int      `json:"height,omitempty"`
	AltText     string    `json:"alt_text"`
	CreatedAt   time.Time `json:"created_at"`
}

type Post struct {
	ID             uuid.UUID  `json:"id"`
	Slug           string     `json:"slug"`
	Title          string     `json:"title"`
	Summary        string     `json:"summary"`
	BodyMarkdown   string     `json:"body_markdown"`
	CoverMediaID   *uuid.UUID `json:"cover_media_id,omitempty"`
	Cover          *Media     `json:"cover,omitempty"`
	Tags           []string   `json:"tags"`
	Status         Status     `json:"status"`
	ReadingMinutes int        `json:"reading_minutes"`
	PublishedAt    *time.Time `json:"published_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	// Translations is only present on admin reads. Public reads are already
	// localized and leave it out.
	Translations map[Locale]PostTranslation `json:"translations,omitempty"`
	// Locale is the language the body was actually served in, set only on
	// public reads. It differs from the requested one when the body has not
	// been translated yet and fell back to the default.
	Locale Locale `json:"locale,omitempty"`
}

type Project struct {
	ID           uuid.UUID  `json:"id"`
	Slug         string     `json:"slug"`
	Title        string     `json:"title"`
	Tagline      string     `json:"tagline"`
	BodyMarkdown string     `json:"body_markdown"`
	Tech         []string   `json:"tech"`
	RepoURL      string     `json:"repo_url"`
	LiveURL      string     `json:"live_url"`
	DemoType     DemoType   `json:"demo_type"`
	DemoURL      string     `json:"demo_url"`
	CoverMediaID *uuid.UUID `json:"cover_media_id,omitempty"`
	Cover        *Media     `json:"cover,omitempty"`
	Gallery      []Media    `json:"gallery"`
	Featured     bool       `json:"featured"`
	Status       Status     `json:"status"`
	SortOrder    int        `json:"sort_order"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	// Same contract as Post.Translations and Post.Locale.
	Translations map[Locale]ProjectTranslation `json:"translations,omitempty"`
	Locale       Locale                        `json:"locale,omitempty"`
}

type CVEntry struct {
	ID                  uuid.UUID `json:"id"`
	Kind                CVKind    `json:"kind"`
	Title               string    `json:"title"`
	Organization        string    `json:"organization"`
	Location            string    `json:"location"`
	StartDate           *string   `json:"start_date,omitempty"` // YYYY-MM-DD
	EndDate             *string   `json:"end_date,omitempty"`
	IsCurrent           bool      `json:"is_current"`
	DescriptionMarkdown string    `json:"description_markdown"`
	Highlights          []string  `json:"highlights"`
	SortOrder           int       `json:"sort_order"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
	// Only present on admin reads; public reads are already localized.
	Translations map[Locale]CVEntryTranslation `json:"translations,omitempty"`
}

// Setting is a free-form JSON blob keyed by name ("site", "about", "socials").
type Setting struct {
	Key       string         `json:"key"`
	Value     map[string]any `json:"value"`
	UpdatedAt time.Time      `json:"updated_at"`
}
