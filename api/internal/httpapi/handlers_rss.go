package httpapi

import (
	"encoding/xml"
	"net/http"
	"time"

	"github.com/vbroendum/portfolio/api/internal/store"
)

// RSS 2.0 is generated here rather than in Next.js so the feed stays correct
// even if the frontend is swapped out.

type rssFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title       string    `xml:"title"`
	Link        string    `xml:"link"`
	Description string    `xml:"description"`
	Language    string    `xml:"language"`
	Updated     string    `xml:"lastBuildDate"`
	Items       []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	GUID        string `xml:"guid"`
	PubDate     string `xml:"pubDate"`
	Description string `xml:"description"`
}

func (s *Server) handleRSS(w http.ResponseWriter, r *http.Request) {
	posts, _, err := s.store.ListPosts(r.Context(), store.PostFilter{Limit: 50})
	if err != nil {
		writeStoreErr(w, err, "posts")
		return
	}
	settings, err := s.store.GetAllSettings(r.Context())
	if err != nil {
		writeStoreErr(w, err, "settings")
		return
	}

	site := settings["site"]
	title, _ := site["title"].(string)
	desc, _ := site["description"].(string)
	if title == "" {
		title = "Portfolio"
	}
	base := s.cfg.PublicSiteURL

	feed := rssFeed{
		Version: "2.0",
		Channel: rssChannel{
			Title:       title,
			Link:        base,
			Description: desc,
			Language:    "en",
			Updated:     time.Now().UTC().Format(time.RFC1123Z),
			Items:       make([]rssItem, 0, len(posts)),
		},
	}
	for _, p := range posts {
		pub := p.CreatedAt
		if p.PublishedAt != nil {
			pub = *p.PublishedAt
		}
		link := base + "/blog/" + p.Slug
		feed.Channel.Items = append(feed.Channel.Items, rssItem{
			Title:       p.Title,
			Link:        link,
			GUID:        link,
			PubDate:     pub.UTC().Format(time.RFC1123Z),
			Description: p.Summary,
		})
	}

	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=900")
	_, _ = w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	_ = enc.Encode(feed)
}
