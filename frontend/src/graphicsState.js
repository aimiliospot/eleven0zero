// Pure state derivation for the GRAPHICS tab (live stream + step-by-step replay + historical fallback).

const SANDBOX_KINDS = new Set([
  "snapshot", "clone", "plan", "fix_cmd", "fix_out", "fix_done",
  "poc_gen", "poc_reuse", "attacker", "attack", "poc_done", "cleanup",
]);

function synthesizeEvents(cveId, data) {
  const cve = data.cves.find((c) => c.id === cveId);
  const findings = data.findings.filter((f) => f.cve_id === cveId);
  if (!cve && !findings.length) return [];

  const out = [];
  let seq = 1;
  const push = (kind, text, host = "") => out.push({ id: `syn-${cveId}-${seq++}`, cve_id: cveId, host, kind, text });

  push("arrived", `${cveId} received${cve?.title ? `: ${cve.title.slice(0, 80)}` : ""}`);

  const orderedHosts = data.vms.length
    ? data.vms.map((v) => v.host)
    : findings.map((f) => f.host);

  for (const host of orderedHosts) {
    const f = findings.find((x) => x.host === host);
    if (!f) {
      if (cve?.status === "new" || cve?.status === "evaluating") {
        push("judging", `checking ${host} inventory`, host);
      }
      continue;
    }
    push("judging", `checking ${host} installed packages & exposed ports`, host);
    for (const v of f.votes || []) {
      push("model", `${v.model}: ${v.error ? `error ${v.error.slice(0, 60)}` : `${v.verdict} (${Math.round((v.confidence || 0) * 100)}%)`}`, host);
    }
    push("verdict", `${f.verdict} (${Math.round((f.confidence || 0) * 100)}%)`, host);
  }

  if (cve?.status !== "new" && cve?.status !== "evaluating") {
    push("done", `${cveId} jury evaluation finished`);
  }

  let pocGenerated = false;
  for (const f of findings.filter((x) => x.verdict === "affected" && x.remediation)) {
    const r = f.remediation;
    const host = f.host;
    const clone = r.clone || "wdt-clone";
    if (r.snapshot) push("snapshot", `boxd snapshots save ${host.split(".")[0]} ${r.snapshot}`, host);
    if (r.snapshot || r.commands?.length || r.status === "passed" || r.status === "failed") {
      push("clone", `boxd new ${clone} --from-snapshot ${r.snapshot || "snap"} --isolated`, host);
    }
    if (r.model) push("plan", `${r.model}: writing safe upgrade commands for ${clone}`, host);
    for (const c of r.commands || []) {
      push("fix_cmd", `boxd machine exec ${clone} -- ${c.cmd}`, host);
      push("fix_out", c.rc === null ? `blocked: ${c.out}` : `rc=${c.rc}: ${(c.out || "ok").trim().split("\n").pop().slice(0, 120)}`, host);
    }
    if (r.status && r.status !== "queued" && r.status !== "running") {
      push("fix_done", `${r.status}: ${r.error || (r.status === "passed" ? `clone ${clone} patched & services healthy` : "fix check failed")}`, host);
    }
    const e = f.exploit;
    if (e) {
      const atk = e.attacker || "wdx-attacker";
      const ext = e.language === "bash" || e.language === "sh" ? "sh" : "py";
      if (e.reused_poc || pocGenerated) {
        push("poc_reuse", `reusing ${cveId} PoC (poc.${ext}) against ${clone}`, host);
      } else if (e.model) {
        push("poc_gen", `${e.model}: writing safe network PoC for ${cveId}`, host);
        pocGenerated = true;
      }
      if (e.status === "patched" || e.status === "vulnerable" || e.output) {
        push("attacker", `boxd new ${atk} --isolated --networks wd-net-sandbox  # poc.${ext} ready`, host);
        push("attack", `boxd machine exec ${atk} -- TARGET=${clone} ${e.language || "python3"} /tmp/poc`, host);
      }
      if (e.status && e.status !== "running") {
        push("poc_done", `${e.status}: ${e.status === "patched" ? "exploit blocked on patched clone" : e.notes || e.error || "clone still exploitable"}`, host);
        if (e.status === "patched" || e.status === "vulnerable") {
          push("cleanup", `boxd machine rm ${atk} -y`, host);
        }
      }
    }
    if (r.status && r.status !== "queued" && r.status !== "running" && r.status !== "skipped") {
      push("cleanup", `boxd machine rm ${clone} -y`, host);
    }
  }

  return out;
}

