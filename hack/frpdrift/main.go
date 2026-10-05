// Command frpdrift answers one question: has frp gained or dropped a config field since
// FEATURE-MATRIX.md was last reviewed?
//
// It reflects over frp's config types -- the frpc common config, the frps config, every
// proxy and visitor type and every client and visitor plugin -- and compares the JSON
// field paths with known.txt, the set accepted at the last review.
//
//	go run ./hack/frpdrift          # compare with known.txt; exit 1 on drift
//	go run ./hack/frpdrift -write   # accept the current set as reviewed
//	go run ./hack/frpdrift -list    # print every path
//
// Run it on every frp bump, review each added path against FEATURE-MATRIX.md, then
// -write. It deliberately is not wired into CI: drift is a review prompt, not a failure.
//
// It cannot see a new proxy, visitor or plugin *type*: frp's type registries are
// unexported, so the type names below are listed by hand. frp's release notes still need
// reading for those.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"reflect"
	"sort"
	"strings"

	v1 "github.com/fatedier/frp/pkg/config/v1"
)

var (
	proxyTypes = []v1.ProxyType{
		v1.ProxyTypeTCP, v1.ProxyTypeUDP, v1.ProxyTypeTCPMUX, v1.ProxyTypeHTTP,
		v1.ProxyTypeHTTPS, v1.ProxyTypeSTCP, v1.ProxyTypeXTCP, v1.ProxyTypeSUDP,
	}
	visitorTypes = []v1.VisitorType{v1.VisitorTypeSTCP, v1.VisitorTypeXTCP, v1.VisitorTypeSUDP}
	pluginTypes  = []string{
		v1.PluginHTTP2HTTPS, v1.PluginHTTPProxy, v1.PluginHTTPS2HTTP, v1.PluginHTTPS2HTTPS,
		v1.PluginHTTP2HTTP, v1.PluginSocks5, v1.PluginStaticFile, v1.PluginUnixDomainSocket,
		v1.PluginTLS2Raw, v1.PluginVirtualNet,
	}
	visitorPluginTypes = []string{v1.VisitorPluginVirtualNet}
)

// currentPaths is every "<root> <json path>" line for the frp linked into this binary.
func currentPaths() ([]string, error) {
	roots := map[string]reflect.Type{
		"client": reflect.TypeFor[v1.ClientCommonConfig](),
		"server": reflect.TypeFor[v1.ServerConfig](),
	}
	for _, t := range proxyTypes {
		c := v1.NewProxyConfigurerByType(t)
		if c == nil {
			return nil, fmt.Errorf("frp no longer knows proxy type %q", t)
		}
		roots["proxy."+string(t)] = reflect.TypeOf(c)
	}
	for _, t := range visitorTypes {
		c := v1.NewVisitorConfigurerByType(t)
		if c == nil {
			return nil, fmt.Errorf("frp no longer knows visitor type %q", t)
		}
		roots["visitor."+string(t)] = reflect.TypeOf(c)
	}
	// Plugin option types are only reachable through the typed wrappers' decoders.
	for _, t := range pluginTypes {
		var p v1.TypedClientPluginOptions
		if err := json.Unmarshal([]byte(fmt.Sprintf(`{"type":%q}`, t)), &p); err != nil || p.ClientPluginOptions == nil {
			return nil, fmt.Errorf("frp no longer knows client plugin %q: %v", t, err)
		}
		roots["plugin."+t] = reflect.TypeOf(p.ClientPluginOptions)
	}
	for _, t := range visitorPluginTypes {
		var p v1.TypedVisitorPluginOptions
		if err := json.Unmarshal([]byte(fmt.Sprintf(`{"type":%q}`, t)), &p); err != nil || p.VisitorPluginOptions == nil {
			return nil, fmt.Errorf("frp no longer knows visitor plugin %q: %v", t, err)
		}
		roots["visitorPlugin."+t] = reflect.TypeOf(p.VisitorPluginOptions)
	}

	var out []string
	for root, t := range roots {
		for _, p := range fieldPaths(t) {
			out = append(out, root+" "+p)
		}
	}
	sort.Strings(out)
	return out, nil
}

func readKnown(path string) (map[string]bool, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	known := map[string]bool{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		known[line] = true
	}
	return known, sc.Err()
}

// diff returns the paths in current but not in known, and the reverse.
func diff(current []string, known map[string]bool) (added, removed []string) {
	seen := map[string]bool{}
	for _, p := range current {
		seen[p] = true
		if !known[p] {
			added = append(added, p)
		}
	}
	for p := range known {
		if !seen[p] {
			removed = append(removed, p)
		}
	}
	sort.Strings(removed)
	return added, removed
}

func main() {
	knownPath := flag.String("known", "hack/frpdrift/known.txt", "reviewed field paths")
	write := flag.Bool("write", false, "accept the current paths as reviewed")
	list := flag.Bool("list", false, "print every current path")
	flag.Parse()

	current, err := currentPaths()
	if err != nil {
		fmt.Fprintln(os.Stderr, "frpdrift:", err)
		os.Exit(2)
	}

	switch {
	case *list:
		fmt.Println(strings.Join(current, "\n"))
	case *write:
		body := "# frp config field paths reviewed against FEATURE-MATRIX.md.\n" +
			"# Regenerate with: go run ./hack/frpdrift -write\n" + strings.Join(current, "\n") + "\n"
		if err := os.WriteFile(*knownPath, []byte(body), 0o644); err != nil {
			fmt.Fprintln(os.Stderr, "frpdrift:", err)
			os.Exit(2)
		}
		fmt.Printf("wrote %d paths to %s\n", len(current), *knownPath)
	default:
		known, err := readKnown(*knownPath)
		if err != nil {
			fmt.Fprintln(os.Stderr, "frpdrift:", err)
			os.Exit(2)
		}
		added, removed := diff(current, known)
		for _, p := range added {
			fmt.Println("+ " + p)
		}
		for _, p := range removed {
			fmt.Println("- " + p)
		}
		if len(added)+len(removed) > 0 {
			fmt.Fprintf(os.Stderr, "frpdrift: %d added, %d removed since the last review\n", len(added), len(removed))
			os.Exit(1)
		}
		fmt.Printf("frpdrift: no drift (%d paths)\n", len(current))
	}
}
