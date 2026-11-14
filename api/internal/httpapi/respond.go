// Package httpapi wires the HTTP surface: routing, request decoding, and the
// JSON envelope every response uses.
package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/vbroendum/portfolio/api/internal/store"
)

// ErrorBody is the shape of every non-2xx response:
//
//	{"error": {"code": "not_found", "message": "post not found"}}
type ErrorBody struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// ListEnvelope wraps collection responses so pagination can be added without
// breaking clients.
type ListEnvelope[T any] struct {
	Items  []T `json:"items"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encode response", "err", err)
	}
}

func writeErr(w http.ResponseWriter, status int, code, message string) {
	var b ErrorBody
	b.Error.Code = code
	b.Error.Message = message
	writeJSON(w, status, b)
}

// writeStoreErr maps store sentinels onto HTTP statuses. Anything unexpected is
// logged and reported as a generic 500 so internals never leak to the client.
func writeStoreErr(w http.ResponseWriter, err error, subject string) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeErr(w, http.StatusNotFound, "not_found", subject+" not found")
	case errors.Is(err, store.ErrConflict):
		writeErr(w, http.StatusConflict, "conflict", subject+" with that slug already exists")
	default:
		slog.Error("store error", "subject", subject, "err", err)
		writeErr(w, http.StatusInternalServerError, "internal", "something went wrong")
	}
}

// decodeJSON reads a request body into dst, rejecting unknown fields so typos
// in the CMS surface as errors instead of silently doing nothing.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "invalid JSON body: "+err.Error())
		return false
	}
	return true
}

func parseUUID(w http.ResponseWriter, raw string) (uuid.UUID, bool) {
	id, err := uuid.Parse(raw)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "invalid id")
		return uuid.Nil, false
	}
	return id, true
}

func queryInt(r *http.Request, key string, def int) int {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return def
	}
	return n
}

func queryBool(r *http.Request, key string) bool {
	b, err := strconv.ParseBool(r.URL.Query().Get(key))
	return err == nil && b
}
