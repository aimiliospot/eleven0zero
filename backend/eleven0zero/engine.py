"""eleven0zero engine: watch cve.org feed, inventory VMs over SSH, let Gemini judge exposure."""
import base64, json, os, re, secrets, shutil, subprocess, threading, time, traceback, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone as tz
from pathlib import Path

from django.conf import settings
from django.db import close_old_connections, connection
from django.utils import timezone

from .models import Cve, Event, Finding, Setting, Vm

# env overrides let the demo stack point at demo/mock_cve_api.py
DELTA_URL = os.getenv("CVE_DELTA_URL", "https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/deltaLog.json")
CVE_API = os.getenv("CVE_API_URL", "https://cveawg.mitre.org/api/cve/{}")
MODEL = os.getenv("GEMINI_MODEL", "gemini-4-carbon")
VENICE_MODEL = "deepseek-v4-1-flash-1017-uncensored"  # exploit generation only: PoC writing, not judging/remediation
VENICE_API_KEY = os.getenv("VENICE_API_KEY", "")
VENICE_URL = "https://api.venice.ai/api/v1/chat/completions"
VENICE_MODELS_URL = "https://api.venice.ai/api/v1/models"
HERE = Path(__file__).parent

# ponytail: generic names that would match every VM. Linux kernel CVEs (dozens/day) are dropped here;
# route them to a kernel-version check instead of Gemini if kernel coverage matters.
STOP = {"linux", "kernel", "n/a", "unknown", "server", "client", "library", "common", "core"}


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "eleven0zero"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


# ---------- inventory ----------

# user, alias/hostname, optional port: "vm1", "root@10.0.0.5", "root@my-vm.boxd.sh:2222"
HOST_RE = re.compile(r"(?:[A-Za-z0-9_][A-Za-z0-9._-]*@)?[A-Za-z0-9][A-Za-z0-9.-]*(?::\d{1,5})?")


def ssh_target(host):
    if not HOST_RE.fullmatch(host):  # trust boundary: never let a user string become an ssh option
        raise ValueError(f"invalid host {host!r}")
    return f"ssh://{host}" if ":" in host else host


def collect_command(host):
    """boxd machines are reached through the boxd CLI (BOXD_TOKEN only, no SSH keys); everything else over SSH."""
    m = BOXD_HOST.fullmatch(host)
    if m and os.getenv("BOXD_TOKEN") and shutil.which("boxd"):
        return ["boxd", "machine", "exec", m.group(1), "--timeout", "120", "--", "python3", "-"]
    return ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=accept-new", "--", ssh_target(host), "python3", "-"]


def collect(host):
    r = subprocess.run(collect_command(host), input=(HERE / "collector.py").read_text(),
                       capture_output=True, text=True, timeout=150)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[-500:])
    return json.loads(r.stdout)


def collect_one(host):
    # filter().update(): a host removed while being collected must stay removed
    try:
        emit("", "scan", f"{' '.join(collect_command(host)[:4])} ... < collector.py", host)
        inv = collect(host)
        Vm.objects.filter(host=host).update(collected_at=timezone.now(), inventory=inv, error=None)
        emit("", "scan_ok", f"inventory ready: {len(inv.get('packages', {}))} pkgs, {len(inv.get('services', []))} services", host)
    except Exception as e:
        Vm.objects.filter(host=host).update(error=str(e))  # keep last good inventory
        emit("", "error", f"inventory failed: {str(e)[:120]}", host)
        print(f"[inventory] {host}: {e}")


def parallel(fn, items):
    """Run fn on every item in its own thread (each closes its DB connection); one failure doesn't stop the rest."""
    def run(item):
        try:
            return fn(item)
        except Exception:
            traceback.print_exc()
        finally:
            connection.close()
    items = list(items)
    if items:
        with ThreadPoolExecutor(len(items)) as ex:
            list(ex.map(run, items))


def inventory_once():
    parallel(collect_one, Vm.objects.values_list("host", flat=True))


# ---------- matching ----------

def norm(s):
    return re.sub(r"[^a-z0-9.+]+", "-", s.lower()).strip("-")


def cve_terms(record):
    terms = set()
    for a in record["containers"]["cna"].get("affected", []):
        for k in ("packageName", "product"):
            if a.get(k):
                terms.add(norm(a[k]))
    return {t for t in terms if len(t) >= 3 and t not in STOP}


def vm_names(inv):
    """name -> version (or source) for everything installed/running on the VM."""
    names = {norm(k): v for k, v in {**inv.get("packages", {}), **inv.get("lang_packages", {})}.items()}
    for s in inv.get("services", []):
        names.setdefault(norm(s), "running service")
    for p in inv.get("ports", []):
        if p.get("process"):
            names.setdefault(norm(p["process"]), f"listening {p['local']}")
    for c in inv.get("containers", []):
        img = c.get("image", "").split("/")[-1]
        name, _, tag = img.partition(":")
        names.setdefault(norm(name), f"container image tag {tag or 'latest'}")
    return names


