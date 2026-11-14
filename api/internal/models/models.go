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
}

// Setting is a free-form JSON blob keyed by name ("site", "about", "socials").
type Setting struct {
	Key       string         `json:"key"`
	Value     map[string]any `json:"value"`
	UpdatedAt time.Time      `json:"updated_at"`
}
