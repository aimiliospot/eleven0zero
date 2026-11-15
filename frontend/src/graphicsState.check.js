import assert from "node:assert";
import { deriveScene } from "./graphicsState.js";

const data = {
  cves: [{ id: "CVE-2020-14343", title: "PyYAML RCE", status: "evaluated" }],
  vms: [
    { host: "hackathon-vm-1.boxd", os: "Ubuntu 24.04", npkg: 400, ports: [], collected_at: "2026-11-15T10:00:00Z" },
    { host: "cve-lab.boxd", os: "Ubuntu 24.04", npkg: 412, ports: ["sshd@0.0.0.0:22"], collected_at: "2026-11-15T10:00:00Z" },
  ],
  findings: [
    { cve_id: "CVE-2020-14343", host: "hackathon-vm-1.boxd", verdict: "not_affected", confidence: 0.95, votes: [{ model: "gemini-4-carbon", verdict: "not_affected", confidence: 0.95 }] },
    {
      cve_id: "CVE-2020-14343",
      host: "cve-lab.boxd",
      verdict: "affected",
      confidence: 0.98,
      votes: [{ model: "gemini-4-carbon", verdict: "affected", confidence: 0.98 }],
      remediation: { status: "passed", snapshot: "wd-lab-1", clone: "wdt-abc123", model: "gemini-4-carbon", commands: [{ cmd: "pip3 install pyyaml>=5.4", rc: 0, out: "ok" }] },
      exploit: { status: "patched", attacker: "wdx-def456", model: "venice:deepseek", language: "python3" },
    },
  ],
};

// 1. Completed run shows all 3 Agents + Clone VM + Attacker VM + blocked PoC
const live = deriveScene({ cveId: "CVE-2020-14343", data, rawEvents: [] });
assert.deepEqual(live.vmNodes.map((v) => v.state), ["not_affected", "affected"]);
assert.equal(live.sandbox.patchAgent.state, "passed");
assert.equal(live.sandbox.patchAgent.model, "gemini-4-carbon");
assert.equal(live.sandbox.cloneVm.name, "wdt-abc123");
assert.equal(live.sandbox.cloneVm.visualState, "not_affected");
assert.equal(live.sandbox.exploitAgent.state, "patched");
assert.equal(live.sandbox.exploitAgent.model, "venice:deepseek");
assert.equal(live.sandbox.exploitAgent.pocFile, "poc.py");
assert.equal(live.sandbox.exploitAgent.pocStatus, "ready");
assert.equal(live.sandbox.attackerVm.name, "wdx-def456");
assert.equal(live.sandbox.attackerVm.spawned, true);
assert.equal(live.stage, 4);
assert.equal(live.working, false);
assert.equal(live.outcomeTone, "safe");
assert(live.terminalLines.some((l) => l.agent.label === "AGENT 2 · FIX TESTER"));
assert(live.terminalLines.some((l) => l.agent.label === "AGENT 3 · ATTACK SIMULATOR"));

// 2. Replay step-by-step starts VMs idle, then triggers Agent 02, then Agent 03
const step0 = deriveScene({ cveId: "CVE-2020-14343", data, rawEvents: [], replayIndex: 0 });
assert.deepEqual(step0.vmNodes.map((v) => v.state), ["idle", "idle"]);
assert.equal(step0.sandbox, null);
assert.equal(step0.working, true);

const step1 = deriveScene({ cveId: "CVE-2020-14343", data, rawEvents: [], replayIndex: 1 });
assert.deepEqual(step1.vmNodes.map((v) => v.state), ["judging", "idle"]);

// 3. Multiple affected VMs generate PoC once and reuse it on subsequent VMs
const multiData = {
  cves: [{ id: "CVE-2024-22195", title: "Jinja2 XSS", status: "evaluated" }],
  vms: [
    { host: "vm1.boxd", os: "Ubuntu 24.04", npkg: 400, ports: [], collected_at: "2026-11-15T10:00:00Z" },
    { host: "vm2.boxd", os: "Ubuntu 24.04", npkg: 410, ports: [], collected_at: "2026-11-15T10:00:00Z" },
  ],
  findings: [
    {
      cve_id: "CVE-2024-22195",
      host: "vm1.boxd",
      verdict: "affected",
      confidence: 0.96,
      votes: [{ model: "gemini-4-carbon", verdict: "affected", confidence: 0.96 }],
      remediation: { status: "passed", snapshot: "wd-vm1", clone: "wdt-111", model: "gemini-4-carbon", commands: [] },
      exploit: { status: "patched", attacker: "wdx-111", model: "venice:deepseek", language: "python3" },
    },
    {
      cve_id: "CVE-2024-22195",
      host: "vm2.boxd",
      verdict: "affected",
      confidence: 0.96,
      votes: [{ model: "gemini-4-carbon", verdict: "affected", confidence: 0.96 }],
      remediation: { status: "passed", snapshot: "wd-vm2", clone: "wdt-222", model: "gemini-4-carbon", commands: [] },
      exploit: { status: "patched", attacker: "wdx-222", model: "venice:deepseek", language: "python3", reused_poc: true },
    },
  ],
};
const multiVm1 = deriveScene({ cveId: "CVE-2024-22195", data: multiData, rawEvents: [], sandboxHost: "vm1.boxd" });
const multiVm2 = deriveScene({ cveId: "CVE-2024-22195", data: multiData, rawEvents: [], sandboxHost: "vm2.boxd" });
assert.equal(multiVm1.terminalLines.filter((l) => l.kind === "poc_gen").length, 1);
assert.equal(multiVm1.terminalLines.filter((l) => l.kind === "poc_reuse").length, 1);
assert.equal(multiVm1.sandbox.exploitAgent.pocStatus, "ready");
assert.equal(multiVm2.sandbox.exploitAgent.pocStatus, "reused");
assert(multiVm1.terminalLines.some((l) => l.cmd === "Agent 1 is currently working at vm1.boxd to evaluate if CVE-2024-22195 affects it."));

// 4. Criticality >= threshold shuts down affected VMs immediately and skips Safe Test Room
const shutdownData = {
  cves: [{ id: "CVE-2024-6387", title: "regreSSHion", cvss: 9.8, status: "evaluated" }],
  vms: [
    { host: "safe.boxd", os: "Ubuntu 24.04", npkg: 400, ports: [], collected_at: "2026-11-15T10:00:00Z" },
    { host: "gw.boxd", os: "Debian 12", npkg: 420, ports: ["sshd@0.0.0.0:22"], collected_at: "2026-11-15T10:00:00Z" },
  ],
  findings: [
    { cve_id: "CVE-2024-6387", host: "safe.boxd", verdict: "not_affected", confidence: 0.98, votes: [] },
    {
      cve_id: "CVE-2024-6387",
      host: "gw.boxd",
      verdict: "affected",
      confidence: 0.99,
      votes: [],
      remediation: { status: "auto_shutdown", cvss: 9.8, threshold: 9.0, cmd: "boxd machine stop gw" },
    },
  ],
};
const shutdownScene = deriveScene({ cveId: "CVE-2024-6387", data: shutdownData, rawEvents: [] });
assert.deepEqual(shutdownScene.vmNodes.map((v) => v.state), ["not_affected", "shutdown"]);
assert.equal(shutdownScene.sandbox, null);
assert.deepEqual(shutdownScene.containment, { hosts: ["gw.boxd"], cvss: 9.8, threshold: 9.0 });
assert.equal(shutdownScene.outcomeTone, "warn");
assert(shutdownScene.terminalLines.some((l) => l.kind === "auto_shutdown"));

console.log("ok");