def matches(terms, names):
    """VM entries whose name equals a CVE term or extends it (openssh -> openssh-server)."""
    # ponytail: name matching only, misses aliases (httpd vs apache http server); add an alias map if recall matters
    return {n: v for n, v in names.items()
            if any(n == t or n.startswith(t + "-") or t.startswith(n + "-") for t in terms)}


# ---------- evaluation ----------

SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["affected", "likely", "not_affected"]},
        "confidence": {"type": "number"},
        "evidence": {"type": "string"},
        "actions": {"type": "array", "items": {"type": "string"}},
        "estimated_cvss": {"type": "number"},
    },
    "required": ["verdict", "confidence", "evidence", "actions"],
}

DEFAULT_CRITICALITY_THRESHOLD = 9.0

SEVERITY = {"affected": 2, "likely": 1, "not_affected": 0}
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
VENICE = "venice:"  # model id prefix: "venice:llama-3.3-70b" goes to Venice AI, anything else to Gemini
_gemini = None


def selected_models():
    s = Setting.objects.filter(pk=1).first()
    return (s and s.models) or [MODEL]


def gemini():
    global _gemini
    if not GOOGLE_API_KEY:
        raise RuntimeError("No Gemini API key: set GOOGLE_API_KEY")
    if _gemini is None:
        from google import genai
        _gemini = genai.Client(api_key=GOOGLE_API_KEY)
    return _gemini


def list_models():
    """Gemini + Venice text models; a provider that fails or has no key just contributes nothing."""
    found = []
    try:
        found += [n for n in (m.name.removeprefix("models/") for m in gemini().models.list()
                              if "generateContent" in (m.supported_actions or [])) if n.startswith("gemini")]
    except Exception as e:
        print(f"[models] gemini: {e}")
    if VENICE_API_KEY:
        try:
            req = urllib.request.Request(VENICE_MODELS_URL, headers={"Authorization": f"Bearer {VENICE_API_KEY}"})
            with urllib.request.urlopen(req, timeout=30) as r:
                found += [VENICE + m["id"] for m in json.load(r)["data"] if m.get("type", "text") == "text"]
        except Exception as e:
            print(f"[models] venice: {e}")
    return sorted(found)


