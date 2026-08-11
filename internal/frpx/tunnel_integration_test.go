//go:build integration

// Package frpx_test stands up a real frps and a real frpc in one process and pushes real
// bytes through every tunnel type frp-panel supports.
//
// This exists to gate frp version bumps. frp-panel has no other test that exercises a
// tunnel, and CI runs no Go tests at all, so without this an frp upgrade is verified only
// by "it compiles".
//
// Run it explicitly:
//
//	go test -tags integration -run TestTunnelMatrix -v ./internal/frpx/...
//
// It is behind a build tag because it binds real ports and takes ~30s.
//
// It is deliberately an external test package (frpx_test): it imports services/client and
// services/server, both of which import internal/frpx, which would be an import cycle for
// an in-package test.
package frpx_test

import (
	"bufio"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/VaalaCat/frp-panel/internal/frpx"
	fclient "github.com/VaalaCat/frp-panel/services/client"
	fserver "github.com/VaalaCat/frp-panel/services/server"
	"github.com/VaalaCat/frp-panel/utils"
	v1 "github.com/fatedier/frp/pkg/config/v1"
)

const (
	testUser  = "alice"
	testToken = "integration-test-token"

	tcpEchoReply  = "echo-tcp"
	udpEchoReply  = "echo-udp"
	httpBodyReply = "echo-http"

	phaseRunning = "running"

	startupTimeout = 30 * time.Second
	dialTimeout    = 5 * time.Second
)

var enableMetricsOnce sync.Once

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------

