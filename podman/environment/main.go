// slk-env reloads mounted dotenv files and replaces itself with the service.
// The parser follows dotenv's MIT-licensed parse() (motdotla/dotenv), preserving
// literal dollars and backslashes instead of evaluating shell expressions.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"syscall"
)

var line = regexp.MustCompile("(?m)^\\s*(?:export\\s+)?([\\w.-]+)(?:\\s*=\\s*?|:\\s+?)(\\s*'(?:\\\\'|[^'])*'|\\s*\"(?:\\\\\"|[^\"])*\"|\\s*`(?:\\\\`|[^`])*`|[^#\\r\\n]+)?\\s*(?:#.*)?$")
var key = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func parse(input string) (map[string]string, error) {
	values := map[string]string{}
	if strings.ContainsRune(input, 0) {
		return nil, fmt.Errorf("invalid environment")
	}
	input = strings.ReplaceAll(strings.ReplaceAll(input, "\r\n", "\n"), "\r", "\n")
	for _, match := range line.FindAllStringSubmatch(input, -1) {
		if !key.MatchString(match[1]) {
			return nil, fmt.Errorf("invalid environment key")
		}
		value := strings.TrimSpace(match[2])
		if len(value) >= 2 && (value[0] == '\'' || value[0] == '"' || value[0] == '`') && value[len(value)-1] == value[0] {
			quote := value[0]
			value = value[1 : len(value)-1]
			if quote == '"' {
				value = strings.ReplaceAll(strings.ReplaceAll(value, `\n`, "\n"), `\r`, "\r")
			}
		}
		values[match[1]] = value
	}
	return values, nil
}

func environment(inherited []string, paths, locked string) (map[string]string, error) {
	values := map[string]string{}
	for _, entry := range inherited {
		k, v, ok := strings.Cut(entry, "=")
		if ok {
			values[k] = v
		}
	}
	pinned := map[string]string{}
	for _, name := range strings.Split(locked, ",") {
		if value, ok := values[name]; ok {
			pinned[name] = value
		}
	}
	for _, path := range strings.Split(paths, ":") {
		if path == "" {
			continue
		}
		info, err := os.Stat(path)
		if err != nil || !info.Mode().IsRegular() || info.Size() > 1024*1024 || (info.Mode().Perm() != 0600 && info.Mode().Perm() != 0400) {
			return nil, fmt.Errorf("environment file unavailable")
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("environment file unavailable")
		}
		parsed, err := parse(string(data))
		if err != nil {
			return nil, err
		}
		for k, v := range parsed {
			values[k] = v
		}
	}
	for k, v := range pinned {
		values[k] = v
	}
	values["SLK_ENV_FILES"] = paths
	values["SLK_ENV_LOCKED_KEYS"] = locked
	return values, nil
}

func run() error {
	if len(os.Args) < 2 {
		return fmt.Errorf("missing command")
	}
	locked := os.Getenv("SLK_ENV_LOCKED_KEYS")
	if strings.HasPrefix(os.Args[1], "--keep=") && len(os.Args) > 2 {
		locked += "," + strings.TrimPrefix(os.Args[1], "--keep=")
		os.Args = append(os.Args[:1], os.Args[2:]...)
	}
	values, err := environment(os.Environ(), os.Getenv("SLK_ENV_FILES"), locked)
	if err != nil {
		return err
	}
	os.Clearenv()
	for k, v := range values {
		if err := os.Setenv(k, v); err != nil {
			return fmt.Errorf("invalid environment")
		}
	}
	command, err := exec.LookPath(os.Args[1])
	if err != nil {
		return fmt.Errorf("command unavailable")
	}
	return syscall.Exec(command, os.Args[1:], os.Environ())
}
func main() {
	if run() != nil {
		fmt.Fprintln(os.Stderr, "Runtime environment or command could not be loaded; inspect private configuration.")
		os.Exit(1)
	}
}
