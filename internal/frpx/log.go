package frpx

import (
	frplog "github.com/fatedier/frp/pkg/util/log"
	golog "github.com/fatedier/golib/log"
)

// SetFRPLogger redirects frp's own logging into the given logger.
//
// This writes frp's package-level Logger variable, so it affects every frps and frpc in
// the process and is not safe to call concurrently with a running tunnel.
func SetFRPLogger(l *golog.Logger) {
	frplog.Logger = l
}