func TestTunnelMatrix(t *testing.T) {
	enableMetricsOnce.Do(frpx.EnableMemMetrics)

	p := allocPorts(t,
		"frps", "vhostHTTP", "vhostHTTPS", "tcpmux",
		"tcpRemote", "udpRemote",
		"stcpVisitor", "sudpVisitor",
	)

	// Local backends the tunnels point at.
	tcpBackend := startTCPEcho(t)
	udpBackend := startUDPEcho(t)
	httpBackend := startHTTPBackend(t)

	certPath, keyPath := writeSelfSignedCert(t)

	// ---- frps ----
	svrCfg := utils.NewBaseFRPServerConfig(p["frps"], testToken)
	svrCfg.VhostHTTPPort = p["vhostHTTP"]
	svrCfg.VhostHTTPSPort = p["vhostHTTPS"]
	svrCfg.TCPMuxHTTPConnectPort = p["tcpmux"]
	svrCfg.Complete()

	srv := fserver.NewServerHandler(svrCfg)
	go srv.Run()
	t.Cleanup(srv.Stop)

	waitPortOpen(t, p["frps"])

	// ---- frpc ----
	//
	// Deliberately routed through utils.LoadClientConfig rather than hand-built structs.
	// That is the exact path production uses (master pushes JSON, agent loads it), and it
	// is where frp's Complete() fan-out runs -- the thing that changed in frp v0.68.
	cliCfg, proxyCfgs, visitorCfgs := loadClientConfig(t, fmt.Sprintf(`{
  "user": %q,
  "serverAddr": "127.0.0.1",
  "serverPort": %d,
  "auth": { "method": "token", "token": %q },
  "proxies": [
    { "name": "tcp-test",    "type": "tcp",  "localIP": "127.0.0.1", "localPort": %d, "remotePort": %d },
    { "name": "udp-test",    "type": "udp",  "localIP": "127.0.0.1", "localPort": %d, "remotePort": %d },
    { "name": "http-test",   "type": "http", "localIP": "127.0.0.1", "localPort": %d,
      "customDomains": ["http.example.com"] },
    { "name": "https-test",  "type": "https",
      "customDomains": ["https.example.com"],
      "plugin": { "type": "https2http", "localAddr": "127.0.0.1:%d", "crtPath": %q, "keyPath": %q } },
    { "name": "tcpmux-test", "type": "tcpmux", "multiplexer": "httpconnect",
      "customDomains": ["mux.example.com"], "localIP": "127.0.0.1", "localPort": %d },
    { "name": "stcp-test",   "type": "stcp", "secretKey": "stcp-secret",
      "localIP": "127.0.0.1", "localPort": %d },
    { "name": "sudp-test",   "type": "sudp", "secretKey": "sudp-secret",
      "localIP": "127.0.0.1", "localPort": %d }
  ],
  "visitors": [
    { "name": "stcp-visitor", "type": "stcp", "serverName": "stcp-test",
      "secretKey": "stcp-secret", "bindAddr": "127.0.0.1", "bindPort": %d },
    { "name": "sudp-visitor", "type": "sudp", "serverName": "sudp-test",
      "secretKey": "sudp-secret", "bindAddr": "127.0.0.1", "bindPort": %d }
  ]
}`,
		testUser, p["frps"], testToken,
		tcpBackend, p["tcpRemote"],
		udpBackend, p["udpRemote"],
		httpBackend,
		httpBackend, certPath, keyPath,
		tcpBackend,
		tcpBackend,
		udpBackend,
		p["stcpVisitor"], p["sudpVisitor"],
	))

	cli := fclient.NewClientHandler(cliCfg, proxyCfgs, visitorCfgs)
	go cli.Run()
	t.Cleanup(cli.Stop)

	proxyNames := []string{
		"tcp-test", "udp-test", "http-test", "https-test",
		"tcpmux-test", "stcp-test", "sudp-test",
	}
	for _, name := range proxyNames {
		waitProxyRunning(t, cli, name)
	}

	// ---- the tunnels ----

	t.Run("tcp", func(t *testing.T) {
		assertTCPEcho(t, fmt.Sprintf("127.0.0.1:%d", p["tcpRemote"]))
	})

	t.Run("udp", func(t *testing.T) {
		assertUDPEcho(t, fmt.Sprintf("127.0.0.1:%d", p["udpRemote"]))
	})

	t.Run("http", func(t *testing.T) {
		assertHTTPBody(t, fmt.Sprintf("http://127.0.0.1:%d/", p["vhostHTTP"]), "http.example.com", nil)
	})

	t.Run("https", func(t *testing.T) {
		assertHTTPBody(t,
			fmt.Sprintf("https://127.0.0.1:%d/", p["vhostHTTPS"]),
			"https.example.com",
			&tls.Config{InsecureSkipVerify: true, ServerName: "https.example.com"},
		)
	})

	t.Run("tcpmux", func(t *testing.T) {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", p["tcpmux"]), dialTimeout)
		if err != nil {
			t.Fatalf("dial tcpmux connect port: %v", err)
		}
		defer conn.Close()

		// httpconnect multiplexing: the CONNECT target selects the proxy by domain.
		req := "CONNECT mux.example.com:80 HTTP/1.1\r\nHost: mux.example.com:80\r\n\r\n"
		if _, err := conn.Write([]byte(req)); err != nil {
			t.Fatalf("write CONNECT: %v", err)
		}
		br := bufio.NewReader(conn)
		statusLine, err := br.ReadString('\n')
		if err != nil {
			t.Fatalf("read CONNECT response: %v", err)
		}
		if !strings.Contains(statusLine, "200") {
			t.Fatalf("CONNECT rejected: %q", strings.TrimSpace(statusLine))
		}
		for { // drain headers
			line, err := br.ReadString('\n')
			if err != nil {
				t.Fatalf("drain CONNECT headers: %v", err)
			}
			if strings.TrimSpace(line) == "" {
				break
			}
		}

		if _, err := conn.Write([]byte(tcpEchoReply)); err != nil {
			t.Fatalf("write through tcpmux: %v", err)
		}
		got := make([]byte, len(tcpEchoReply))
		_ = conn.SetReadDeadline(time.Now().Add(dialTimeout))
		if _, err := io.ReadFull(br, got); err != nil {
			t.Fatalf("read through tcpmux: %v", err)
		}
		if string(got) != tcpEchoReply {
			t.Fatalf("tcpmux echo = %q, want %q", got, tcpEchoReply)
		}
	})

	t.Run("stcp", func(t *testing.T) {
		waitPortOpen(t, p["stcpVisitor"])
		assertTCPEcho(t, fmt.Sprintf("127.0.0.1:%d", p["stcpVisitor"]))
	})

	t.Run("sudp", func(t *testing.T) {
		assertUDPEcho(t, fmt.Sprintf("127.0.0.1:%d", p["sudpVisitor"]))
	})

	t.Run("xtcp", func(t *testing.T) {
		if os.Getenv("FRPX_TEST_XTCP") == "" {
			t.Skip("xtcp needs NAT hole punching and is unreliable on loopback; " +
				"set FRPX_TEST_XTCP=1 to attempt it. Covered by the manual runbook instead.")
		}
		t.Skip("xtcp loopback harness not implemented; verify via docs/frp-upgrade-verification.md")
	})

	// ---- the regression guard this file exists for ----
	//
	// frp <= v0.67 rewrote the config Name to "{user}.{name}" during Complete(), so the
	// client-side status map was keyed by the prefixed name. frp >= v0.68 keeps the raw
	// name in config and applies the prefix only on the wire.
	//
	// This repo crossed that boundary at frp v0.70.1; the expectations below are the
	// post-v0.68 ones. The wire name is identical in both generations, which is why the
	// server-side assertion is version-independent while the client-side one is not. If
	// this subtest fails after a future frp bump, that IS the finding -- flip the
	// expectation and fix the lookups that depend on it (biz/client/get_proxy_info.go,
	// which resolves both forms via frpx.RawProxyName / frpx.WireProxyName).
	t.Run("proxy name correlation", func(t *testing.T) {
		raw := "tcp-test"
		wire := frpx.WireProxyName(testUser, raw)

		_, rawOK := cli.GetProxyStatus(raw)
		_, wireOK := cli.GetProxyStatus(wire)
		t.Logf("client-side status lookup: raw(%q)=%v wire(%q)=%v", raw, rawOK, wire, wireOK)

		// frp >= v0.68 semantics: the client keys proxies by the RAW config name.
		if !rawOK {
			t.Errorf("client-side lookup by raw name %q failed; "+
				"frp >= v0.68 should key by the raw config name.", raw)
		}
		if wireOK {
			t.Errorf("client-side lookup by wire name %q succeeded; "+
				"frp >= v0.68 should no longer key by the prefixed name. "+
				"If frp reverted to prefixing during Complete(), update this assertion "+
				"and re-check biz/client/get_proxy_info.go.", wire)
		}

		// Version-independent: frps always sees the prefixed name.
		stats := srv.GetProxyStatsByType(v1.ProxyTypeTCP)
		names := make([]string, 0, len(stats))
		for _, s := range stats {
			names = append(names, s.Name)
		}
		t.Logf("server-side ProxyStats names: %v", names)
		if !contains(names, wire) {
			t.Errorf("frps ProxyStats has no proxy named %q; got %v. "+
				"The wire proxy name is expected to be stable across frp versions.", wire, names)
		}
	})
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

func loadClientConfig(t *testing.T, cfgJSON string) (
	*v1.ClientCommonConfig, []v1.ProxyConfigurer, []v1.VisitorConfigurer,
) {
	t.Helper()
	common, proxies, visitors, err := utils.LoadClientConfig([]byte(cfgJSON), true)
	if err != nil {
		t.Fatalf("load client config: %v\n---\n%s", err, cfgJSON)
	}
	return common, proxies, visitors
}

// ---------------------------------------------------------------------------
// waiting
// ---------------------------------------------------------------------------

// waitProxyRunning blocks until the named proxy reports "running".
//
// The lookup is tolerant of both name forms on purpose: this helper must keep working
// across the frp v0.68 naming change so that a bump produces a clear assertion failure in
// the correlation subtest rather than a 30s hang in every subtest.
func waitProxyRunning(t *testing.T, cli interface {
	GetProxyStatus(string) (*frpx.ProxyWorkingStatus, bool)
}, rawName string) {
	t.Helper()

	wireName := frpx.WireProxyName(testUser, rawName)
	deadline := time.Now().Add(startupTimeout)
	var last string

	for time.Now().Before(deadline) {
		for _, candidate := range []string{rawName, wireName} {
			st, ok := cli.GetProxyStatus(candidate)
			if !ok {
				continue
			}
			if st.Phase == phaseRunning {
				return
			}
			last = fmt.Sprintf("phase=%q err=%q", st.Phase, st.Err)
		}
		time.Sleep(200 * time.Millisecond)
	}
	t.Fatalf("proxy %q never reached %q within %s (last: %s)", rawName, phaseRunning, startupTimeout, last)
}

func waitPortOpen(t *testing.T, port int) {
	t.Helper()
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	deadline := time.Now().Add(startupTimeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return
		}
		time.Sleep(150 * time.Millisecond)
	}
	t.Fatalf("port %d never opened within %s", port, startupTimeout)
}

