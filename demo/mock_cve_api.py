"""Mock CVE feed for demos: same shapes as the GitHub deltaLog + cveawg API the eleven0zero reads.
Run: uvicorn mock_cve_api:app --port 8000   (from demo/; docs at /docs)"""
import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException

BASE = os.getenv("PUBLIC_URL", "http://mock-cve:8000")


def cve(cve_id, title, description, product, versions):
    return {
        "cveMetadata": {"cveId": cve_id, "state": "PUBLISHED", "datePublished": "2024-01-01T00:00:00.000Z"},
        "containers": {"cna": {
            "title": title,
            "descriptions": [{"lang": "en", "value": description}],
            "affected": [{"vendor": "n/a", "product": product, "packageName": product, "versions": versions}],
        }},
    }


CVES = {c["cveMetadata"]["cveId"]: c for c in [
    cve("CVE-2024-22195", "Jinja2 xmlattr filter allows HTML attribute injection",
        "Jinja2 before 3.1.3 lets the xmlattr filter accept keys containing spaces, so an application that "
        "passes user-controlled keys to xmlattr can inject arbitrary HTML attributes (cross-site scripting). "
        "Fixed in 3.1.3.",
        "Jinja2", [{"version": "0", "lessThan": "3.1.3", "status": "affected", "versionType": "python"}]),
    cve("CVE-2024-6387", "OpenSSH regreSSHion race condition in sshd",
        "A signal handler race condition in OpenSSH sshd allows unauthenticated remote code execution "
        "on glibc-based Linux systems.",
        "openssh", [{"version": "8.5p1", "lessThan": "9.8p1", "status": "affected"}]),
    cve("CVE-2023-44487", "HTTP/2 Rapid Reset denial of service",
        "The HTTP/2 protocol allows denial of service because request cancellation can reset many streams quickly.",
        "nghttp2", [{"version": "0", "lessThan": "1.57.0", "status": "affected"}]),
]}


app = FastAPI(title="Mock CVE API")


@app.get("/deltaLog.json")
def delta_log():
    now = datetime.now(timezone.utc).isoformat()  # always fresh so eleven0zero's lookback window matches
    return [{"fetchTime": now, "new": [{"cveId": i, "githubLink": f"{BASE}/cves/{i}.json"} for i in CVES]}]


@app.get("/cves/{cve_id}.json")
@app.get("/api/cve/{cve_id}")
def get_cve(cve_id: str):
    if cve_id not in CVES:
        raise HTTPException(404, "not found")
    return CVES[cve_id]
