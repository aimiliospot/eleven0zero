from django.test import SimpleTestCase, TestCase, TransactionTestCase

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


class Events(TransactionTestCase):
    def test_evaluate_emits_progress(self):
        from unittest.mock import patch
        Vm.objects.create(host="vm1", inventory={"packages": {"openssh-server": "9"}})
        rec = {"cveMetadata": {"cveId": "CVE-2024-2"}, "containers": {"cna": {"affected": [{"packageName": "openssh"}]}}}
        Cve.objects.create(id="CVE-2024-2", title="t", record=rec)
        with patch.object(engine, "judge", return_value={"verdict": "not_affected", "confidence": .9, "evidence": "", "actions": []}):
            from config.celery import app
            from .tasks import evaluate_cve
            app.conf.task_always_eager = True
            try:
                evaluate_cve.delay("CVE-2024-2")
            finally:
                app.conf.task_always_eager = False
        ev = self.client.get("/api/events").json()["events"]
        assert [e["kind"] for e in ev] == ["arrived", "judging", "verdict", "done"], ev
        assert self.client.get(f"/api/events?since={ev[1]['id']}").json()["events"] == ev[2:]

    def test_remediate_and_exploit_emit_events(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        inv = {"os": {"PRETTY_NAME": "Ubuntu 24.04"}, "packages": {"pyyaml": "5.3.1"}, "services": ["sshd"], "ports": []}
        Vm.objects.create(host="lab.boxd", inventory=inv)
        rec = {"cveMetadata": {"cveId": "CVE-2020-14343"}, "containers": {"cna": {
            "affected": [{"packageName": "pyyaml"}], "descriptions": [{"lang": "en", "value": "vuln"}]}}}
        Cve.objects.create(id="CVE-2020-14343", title="PyYAML", record=rec)
        Finding.objects.create(cve_id="CVE-2020-14343", vm_id="lab.boxd", verdict="affected",
                               confidence=.95, actions=["pip3 install pyyaml>=5.4"], remediation={"status": "queued"})
        clean_inv = {**inv, "packages": {"pyyaml": "6.0.1"}}
        poc_res = {"feasible": True, "language": "python3", "script": "print('safe')", "success_marker": "VULN!", "notes": "ok"}
        with tempfile.TemporaryDirectory() as tmp, \
             patch("shutil.which", return_value="/usr/bin/boxd"), \
             patch.object(engine, "EXPLOIT_DIR", Path(tmp)), \
             patch.object(engine, "machine_region", return_value="eu-1"), \
             patch.object(engine, "boxd_ok", return_value='{"public_ip": "10.0.0.2"}'), \
             patch.object(engine, "boxd", return_value=(0, "", "")), \
             patch.object(engine, "vm_exec", side_effect=[(0, ""), (0, ""), (0, "Successfully installed pyyaml-6.0.1"), (0, ""), (0, ""), (0, "safe")]), \
             patch.object(engine, "vm_inventory", side_effect=[inv, clean_inv]), \
             patch.object(engine, "plan_commands", return_value=["pip3 install 'pyyaml>=5.4'"]), \
             patch.object(engine, "judge", return_value={"verdict": "not_affected", "confidence": .95, "evidence": "fixed", "actions": []}), \
             patch.object(engine, "generate_exploit", return_value=poc_res):
            engine.remediate("CVE-2020-14343", "lab.boxd")
        ev = self.client.get("/api/events").json()["events"]
        kinds = [e["kind"] for e in ev]
        assert kinds == ["snapshot", "clone", "plan", "fix_cmd", "fix_out", "fix_done",
                         "poc_gen", "attacker", "attack", "poc_done", "cleanup", "cleanup"], kinds

    def test_poc_generated_once_across_multiple_affected_vms(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        inv = {"os": {"PRETTY_NAME": "Ubuntu 24.04"}, "packages": {"pyyaml": "5.3.1"}, "services": ["sshd"], "ports": []}
        clean_inv = {**inv, "packages": {"pyyaml": "6.0.1"}}
        rec = {"cveMetadata": {"cveId": "CVE-2020-14343"}, "containers": {"cna": {
            "affected": [{"packageName": "pyyaml"}], "descriptions": [{"lang": "en", "value": "vuln"}]}}}
        Cve.objects.create(id="CVE-2020-14343", title="PyYAML", record=rec)
        for host in ("lab1.boxd", "lab2.boxd"):
            Vm.objects.create(host=host, inventory=inv)
            Finding.objects.create(cve_id="CVE-2020-14343", vm_id=host, verdict="affected",
                                   confidence=.95, actions=["pip3 install pyyaml>=5.4"], remediation={"status": "queued"})
        poc_res = {"feasible": True, "language": "python3", "script": "print('safe')", "success_marker": "VULN!", "notes": "ok"}
        exec_seq = [(0, ""), (0, ""), (0, "ok"), (0, ""), (0, ""), (0, "safe")]
        with tempfile.TemporaryDirectory() as tmp, \
             patch("shutil.which", return_value="/usr/bin/boxd"), \
             patch.object(engine, "EXPLOIT_DIR", Path(tmp)), \
             patch.object(engine, "machine_region", return_value="eu-1"), \
             patch.object(engine, "boxd_ok", return_value='{"public_ip": "10.0.0.2"}'), \
             patch.object(engine, "boxd", return_value=(0, "", "")), \
             patch.object(engine, "vm_exec", side_effect=exec_seq * 2), \
             patch.object(engine, "vm_inventory", side_effect=[inv, clean_inv, inv, clean_inv]), \
             patch.object(engine, "plan_commands", return_value=["pip3 install 'pyyaml>=5.4'"]), \
             patch.object(engine, "judge", return_value={"verdict": "not_affected", "confidence": .95, "evidence": "fixed", "actions": []}), \
             patch.object(engine, "generate_exploit", return_value=poc_res) as gen_mock:
            engine.remediate("CVE-2020-14343", "lab1.boxd")
            engine.remediate("CVE-2020-14343", "lab2.boxd")
            assert gen_mock.call_count == 1
            assert len(list(Path(tmp).iterdir())) == 1
        f1 = Finding.objects.get(cve_id="CVE-2020-14343", vm_id="lab1.boxd")
        f2 = Finding.objects.get(cve_id="CVE-2020-14343", vm_id="lab2.boxd")
        assert f1.exploit["status"] == "patched" and not f1.exploit.get("reused_poc")
        assert f2.exploit["status"] == "patched" and f2.exploit.get("reused_poc") is True
        assert f1.exploit["saved_path"] == f2.exploit["saved_path"]
        ev = self.client.get("/api/events").json()["events"]
        assert [e["kind"] for e in ev if e["host"] == "lab1.boxd" and e["kind"].startswith("poc_")] == ["poc_gen", "poc_done"]
        assert [e["kind"] for e in ev if e["host"] == "lab2.boxd" and e["kind"].startswith("poc_")] == ["poc_reuse", "poc_done"]


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


class DemoHosts(TestCase):
    def test_adds_valid_demo_hosts_once(self):
        from unittest import mock
        with mock.patch.dict("os.environ", {"DEMO_HOSTS": "a.boxd, bad host!,,b.boxd"}):
            engine.add_demo_hosts()
            engine.add_demo_hosts()
        assert sorted(Vm.objects.values_list("host", flat=True)) == ["a.boxd", "b.boxd"]
        engine.add_demo_hosts()  # unset: no-op
        assert Vm.objects.count() == 2


class CollectCommand(SimpleTestCase):
    def test_boxd_hosts_use_the_cli_only_with_a_token(self):
        from unittest import mock
        with mock.patch("shutil.which", return_value="/usr/local/bin/boxd"):
            with mock.patch.dict("os.environ", {"BOXD_TOKEN": "t"}):
                assert engine.collect_command("hackathon-vm-1.boxd")[:4] == ["boxd", "machine", "exec", "hackathon-vm-1"]
                assert engine.collect_command("root@10.0.0.5")[0] == "ssh"
            with mock.patch.dict("os.environ", {"BOXD_TOKEN": ""}):
                assert engine.collect_command("hackathon-vm-1.boxd")[0] == "ssh"
