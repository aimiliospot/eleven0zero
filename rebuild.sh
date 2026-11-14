#!/usr/bin/env bash
# Full reset + rebuild for a fresh docker build: deletes the 3 demo boxd VMs and ALL boxd snapshots
# in the active org (cannot be undone), resets the SQLite DB (drops the docker volumes), recreates
# the demo VMs, then rebuilds and restarts the stack. Run this INSTEAD OF `docker compose up --build`.
# Run:  ./rebuild.sh
set -euo pipefail
cd "$(dirname "$0")"

VMS=(keen-pond free-sky cve-2024-6387-lab)

echo "Deleting demo VMs..."
for v in "${VMS[@]}"; do boxd machine remove "$v" -y 2>/dev/null || true; done  # ponytail: best-effort, ok if a VM is already gone

echo "Deleting all boxd snapshots..."
boxd snapshots list --json | jq -r '.[].name' | while read -r s; do
    boxd snapshots remove "$s" -y || echo "failed to remove snapshot $s"
done

echo "Recreating demo VMs..."
./setup-vms.sh

echo "Resetting the database (dropping docker volumes) and rebuilding..."
docker compose down -v
docker compose up --build -d
