// server/geoip.routes.js
const path = require("path");
const net = require("net");
const maxmind = require("maxmind");

let reader; // mmdb 리더 (프로세스 내 1회 로드)
const peerIpMap = new Map(); // peerId -> IP 저장

const normalizeIp = (ip) => (ip || "").replace(/^::ffff:/, "");
const isIp = (ip) => !!ip && net.isIP(ip) !== 0;

function lookup(ip) {
  if (!reader || !isIp(ip)) return null;
  try {
    const r = reader.get(ip);
    if (!r || !r.location) return null;
    const lat = r.location.latitude;
    const lon = r.location.longitude;
    const city = (r.city && (r.city.names.ko || r.city.names.en)) || undefined;
    const country =
      (r.country && (r.country.names.ko || r.country.names.en)) || undefined;
    return { lat, lon, city, country };
  } catch {
    return null;
  }
}

function clientIpFromReq(req) {
  // 프록시(nginx 등) 뒤면 X-Forwarded-For의 첫 IP가 실제 클라이언트
  const xf = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = xf || req.ip || (req.socket && req.socket.remoteAddress);
  return normalizeIp(raw);
}

/**
 * Express 앱에 GeoIP 라우트를 마운트
 */
async function mountGeoIpRoutes(
  app,
  {
    dbPath = path.resolve(process.cwd(), "server/GeoLite2-City.mmdb"),
    trustProxy = true,
    defaultAccuracyM = 8000, // GeoIP는 도시 수준 → 5~20km 권장
  } = {}
) {
  // 프록시 환경에서 실제 클라 IP 사용
  app.set("trust proxy", trustProxy);

  // mmdb 파일 로드 (1회)
  reader = await maxmind.open(dbPath);

  // 1) 이 요청을 보낸 클라이언트(브라우저)의 IP 기준
  app.get("/geoip/me", (req, res) => {
    const ip = clientIpFromReq(req);
    const pos = lookup(ip);
    if (!pos) return res.json({ ok: false, reason: "NO_LOCATION", ip });
    res.json({ ok: true, ip, pos, accuracyM: defaultAccuracyM });
  });

  // 2) 임의 IP로 조회 (관리/디버그)
  app.get("/geoip/by-ip", (req, res) => {
    const ip = normalizeIp(req.query.ip);
    const pos = lookup(ip);
    if (!pos) return res.json({ ok: false, reason: "NO_LOCATION", ip });
    res.json({ ok: true, ip, pos, accuracyM: defaultAccuracyM });
  });

  // 3) peerId -> IP 매핑 기반 조회 (시그널링에서 setPeerIp로 저장)
  app.get("/geoip/by-peer/:peerId", (req, res) => {
    const peerId = req.params.peerId;
    const ip = normalizeIp(peerIpMap.get(peerId));
    const pos = lookup(ip);
    if (!pos) return res.json({ ok: false, reason: "NO_LOCATION", peerId, ip });
    res.json({ ok: true, peerId, ip, pos, accuracyM: defaultAccuracyM });
  });
}

function setPeerIp(peerId, ip) {
  const n = normalizeIp(ip);
  if (isIp(n)) peerIpMap.set(peerId, n);
}
function getPeerIp(peerId) {
  return peerIpMap.get(peerId);
}

module.exports = {
  mountGeoIpRoutes,
  setPeerIp,
  getPeerIp,
};
