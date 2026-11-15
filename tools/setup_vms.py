"""Creates the 3 demo VMs in boxd. Safe to re-run: existing VMs are kept.
keen-pond, free-sky are clean; cve-2024-6387-lab gets PyYAML 5.3.1 (CVE-2020-14343) for eleven0zero to flag."""
from boxd import DEMO_VMS, LAB, boxd

for name, flags in DEMO_VMS.items():
    if boxd("machine", "get", name, check=False, capture=True).returncode == 0:
        print(f"{name}: exists, skipping create")
    else:
        boxd("machine", "new", name, *flags)

boxd("machine", "exec", LAB, "--timeout", "240", "--",
     "pip3 install --break-system-packages --ignore-installed PyYAML==5.3.1")
print(f"\nDone. Add {', '.join(n + '.boxd' for n in DEMO_VMS)} in eleven0zero, then `docker compose restart` "
      "so it picks up ~/.ssh/config.")
