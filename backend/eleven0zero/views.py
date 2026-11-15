import json, re

from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods, require_POST

from . import engine
from .models import Cve, Event, Finding, Setting, Vm
from .tasks import replay_cve


def payload(request):
    try:
        d = json.loads(request.body)
    except ValueError:
        return {}
    return d if isinstance(d, dict) else {}


@ensure_csrf_cookie  # the React app polls this first, which hands it the CSRF cookie
@require_http_methods(["GET"])
def state(request):
    findings = [dict(cve_id=f.cve_id, host=f.vm_id, title=f.cve.title, verdict=f.verdict, confidence=f.confidence,
                     evidence=f.evidence, actions=f.actions, votes=f.votes, remediation=f.remediation,
                     exploit=f.exploit or (f.remediation or {}).get("exploit"),
                     created_at=f.created_at, cve_status=f.cve.status)
                for f in Finding.objects.select_related("cve")[:200]]
    vms = []
    for v in Vm.objects.order_by("host"):
        inv = v.inventory or {}
        vms.append(dict(host=v.host, collected_at=v.collected_at, error=v.error,
                        os=inv.get("os", {}).get("PRETTY_NAME", ""), npkg=len(inv.get("packages", {})),
                        ports=[f"{p['process'] or '?'}@{p['local']}" for p in inv.get("ports", []) if p["exposed"]]))
    cves = list(Cve.objects.order_by("-seen_at").values("id", "title", "status", "seen_at")[:30])
    return JsonResponse({"findings": findings, "vms": vms, "cves": cves})


@require_http_methods(["GET"])
def events(request):
    try:
        since = int(request.GET.get("since", 0))
    except ValueError:
        since = 0
    qs = Event.objects.filter(id__gt=since).values("id", "cve_id", "host", "kind", "text")
    rows = list(reversed(list(qs.order_by("-id")[:200]))) if since == 0 else list(qs.order_by("id")[:200])
    return JsonResponse({"events": rows})


MODEL_RE = re.compile(r"(?:venice:)?[A-Za-z0-9._-]{1,64}")


def settings_json():
    return {
        "models": engine.selected_models(),
        "remediation_model": engine.remediation_model(),
        "exploitation_model": engine.exploitation_model(),
    }


@require_http_methods(["GET", "PUT"])
def settings(request):
    if request.method == "PUT":
        d = payload(request)
        models = d.get("models", [])
        if not (isinstance(models, list) and 1 <= len(models) <= 5 and all(isinstance(m, str) and MODEL_RE.fullmatch(m) for m in models)):
            return JsonResponse({"error": "pick 1-5 models (letters, digits, . _ -)"}, status=400)
        rm = str(d.get("remediation_model", "")).strip()
        if rm and not MODEL_RE.fullmatch(rm):
            return JsonResponse({"error": "bad remediation model id"}, status=400)
        em = str(d.get("exploitation_model", "")).strip()
        if em and not MODEL_RE.fullmatch(em):
            return JsonResponse({"error": "bad exploitation model id"}, status=400)
        s, _ = Setting.objects.get_or_create(pk=1)
        s.models = list(dict.fromkeys(models))
        if "remediation_model" in d:
            s.remediation_model = rm
        if "exploitation_model" in d:
            s.exploitation_model = em
        s.save()
    return JsonResponse(settings_json())


@require_http_methods(["GET"])
def models(request):
    available = engine.list_models()
    return JsonResponse({"models": sorted(set(available) | set(engine.selected_models()) | {engine.MODEL, engine.VENICE + engine.VENICE_MODEL}),
                         "listed": bool(available)})


@require_http_methods(["POST", "DELETE"])
def hosts(request):
    host = str(payload(request).get("host", "")).strip()
    if request.method == "DELETE":
        Vm.objects.filter(host=host).delete()  # cascades to its findings
        return JsonResponse({"ok": True})
    if not engine.HOST_RE.fullmatch(host):
        return JsonResponse({"error": "invalid host: use alias, user@host or user@host:port"}, status=400)
    Vm.objects.get_or_create(host=host)
    engine.background(engine.collect_one, host)
    return JsonResponse({"ok": True})


@require_POST
def replay(request, cve_id):
    cve_id = cve_id.strip().upper()
    if not re.fullmatch(r"CVE-\d{4}-\d{4,}", cve_id):
        return JsonResponse({"error": "bad CVE id"}, status=400)
    Cve.objects.filter(id=cve_id).update(status="evaluating")  # show progress immediately
    replay_cve.delay(cve_id)
    return JsonResponse({"ok": True})