// ---------------------------------------------------------------------------
// assertions
// ---------------------------------------------------------------------------

func assertTCPEcho(t *testing.T, addr string) {
	t.Helper()
	conn, err := net.DialTimeout("tcp", addr, dialTimeout)
	if err != nil {
		t.Fatalf("dial %s: %v", addr, err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(dialTimeout))

	if _, err := conn.Write([]byte(tcpEchoReply)); err != nil {
		t.Fatalf("write %s: %v", addr, err)
	}
	got := make([]byte, len(tcpEchoReply))
	if _, err := io.ReadFull(conn, got); err != nil {
		t.Fatalf("read %s: %v", addr, err)
	}
	if string(got) != tcpEchoReply {
		t.Fatalf("tcp echo via %s = %q, want %q", addr, got, tcpEchoReply)
	}
}

func assertUDPEcho(t *testing.T, addr string) {
	t.Helper()
	conn, err := net.DialTimeout("udp", addr, dialTimeout)
	if err != nil {
		t.Fatalf("dial udp %s: %v", addr, err)
	}
	defer conn.Close()

	// UDP through frp can drop the first datagram while the session is being set up.
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		_ = conn.SetDeadline(time.Now().Add(2 * time.Second))
		if _, err := conn.Write([]byte(udpEchoReply)); err != nil {
			lastErr = err
			continue
		}
		buf := make([]byte, 64)
		n, err := conn.Read(buf)
		if err != nil {
			lastErr = err
			continue
		}
		if string(buf[:n]) != udpEchoReply {
			t.Fatalf("udp echo via %s = %q, want %q", addr, buf[:n], udpEchoReply)
		}
		return
	}
	t.Fatalf("udp echo via %s failed after 5 attempts: %v", addr, lastErr)
}

