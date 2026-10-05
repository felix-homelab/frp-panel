import { ClientVersion } from "@/lib/pb/api_master"

export function NeedUpgrade(version: ClientVersion | undefined) {
    if (!(version)) return false
    if (!version.gitVersion) return false
    const versionString = version?.gitVersion
    const [a, b, c] = versionString.split('.')
    if (Number(b) < 1) {
        return true
    }

    console.log(Number(a), Number(b), Number(c))

    if (a=='v0' && Number(b)<=1 && Number(c) <= 10) {
        return true
    }

    return false
}
/**
 * Mirrors frpx.SupportsWireProtocolV2: frp >= v0.69 on an agent, from the frpVersion it
 * reports. Empty (offline, or an agent too old to report it) or unparsable is "no" --
 * the backend re-checks authoritatively in biz/master/client/wire_protocol.go.
 */
export function SupportsWireProtocolV2(frpVersion: string | undefined) {
    const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec((frpVersion || '').trim())
    if (!m) return false
    const [major, minor] = [Number(m[1]), Number(m[2] || 0)]
    return major > 0 || minor >= 69
}
