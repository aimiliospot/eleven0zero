"""Shared helpers for the VM scripts: thin wrapper over the boxd CLI."""
import json, subprocess

DEMO_VMS = {"hackathon-vm-1": ["--vcpu", "2", "--memory", "8G"],
            "hackathon-vm-2": ["--vcpu", "1", "--memory", "4G"],
            "hackathon-vulnerable-vm": ["--isolated"]}
LAB = "hackathon-vulnerable-vm"


def boxd(*args, check=True, capture=False):
    return subprocess.run(["boxd", *args], check=check, capture_output=capture, text=True, stdin=subprocess.DEVNULL)


def names(kind):
    return [x["name"] for x in json.loads(boxd(kind, "list", "--json", capture=True).stdout)]