func assertHTTPBody(t *testing.T, url, host string, tlsCfg *tls.Config) {
	t.Helper()
	client := &http.Client{
		Timeout:   dialTimeout,
		Transport: &http.Transport{TLSClientConfig: tlsCfg},
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("build request %s: %v", url, err)
	}
	req.Host = host

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET %s (Host %s): %v", url, host, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body from %s: %v", url, err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET %s (Host %s) = %d, want 200 (body %q)", url, host, resp.StatusCode, body)
	}
	if strings.TrimSpace(string(body)) != httpBodyReply {
		t.Fatalf("GET %s (Host %s) body = %q, want %q", url, host, body, httpBodyReply)
	}
}

// ---------------------------------------------------------------------------
// local backends
// ---------------------------------------------------------------------------

func startTCPEcho(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen tcp echo: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				_, _ = io.Copy(c, c)
			}(conn)
		}
	}()
	return ln.Addr().(*net.TCPAddr).Port
}

func startUDPEcho(t *testing.T) int {
	t.Helper()
	pc, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen udp echo: %v", err)
	}
	t.Cleanup(func() { _ = pc.Close() })

	go func() {
		buf := make([]byte, 2048)
		for {
			n, addr, err := pc.ReadFrom(buf)
			if err != nil {
				return
			}
			_, _ = pc.WriteTo(buf[:n], addr)
		}
	}()
	return pc.LocalAddr().(*net.UDPAddr).Port
}

func startHTTPBackend(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen http backend: %v", err)
	}
	srv := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = io.WriteString(w, httpBodyReply)
		}),
	}
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() { _ = srv.Close() })
	return ln.Addr().(*net.TCPAddr).Port
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// allocPorts reserves a free port per name by binding and immediately releasing. This is
// inherently racy, but it is what frp's own tests do and the window is small.
func allocPorts(t *testing.T, names ...string) map[string]int {
	t.Helper()
	out := make(map[string]int, len(names))
	for _, name := range names {
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatalf("allocate port for %s: %v", name, err)
		}
		out[name] = ln.Addr().(*net.TCPAddr).Port
		_ = ln.Close()
	}
	return out
}

func writeSelfSignedCert(t *testing.T) (certPath, keyPath string) {
	t.Helper()
	dir := t.TempDir()
	certPath = filepath.Join(dir, "tls.crt")
	keyPath = filepath.Join(dir, "tls.key")

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	tmpl := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "https.example.com"},
		DNSNames:     []string{"https.example.com"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}

	writePEM(t, certPath, &pem.Block{Type: "CERTIFICATE", Bytes: der})
	writePEM(t, keyPath, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	return certPath, keyPath
}

func writePEM(t *testing.T, path string, blk *pem.Block) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create %s: %v", path, err)
	}
	defer f.Close()
	if err := pem.Encode(f, blk); err != nil {
		t.Fatalf("encode %s: %v", path, err)
	}
}

func contains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
