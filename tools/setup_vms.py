"""Creates the 3 demo VMs in boxd. Safe to re-run: existing VMs are kept.
hackathon-vm-1 and hackathon-vm-2 are clean; hackathon-vulnerable-vm gets
pyyaml 5.3.1 (CVE-2020-14343, fixed by `sudo pip3 install --break-system-packages -U pyyaml`)."""
from boxd import DEMO_VMS, LAB, boxd

# --ignore-installed: pip can't uninstall Ubuntu's python3-yaml; the /usr/local copy shadows it
SETUP_LAB = """set -e
sudo pip3 install -q --break-system-packages --ignore-installed pyyaml==5.3.1
"""

for name, flags in DEMO_VMS.items():
    if boxd("machine", "get", name, check=False, capture=True).returncode == 0:
        print(f"{name}: exists, skipping create")
    else:
        boxd("machine", "new", name, *flags)

boxd("machine", "exec", LAB, "--timeout", "240", "--", "sh", "-c", SETUP_LAB)
print(f"\nDone. Add {', '.join(n + '.boxd' for n in DEMO_VMS)} in eleven0zero, then `docker compose restart` "
      "so it picks up ~/.ssh/config.")