def venice_chat(model, prompt):
    """One JSON-object answer from a Venice AI chat model."""
    if not VENICE_API_KEY:
        raise RuntimeError("No Venice API key: set VENICE_API_KEY")
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}],
                       "response_format": {"type": "json_object"}}).encode()
    req = urllib.request.Request(VENICE_URL, data=body, method="POST", headers={
        "Authorization": f"Bearer {VENICE_API_KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = json.load(r)["choices"][0]["message"]["content"]
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def ask_json(model, prompt, schema):
    """Ask Gemini or Venice (by model id prefix) for an answer matching schema."""
    if model.startswith(VENICE):
        out = venice_chat(model.removeprefix(VENICE),
                          f"{prompt}\n\nRespond with a single JSON object matching this JSON schema: {json.dumps(schema)}")
        if not set(schema["required"]) <= out.keys():
            raise RuntimeError(f"malformed response from {model}")
        return out
    r = gemini().models.generate_content(model=model, contents=prompt, config={
        "response_mime_type": "application/json", "response_schema": schema})
    return json.loads(r.text)


def aggregate(votes):
    """Majority verdict (ties -> more severe); confidence = agreeing confidences / all votes, so dissent lowers it."""
    n = len(votes)
    counts = {}
    for v in votes:
        counts[v["verdict"]] = counts.get(v["verdict"], 0) + 1
    verdict = max(counts, key=lambda k: (counts[k], SEVERITY[k]))
    agree = [v for v in votes if v["verdict"] == verdict]
    best = max(agree, key=lambda v: v["confidence"])
    est = [float(v["estimated_cvss"]) for v in votes if isinstance(v.get("estimated_cvss"), (int, float)) and not isinstance(v.get("estimated_cvss"), bool)]
    out = {"verdict": verdict, "confidence": sum(v["confidence"] for v in agree) / n,
           "evidence": (f"{len(agree)}/{n} models agree. " if n > 1 else "") + best["evidence"],
           "actions": list(dict.fromkeys(a for v in agree for a in v["actions"]))}
    if est:
        out["estimated_cvss"] = round(min(10.0, max(0.0, sum(est) / len(est))), 1)
    return out


def cve_cvss(record):
    """Highest official CVSS baseScore (0.0-10.0) in CNA or ADP metrics, or None if not published yet."""
    containers = record.get("containers") or {}
    blocks = [containers.get("cna") or {}, *(containers.get("adp") or [])]
    scores = []
    for block in blocks:
        for m in block.get("metrics") or []:
            if not isinstance(m, dict):
                continue
            for key in ("cvssV4_0", "cvssV3_1", "cvssV3_0", "cvssV2_0"):
                score = (m.get(key) or {}).get("baseScore")
                if isinstance(score, (int, float)) and not isinstance(score, bool) and 0.0 <= float(score) <= 10.0:
                    scores.append(float(score))
    return round(max(scores), 1) if scores else None


def description(record):
    d = record["containers"]["cna"].get("descriptions") or [{}]
    return next((x["value"] for x in d if x.get("lang", "").startswith("en")), d[0].get("value", ""))


def ask_verdict(record, host, inv, matched, model):
    cna = record["containers"]["cna"]
    prompt = f"""You are a vulnerability analyst. Decide whether this VM is exposed to the CVE.
Compare installed versions to the affected ranges carefully. Distro packages often carry backported fixes
(e.g. Debian/Ubuntu/RHEL release suffixes) - take the distro and its package version into account.
Consider whether the vulnerable component is actually reachable (listening ports, exposed=true means bound to all interfaces).
verdict: affected (version clearly in range), likely (probably in range / can't fully confirm), not_affected.
confidence: 0..1. evidence: 1-3 sentences citing versions. actions: concrete remediation steps for THIS VM
(exact upgrade commands for its package manager, config mitigations, temporary workarounds).
estimated_cvss: 0..10 CVSS base-score estimate for the CVE based on its impact and attack vector.

CVE: {record['cveMetadata']['cveId']} - {cna.get('title', '')}
Description: {description(record)}
Affected (CNA data): {json.dumps(cna.get('affected', [])[:15])}

VM: {host}
OS: {inv.get('os', {}).get('PRETTY_NAME')} | kernel {inv.get('kernel')}
Matched components (name -> version/source): {json.dumps(matched)}
Listening ports: {json.dumps(inv.get('ports', []))}
Firewall: {inv.get('firewall', '')[:500]}"""
    if not matched:
        prompt += f"""
No installed component matched the CVE's product names. Check the full inventory below for aliases or renamed
packages (e.g. httpd = Apache HTTP Server). If the product is absent, answer not_affected.
Installed inventory (name -> version/source): {json.dumps(dict(list(vm_names(inv).items())[:400]))}"""
    return ask_json(model, prompt, SCHEMA)


def judge(record, host, inv, matched, quiet=False):
    """Ask every selected model in parallel (network only, no DB in the threads) and aggregate the votes."""
    models = selected_models()

    def one(model):
        try:
            return {"model": model, **ask_verdict(record, host, inv, matched, model)}
        except Exception as e:
            print(f"[judge] {model} {host}: {e}")
            return {"model": model, "error": str(e)[:300]}
    with ThreadPoolExecutor(len(models)) as ex:
        votes = list(ex.map(one, models))
    if not quiet:
        cve_id = record["cveMetadata"]["cveId"]
        for v in votes:
            emit(cve_id, "model", f"{v['model']}: " + (f"error {v['error'][:80]}" if "error" in v else f"{v['verdict']} ({v['confidence']:.0%})"), host)
    ok = [v for v in votes if "error" not in v]
    if not ok:
        raise RuntimeError("; ".join(f"{v['model']}: {v['error']}" for v in votes)[:500])
    return {**aggregate(ok), "votes": votes}


def emit(cve_id, kind, text, host=""):
    try:
        Event.objects.create(cve_id=cve_id, host=host, kind=kind, text=text)
        cutoff = Event.objects.order_by("-id").values_list("id", flat=True)[500:501].first()
        if cutoff:
            Event.objects.filter(id__lte=cutoff).delete()
    except Exception:
        pass


def save_finding(cve_id, host, f):
    Finding.objects.update_or_create(cve_id=cve_id, vm_id=host, defaults=dict(
        verdict=f["verdict"], confidence=f["confidence"], evidence=f["evidence"], actions=f["actions"],
        votes=f.get("votes", []), remediation=None, exploit=None, created_at=timezone.now()))  # re-judged -> fix/exploit are retested


def start_evaluation(record):
    """Mark the CVE as evaluating; returns the hosts to judge (one Celery task each, see tasks.py)."""
    cve_id = record["cveMetadata"]["cveId"]
    # ponytail: one LLM call per CVE x VM x model for the whole feed; cap per poll or use a cheap model if volume hurts
    hosts = list(Vm.objects.filter(inventory__isnull=False).values_list("host", flat=True))
    if not hosts:  # no VM inventory yet, nothing to judge
        Cve.objects.filter(id=cve_id).update(status="skipped")
        return []
    Cve.objects.filter(id=cve_id).update(status="evaluating", seen_at=timezone.now())
    emit(cve_id, "arrived", f"{cve_id} received: {', '.join(sorted(cve_terms(record))[:5]) or 'no product names'}")
    return hosts


def evaluate_host(record, host):
    """Judge one CVE against one VM. Never raises, so the Celery chord always reaches finish_evaluation."""
    cve_id = record["cveMetadata"]["cveId"]
    vm = Vm.objects.filter(host=host, inventory__isnull=False).first()
    if not vm:  # removed since start_evaluation
        return
    try:
        m = matches(cve_terms(record), vm_names(vm.inventory))
        emit(cve_id, "judging", f"checking {host}: {len(m)} matching component(s)", host)
        f = judge(record, host, vm.inventory, m)
        cvss = cve_cvss(record)
        if cvss is None:
            cve_row = Cve.objects.filter(id=cve_id).only("cvss").first()
            cvss = cve_row.cvss if cve_row else None
        if cvss is None and f.get("estimated_cvss") is not None:
            cvss = round(min(10.0, max(0.0, float(f["estimated_cvss"]))), 1)
            Cve.objects.filter(id=cve_id, cvss__isnull=True).update(cvss=cvss)
        save_finding(cve_id, host, f)
        emit(cve_id, "verdict", f"{f['verdict']} ({f['confidence']:.0%})", host)
        if f["verdict"] == "affected":
            threshold = criticality_threshold()
            if threshold is not None and cvss is not None and cvss >= threshold and can_auto_shutdown(host):
                shutdown_vm(cve_id, host, cvss, threshold)
            else:
                queue_remediation(cve_id, host)
    except Exception as e:
        print(f"[judge] {cve_id} {host}: {e}")
        save_finding(cve_id, host, {"verdict": "error", "confidence": 0, "evidence": str(e)[:500], "actions": []})
        emit(cve_id, "error", str(e)[:120], host)


def finish_evaluation(cve_id):
    Cve.objects.filter(id=cve_id).update(status="evaluated")
    emit(cve_id, "done", f"{cve_id} finished")


def store(record):
    """Save a published CVE record; True if it should be evaluated (done by a Celery task)."""
    meta = record["cveMetadata"]
    if meta.get("state") != "PUBLISHED":
        return False
    Cve.objects.update_or_create(id=meta["cveId"], defaults=dict(
        published=meta.get("datePublished"), cvss=cve_cvss(record), record=record,
        title=record["containers"]["cna"].get("title") or description(record)[:120]))
    return True


def new_cve_ids():
    """CVEs from the feed's last CVE_LOOKBACK_MIN minutes (config.py) that we haven't stored yet; stores them."""
    since = (datetime.now(tz.utc) - timedelta(minutes=settings.CVE_LOOKBACK_MIN)).isoformat().replace("+00:00", "Z")
    ids = []
    for entry in reversed(fetch_json(DELTA_URL)):  # oldest first
        if entry["fetchTime"] <= since:
            continue
        for c in entry.get("new", []):
            # ponytail: overlapping watch ticks could double-evaluate; keep beat interval > run time, add a Redis lock if needed
            if not Cve.objects.filter(id=c["cveId"]).exists() and store(fetch_json(c["githubLink"])):
                ids.append(c["cveId"])
    return ids


def replay(cve_id):
    """Re-fetch a CVE and store it; returns True if it should be (re-)evaluated."""
    try:
        return store(fetch_json(CVE_API.format(cve_id)))  # old findings stay visible until each is overwritten
    except Exception:
        Cve.objects.filter(id=cve_id).update(status="failed")
        raise


# ---------- remediation: test the proposed fix on a snapshot clone ----------

BOXD_HOST = re.compile(r"(?:[^@]+@)?([a-z0-9][a-z0-9-]*)\.boxd(?:\.sh)?(?::\d+)?")
# the clone is disposable, but the LLM output is still untrusted: never touch the firewall or power state
FORBIDDEN = re.compile(r"\b(ufw|iptables|ip6tables|nft|firewall-cmd|reboot|shutdown|poweroff|halt|init)\b")
CMD_SCHEMA = {"type": "object", "properties": {"commands": {"type": "array", "items": {"type": "string"}}},
              "required": ["commands"]}
_remediation_lock = threading.Lock()  # ponytail: one remediation at a time, per-VM locks if throughput matters


def remediation_model():
    s = Setting.objects.filter(pk=1).first()
    return (s and s.remediation_model) or selected_models()[0]


def exploitation_model():
    s = Setting.objects.filter(pk=1).first()
    return (s and s.exploitation_model) or (VENICE + VENICE_MODEL)


def criticality_threshold():
    s = Setting.objects.filter(pk=1).first()
    return DEFAULT_CRITICALITY_THRESHOLD if s is None else s.criticality_threshold


def shutdown_hosts():
    """Hosts selected for immediate auto-shutdown (None in DB => all monitored VMs)."""
    all_hosts = list(Vm.objects.order_by("host").values_list("host", flat=True))
    s = Setting.objects.filter(pk=1).first()
    if s is None or s.shutdown_hosts is None:
        return all_hosts
    allowed = set(s.shutdown_hosts)
    return [h for h in all_hosts if h in allowed]


def can_auto_shutdown(host):
    s = Setting.objects.filter(pk=1).first()
    if s is None or s.shutdown_hosts is None:
        return True
    return host in s.shutdown_hosts


def shutdown_vm(cve_id, host, cvss, threshold):
    """Immediately power off an affected VM (.boxd or SSH) when CVE criticality >= threshold."""
    m = BOXD_HOST.fullmatch(host)
    cmd = f"boxd machine stop {m.group(1)}" if m else f"ssh {host} -- sudo -n poweroff"
    try:
        if m and shutil.which("boxd"):
            machine = m.group(1)
            region = machine_region(machine)
            boxd_ok("machine", "stop", machine, region=region)
        else:
            r = subprocess.run(
                ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
                 "-o", "StrictHostKeyChecking=accept-new", "--", ssh_target(host), "sudo -n poweroff"],
                capture_output=True, text=True, timeout=30,
            )
            err_lower = (r.stderr or "").lower()
            if r.returncode != 0 and "closed by remote host" not in err_lower and "connection reset" not in err_lower:
                raise RuntimeError((r.stderr or r.stdout or f"ssh rc={r.returncode}").strip()[-300:])
        rem = {"status": "auto_shutdown", "cvss": cvss, "threshold": threshold, "cmd": cmd}
        Finding.objects.filter(cve_id=cve_id, vm_id=host).update(remediation=rem)
        emit(cve_id, "auto_shutdown", f"cvss={cvss} >= {threshold}: {host} shut down immediately ({cmd})", host)
    except Exception as e:
        print(f"[auto_shutdown] {cve_id} {host}: {e}")
        rem = {"status": "shutdown_failed", "cvss": cvss, "threshold": threshold, "cmd": cmd, "error": str(e)[:300]}
        Finding.objects.filter(cve_id=cve_id, vm_id=host).update(remediation=rem)
        emit(cve_id, "error", f"auto-shutdown failed on {host}: {str(e)[:120]}", host)


def boxd(*args, timeout=300, region=None):
    """Run the boxd CLI (auth: BOXD_TOKEN env). Returns (returncode, stdout, stderr).
    Without region the CLI picks its own default, which can differ from where the VM lives."""
    cmd = ["boxd", *(["--region", region] if region else []), *args]  # before args: `exec ... -- cmd` ends them
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout, r.stderr


def boxd_ok(*args, **kw):
    rc, out, err = boxd(*args, **kw)
    if rc:
        raise RuntimeError(f"boxd {' '.join(args[:2])}: {(err or out).strip()[-300:]}")
    return out


def machine_region(machine):
    vms = json.loads(boxd_ok("list", "--region", "all", "--json"))
    region = next((v["region"] for v in vms if v["name"] == machine), None)
    if not region:
        raise RuntimeError(f"no boxd machine named {machine!r} in any region")
    return region


def vm_exec(machine, cmd, timeout=300, region=None):
    rc, out, err = boxd("machine", "exec", machine, "--timeout", str(timeout), "--", cmd, timeout=timeout + 30, region=region)
    return rc, (out + err).strip()


def vm_inventory(machine, region=None):
    b64 = base64.b64encode((HERE / "collector.py").read_bytes()).decode()
    out = boxd_ok("machine", "exec", machine, "--timeout", "180", "--", f"echo {b64} | base64 -d | python3 -",
                  timeout=210, region=region)
    return json.loads(out[out.index("{"):])


def failed_units(machine, region=None):
    return vm_exec(machine, "systemctl --failed --no-legend --plain | awk '{print $1}'", 60, region)[1].split()


def compare(before, after, failed_before, failed_after):
    """What the fix broke: services that stopped, units that newly failed, listening ports that vanished/appeared."""
    ports = lambda i: {f"{p['proto']} {p['process'] or '?'}@{p['local']}" for p in i.get("ports", [])}
    missing = sorted(set(before.get("services", [])) - set(after.get("services", [])))
    new_failed = sorted(set(failed_after) - set(failed_before))
    gone, added = sorted(ports(before) - ports(after)), sorted(ports(after) - ports(before))
    return {"services_ok": not (missing or new_failed or gone), "services_missing": missing,
            "failed_units": new_failed, "ports_gone": gone, "ports_added": added}


def plan_commands(record, host, inv, actions, model):
    matched = {k: v for k, v in vm_names(inv).items() if k in cve_terms(record)}
    prompt = f"""Turn the remediation advice below into the exact shell commands to run on this VM, in order.
Rules: non-interactive, run as the unprivileged login user (prefix privileged commands with sudo -n), idempotent,
at most 10 commands, no firewall/port changes, no reboot or shutdown, no searching/investigation commands -
only commands that apply the fix (upgrade/patch/restart the affected component). Return an empty list if
no safe command applies. Restart a service only if it uses the upgraded component.

CVE: {record['cveMetadata']['cveId']} - {description(record)[:600]}
VM OS: {inv.get('os', {}).get('PRETTY_NAME')}
Matched components: {json.dumps(matched)}
Running services: {json.dumps(inv.get('services', []))}
Advice:
{json.dumps(actions, indent=1)}"""
    return [c for c in ask_json(model, prompt, CMD_SCHEMA)["commands"] if isinstance(c, str) and c.strip()][:10]


# ---------- exploit: PoC a fix on the patched clone from a second throwaway VM ----------

EXPLOIT_DIR = Path(os.getenv("EXPLOIT_DIR", "/data/exploits"))
RUNNERS = {"python3": "python3", "python": "python3", "bash": "bash", "sh": "sh"}
EXT = {"python3": "py", "python": "py", "bash": "sh", "sh": "sh"}
SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")

EXPLOIT_SCHEMA = {
    "type": "object",
    "properties": {
        "feasible": {"type": "boolean"},
        "language": {"type": "string"},
        "script": {"type": "string"},
        "success_marker": {"type": "string"},
        "notes": {"type": "string"},
    },
    "required": ["feasible", "language", "script", "success_marker", "notes"],
}


def generate_exploit(record, host, inv, matched, model=None):
    """Exploit PoCs are written by the configured exploitation model (defaults to Venice AI uncensored)."""
    model = model or exploitation_model()
    prompt = f"""Write a minimal proof-of-concept that checks whether this VM is still exploitable for the
CVE below, to be run from a SEPARATE machine on an isolated private network against the target
(its address is given as the environment variable $TARGET). It must be safe to run only against a
disposable sandbox clone: non-destructive, no data exfiltration beyond confirming the vulnerability,
no spreading or pivoting to other hosts. Use only language "python3" or "bash". The script must finish
within 60 seconds and always exit 0, whether or not the exploit succeeds (report the result via the
success_marker text, not the exit code). Print a line containing success_marker LITERALLY if and only if
the target is still vulnerable; print nothing matching it if the target is patched/not exploitable.
If no safe network-based PoC is possible for this CVE (e.g. it needs local/physical access, or a complex
multi-stage chain that can't be reduced to a quick check), set feasible=false and explain why in notes.
Respond with a single JSON object with exactly these keys: feasible (bool), language ("python3" or "bash"),
script (string), success_marker (string), notes (string).

CVE: {record['cveMetadata']['cveId']} - {description(record)[:600]}
VM OS: {inv.get('os', {}).get('PRETTY_NAME')}
Matched components: {json.dumps(matched)}"""
    return ask_json(model, prompt, EXPLOIT_SCHEMA)


def reusable_exploit(cve_id, host, model):
    """Return an already-generated PoC for this CVE evaluation so multiple affected VMs generate the PoC once."""
    cve = Cve.objects.filter(id=cve_id).first()
    qs = Finding.objects.filter(cve_id=cve_id).exclude(vm_id=host)
    if cve and cve.seen_at:
        qs = qs.filter(created_at__gte=cve.seen_at)
    for other in qs.order_by("id"):
        prev = other.exploit or {}
        if prev.get("model") == model and (prev.get("script") or prev.get("status") in ("not_feasible", "blocked")):
            return prev
    return None


def run_exploit(cve_id, host, record, inv, clone, model, region):
    """Generate a PoC once per CVE (reusing it on subsequent affected VMs) and fire it at the patched clone."""
    matched = {k: v for k, v in vm_names(inv).items() if k in cve_terms(record)}
    exp = {"status": "running", "model": model}
    atk = None
    try:
        cached = reusable_exploit(cve_id, host, model)
        if cached and cached.get("status") in ("not_feasible", "blocked"):
            exp.update({k: cached[k] for k in ("status", "notes", "error") if k in cached}, reused_poc=True)
            detail = (exp.get("notes") or exp.get("error") or "")[:120]
            emit(cve_id, "poc_done", f"{exp['status']}: {detail} (reused)", host)
            return exp
        if cached and cached.get("script"):
            lang, script, marker = cached["language"], cached["script"], cached["success_marker"]
            exp.update(language=lang, script=script, success_marker=marker,
                       notes=cached.get("notes", ""), saved_path=cached.get("saved_path", ""), reused_poc=True)
            emit(cve_id, "poc_reuse", f"reusing {cve_id} PoC (poc.{EXT[lang]}) against {clone}", host)
        else:
            emit(cve_id, "poc_gen", f"{model}: writing safe network PoC for {cve_id}", host)
            gen = generate_exploit(record, host, inv, matched, model)
            if not gen.get("feasible"):
                exp.update(status="not_feasible", notes=gen.get("notes", ""))
                emit(cve_id, "poc_done", f"not_feasible: {exp['notes'][:140]}", host)
                return exp
            lang, script, marker = gen.get("language", ""), gen.get("script", ""), gen.get("success_marker", "")
            if lang not in RUNNERS or not script.strip() or not marker.strip():
                exp.update(status="error", error="malformed exploit response from the model")
                emit(cve_id, "poc_done", f"error: {exp['error']}", host)
                return exp
            if FORBIDDEN.search(script):
                exp.update(status="blocked", error="generated exploit touched firewall/power commands")
                emit(cve_id, "poc_done", f"blocked: {exp['error']}", host)
                return exp
            exp.update(language=lang, script=script, success_marker=marker, notes=gen.get("notes", ""))

            EXPLOIT_DIR.mkdir(parents=True, exist_ok=True)
            safe_cve = SAFE_RE.sub("_", cve_id)
            path = EXPLOIT_DIR / f"{safe_cve}_{int(time.time())}.{EXT[lang]}"
            path.write_text(script)
            exp["saved_path"] = str(path)  # saved once per CVE regardless of outcome, for IT admin review

        net = f"wd-net-{secrets.token_hex(3)}"
        boxd_ok("machine", "networks", clone, net, region=region)
        exp["attacker"] = atk = f"wdx-{secrets.token_hex(3)}"
        emit(cve_id, "attacker", f"boxd new {atk} --isolated --networks {net}  # poc.{EXT[lang]} ready", host)
        boxd_ok("new", atk, "--isolated", "--networks", net, region=region)
        for _ in range(20):  # wait until the attacker VM answers
            if vm_exec(atk, "true", 20, region)[0] == 0:
                break
            time.sleep(3)
        info = json.loads(boxd_ok("machine", "get", clone, "--json", region=region))
        target = info.get("public_ip") or clone

        emit(cve_id, "attack", f"boxd machine exec {atk} -- TARGET={target} {RUNNERS[lang]} /tmp/poc", host)
        b64 = base64.b64encode(script.encode()).decode()
        rc, out = vm_exec(atk, f"echo {b64} | base64 -d > /tmp/poc && "
                                f"TARGET={target} timeout 60 {RUNNERS[lang]} /tmp/poc", 90, region)
        exp["output"] = out[-2000:]
        exp["vulnerable"] = marker in out
        exp["status"] = "vulnerable" if exp["vulnerable"] else "patched"
        emit(cve_id, "poc_done", f"{exp['status']}: {'exploit blocked on patched clone' if exp['status'] == 'patched' else 'clone still exploitable'}", host)
    except Exception as e:
        traceback.print_exc()
        exp.update(status="error", error=str(e)[:500])
        emit(cve_id, "error", f"exploit check error: {str(e)[:140]}", host)
    finally:
        if atk:
            emit(cve_id, "cleanup", f"boxd machine rm {atk} -y", host)
            boxd("machine", "rm", atk, "-y", region=region)
    return exp


def queue_remediation(cve_id, host):
    from .tasks import remediate_finding
    Finding.objects.filter(cve_id=cve_id, vm_id=host).update(remediation={"status": "queued"})
    remediate_finding.delay(cve_id, host)


def remediate(cve_id, host):
    """Snapshot the VM, apply the fix on a clone from that snapshot, re-test, destroy the clone."""
    with _remediation_lock:
        f = Finding.objects.filter(cve_id=cve_id, vm_id=host, verdict="affected").first()
        if not f or (f.remediation or {}).get("status") != "queued":  # already handled / re-judged meanwhile
            return
        rem = {"status": "running", "commands": []}
        exp = None
        save = lambda: Finding.objects.filter(pk=f.pk).update(remediation=rem, exploit=exp)
        save()
        clone = region = None
        try:
            m = BOXD_HOST.fullmatch(host)
            if not m or not shutil.which("boxd"):
                rem.update(status="skipped", error="needs a boxd VM and the boxd CLI (snapshots are a boxd feature)")
                emit(cve_id, "fix_done", "skipped: boxd CLI not configured for sandbox snapshots", host)
                return
            machine, record, inv = m.group(1), Cve.objects.get(id=cve_id).record, Vm.objects.get(host=host).inventory
            region = machine_region(machine)  # snapshot, clone and attacker all live in the VM's region
            rem["snapshot"] = snap = f"wd-{machine}-{int(time.time())}"
            emit(cve_id, "snapshot", f"boxd snapshots save {machine} {snap}", host)
            boxd_ok("snapshots", "save", machine, snap, region=region)
            save()
            rem["clone"] = clone = f"wdt-{secrets.token_hex(3)}"
            emit(cve_id, "clone", f"boxd new {clone} --from-snapshot {snap} --isolated", host)
            boxd_ok("new", clone, "--from-snapshot", snap, "--isolated", region=region)
            save()
            for _ in range(20):  # wait until the clone answers
                if vm_exec(clone, "true", 20, region)[0] == 0:
                    break
                time.sleep(3)
            before, failed0 = vm_inventory(clone, region), failed_units(clone, region)
            rem["model"] = model = remediation_model()
            save()
            emit(cve_id, "plan", f"{model}: writing safe upgrade commands for {clone}", host)
            for cmd in plan_commands(record, host, inv, f.actions, model):
                if FORBIDDEN.search(cmd):
                    rem["commands"].append({"cmd": cmd, "rc": None, "out": "blocked: firewall/power commands are not allowed"})
                    emit(cve_id, "fix_out", f"blocked unsafe command: {cmd}", host)
                    continue
                emit(cve_id, "fix_cmd", f"boxd machine exec {clone} -- {cmd}", host)
                rc, out = vm_exec(clone, cmd, region=region)
                rem["commands"].append({"cmd": cmd, "rc": rc, "out": out[-500:]})
                tail = (out.strip().splitlines() or ["done"])[-1][:140]
                emit(cve_id, "fix_out", f"rc={rc}: {tail}", host)
                save()
                if rc:
                    break
            after, failed1 = vm_inventory(clone, region), failed_units(clone, region)
            rem.update(compare(before, after, failed0, failed1))
            hits = matches(cve_terms(record), vm_names(after))
            # component still present: ask the judge about the post-fix inventory
            verdict = judge(record, host, after, hits, quiet=True)["verdict"] if hits else "not_affected"
            rem.update(verdict_after=verdict, fixed=verdict == "not_affected")
            rem["status"] = "passed" if rem["fixed"] and rem["services_ok"] else "failed"
            if rem["status"] == "passed":  # keep the patched clone as a deployable snapshot, before the PoC touches it
                rem["fixed_snapshot"] = fixed = f"wdf-{machine}-{int(time.time())}"
                emit(cve_id, "fix_out", f"boxd snapshots save {clone} {fixed}", host)
                boxd_ok("snapshots", "save", clone, fixed, region=region)
                rem["deploy_cmd"] = f"boxd --region {region} new {machine}-patched --from-snapshot {fixed}"
            emit(cve_id, "fix_done", f"{rem['status']}: clone {clone} {'patched & services healthy' if rem['status'] == 'passed' else 'fix check failed'}", host)
            save()
            if rem["status"] == "passed":
                exp_model = exploitation_model()
                exp = {"status": "running", "model": exp_model}
                save()
                exp = run_exploit(cve_id, host, record, inv, clone, exp_model, region)
        except Exception as e:
            traceback.print_exc()
            rem.update(status="error", error=str(e)[:500])
            emit(cve_id, "error", f"sandbox error: {str(e)[:140]}", host)
        finally:
            if clone:
                emit(cve_id, "cleanup", f"boxd machine rm {clone} -y", host)
                boxd("machine", "rm", clone, "-y", region=region)
            save()


def remediate_pending():
    """Boot backfill: affected findings never tested (or interrupted by a restart)."""
    for f in Finding.objects.filter(verdict="affected"):
        if (f.remediation or {}).get("status") in (None, "queued", "running"):
            queue_remediation(f.cve_id, f.vm_id)


# ---------- background threads ----------

def background(fn, *args, **kw):
    """Run fn in a daemon thread; each thread owns its own DB connection, closed when it ends."""
    def run():
        try:
            fn(*args, **kw)
        except Exception:
            traceback.print_exc()
        finally:
            connection.close()
    threading.Thread(target=run, daemon=True).start()


def loop(fn, every, delay=0):
    def run():
        time.sleep(delay)
        state = None
        while True:
            try:
                state = fn(state)
            except Exception:
                traceback.print_exc()
            close_old_connections()
            time.sleep(every)
    threading.Thread(target=run, daemon=True).start()


def add_demo_hosts():
    """Adds the hosts in DEMO_HOSTS (comma-separated; set by docker-compose-demo.yml) so a demo needs no manual setup."""
    for host in filter(None, (h.strip() for h in os.getenv("DEMO_HOSTS", "").split(","))):
        if HOST_RE.fullmatch(host):
            Vm.objects.get_or_create(host=host)
        else:
            print(f"[demo] ignoring invalid DEMO_HOSTS entry {host!r}")
    shutdown = os.getenv("DEMO_SHUTDOWN_HOSTS")
    if shutdown is not None:  # only until someone picks shutdown VMs in Settings
        s, _ = Setting.objects.get_or_create(pk=1)
        if s.shutdown_hosts is None:
            s.shutdown_hosts = [h for h in (x.strip() for x in shutdown.split(",")) if HOST_RE.fullmatch(h)]
            s.save(update_fields=["shutdown_hosts"])


def start():
    """Web-process loops. New-CVE polling, replays and remediation run in Celery (see tasks.py)."""
    def boot():
        add_demo_hosts()
        inventory_once()
        remediate_pending()
        loop(lambda _: inventory_once(), settings.VM_SCAN_SEC, delay=settings.VM_SCAN_SEC)
    background(boot)
