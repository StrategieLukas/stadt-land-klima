package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLiteralDotenvAndReload(t *testing.T) {
	path := filepath.Join(t.TempDir(), "service.env")
	first := "export TOKEN='a$HOME $(touch /tmp/no-shell) # literal'\nEMPTY=\nMULTI=\"one\\ntwo\"\nCACHE_ENABLED=true\n"
	if err := os.WriteFile(path, []byte(first), 0600); err != nil {
		t.Fatal(err)
	}
	inherited := []string{"CACHE_ENABLED=false", "TOKEN=stale"}
	values, err := environment(inherited, path, "CACHE_ENABLED")
	if err != nil {
		t.Fatal(err)
	}
	if values["TOKEN"] != "a$HOME $(touch /tmp/no-shell) # literal" || values["MULTI"] != "one\ntwo" || values["CACHE_ENABLED"] != "false" || values["EMPTY"] != "" {
		t.Fatal("literal parsing or managed controls changed")
	}
	if err := os.WriteFile(path, []byte("TOKEN=changed\n"), 0600); err != nil {
		t.Fatal(err)
	}
	values, err = environment(inherited, path, "CACHE_ENABLED")
	if err != nil || values["TOKEN"] != "changed" {
		t.Fatal("restart retained stale environment")
	}
}

func TestFileOrderAndFailure(t *testing.T) {
	directory := t.TempDir()
	a, b := filepath.Join(directory, "a"), filepath.Join(directory, "b")
	for path, value := range map[string]string{a: "KEY=first\n", b: "KEY=last\n"} {
		if err := os.WriteFile(path, []byte(value), 0600); err != nil {
			t.Fatal(err)
		}
	}
	values, err := environment(nil, a+":"+b, "")
	if err != nil || values["KEY"] != "last" {
		t.Fatal("shared file precedence changed")
	}
	if _, err := environment(nil, a+":/missing-runtime-file", ""); err == nil {
		t.Fatal("missing mount accepted")
	}
	if _, err := parse("TOKEN=bad\x00value"); err == nil {
		t.Fatal("NUL accepted")
	}
	if err := os.Chmod(a, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := environment(nil, a, ""); err == nil {
		t.Fatal("shared environment file accepted")
	}
}
