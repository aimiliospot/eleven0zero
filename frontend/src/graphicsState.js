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
    if (r.status === "auto_shutdown") {
      push("auto_shutdown", `cvss=${r.cvss ?? "?"} >= ${r.threshold ?? "?"}: ${host} shut down immediately`, host);
      continue;
    }
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
  arrived: { label: "NEW THREAT", tone: "cyan" },
  scan: { label: "SCANNER", tone: "muted" },
  scan_ok: { label: "SCANNER", tone: "ok" },
  judging: { label: "AGENT 1 · SECURITY INSPECTOR", tone: "cyan" },
  model: { label: "AGENT 1 · SECURITY INSPECTOR", tone: "cyan" },
  verdict: { label: "AGENT 1 · SECURITY INSPECTOR", tone: "cyan" },
  done: { label: "AGENT 1 · SECURITY INSPECTOR", tone: "muted" },
  snapshot: { label: "AGENT 2 · FIX TESTER", tone: "emerald" },
  clone: { label: "AGENT 2 · FIX TESTER", tone: "emerald" },
  plan: { label: "AGENT 2 · FIX TESTER", tone: "emerald" },
  fix_cmd: { label: "AGENT 2 · FIX TESTER", tone: "emerald" },
  fix_out: { label: "AGENT 2 · FIX TESTER", tone: "emerald" },
  fix_done: { label: "AGENT 2 · FIX TESTER", tone: "emerald" },
  poc_gen: { label: "AGENT 3 · ATTACK SIMULATOR", tone: "rose" },
  poc_reuse: { label: "AGENT 3 · ATTACK SIMULATOR", tone: "rose" },
  attacker: { label: "AGENT 3 · ATTACK SIMULATOR", tone: "rose" },
  attack: { label: "AGENT 3 · ATTACK SIMULATOR", tone: "rose" },
  poc_done: { label: "AGENT 3 · ATTACK SIMULATOR", tone: "rose" },
  auto_shutdown: { label: "AUTO-PROTECTION", tone: "warn" },
  cleanup: { label: "SAFE TEST ROOM", tone: "muted" },
  error: { label: "ALERT", tone: "rose" },
};

function humanizeModelVote(text = "", host = "") {
  const model = parseModelPrefix(text) || "AI model";
  const rest = text.slice(model.length + 2).trim();
  if (rest.startsWith("error")) return `Agent 1 (${model}) could not complete its check at ${host}.`;
  if (rest.startsWith("affected")) return `Agent 1 (${model}) voted that ${host} is affected.`;
  if (rest.startsWith("likely")) return `Agent 1 (${model}) voted that ${host} is likely affected.`;
  if (rest.startsWith("not_affected")) return `Agent 1 (${model}) voted that ${host} is safe.`;
  return `Agent 1 (${model}) finished checking ${host}.`;
}

