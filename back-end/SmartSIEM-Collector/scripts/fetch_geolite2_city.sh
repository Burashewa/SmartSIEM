#!/usr/bin/env bash
# Download GeoLite2-City.tar.gz from MaxMind (requires a free license key).
# Usage: export MAXMIND_LICENSE_KEY=your_key && ./scripts/fetch_geolite2_city.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="${ROOT}/data"
MMDB="${DEST_DIR}/GeoLite2-City.mmdb"

if [[ -z "${MAXMIND_LICENSE_KEY:-}" ]]; then
  echo "Set MAXMIND_LICENSE_KEY (from https://www.maxmind.com/en/accounts/current/license-key)" >&2
  exit 1
fi

mkdir -p "${DEST_DIR}"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

URL="https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz"
echo "Downloading GeoLite2-City..."
curl -fsSL "${URL}" -o "${TMP}/GeoLite2-City.tar.gz"
tar -xzf "${TMP}/GeoLite2-City.tar.gz" -C "${TMP}"
find "${TMP}" -name 'GeoLite2-City.mmdb' -exec cp -f {} "${MMDB}" \;
echo "Installed: ${MMDB}"
