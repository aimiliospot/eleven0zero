"""Creates the 3 demo VMs in boxd. Safe to re-run: existing VMs are kept.
hackathon-vm-1, hackathon-vm-2 are clean; hackathon-vulnerable-vm gets
Jinja2 3.1.2 (CVE-2024-22195, fixed by `pip install -U Jinja2`) for eleven0zero to flag."""
from boxd import DEMO_VMS, LAB, boxd

for name, flags in DEMO_VMS.items():
    if boxd("machine", "get", name, check=False, capture=True).returncode == 0:
        print(f"{name}: exists, skipping create")
    else:
        boxd("machine", "new", name, *flags)

boxd("machine", "exec", LAB, "--timeout", "240", "--",
     "pip3 install --break-system-packages --ignore-installed Jinja2==3.1.2")
print(f"\nDone. Add {', '.join(n + '.boxd' for n in DEMO_VMS)} in eleven0zero, then `docker compose restart` "
      "so it picks up ~/.ssh/config.")