function formatLine(e, active) {
  const host = e.host || "server";
  const cve = e.cve_id || "the vulnerability";
  const isSafeVerdict = e.text.startsWith("not_affected");
  const isAffectedVerdict = e.text.startsWith("affected");
  const isLikelyVerdict = e.text.startsWith("likely");

  const map = {
    arrived: {
      prompt: "•",
      cmd: `New vulnerability ${cve} arrived. Waking up Agent 1 to check all servers.`,
      tone: "cyan",
    },
    scan: {
      prompt: "→",
      cmd: `Scanner is currently checking installed software and open ports at ${host}.`,
      tone: "cyan",
    },
    scan_ok: {
      prompt: "✓",
      cmd: `Scanner finished checking ${host}.`,
      tone: "ok",
    },
    judging: {
      prompt: "→",
      cmd: `Agent 1 is currently working at ${host} to evaluate if ${cve} affects it.`,
      tone: "cyan",
    },
    model: {
      prompt: "•",
      cmd: humanizeModelVote(e.text, host),
      tone: "muted",
    },
    verdict: {
      prompt: isSafeVerdict ? "✓" : "!",
      cmd: isAffectedVerdict
        ? `Agent 1 found that ${host} is affected by ${cve}.`
        : isLikelyVerdict
          ? `Agent 1 found that ${host} is likely affected by ${cve}.`
          : `Agent 1 confirmed that ${host} is safe and not affected by ${cve}.`,
      tone: isAffectedVerdict ? "bad" : isLikelyVerdict ? "warn" : "ok",
    },
    done: {
      prompt: "✓",
      cmd: `Agent 1 finished evaluating all servers for ${cve}.`,
      tone: "muted",
    },
    snapshot: {
      prompt: "→",
      cmd: `Agent 2 is taking a safe backup snapshot of ${host} so the live server stays untouched.`,
      tone: "cyan",
    },
    clone: {
      prompt: "→",
      cmd: `Agent 2 created an isolated test copy of ${host} in the sandbox.`,
      tone: "cyan",
    },
    plan: {
      prompt: "→",
      cmd: `Agent 2 is preparing safe update steps to fix ${cve} on ${host}'s test copy.`,
      tone: "cyan",
    },
    fix_cmd: {
      prompt: "→",
      cmd: `Agent 2 is currently applying the security update on ${host}'s test copy.`,
      tone: "cyan",
    },
    fix_out: {
      prompt: e.text.startsWith("rc=0") ? "✓" : "!",
      cmd: e.text.startsWith("rc=0")
        ? `Agent 2 completed an update step on ${host}'s test copy.`
        : `Agent 2 reported an issue while updating ${host}'s test copy.`,
      tone: e.text.startsWith("rc=0") ? "ok" : "bad",
    },
    fix_done: {
      prompt: e.text.startsWith("passed") ? "✓" : "!",
      cmd: e.text.startsWith("passed")
        ? `Agent 2 verified that ${host}'s test copy is fixed and all services are running normally.`
        : e.text.startsWith("skipped")
          ? `Agent 2 skipped sandbox testing for ${host} because snapshots are unavailable.`
          : `Agent 2 could not verify the fix on ${host}'s test copy.`,
      tone: e.text.startsWith("passed") ? "ok" : e.text.startsWith("skipped") ? "warn" : "bad",
    },
    poc_gen: {
      prompt: "→",
      cmd: `Agent 3 is currently creating a simulated attack for ${cve} (created once for this vulnerability).`,
      tone: "warn",
    },
    poc_reuse: {
      prompt: "↻",
      cmd: `Agent 3 is reusing the ${cve} simulated attack already created to test ${host}'s patched copy.`,
      tone: "warn",
    },
    attacker: {
      prompt: "→",
      cmd: `Agent 3 started an isolated attacker machine to test ${host}'s patched copy.`,
      tone: "warn",
    },
    attack: {
      prompt: "→",
      cmd: `Agent 3 is currently attacking ${host}'s patched copy to verify that ${cve} is blocked.`,
      tone: "bad",
    },
    poc_done: {
      prompt: e.text.startsWith("patched") ? "✓" : "!",
      cmd: e.text.startsWith("patched")
        ? `Agent 3 confirmed the attack was blocked on ${host}'s patched copy — the fix works.`
        : e.text.startsWith("vulnerable")
          ? `Warning: Agent 3's simulated attack still succeeded on ${host}'s copy.`
          : `Agent 3 finished the attack check for ${host} (no network attack needed).`,
      tone: e.text.startsWith("patched") ? "ok" : e.text.startsWith("vulnerable") ? "bad" : "warn",
    },
    auto_shutdown: {
      prompt: "⏻",
      cmd: `Emergency action: ${cve} exceeded your criticality threshold — ${host} was shut down immediately to protect your network.`,
      tone: "warn",
    },
    cleanup: {
      prompt: "•",
      cmd: e.text.includes("wdx-") && !e.text.includes("wdt-")
        ? `Sandbox removed the temporary attacker machine used for ${host}.`
        : `Sandbox removed the temporary test copy of ${host}. The live server was never touched.`,
      tone: "muted",
    },
    error: {
      prompt: "✗",
      cmd: `Issue${e.host ? ` at ${host}` : ""}: ${e.text}`,
      tone: "bad",
    },
  };
  const spec = map[e.kind] || { prompt: "•", cmd: e.text, tone: "muted" };
  const agent = AGENT_TAG[e.kind] || { label: "SYSTEM", tone: "muted" };
  return { id: e.id, kind: e.kind, host: e.host, agent, comment: null, ...spec, active };
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
      } else if (lastEv.kind === "auto_shutdown") {
        state = "shutdown";
        note = "Shut down immediately";
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
          state = finding.remediation?.status === "auto_shutdown" ? "shutdown" : finding.verdict;
        }
      } else if (finding && cve?.status !== "evaluating") {
        state = finding.remediation?.status === "auto_shutdown" ? "shutdown" : finding.verdict;
      } else if (lastEv?.kind === "auto_shutdown") {
        state = "shutdown";
      } else if (lastEv?.kind === "verdict") {
        state = parseVerdict(lastEv.text);
      } else if (cve?.status === "new" || cve?.status === "evaluating") {
        state = finding ? (finding.remediation?.status === "auto_shutdown" ? "shutdown" : finding.verdict) : "idle";
      }
    }

    const hostSandboxEvents = events.filter((e) => e.host === vm.host && SANDBOX_KINDS.has(e.kind));
    const fixVerified = isReplay
      ? hostSandboxEvents.some((e) => e.kind === "fix_done" && e.text.startsWith("passed"))
      : finding?.remediation?.status === "passed";
    const pocBlocked = isReplay
      ? hostSandboxEvents.some((e) => e.kind === "poc_done" && e.text.startsWith("patched"))
      : finding?.exploit?.status === "patched";
    const shutDown = state === "shutdown";

    return {
      ...vm,
      state,
      note,
      finding: isReplay && state !== "affected" && state !== "likely" && state !== "not_affected" && state !== "shutdown" ? null : finding,
      confidence: finding ? Math.round((finding.confidence || 0) * 100) : null,
      fixVerified,
      pocBlocked,
      shutDown,
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
  const shutdownHosts = vmNodes.filter((v) => v.state === "shutdown").map((v) => v.host);
  const shutdownSample = findings.find((f) => f.remediation?.status === "auto_shutdown")?.remediation;
  const containment = shutdownHosts.length > 0 ? {
    hosts: shutdownHosts,
    cvss: shutdownSample?.cvss ?? cve?.cvss ?? null,
    threshold: shutdownSample?.threshold ?? null,
  } : null;

  if (cveId) {
    if (containment) stage = 4;
    else if (sandbox?.exploitAgent.triggered && sandbox.exploitAgent.state !== "standby") stage = 4;
    else if (sandbox) stage = 3;
    else if (judgingVm || events.some((e) => e.kind === "judging" || e.kind === "verdict" || e.kind === "done")) stage = 2;
    else stage = 1;
  }

  // Plain-English live narrator headline naming which Agent is acting
  const affectedCount = vmNodes.filter((v) => v.state === "affected").length;
  const safeCount = vmNodes.filter((v) => v.state === "not_affected").length;
  let headline = "All servers are monitored. Enter a vulnerability ID above or wait for the live feed.";
  let outcomeTone = "neutral";

  if (!cveId && scanningVm) {
    headline = `Checking installed software and running services on ${scanningVm.host}…`;
  } else if (cveId) {
    const pa = sandbox?.patchAgent;
    const ea = sandbox?.exploitAgent;
    if (containment && !judgingVm && !evalBusy) {
      outcomeTone = "warn";
      const list = shutdownHosts.join(", ");
      const scoreText = containment.cvss != null && containment.threshold != null
        ? ` (CVSS ${containment.cvss} ≥ ${containment.threshold} threshold)`
        : "";
      headline = `Emergency auto-shutdown triggered${scoreText}: ${list} ${shutdownHosts.length === 1 ? "was" : "were"} shut down immediately to protect your network.`;
    } else if (ea?.state === "coding_poc") {
      headline = `Agent 3 (Attack Simulator) is creating one simulated attack for ${cveId}…`;
    } else if (ea?.state === "reusing_poc") {
      headline = `Agent 3 is reusing the simulated attack already created for ${cveId} to test ${sandbox.sourceHost}…`;
    } else if (ea?.state === "spawning_vm") {
      headline = `Agent 3 is starting an isolated test attacker to verify the updated copy of ${sandbox.sourceHost}…`;
    } else if (ea?.state === "attacking") {
      headline = `Agent 3 is testing the simulated attack against the updated copy of ${sandbox.sourceHost}…`;
    } else if (ea?.state === "patched") {
      outcomeTone = "safe";
      headline = `Fix proven safe: ${safeCount} server${safeCount === 1 ? " is" : "s are"} unaffected. For ${affectedCount > 1 ? `the ${affectedCount} affected servers` : sandbox.sourceHost}, an update was tested on ${affectedCount > 1 ? "temporary copies" : "a temporary copy"}, kept all services running, and blocked a simulated attack — ready to apply whenever you choose.`;
    } else if (ea?.state === "vulnerable") {
      outcomeTone = "warn";
      headline = `Attention needed: Agent 3's simulated attack still succeeded on the test copy of ${sandbox.sourceHost}.`;
    } else if (ea?.state === "blocked" || ea?.state === "not_feasible") {
      outcomeTone = "safe";
      headline = `Fix tested: Agent 2 updated a temporary copy of ${sandbox.sourceHost} and confirmed all services stayed healthy.`;
    } else if (pa?.state === "queued" || pa?.state === "snapshotting" || pa?.state === "cloning") {
      headline = `${sandbox.sourceHost} is affected — Agent 2 (Fix Tester) is creating a temporary copy in the safe test room so the live server stays untouched…`;
    } else if (pa?.state === "planning" || pa?.state === "patching") {
      headline = `Agent 2 (Fix Tester) is installing the software update inside the temporary copy of ${sandbox.sourceHost}…`;
    } else if (pa?.state === "passed") {
      headline = `Agent 2 confirmed the update works on ${sandbox.sourceHost}'s copy — handing off to Agent 3 to simulate an attack…`;
    } else if (judgingVm) {
      headline = `Agent 1 (Security Inspector) is checking whether ${judgingVm.host} uses software affected by ${cveId}…`;
    } else if (evalBusy) {
      headline = `New threat ${cveId} arrived — waking up Agent 1 (Security Inspector) to check all servers…`;
    } else if (affectedCount > 0) {
      headline = `${cveId}: ${affectedCount} server${affectedCount > 1 ? "s" : ""} affected, ${safeCount} unaffected.`;
    } else if (safeCount > 0) {
      outcomeTone = "safe";
      headline = `No action needed: All ${vmNodes.length} server${vmNodes.length === 1 ? "" : "s"} were checked against ${cveId} and none are affected.`;
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
    outcomeTone,
    juryBusy: Boolean(evalBusy),
    headline,
    juryModels,
    judgingHost: judgingVm?.host || null,
    vmNodes,
    sandbox,
    containment,
    terminalLines,
  };
}
