// Package migrations embeds the SQL migration files so the server can apply
// them at boot without needing a migration binary in the container.
package migrations

import "embed"

// FS holds every *.sql migration, applied in lexical filename order.
//
//go:embed *.sql
var FS embed.FS
