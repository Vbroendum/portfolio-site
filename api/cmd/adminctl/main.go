// Command adminctl is the operator CLI for the portfolio API.
//
//	adminctl create-user  -email you@example.com [-name "Your Name"]
//	adminctl set-password -email you@example.com
//	adminctl migrate
//	adminctl seed            # demo content, for a fresh dev database
//
// The password is read from the PORTFOLIO_PASSWORD env var, or from stdin when
// that is unset, so it never ends up in your shell history.
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/vbroendum/portfolio/api/internal/auth"
	"github.com/vbroendum/portfolio/api/internal/database"
	"github.com/vbroendum/portfolio/api/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	if err := dispatch(os.Args[1], os.Args[2:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `adminctl - portfolio operator CLI

Commands:
  create-user  -email <email> [-name <name>]   create the admin account
  set-password -email <email>                  change an account's password
  migrate                                      apply pending migrations
  seed                                         insert demo content (dev only)

Password input: $PORTFOLIO_PASSWORD, else read from stdin.
Database:       $DATABASE_URL
`)
}

func dispatch(cmd string, args []string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	switch cmd {
	case "create-user":
		return cmdCreateUser(ctx, args)
	case "set-password":
		return cmdSetPassword(ctx, args)
	case "migrate":
		return cmdMigrate(ctx)
	case "seed":
		return cmdSeed(ctx)
	case "-h", "--help", "help":
		usage()
		return nil
	default:
		usage()
		return fmt.Errorf("unknown command %q", cmd)
	}
}

func connect(ctx context.Context) (*store.Store, func(), error) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return nil, nil, errors.New("DATABASE_URL is not set")
	}
	pool, err := database.Connect(ctx, url, 15*time.Second)
	if err != nil {
		return nil, nil, err
	}
	base := os.Getenv("PUBLIC_MEDIA_BASE_URL")
	if base == "" {
		base = "http://localhost:8080/media"
	}
	return store.New(pool, base), pool.Close, nil
}

func readPassword() (string, error) {
	if p := os.Getenv("PORTFOLIO_PASSWORD"); p != "" {
		return p, nil
	}
	fmt.Fprint(os.Stderr, "password (min 10 chars): ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil {
		return "", err
	}
	p := strings.TrimSpace(line)
	if p == "" {
		return "", errors.New("empty password")
	}
	return p, nil
}

func cmdCreateUser(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("create-user", flag.ExitOnError)
	email := fs.String("email", "", "admin email address")
	name := fs.String("name", "", "display name")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *email == "" {
		return errors.New("-email is required")
	}

	st, closeFn, err := connect(ctx)
	if err != nil {
		return err
	}
	defer closeFn()

	password, err := readPassword()
	if err != nil {
		return err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	u, err := st.CreateUser(ctx, *email, *name, hash)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			return fmt.Errorf("a user with email %s already exists (use set-password)", *email)
		}
		return err
	}
	fmt.Printf("created user %s (%s)\n", u.Email, u.ID)
	return nil
}

func cmdSetPassword(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("set-password", flag.ExitOnError)
	email := fs.String("email", "", "account email address")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *email == "" {
		return errors.New("-email is required")
	}

	st, closeFn, err := connect(ctx)
	if err != nil {
		return err
	}
	defer closeFn()

	u, err := st.GetUserByEmail(ctx, *email)
	if err != nil {
		return err
	}
	password, err := readPassword()
	if err != nil {
		return err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	if err := st.SetUserPassword(ctx, u.ID, hash); err != nil {
		return err
	}
	fmt.Printf("password updated for %s\n", u.Email)
	return nil
}

func cmdMigrate(ctx context.Context) error {
	st, closeFn, err := connect(ctx)
	if err != nil {
		return err
	}
	defer closeFn()

	applied, err := database.Migrate(ctx, st.Pool())
	if err != nil {
		return err
	}
	if len(applied) == 0 {
		fmt.Println("database already up to date")
		return nil
	}
	for _, name := range applied {
		fmt.Println("applied", name)
	}
	return nil
}
