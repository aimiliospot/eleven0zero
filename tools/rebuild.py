"""Resets boxd: deletes the demo VMs and ALL snapshots in the active org, then recreates the demo VMs.
Afterwards, on the host: docker compose down -v && docker compose up --build -d  (resets the DB volume)."""
import runpy
from boxd import DEMO_VMS, boxd, names

for vm in DEMO_VMS:
    boxd("machine", "remove", vm, "-y", check=False)  # ponytail: best-effort, ok if already gone
for snap in names("snapshots"):
    if boxd("snapshots", "remove", snap, "-y", check=False).returncode:
        print(f"failed to remove snapshot {snap}")
runpy.run_path("setup_vms.py")
print("\nNow run on the host: docker compose down -v && docker compose up --build -d")
