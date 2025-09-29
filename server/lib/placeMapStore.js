// lib/placeMapStore.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../data");
const FILE = path.join(DATA_DIR, "place-map.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(
      FILE,
      JSON.stringify({ ssidMap: {}, bssidMap: {} }, null, 2)
    );
  }
}

function load() {
  ensureFile();
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const json = JSON.parse(raw);
    return {
      ssidMap: json.ssidMap || {},
      bssidMap: json.bssidMap || {},
    };
  } catch {
    return { ssidMap: {}, bssidMap: {} };
  }
}

function save(map) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(map, null, 2));
}

function setLabel({ ssid, bssid, label }) {
  if (!label || (!ssid && !bssid))
    throw new Error("label과 ssid/bssid 중 하나는 필수");
  const map = load();
  if (bssid) map.bssidMap[bssid.toLowerCase()] = label;
  else map.ssidMap[ssid] = label;
  save(map);
  return map;
}

function deleteLabel({ ssid, bssid }) {
  const map = load();
  if (bssid) delete map.bssidMap[bssid.toLowerCase()];
  if (ssid) delete map.ssidMap[ssid];
  save(map);
  return map;
}

module.exports = { load, setLabel, deleteLabel };
