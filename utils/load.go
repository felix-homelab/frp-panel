package utils

import (
	"fmt"

	"github.com/VaalaCat/frp-panel/internal/frpx"
	v1 "github.com/fatedier/frp/pkg/config/v1"
	"github.com/samber/lo"
	"k8s.io/apimachinery/pkg/util/sets"
)

// ValidateNoDuplicateNames mirrors frp's own pkg/config.validateNoDuplicateNames, which
// frp-panel never reaches: that check lives in the path-based LoadClientConfigResult, and
// this codebase always decodes from a []byte pushed over gRPC. Without it a duplicate is
// not an error -- frp's ConfigSource keys proxies and visitors by name in a map, so the
// collision silently collapses and the last entry wins.
//
// Names are checked per kind, matching frp: a proxy and a visitor may share a name.
func ValidateNoDuplicateNames(proxyCfgs []v1.ProxyConfigurer, visitorCfgs []v1.VisitorConfigurer) error {
	proxyNames := sets.New[string]()
	for _, c := range proxyCfgs {
		name := c.GetBaseConfig().Name
		if proxyNames.Has(name) {
			return fmt.Errorf("duplicate proxy name: %s", name)
		}
		proxyNames.Insert(name)
	}

	visitorNames := sets.New[string]()
	for _, c := range visitorCfgs {
		name := c.GetBaseConfig().Name
		if visitorNames.Has(name) {
			return fmt.Errorf("duplicate visitor name: %s", name)
		}
		visitorNames.Insert(name)
	}

	return nil
}

func LoadContentWithTemplate(content []byte, values *frpx.TemplateValues) ([]byte, error) {
	return frpx.RenderTemplate(content, values)
}

func LoadConfigureFromContent(content []byte, c any, strict bool) error {
	ans, err := LoadContentWithTemplate(content, frpx.TemplateDefaults())
	if err != nil {
		return err
	}
	return frpx.DecodeConfig(ans, c, strict)
}

func LoadProxiesFromContent(content []byte) ([]v1.TypedProxyConfig, error) {
	allCfg := &v1.ClientConfig{}

	if err := LoadConfigureFromContent(content, allCfg, true); err != nil {
		return nil, err
	}

	return allCfg.Proxies, nil
}

func LoadVisitorsFromContent(content []byte) ([]v1.TypedVisitorConfig, error) {
	allCfg := &v1.ClientConfig{}

	if err := LoadConfigureFromContent(content, allCfg, true); err != nil {
		return nil, err
	}

	return allCfg.Visitors, nil
}

func LoadClientConfigNormal(content []byte, strict bool) (*v1.ClientConfig, error) {
	var (
		cliCfg *v1.ClientCommonConfig
	)

	allCfg := v1.ClientConfig{}
	if err := LoadConfigureFromContent(content, &allCfg, strict); err != nil {
		return nil, err
	}
	if err := ValidateNoDuplicateNames(
		lo.Map(allCfg.Proxies, func(c v1.TypedProxyConfig, _ int) v1.ProxyConfigurer { return c.ProxyConfigurer }),
		lo.Map(allCfg.Visitors, func(c v1.TypedVisitorConfig, _ int) v1.VisitorConfigurer { return c.VisitorConfigurer }),
	); err != nil {
		return nil, err
	}

	cliCfg = &allCfg.ClientCommonConfig
	cliCfg.Complete()
	allCfg.ClientCommonConfig = *cliCfg
	return &allCfg, nil
}

func LoadClientConfig(content []byte, strict bool) (
	*v1.ClientCommonConfig,
	[]v1.ProxyConfigurer,
	[]v1.VisitorConfigurer,
	error,
) {
	var (
		cliCfg      *v1.ClientCommonConfig
		proxyCfgs   = make([]v1.ProxyConfigurer, 0)
		visitorCfgs = make([]v1.VisitorConfigurer, 0)
	)

	allCfg := v1.ClientConfig{}
	if err := LoadConfigureFromContent(content, &allCfg, strict); err != nil {
		return nil, nil, nil, err
	}
	cliCfg = &allCfg.ClientCommonConfig
	for _, c := range allCfg.Proxies {
		proxyCfgs = append(proxyCfgs, c.ProxyConfigurer)
	}
	for _, c := range allCfg.Visitors {
		visitorCfgs = append(visitorCfgs, c.VisitorConfigurer)
	}

	if err := ValidateNoDuplicateNames(proxyCfgs, visitorCfgs); err != nil {
		return nil, nil, nil, err
	}

	// Filter by start
	if len(cliCfg.Start) > 0 {
		startSet := sets.New(cliCfg.Start...)
		proxyCfgs = lo.Filter(proxyCfgs, func(c v1.ProxyConfigurer, _ int) bool {
			return startSet.Has(c.GetBaseConfig().Name)
		})
		visitorCfgs = lo.Filter(visitorCfgs, func(c v1.VisitorConfigurer, _ int) bool {
			return startSet.Has(c.GetBaseConfig().Name)
		})
	}

	cliCfg.Complete()

	for _, c := range proxyCfgs {
		frpx.CompleteProxy(c, cliCfg)
	}
	for _, c := range visitorCfgs {
		frpx.CompleteVisitor(c, cliCfg)
	}
	return cliCfg, proxyCfgs, visitorCfgs, nil
}

func LoadServerConfig(content []byte, strict bool) (*v1.ServerConfig, error) {
	var (
		svrCfg = &v1.ServerConfig{}
	)
	if err := LoadConfigureFromContent(content, svrCfg, strict); err != nil {
		return nil, err
	}

	svrCfg.Complete()

	return svrCfg, nil
}
