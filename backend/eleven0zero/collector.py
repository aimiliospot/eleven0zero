"""Runs ON the VM (stdlib only): `ssh host python3 - < collector.py`. Prints one JSON inventory."""
import json, os, platform, re, shutil, socket, subprocess


def sh(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30).stdout
    except Exception:
        return ""


def os_release():
    try:
        return dict(l.split("=", 1) for l in open("/etc/os-release").read().replace('"', "").splitlines() if "=" in l)
    except Exception:
        return {}


def packages():
    if shutil.which("dpkg-query"):
        out = sh("dpkg-query -W -f='${Package}\\t${Version}\\n'")
    elif shutil.which("rpm"):
        out = sh("rpm -qa --qf '%{NAME}\\t%{VERSION}-%{RELEASE}\\n'")
    else:
        return {}
    return dict(l.split("\t", 1) for l in out.splitlines() if "\t" in l)


def ports():
    res = []
    # sudo -n: process names of other users need root; falls back silently without passwordless sudo
    for l in (sh("sudo -n ss -tulpnH 2>/dev/null") or sh("ss -tulpnH")).splitlines():
        f = l.split()
        if len(f) < 5:
            continue
        local = f[4]
        proc = re.search(r'\(\("([^"]+)"', l)
        res.append({
            "proto": f[0], "local": local, "process": proc.group(1) if proc else None,
            # ponytail: bound to all interfaces = exposed; doesn't consult firewall/cloud SG
            "exposed": local.startswith(("0.0.0.0:", "*:", "[::]:")),
        })
    return res


def services():
    out = sh("systemctl list-units --type=service --state=running --no-legend --plain")
    return [l.split()[0].removesuffix(".service") for l in out.splitlines() if l.strip()]


def containers():
    if not shutil.which("docker"):
        return []
    out = sh("docker ps --format '{{.Names}}\\t{{.Image}}\\t{{.Ports}}'")
    return [dict(zip(("name", "image", "ports"), l.split("\t"))) for l in out.splitlines() if l.strip()]


def lang_packages():
    res = {}
    for py in ("pip3", "pip"):
        if shutil.which(py):
            try:
                res.update({p["name"].lower(): p["version"] for p in json.loads(sh(f"{py} list --format=json 2>/dev/null") or "[]")})
            except Exception:
                pass
            break
    if shutil.which("npm"):
        try:
            deps = json.loads(sh("npm ls -g --json 2>/dev/null") or "{}").get("dependencies", {})
            res.update({k: v.get("version", "") for k, v in deps.items()})
        except Exception:
            pass
    return res


def firewall():
    if shutil.which("ufw"):
        return sh("ufw status").strip()[:2000]
    if shutil.which("nft"):
        return sh("nft list ruleset").strip()[:2000]
    return ""


print(json.dumps({
    "hostname": socket.gethostname(),
    "os": os_release(),
    "kernel": platform.release(),
    "packages": packages(),
    "lang_packages": lang_packages(),
    "ports": ports(),
    "services": services(),
    "containers": containers(),
    "firewall": firewall(),
}))
