"""Shared helpers for the VM scripts: thin wrapper over the boxd CLI."""
import json, subprocess

DEMO_VMS = {"keen-pond": ["--vcpu", "2", "--memory", "8G"],
            "free-sky": ["--vcpu", "1", "--memory", "4G"],
            "cve-2024-6387-lab": ["--isolated"]}
LAB = "cve-2024-6387-lab"


def boxd(*args, check=True, capture=False):
    return subprocess.run(["boxd", *args], check=check, capture_output=capture, text=True, stdin=subprocess.DEVNULL)


def names(kind):
    return [x["name"] for x in json.loads(boxd(kind, "list", "--json", capture=True).stdout)]
