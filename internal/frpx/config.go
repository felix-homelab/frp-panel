package frpx

import (
	"github.com/fatedier/frp/pkg/config"
	v1 "github.com/fatedier/frp/pkg/config/v1"
)

// TemplateValues are the values frp exposes to config templates.
type TemplateValues = config.Values

// TemplateDefaults returns the default template values (env, etc.).
func TemplateDefaults() *TemplateValues {
	return config.GetValues()
}

// RenderTemplate expands a config's template directives.
func RenderTemplate(content []byte, values *TemplateValues) ([]byte, error) {
	return config.RenderWithTemplate(content, values)
}

// DecodeConfig decodes TOML/YAML/JSON config content into out.
//
// frp-panel always decodes from a []byte pushed over gRPC by the master, never from a
// file path, so frp's path-based loaders are deliberately not used here.
func DecodeConfig(content []byte, out any, strict bool) error {
	return config.LoadConfigure(content, out, strict)
}

// CompleteProxy applies frp's defaults to a proxy config.
//
// The global config is still accepted but no longer used: through v0.67 Complete took
// the user name in order to rewrite Name to "{user}.{name}", and from v0.68 it takes
// nothing because user-prefixing moved to the wire layer. Keeping the parameter means
// utils.LoadClientConfig did not have to change when frp did.
//
// Completing twice is harmless now that Name is no longer rewritten, which matters
// because client.NewService completes every configurer again internally.
func CompleteProxy(c v1.ProxyConfigurer, _ *v1.ClientCommonConfig) {
	c.Complete()
}

// CompleteVisitor applies frp's defaults to a visitor config.
//
// See CompleteProxy for why the global config is still a parameter.
func CompleteVisitor(c v1.VisitorConfigurer, _ *v1.ClientCommonConfig) {
	c.Complete()
}
