package httpapi

import (
	"net/http"

	"github.com/vbroendum/portfolio/api/internal/models"
)

// publicLocale reads ?lang= for a public read. Leaving it out means the
// default locale, so a client that predates translations keeps working. An
// unknown value is a 400 rather than a silent fallback, so a typo in the
// frontend shows up instead of quietly serving English.
func publicLocale(w http.ResponseWriter, r *http.Request) (models.Locale, bool) {
	raw := r.URL.Query().Get("lang")
	if raw == "" {
		return models.DefaultLocale, true
	}
	loc := models.Locale(raw)
	if !loc.Valid() {
		writeErr(w, http.StatusBadRequest, "bad_request", "lang must be one of: en, da")
		return "", false
	}
	return loc, true
}

// validTranslations rejects translation keys that are not a translated
// locale. The default locale is never a key: its text is in the base fields.
func validTranslations[T any](w http.ResponseWriter, m map[models.Locale]T) bool {
	for loc := range m {
		if !loc.Translated() {
			writeErr(w, http.StatusUnprocessableEntity, "validation",
				"translations may only contain: da (en is the base fields), got "+string(loc))
			return false
		}
	}
	return true
}