export function timelineForCve(cveId, data, rawEvents) {
  if (!cveId) return rawEvents.filter((e) => !e.cve_id);
  const matching = rawEvents.filter((e) => e.cve_id === cveId);
  const cve = data.cves.find((c) => c.id === cveId);

  if (matching.length) {
    let lastArrived = -1;
    for (let i = matching.length - 1; i >= 0; i--) {
      if (matching[i].kind === "arrived") { lastArrived = i; break; }
    }
    const latestRun = lastArrived > 0 ? matching.slice(lastArrived) : matching;
    const finishedBefore = latestRun.some((e) => e.kind === "done");
    if (cve?.status === "evaluating" && finishedBefore) {
      return [{ id: `pending-${cveId}`, cve_id: cveId, host: "", kind: "arrived", text: `${cveId} queued — waking up AI jury…` }];
    }
    return latestRun;
  }

  return synthesizeEvents(cveId, data);
}

const AGENT_TAG = {
  arrived: { label: "FEED", tone: "cyan" },
  scan: { label: "SCANNER", tone: "muted" },
  scan_ok: { label: "SCANNER", tone: "ok" },
  judging: { label: "AGENT 01 · JURY", tone: "cyan" },
  model: { label: "AGENT 01 · JURY", tone: "cyan" },
  verdict: { label: "AGENT 01 · JURY", tone: "cyan" },
  done: { label: "AGENT 01 · JURY", tone: "muted" },
  snapshot: { label: "AGENT 02 · PATCH", tone: "emerald" },
  clone: { label: "AGENT 02 · PATCH", tone: "emerald" },
  plan: { label: "AGENT 02 · PATCH", tone: "emerald" },
  fix_cmd: { label: "AGENT 02 · PATCH", tone: "emerald" },
  fix_out: { label: "AGENT 02 · PATCH", tone: "emerald" },
  fix_done: { label: "AGENT 02 · PATCH", tone: "emerald" },
  poc_gen: { label: "AGENT 03 · EXPLOIT", tone: "rose" },
  poc_reuse: { label: "AGENT 03 · EXPLOIT", tone: "rose" },
  attacker: { label: "AGENT 03 · EXPLOIT", tone: "rose" },
  attack: { label: "AGENT 03 · EXPLOIT", tone: "rose" },
  poc_done: { label: "AGENT 03 · EXPLOIT", tone: "rose" },
  cleanup: { label: "SANDBOX", tone: "muted" },
  error: { label: "ALERT", tone: "rose" },
};

