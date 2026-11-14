package auth

import (
	"errors"
	"testing"
)

func TestHashAndVerify(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if err := VerifyPassword("correct horse battery staple", hash); err != nil {
		t.Fatalf("valid password rejected: %v", err)
	}
	if err := VerifyPassword("wrong password here", hash); !errors.Is(err, ErrInvalidPassword) {
		t.Fatalf("expected ErrInvalidPassword, got %v", err)
	}
}

func TestHashRejectsShortPasswords(t *testing.T) {
	if _, err := HashPassword("short"); err == nil {
		t.Fatal("expected short password to be rejected")
	}
}

func TestHashesAreSalted(t *testing.T) {
	a, _ := HashPassword("the same password")
	b, _ := HashPassword("the same password")
	if a == b {
		t.Fatal("two hashes of the same password should differ")
	}
}
