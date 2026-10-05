package main

import (
	"encoding"
	"encoding/json"
	"reflect"
	"sort"
	"strings"
)

var (
	jsonMarshaler = reflect.TypeFor[json.Marshaler]()
	textMarshaler = reflect.TypeFor[encoding.TextMarshaler]()
)

// fieldPaths returns the JSON field path of every leaf reachable from t, the way
// encoding/json -- and therefore frp's strict decoder -- sees it:
//
//   - the JSON name comes from the tag; untagged fields use the Go name;
//   - `json:"-"` and unexported fields are skipped;
//   - an embedded struct without a JSON name is inlined into its parent, which is how
//     frp flattens ProxyBaseConfig, DomainConfig, ProxyBackend and TLSConfig;
//   - a type with its own JSON or text marshalling, a map, or an interface is a leaf,
//     because its keys are not a fixed field set;
//   - slices and arrays of structs continue as "path[].field".
func fieldPaths(t reflect.Type) []string {
	set := map[string]struct{}{}
	walk(t, "", set, map[reflect.Type]bool{})
	out := make([]string, 0, len(set))
	for p := range set {
		out = append(out, p)
	}
	sort.Strings(out)
	return out
}

func walk(t reflect.Type, prefix string, out map[string]struct{}, onPath map[reflect.Type]bool) {
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}

	if prefix != "" && isLeaf(t) {
		out[prefix] = struct{}{}
		return
	}

	switch t.Kind() {
	case reflect.Slice, reflect.Array:
		walk(t.Elem(), prefix+"[]", out, onPath)
		return
	case reflect.Struct:
	default:
		if prefix != "" {
			out[prefix] = struct{}{}
		}
		return
	}

	if onPath[t] { // a recursive type; frp has none today, but do not loop if it gains one
		out[prefix] = struct{}{}
		return
	}
	onPath[t] = true
	defer delete(onPath, t)

	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "-" {
			continue
		}
		if f.Anonymous && name == "" {
			ft := f.Type
			for ft.Kind() == reflect.Pointer {
				ft = ft.Elem()
			}
			if ft.Kind() == reflect.Struct && !isLeaf(ft) {
				walk(ft, prefix, out, onPath) // inlined
			}
			// An embedded interface (frp's TypedClientPluginOptions) carries no fields of
			// its own here; plugin option types are separate roots.
			continue
		}
		if !f.IsExported() {
			continue
		}
		if name == "" {
			name = f.Name
		}
		path := name
		if prefix != "" {
			path = prefix + "." + name
		}
		walk(f.Type, path, out, onPath)
	}
}

func isLeaf(t reflect.Type) bool {
	if t.Implements(jsonMarshaler) || reflect.PointerTo(t).Implements(jsonMarshaler) ||
		t.Implements(textMarshaler) || reflect.PointerTo(t).Implements(textMarshaler) {
		return true
	}
	switch t.Kind() {
	case reflect.Map, reflect.Interface:
		return true
	}
	return false
}
