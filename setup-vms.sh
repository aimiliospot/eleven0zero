#!/usr/bin/env bash
# Creates the 3 demo VMs in boxd. Safe to re-run: VMs that already exist are kept, not recreated.
#   keen-pond, free-sky   plain machines (patched, should come back "not affected")
#   cve-2024-6387-lab     isolated; one outdated package (PyYAML 5.3.1, CVE-2020-14343) for CVE Watchdog to flag
set -euo pipefail

LAB=cve-2024-6387-lab

new() { boxd machine get "$1" >/dev/null 2>&1 && echo "$1: exists, skipping create" || boxd machine new "$@"; }

new keen-pond --vcpu 2 --memory 8G
new free-sky  --vcpu 1 --memory 4G
new "$LAB" --isolated

# --- one outdated package for CVE Watchdog to flag; the fix is a single pip upgrade ---
boxd machine exec "$LAB" --timeout 240 -- 'pip3 install --break-system-packages --ignore-installed PyYAML==5.3.1' </dev/null

echo
echo "Done. Add keen-pond.boxd, free-sky.boxd and $LAB.boxd in CVE Watchdog."
echo "Watchdog copies ~/.ssh/config only at startup: docker restart genai-summit-hackathon-1100-watchdog-1"
