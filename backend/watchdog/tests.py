from django.test import SimpleTestCase, TestCase

from . import engine
from .models import Cve, Finding, Vm


class Matching(SimpleTestCase):
    def test_matching_and_host_validation(self):
        rec = {"containers": {"cna": {"affected": [{"packageName": "OpenSSH", "product": "Red Hat Enterprise Linux 9"},
                                                   {"vendor": "Linux", "product": "Linux"}]}}}
        terms = engine.cve_terms(rec)
        assert "openssh" in terms and "linux" not in terms, terms
        vuln = {"packages": {"openssh-server": "1:9.6p1-3ubuntu13", "bash": "5.2"}, "ports": [
            {"process": "sshd", "local": "0.0.0.0:22", "exposed": True}]}
        clean = {"packages": {"dropbear": "2022.83", "libssh-4": "0.10"}, "containers": [{"image": "nginx:1.25"}]}
        assert set(engine.matches(terms, engine.vm_names(vuln))) == {"openssh-server"}
        assert not engine.matches(terms, engine.vm_names(clean))
        assert "nginx" in engine.matches({"nginx"}, engine.vm_names(clean))
        for ok in ("vm1", "root@10.0.0.5", "root@my-vm.boxd.sh:2222"):
            assert engine.HOST_RE.fullmatch(ok), ok
        for bad in ("-oProxyCommand=x", "a b", "root@host;rm", "host -p 22", ""):
            assert not engine.HOST_RE.fullmatch(bad), bad
        assert engine.ssh_target("root@h:2222") == "ssh://root@h:2222"


class Api(TestCase):
    def test_state_hosts_cascade_and_csrf(self):
        r = self.client.get("/api/state")
        assert r.status_code == 200 and "csrftoken" in r.cookies
        assert self.client.post("/api/hosts", {"host": "-oProxyCommand=x"}, content_type="application/json").status_code == 400
        Vm.objects.create(host="vm1")
        Cve.objects.create(id="CVE-2024-1", title="t", record={})
        Finding.objects.create(
            cve_id="CVE-2024-1", vm_id="vm1", verdict="affected", confidence=.9, actions=["x"],
            remediation={"status": "passed", "exploit": {"status": "patched"}},
        )
        f = self.client.get("/api/state").json()["findings"][0]
        assert f["host"] == "vm1" and f["title"] == "t" and f["actions"] == ["x"] and f["exploit"] == {"status": "patched"}
        self.client.delete("/api/hosts", {"host": "vm1"}, content_type="application/json")
        assert Finding.objects.count() == 0
        strict = type(self.client)(enforce_csrf_checks=True)
        assert strict.post("/api/hosts", {"host": "vm1"}, content_type="application/json").status_code == 403


class Remediation(SimpleTestCase):
    def test_compare_and_guards(self):
        before = {"services": ["cron", "docker"], "ports": [{"proto": "tcp", "process": "sshd", "local": "0.0.0.0:22"}]}
        ok = engine.compare(before, {**before, "services": ["cron", "docker", "x"]}, ["a.service"], ["a.service"])
        assert ok["services_ok"] and not ok["services_missing"], ok
        bad = engine.compare(before, {"services": ["cron"], "ports": []}, [], ["b.service"])
        assert not bad["services_ok"] and bad["services_missing"] == ["docker"] and bad["failed_units"] == ["b.service"]
        assert bad["ports_gone"] == ["tcp sshd@0.0.0.0:22"]
        assert engine.BOXD_HOST.fullmatch("cve-lab.boxd").group(1) == "cve-lab"
        assert engine.BOXD_HOST.fullmatch("boxd@my-vm.boxd.sh:2222").group(1) == "my-vm"
        assert not engine.BOXD_HOST.fullmatch("root@10.0.0.5")
        assert engine.FORBIDDEN.search("sudo ufw deny 57073/tcp") and not engine.FORBIDDEN.search("npm install -g lodash@^4.17.21")

    def test_exploit_guards_and_filename(self):
        assert engine.FORBIDDEN.search("sudo reboot now")  # a malicious PoC still can't touch power/firewall
        assert not engine.FORBIDDEN.search("python3 -c \"import socket; socket.create_connection(('x', 1))\"")
        assert engine.SAFE_RE.sub("_", "root@my-vm.boxd.sh:2222") == "root_my-vm.boxd.sh_2222"
        assert engine.RUNNERS["python3"] == "python3" and engine.EXT["bash"] == "sh"


class Aggregation(SimpleTestCase):
    def v(self, verdict, conf, actions=()):
        return {"model": "m", "verdict": verdict, "confidence": conf, "evidence": f"{verdict}!", "actions": list(actions)}

    def test_majority_tie_and_confidence(self):
        a = engine.aggregate([self.v("not_affected", .9, ["x"]), self.v("not_affected", .7, ["x", "y"]), self.v("affected", .8)])
        assert a["verdict"] == "not_affected" and abs(a["confidence"] - (.9 + .7) / 3) < 1e-9, a
        assert a["actions"] == ["x", "y"] and a["evidence"].startswith("2/3 models agree. not_affected!")
        assert engine.aggregate([self.v("not_affected", .9), self.v("likely", .6)])["verdict"] == "likely"  # tie -> more severe
        one = engine.aggregate([self.v("affected", .95)])
        assert one["confidence"] == .95 and one["evidence"] == "affected!"  # single model: no "1/1" noise


class SettingsApi(TestCase):
    def test_models_validated(self):
        put = lambda d: self.client.put("/api/settings", d, content_type="application/json")
        for bad in (["../etc"], [], ["venice:"], ["openai:gpt"]):
            assert put({"models": bad}).status_code == 400, bad
        for bad_single in ("../etc", "venice:", "openai:gpt"):
            assert put({"models": ["gemini-a"], "remediation_model": bad_single}).status_code == 400, bad_single
            assert put({"models": ["gemini-a"], "exploitation_model": bad_single}).status_code == 400, bad_single
        assert self.client.get("/api/settings").json()["exploitation_model"] == engine.VENICE + engine.VENICE_MODEL
        r = put({
            "models": ["gemini-a", "venice:llama-3.3-70b", "gemini-a"],
            "remediation_model": "venice:llama-3.3-70b",
            "exploitation_model": "venice:deepseek-v4-1-flash-1017-uncensored",
        })
        assert r.status_code == 200 and "api_key" not in r.json()
        d = self.client.get("/api/settings").json()
        assert d["models"] == ["gemini-a", "venice:llama-3.3-70b"]
        assert d["remediation_model"] == "venice:llama-3.3-70b"
        assert d["exploitation_model"] == "venice:deepseek-v4-1-flash-1017-uncensored"
        assert engine.selected_models() == ["gemini-a", "venice:llama-3.3-70b"]
        assert engine.exploitation_model() == "venice:deepseek-v4-1-flash-1017-uncensored"
        assert put({"models": ["gemini-a"], "exploitation_model": "gemini-4-carbon"}).status_code == 200
        assert engine.exploitation_model() == "gemini-4-carbon"
        assert engine.VENICE + engine.VENICE_MODEL in self.client.get("/api/models").json()["models"]
        strict = type(self.client)(enforce_csrf_checks=True)
        assert strict.put("/api/settings", {"models": ["m"]}, content_type="application/json").status_code == 403