function formatLine(e, active) {
  const map = {
    arrived: { comment: "Incoming vulnerability alert from feed", prompt: "$", cmd: `watch-cve ${e.cve_id}  # ${e.text}`, tone: "cyan" },
    scan: { comment: `Collecting inventory on ${e.host}`, prompt: "$", cmd: e.text, tone: "cyan" },
    scan_ok: { comment: null, prompt: "✓", cmd: `[${e.host}] ${e.text}`, tone: "ok" },
    judging: { comment: `Agent 01 inspecting ${e.host} against ${e.cve_id}`, prompt: "$", cmd: `judge --host ${e.host} --cve ${e.cve_id}  # ${e.text}`, tone: "cyan" },
    model: { comment: null, prompt: ">", cmd: `[${e.host}] ${e.text}`, tone: "muted" },
    verdict: {
      comment: null,
      prompt: e.text.startsWith("not_affected") ? "✓" : "!",
      cmd: `[${e.host}] verdict: ${e.text}`,
      tone: e.text.startsWith("affected") ? "bad" : e.text.startsWith("likely") ? "warn" : "ok",
    },
    done: { comment: null, prompt: "•", cmd: e.text, tone: "muted" },
    snapshot: { comment: `Agent 02 triggered — freezing snapshot of ${e.host} (production untouched)`, prompt: "$", cmd: e.text, tone: "cyan" },
    clone: { comment: "Agent 02 booting isolated clone VM from snapshot", prompt: "$", cmd: e.text, tone: "cyan" },
    plan: { comment: "Agent 02 planning non-destructive upgrade commands", prompt: ">", cmd: e.text, tone: "cyan" },
    fix_cmd: { comment: "Agent 02 applying patch command inside snapshot clone", prompt: "$", cmd: e.text, tone: "cyan" },
    fix_out: { comment: null, prompt: e.text.startsWith("rc=0") ? "✓" : "✗", cmd: e.text, tone: e.text.startsWith("rc=0") ? "ok" : "bad" },
    fix_done: {
      comment: null,
      prompt: e.text.startsWith("passed") ? "✓" : "!",
      cmd: `sandbox-fix => ${e.text}`,
      tone: e.text.startsWith("passed") ? "ok" : e.text.startsWith("skipped") ? "warn" : "bad",
    },
    poc_gen: { comment: "Agent 03 triggered — writing proof-of-concept exploit script (once per CVE)", prompt: ">", cmd: e.text, tone: "warn" },
    poc_reuse: { comment: "Agent 03 reusing existing PoC script generated for this CVE", prompt: "↻", cmd: e.text, tone: "warn" },
    attacker: { comment: "Agent 03 booting isolated attacker VM to launch PoC", prompt: "$", cmd: e.text, tone: "warn" },
    attack: { comment: "Agent 03 attacking patched snapshot clone over private network", prompt: "$", cmd: e.text, tone: "bad" },
    poc_done: {
      comment: null,
      prompt: e.text.startsWith("patched") ? "✓" : "!",
      cmd: `exploit-check => ${e.text}`,
      tone: e.text.startsWith("patched") ? "ok" : e.text.startsWith("vulnerable") ? "bad" : "warn",
    },
    cleanup: { comment: null, prompt: "$", cmd: e.text, tone: "muted" },
    error: { comment: null, prompt: "✗", cmd: `${e.host ? `[${e.host}] ` : ""}${e.text}`, tone: "bad" },
  };
  const spec = map[e.kind] || { comment: null, prompt: "$", cmd: e.text, tone: "muted" };
  const agent = AGENT_TAG[e.kind] || { label: "SYSTEM", tone: "muted" };
  return { id: e.id, kind: e.kind, host: e.host, agent, ...spec, active };
}

function parseVerdict(text = "") {
  if (text.startsWith("affected")) return "affected";
  if (text.startsWith("likely")) return "likely";
  if (text.startsWith("not_affected")) return "not_affected";
  return "error";
}

function stripExecPrefix(cmd = "") {
  return cmd.replace(/^boxd\s+machine\s+exec\s+\S+\s+--\s+/, "");
}

function parseModelPrefix(text = "") {
  const idx = text.indexOf(": ");
  return idx > 0 ? text.slice(0, idx).trim() : null;
}

