#!/usr/bin/env bash
set -euo pipefail
# Run as root on a fresh Ubuntu ARM VM. Installs from official vendor/package sources.
[[ "$(id -u)" == 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == ubuntu && "$(dpkg --print-architecture)" == arm64 ]] || { echo 'Ubuntu ARM64 required.' >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl python3-venv xz-utils
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: arm64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# Pin each download to the checksum published alongside this Node 24 release.
node_temp="$(mktemp -d)"
trap 'rm -rf -- "$node_temp"' EXIT
curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$node_temp/SHASUMS256.txt"
node_archive="$(awk '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-arm64\.tar\.xz$/ {print $2}' "$node_temp/SHASUMS256.txt")"
[[ "$node_archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-arm64\.tar\.xz$ ]] || { echo 'No single Node 24 ARM64 archive.' >&2; exit 1; }
curl -fsSL "https://nodejs.org/dist/latest-v24.x/$node_archive" -o "$node_temp/$node_archive"
(cd "$node_temp" && awk -v file="$node_archive" '$2 == file' SHASUMS256.txt | sha256sum --check -)
install -d /opt/liftoff-node24
tar -xJf "$node_temp/$node_archive" -C /opt/liftoff-node24 --strip-components=1
ln -sfn /opt/liftoff-node24/bin/node /usr/local/bin/node
ln -sfn /opt/liftoff-node24/bin/npm /usr/local/bin/npm
ln -sfn /opt/liftoff-node24/bin/npx /usr/local/bin/npx

# OCI CLI runs with a dedicated interpreter, without changing Ubuntu's Python packages.
python3 -m venv /opt/liftoff-oci-cli
/opt/liftoff-oci-cli/bin/pip install --quiet oci-cli
ln -sfn /opt/liftoff-oci-cli/bin/oci /usr/local/bin/oci
id liftoff >/dev/null 2>&1 || useradd --create-home --shell /usr/sbin/nologin liftoff
usermod -aG docker liftoff
install -d -o liftoff -g liftoff /opt/liftoff/releases
node --version
docker compose version
oci --version
echo 'VM runtime ready. Network rules and application deployment are separate.'
