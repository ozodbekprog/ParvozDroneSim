#!/usr/bin/env bash
set -euo pipefail
# Keep Oracle Ubuntu's existing firewall rules and permit only the approved web ports.
[[ "$(id -u)" == 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
for port in 80 443; do
  if ! iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
  fi
done
netfilter-persistent save
iptables -S INPUT
