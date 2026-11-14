package store

import "testing"

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Hello, World!":          "hello-world",
		"  Æbleskiver på GitHub": "aebleskiver-paa-github",
		"Go 1.26 is out":         "go-1-26-is-out",
		"---":                    "untitled",
		"":                       "untitled",
	}
	for in, want := range cases {
		if got := Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSlugifyTruncates(t *testing.T) {
	long := ""
	for i := 0; i < 50; i++ {
		long += "word "
	}
	if got := Slugify(long); len(got) > 80 {
		t.Errorf("slug too long: %d chars", len(got))
	}
}

func TestReadingMinutes(t *testing.T) {
	if got := ReadingMinutes(""); got != 0 {
		t.Errorf("empty body should be 0 minutes, got %d", got)
	}
	if got := ReadingMinutes("one two three"); got != 1 {
		t.Errorf("short body should round up to 1, got %d", got)
	}
	words := ""
	for i := 0; i < 440; i++ {
		words += "w "
	}
	if got := ReadingMinutes(words); got != 2 {
		t.Errorf("440 words should be 2 minutes, got %d", got)
	}
}
