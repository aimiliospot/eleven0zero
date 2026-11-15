"""Deletes EVERY machine in the active boxd org (cannot be undone). Asks you to type 'delete' first."""
from boxd import boxd, names

vms = names("machine")
if not vms:
    raise SystemExit("No machines.")
print("These machines will be PERMANENTLY deleted:", *vms, sep="\n  ")
if input("Type 'delete' to continue: ") != "delete":
    raise SystemExit("Aborted.")
for vm in vms:
    if boxd("machine", "remove", vm, "-y", check=False).returncode:
        print(f"failed to remove {vm}")