export function deriveScene({ cveId, data, rawEvents, replayIndex = null, sandboxHost = null }) {
  const fullTimeline = timelineForCve(cveId, data, rawEvents);
  const isReplay = replayIndex !== null;
  const events = isReplay ? fullTimeline.slice(0, replayIndex + 1) : fullTimeline;
  const cve = cveId ? data.cves.find((c) => c.id === cveId) : null;
  const findings = cveId ? data.findings.filter((f) => f.cve_id === cveId) : [];
  const scanEvents = rawEvents.filter((e) => !e.cve_id);

  // Per-VM state
  const vmNodes = data.vms.map((vm) => {
    const finding = findings.find((f) => f.host === vm.host) || null;
    const hostEvents = events.filter((e) => e.host === vm.host && !SANDBOX_KINDS.has(e.kind));
    const lastEv = hostEvents[hostEvents.length - 1];
    const lastScan = scanEvents.filter((e) => e.host === vm.host).pop();

    let state = "idle";
    let note = vm.os || "Linux host";

    if (!cveId) {
      if (!vm.collected_at || lastScan?.kind === "scan") {
        state = "scanning";
        note = "Collecting inventory…";
      } else if (vm.error) {
        state = "error";
        note = "SSH / scan error";
      }
    } else if (isReplay) {
      if (!lastEv) {
        state = "idle";
      } else if (lastEv.kind === "judging" || lastEv.kind === "model") {
        state = "judging";
        note = lastEv.kind === "model" ? lastEv.text : "Checking packages & ports…";
      } else if (lastEv.kind === "verdict") {
        state = parseVerdict(lastEv.text);
        note = lastEv.text;
      } else if (lastEv.kind === "error") {
        state = "error";
        note = lastEv.text;
      }
    } else {
      if (lastEv?.kind === "judging" || lastEv?.kind === "model") {
        if (!finding || cve?.status === "evaluating") {
          state = "judging";
          note = lastEv.kind === "model" ? lastEv.text : "Checking packages & ports…";
        } else {
          state = finding.verdict;
        }
      } else if (finding && cve?.status !== "evaluating") {
        state = finding.verdict;
      } else if (lastEv?.kind === "verdict") {
        state = parseVerdict(lastEv.text);
      } else if (cve?.status === "new" || cve?.status === "evaluating") {
        state = finding ? finding.verdict : "idle";
      }
    }

    const hostSandboxEvents = events.filter((e) => e.host === vm.host && SANDBOX_KINDS.has(e.kind));
    const fixVerified = isReplay
      ? hostSandboxEvents.some((e) => e.kind === "fix_done" && e.text.startsWith("passed"))
      : finding?.remediation?.status === "passed";
    const pocBlocked = isReplay
      ? hostSandboxEvents.some((e) => e.kind === "poc_done" && e.text.startsWith("patched"))
      : finding?.exploit?.status === "patched";

    return {
      ...vm,
      state,
      note,
      finding: isReplay && state !== "affected" && state !== "likely" && state !== "not_affected" ? null : finding,
      confidence: finding ? Math.round((finding.confidence || 0) * 100) : null,
      fixVerified,
      pocBlocked,
    };
  });

  // Agent 01: Jury models
  const modelMap = new Map();
  for (const e of events) {
    if (e.kind === "model") {
      const name = parseModelPrefix(e.text) || e.text;
      modelMap.set(name, e.text);
    }
  }
  if (!isReplay && !modelMap.size) {
    for (const f of findings) {
      for (const v of f.votes || []) {
        modelMap.set(v.model, `${v.model}: ${v.verdict || "error"}`);
      }
    }
  }
  const juryModels = [...modelMap.keys()];

  // Agent 02 (Patch Agent) + Agent 03 (Exploit Agent) + Sandbox VMs
  const sandboxEvents = events.filter((e) => SANDBOX_KINDS.has(e.kind));
  const affectedVms = vmNodes.filter((v) => v.state === "affected");
  const affectedHosts = [...new Set([...affectedVms.map((v) => v.host), ...sandboxEvents.map((e) => e.host).filter(Boolean)])];
  const affectedVm = affectedVms[0];
  const targetHost = (sandboxHost && affectedHosts.includes(sandboxHost))
    ? sandboxHost
    : (sandboxEvents[sandboxEvents.length - 1]?.host || affectedVm?.host || null);
  const targetFinding = targetHost ? findings.find((f) => f.host === targetHost) : null;

  let sandbox = null;
  if (targetHost && (sandboxEvents.length > 0 || Boolean(affectedVm) || (!isReplay && targetFinding?.remediation))) {
    const hostSb = sandboxEvents.filter((e) => e.host === targetHost);
    const rem = !isReplay ? targetFinding?.remediation : null;
    const exp = !isReplay ? targetFinding?.exploit : null;

    let cloneName = rem?.clone || null;
    let snapshotName = rem?.snapshot || null;
    let patchModel = rem?.model || null;
    let patchState = "queued";
    let currentCmd = null;
    let commandsCount = rem?.commands?.length || 0;
    let cleanedClone = false;

    let exploitModel = exp?.model || null;
    let exploitState = "standby";
    let attackerName = exp?.attacker || null;
    let pocFile = exp?.language === "bash" || exp?.language === "sh" ? "poc.sh" : "poc.py";
    let exploitNote = "";
    let cleanedAttacker = false;
    let reusedPoc = Boolean(!isReplay && exp?.reused_poc);

    if (hostSb.length > 0 || isReplay) {
      commandsCount = 0;
      for (const e of hostSb) {
        const cloneMatch = e.text.match(/\b(wdt-[a-z0-9-]+)\b/);
        if (cloneMatch) cloneName = cloneMatch[1];
        const snapMatch = e.text.match(/\b(wd-(?!net-)[a-z0-9-]+)\b/);
        if (snapMatch) snapshotName = snapMatch[1];
        const atkMatch = e.text.match(/\b(wdx-[a-z0-9-]+)\b/);
        if (atkMatch) attackerName = atkMatch[1];
        const pocMatch = e.text.match(/\b(poc\.(?:py|sh))\b/);
        if (pocMatch) pocFile = pocMatch[1];
        if (e.text.includes("bash /tmp/poc") || e.text.includes(" sh /tmp/poc")) pocFile = "poc.sh";

        if (e.kind === "snapshot") {
          patchState = "snapshotting";
          currentCmd = e.text;
        } else if (e.kind === "clone") {
          patchState = "cloning";
          currentCmd = e.text;
        } else if (e.kind === "plan") {
          patchState = "planning";
          patchModel = parseModelPrefix(e.text) || patchModel;
          currentCmd = null;
        } else if (e.kind === "fix_cmd") {
          patchState = "patching";
          currentCmd = stripExecPrefix(e.text);
          commandsCount += 1;
        } else if (e.kind === "fix_done") {
          patchState = e.text.startsWith("passed") ? "passed" : e.text.startsWith("skipped") ? "skipped" : "failed";
          currentCmd = null;
        } else if (e.kind === "poc_gen") {
          exploitState = "coding_poc";
          exploitModel = parseModelPrefix(e.text) || exploitModel;
          exploitNote = `Writing non-destructive ${pocFile} exploit…`;
        } else if (e.kind === "poc_reuse") {
          exploitState = "reusing_poc";
          reusedPoc = true;
          exploitNote = `Reusing ${cveId} ${pocFile} — skipping regeneration…`;
        } else if (e.kind === "attacker") {
          exploitState = "spawning_vm";
          exploitNote = `${pocFile} ready — booting isolated attacker VM…`;
        } else if (e.kind === "attack") {
          exploitState = "attacking";
          exploitNote = `Attacking ${cloneName || "clone"} with ${pocFile}…`;
        } else if (e.kind === "poc_done") {
          exploitState = e.text.startsWith("patched") ? "patched"
            : e.text.startsWith("vulnerable") ? "vulnerable"
            : e.text.startsWith("not_feasible") ? "not_feasible"
            : e.text.startsWith("blocked") ? "blocked" : "error";
          exploitNote = e.text.replace(/^[a-z_]+:\s*/, "");
        } else if (e.kind === "cleanup") {
          if (cloneName && e.text.includes(cloneName)) cleanedClone = true;
          if (attackerName && e.text.includes(attackerName)) cleanedAttacker = true;
        } else if (e.kind === "error" && patchState !== "passed") {
          patchState = "error";
        }
      }
    } else if (rem) {
      patchState = rem.status === "passed" ? "passed"
        : rem.status === "failed" ? "failed"
        : rem.status === "skipped" ? "skipped"
        : rem.status === "error" ? "error"
        : rem.status === "running" ? "patching" : "queued";
    }

    if (!isReplay && exp && exploitState === "standby") {
      exploitState = exp.status === "running" ? (exp.attacker ? "attacking" : "coding_poc") : exp.status;
      exploitNote = exp.notes || exp.error || (exp.status === "patched" ? "Exploit blocked on patched clone" : "");
    }

    const patchBusy = ["queued", "snapshotting", "cloning", "planning", "patching"].includes(patchState);
    const exploitBusy = ["coding_poc", "reusing_poc", "spawning_vm", "attacking"].includes(exploitState);

    const cloneVmState = patchState === "passed" ? "not_affected"
      : patchState === "failed" || patchState === "error" ? "affected"
      : patchState === "patching" || patchState === "planning" || patchState === "cloning" ? "judging"
      : patchState === "snapshotting" || patchState === "queued" ? "affected"
      : "idle";

    const pocStatus = exploitState === "standby" ? "idle"
      : exploitState === "coding_poc" ? "writing"
      : exploitState === "blocked" ? "blocked"
      : exploitState === "not_feasible" ? "not_feasible"
      : exploitState === "error" && !attackerName ? "error"
      : reusedPoc ? "reused" : "ready";

    const attackerSpawned = Boolean(attackerName) || ["spawning_vm", "attacking", "patched", "vulnerable"].includes(exploitState);

    sandbox = {
      sourceHost: targetHost,
      affectedHosts,
      status: patchState, // kept for compact status checks
      patchAgent: {
        state: patchState,
        busy: patchBusy,
        model: patchModel || juryModels[0] || "AI patch model",
        currentCmd,
        commandsCount,
      },
      cloneVm: {
        name: cloneName || "wdt-clone",
        snapshotName: snapshotName || "snapshot",
        booted: Boolean(cloneName) || ["planning", "patching", "passed", "failed"].includes(patchState),
        visualState: cloneVmState,
        destroyed: cleanedClone,
      },
      exploitAgent: {
        state: exploitState,
        busy: exploitBusy,
        triggered: patchState === "passed" || exploitState !== "standby",
        model: exploitModel || "AI exploit model",
        pocFile,
        pocStatus,
        reusedPoc,
        note: exploitNote,
      },
      attackerVm: {
        name: attackerName || "wdx-attacker",
        spawned: attackerSpawned,
        attacking: exploitState === "attacking",
        destroyed: cleanedAttacker,
      },
      exploit: exploitState === "standby" ? null : { status: exploitState, attackerName: attackerName || "wdx-attacker" },
    };
  }

  // Overall pipeline stage & working status
  const judgingVm = vmNodes.find((v) => v.state === "judging");
  const scanningVm = vmNodes.find((v) => v.state === "scanning");
  const sandboxBusy = Boolean(sandbox && (sandbox.patchAgent.busy || sandbox.exploitAgent.busy));
  const evalBusy = cveId && (
    isReplay
      ? replayIndex < fullTimeline.length - 1 && !events.some((e) => e.kind === "done")
      : (cve?.status === "new" || cve?.status === "evaluating" || Boolean(judgingVm))
  );
  const working = Boolean(scanningVm || evalBusy || sandboxBusy || (isReplay && replayIndex < fullTimeline.length - 1));

  let stage = 0;
  if (cveId) {
    if (sandbox?.exploitAgent.triggered && sandbox.exploitAgent.state !== "standby") stage = 4;
    else if (sandbox) stage = 3;
    else if (judgingVm || events.some((e) => e.kind === "judging" || e.kind === "verdict" || e.kind === "done")) stage = 2;
    else stage = 1;
  }

  // Plain-English live narrator headline naming which Agent is acting
  const affectedCount = vmNodes.filter((v) => v.state === "affected").length;
  const safeCount = vmNodes.filter((v) => v.state === "not_affected").length;
  let headline = "All systems monitored. Enter a CVE above or wait for the live feed.";

  if (!cveId && scanningVm) {
    headline = `Scanner is collecting packages, open ports, and services on ${scanningVm.host}…`;
  } else if (cveId) {
    const pa = sandbox?.patchAgent;
    const ea = sandbox?.exploitAgent;
    if (ea?.state === "coding_poc") {
      headline = `Agent 03 (Exploit Agent) woke up and is writing a PoC exploit (${ea.pocFile}) once for ${cveId}…`;
    } else if (ea?.state === "reusing_poc") {
      headline = `Agent 03 is reusing the ${cveId} PoC (${ea.pocFile}) against ${sandbox.sourceHost} — no regeneration needed…`;
    } else if (ea?.state === "spawning_vm") {
      headline = `Agent 03 finished writing ${ea.pocFile} and is booting isolated Attacker VM ${sandbox.attackerVm.name}…`;
    } else if (ea?.state === "attacking") {
      headline = `Agent 03 is attacking patched clone ${sandbox.cloneVm.name} from ${sandbox.attackerVm.name}…`;
    } else if (ea?.state === "patched") {
      headline = `Verified: Agent 02 patched the snapshot clone and Agent 03's PoC attack was blocked — production untouched.`;
    } else if (ea?.state === "vulnerable") {
      headline = `Warning: Agent 03's PoC exploit still succeeded against ${sandbox.cloneVm.name} after patching.`;
    } else if (ea?.state === "blocked" || ea?.state === "not_feasible") {
      headline = `Agent 02 verified the patch on ${sandbox.cloneVm.name}; Agent 03 PoC step finished (${ea.state.replace("_", " ")}).`;
    } else if (pa?.state === "queued" || pa?.state === "snapshotting") {
      headline = `${sandbox.sourceHost} is affected — Agent 02 (Patch Agent) woke up and is snapshotting the VM…`;
    } else if (pa?.state === "cloning") {
      headline = `Agent 02 is booting isolated snapshot clone ${sandbox.cloneVm.name} so production stays untouched…`;
    } else if (pa?.state === "planning" || pa?.state === "patching") {
      headline = `Agent 02 is applying AI-planned upgrade commands inside snapshot clone ${sandbox.cloneVm.name}…`;
    } else if (pa?.state === "passed") {
      headline = `Agent 02 verified the fix on ${sandbox.cloneVm.name} — handing off to Agent 03 to craft a PoC attack…`;
    } else if (judgingVm) {
      headline = `Agent 01 (AI Jury) is inspecting ${judgingVm.host} packages and open ports against ${cveId}…`;
    } else if (evalBusy) {
      headline = `Alert ${cveId} arrived — waking up Agent 01 (AI Security Jury)…`;
    } else if (affectedCount > 0) {
      headline = `${cveId}: ${affectedCount} VM${affectedCount > 1 ? "s" : ""} affected, ${safeCount} safe.`;
    } else if (safeCount > 0) {
      headline = `${cveId} checked across ${vmNodes.length} VM${vmNodes.length === 1 ? "" : "s"} — all machines are safe.`;
    }
  }

  const rawTermEvents = cveId ? events : scanEvents;
  const terminalLines = rawTermEvents.map((e, i) => formatLine(e, working && i === rawTermEvents.length - 1));

  return {
    cve,
    cveId,
    fullTimelineLength: fullTimeline.length,
    stage,
    working,
    juryBusy: Boolean(evalBusy),
    headline,
    juryModels,
    judgingHost: judgingVm?.host || null,
    vmNodes,
    sandbox,
    terminalLines,
  };
}
