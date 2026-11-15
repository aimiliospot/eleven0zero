import { CheckCircle2, Cpu, FileCode2, Radio, ShieldCheck } from "lucide-react";
import CveLink from "./CveLink.jsx";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const VM_STYLE = {
  idle: {
    card: "border-border/90 bg-card/85 text-muted-foreground",
    badge: "secondary",
    label: "Standby",
    wire: "#1e2b40",
  },
  scanning: {
    card: "border-primary/80 bg-primary/[0.07] text-primary shadow-[0_0_26px_-6px_rgba(34,211,238,0.45)]",
    badge: "outline",
    label: "Scanning",
    wire: "#22d3ee",
  },
  judging: {
    card: "border-primary bg-primary/[0.09] text-primary shadow-[0_0_30px_-6px_rgba(34,211,238,0.55)]",
    badge: "outline",
    label: "Checking",
    wire: "#22d3ee",
  },
  not_affected: {
    card: "border-not-affected/90 bg-not-affected/[0.09] text-not-affected shadow-[0_0_28px_-6px_rgba(52,211,153,0.45)]",
    badge: "not_affected",
    label: "Safe",
    wire: "#34d399",
  },
  likely: {
    card: "border-likely/90 bg-likely/[0.09] text-likely shadow-[0_0_28px_-6px_rgba(251,191,36,0.4)]",
    badge: "likely",
    label: "Likely",
    wire: "#fbbf24",
  },
  affected: {
    card: "border-affected bg-affected/[0.10] text-affected shadow-[0_0_32px_-5px_rgba(251,113,133,0.55)]",
    badge: "affected",
    label: "Affected",
    wire: "#fb7185",
  },
  error: {
    card: "border-border bg-muted/40 text-muted-foreground",
    badge: "secondary",
    label: "Error",
    wire: "#475569",
  },
};

/* ---------- Three Distinct Specialist Agent Avatars ---------- */

function JuryBotAvatar({ active }) {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
      {active && <span aria-hidden="true" className="animate-radar-ring pointer-events-none absolute inset-0 rounded-md border border-primary" />}
      <svg aria-hidden="true" viewBox="0 0 40 40" className="size-8" fill="none">
        <line x1="20" y1="4" x2="20" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="20" cy="3.5" r="2" fill="currentColor" />
        <rect x="7" y="10" width="26" height="21" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" />
        <rect x="11" y="15" width="18" height="7" rx="2" fill="#05080f" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="15.5" cy="18.5" r="2" fill="currentColor" className={active ? "animate-pulse" : ""} />
        <circle cx="24.5" cy="18.5" r="2" fill="currentColor" className={active ? "animate-pulse" : ""} />
        <line x1="14" y1="26" x2="26" y2="26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 3" />
        <path d="M4 17v7M36 17v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PatchBotAvatar({ active, passed, failed }) {
  const tone = passed ? "border-not-affected/50 bg-not-affected/10 text-not-affected"
    : failed ? "border-affected/50 bg-affected/10 text-affected"
    : "border-primary/45 bg-primary/10 text-primary";
  return (
    <div className={`relative flex size-12 shrink-0 items-center justify-center rounded-md border ${tone}`}>
      {active && <span aria-hidden="true" className="animate-radar-ring pointer-events-none absolute inset-0 rounded-md border border-current" />}
      <svg aria-hidden="true" viewBox="0 0 40 40" className="size-8" fill="none">
        {/* Engineer dome + cross/wrench badge */}
        <path d="M11 12a9 9 0 0 1 18 0" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.18" />
        <rect x="7" y="12" width="26" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="#060c16" />
        <rect x="11" y="16" width="18" height="6.5" rx="2" fill="#05080f" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="15.5" cy="19.2" r="1.8" fill="currentColor" className={active ? "animate-pulse" : ""} />
        <circle cx="24.5" cy="19.2" r="1.8" fill="currentColor" className={active ? "animate-pulse" : ""} />
        {/* Repair cross emblem */}
        <path d="M20 25v5M17.5 27.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 18v6M36 18v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function ExploitBotAvatar({ active, standby, blocked }) {
  const tone = standby ? "border-border bg-muted/40 text-muted-foreground"
    : blocked ? "border-not-affected/45 bg-not-affected/10 text-not-affected"
    : "border-affected/50 bg-affected/10 text-affected";
  return (
    <div className={`relative flex size-12 shrink-0 items-center justify-center rounded-md border ${tone}`}>
      {active && <span aria-hidden="true" className="animate-radar-ring pointer-events-none absolute inset-0 rounded-md border border-current" />}
      <svg aria-hidden="true" viewBox="0 0 40 40" className="size-8" fill="none">
        {/* Twin red-team horns + tactical angular visor */}
        <path d="M12 11L9 5l5 4M28 11l3-6-5 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="7" y="11" width="26" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="#09070d" />
        <rect x="11" y="15.5" width="18" height="7" rx="2" fill="#05080f" stroke="currentColor" strokeWidth="1.4" />
        <path d="M13.5 17.5l4 2-4 1.5M26.5 17.5l-4 2 4 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 26.5h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 2" />
      </svg>
    </div>
  );
}

/* ---------- Server Chassis Art (Used by Prod VMs + Snapshot Clone VM) ---------- */

function ServerNodeArt({ state, compact = false }) {
  const active = state === "judging" || state === "scanning";
  return (
    <div className="relative flex items-center justify-center py-0.5">
      <svg aria-hidden="true" viewBox="0 0 88 68" className={compact ? "h-12 w-16" : "h-16 w-20"} fill="none">
        <rect x="10" y="8" width="68" height="16" rx="3" fill="#080c14" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="16" r="2.2" fill="currentColor" className={active ? "animate-ping" : ""} />
        <circle cx="25" cy="16" r="2.2" fill="currentColor" fillOpacity="0.55" />
        <line x1="48" y1="16" x2="70" y2="16" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.45" strokeLinecap="round" />

        <rect x="10" y="28" width="68" height="16" rx="3" fill="#080c14" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="36" r="2.2" fill="currentColor" />
        <circle cx="25" cy="36" r="2.2" fill="currentColor" fillOpacity="0.55" />
        <line x1="48" y1="36" x2="70" y2="36" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.45" strokeLinecap="round" />

        <path d="M22 44v8M66 44v8M14 52h60" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.65" />

        <path
          d="M44 19l12 4.5v8.5c0 7.5-5.2 13.4-12 15.5-6.8-2.1-12-8-12-15.5v-8.5L44 19z"
          fill="#0b1220"
          stroke="currentColor"
          strokeWidth="2"
        />
        {state === "not_affected" && (
          <path d="M39 33l3.5 3.5L50 29" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {(state === "affected" || state === "likely") && (
          <path d="M44 27v7M44 38.5h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        )}
        {(state === "judging" || state === "scanning") && (
          <circle cx="44" cy="33" r="4" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
        )}
        {(state === "idle" || state === "error") && (
          <circle cx="44" cy="33" r="2.5" fill="currentColor" fillOpacity="0.55" />
        )}
      </svg>
    </div>
  );
}

function StepDot({ state, label }) {
  const dot = state === "done" ? "bg-not-affected"
    : state === "active" ? "bg-primary animate-pulse"
    : state === "bad" ? "bg-affected"
    : "bg-muted-foreground/35";
  const text = state === "done" ? "text-foreground"
    : state === "active" ? "text-primary font-medium"
    : state === "bad" ? "text-affected"
    : "text-muted-foreground";
  return (
    <li className={`flex items-center gap-2 font-mono text-[11px] ${text}`}>
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{label}</span>
    </li>
  );
}

function VmCyberNode({ vm, onSelect }) {
  const style = VM_STYLE[vm.state] || VM_STYLE.idle;
  const active = vm.state === "judging" || vm.state === "scanning";
  const clickable = Boolean(vm.finding);

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={() => clickable && onSelect(vm.finding)}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(vm.finding);
        }
      }}
      className={`group relative flex min-w-0 flex-col justify-between gap-2.5 overflow-hidden rounded-md border-2 p-3.5 transition-all duration-500 ${style.card} ${clickable ? "cursor-pointer hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
    >
      {active && (
        <div
          aria-hidden="true"
          className="animate-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-primary/25 to-transparent"
        />
      )}

      <div className="flex items-center justify-between gap-1.5">
        <Badge variant={style.badge} className={active ? "border-primary/50 text-primary" : ""}>
          {active && <Spinner aria-hidden="true" />}
          {style.label}
        </Badge>
        {vm.confidence !== null && (vm.state === "affected" || vm.state === "likely" || vm.state === "not_affected") && (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {vm.confidence}%
          </span>
        )}
      </div>

      <ServerNodeArt state={vm.state} />

      <div className="grid min-w-0 gap-1 text-center">
        <strong className="truncate font-mono text-sm font-semibold text-foreground" title={vm.host}>
          {vm.host}
        </strong>
        <span className="truncate text-xs text-muted-foreground" title={vm.note}>
          {vm.os || vm.note}
        </span>
        <div className="flex items-center justify-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>{vm.npkg} pkgs</span>
          {vm.ports?.length > 0 && (
            <>
              <span>·</span>
              <span className="text-primary/90">{vm.ports.length} port{vm.ports.length === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      </div>

      {(vm.fixVerified || vm.pocBlocked) && (
        <div className="flex flex-wrap justify-center gap-1 border-t border-border/60 pt-2">
          {vm.fixVerified && <Badge variant="not_affected">Fix verified</Badge>}
          {vm.pocBlocked && <Badge variant="not_affected">PoC blocked</Badge>}
        </div>
      )}

      {clickable && (
        <div className="text-center font-mono text-[10px] tracking-wider uppercase text-muted-foreground/80 group-hover:text-foreground">
          Inspect report →
        </div>
      )}
    </div>
  );
}

function ScanConduits({ vmNodes }) {
  if (!vmNodes.length) return null;
  const n = vmNodes.length;
  return (
    <div aria-hidden="true" className="relative -my-2 hidden h-12 w-full sm:block">
      <svg viewBox="0 0 1000 72" preserveAspectRatio="none" className="size-full overflow-visible">
        {vmNodes.map((vm, i) => {
          const x = n === 1 ? 500 : ((i + 0.5) / n) * 1000;
          const s = VM_STYLE[vm.state] || VM_STYLE.idle;
          const active = vm.state === "judging" || vm.state === "scanning";
          const d = `M 500 0 C 500 38, ${x} 28, ${x} 72`;
          return (
            <g key={vm.host}>
              <path d={d} fill="none" stroke={s.wire} strokeOpacity={vm.state === "idle" ? 0.55 : 0.35} strokeWidth="2" />
              {(active || vm.state !== "idle") && (
                <path
                  d={d}
                  fill="none"
                  stroke={s.wire}
                  strokeWidth={active ? "3" : "2.2"}
                  className={active ? "animate-beam-flow" : ""}
                />
              )}
              <circle cx={x} cy="70" r={active ? "5" : "3.5"} fill={s.wire} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Isolated Sandbox: Agent 02 (Patch) + Agent 03 (Exploit) + Sandbox VMs ---------- */

function SandboxArena({ sandbox, onSelectSandboxHost }) {
  if (!sandbox) return null;

  const { patchAgent, cloneVm, exploitAgent, attackerVm, affectedHosts = [] } = sandbox;
  const patchPassed = patchAgent.state === "passed";
  const patchFailed = patchAgent.state === "failed" || patchAgent.state === "error";

  const step1State = cloneVm.booted ? "done" : patchAgent.busy ? "active" : patchFailed ? "bad" : "idle";
  const step2State = patchPassed ? "done" : patchFailed ? "bad" : (patchAgent.state === "planning" || patchAgent.state === "patching") ? "active" : "idle";
  const step3State = patchPassed ? "done" : patchFailed ? "bad" : (patchAgent.commandsCount > 0 && patchAgent.busy) ? "active" : "idle";

  const expStandby = exploitAgent.state === "standby";
  const expBlockedAttack = exploitAgent.state === "patched";
  const expVulnerable = exploitAgent.state === "vulnerable";
  const expHaltedEarly = exploitAgent.state === "blocked" || exploitAgent.state === "not_feasible" || (exploitAgent.state === "error" && !attackerVm.spawned);

  const expStep1 = (exploitAgent.pocStatus === "ready" || exploitAgent.pocStatus === "reused") ? "done"
    : exploitAgent.pocStatus === "writing" ? "active"
    : (exploitAgent.pocStatus === "blocked" || exploitAgent.pocStatus === "not_feasible" || exploitAgent.pocStatus === "error") ? "bad"
    : "idle";
  const expStep2 = attackerVm.spawned ? (exploitAgent.state === "spawning_vm" ? "active" : "done") : "idle";
  const expStep3 = expBlockedAttack ? "done" : expVulnerable ? "bad" : exploitAgent.state === "attacking" ? "active" : "idle";

  const cloneStyle = VM_STYLE[cloneVm.visualState] || VM_STYLE.idle;
  const cloneActive = cloneVm.visualState === "judging";

  const patchStatusLabel = {
    queued: "Waking up",
    snapshotting: "Snapshotting",
    cloning: "Booting clone",
    planning: "Planning fix",
    patching: "Applying fix",
    passed: "Fix verified",
    skipped: "Skipped",
    failed: "Fix failed",
    error: "Error",
  }[patchAgent.state] || patchAgent.state;

  const exploitStatusLabel = {
    standby: "Waiting for fix",
    coding_poc: "Writing PoC",
    reusing_poc: "Reusing PoC",
    spawning_vm: "Booting attacker",
    attacking: "Attacking clone",
    patched: "Attack blocked",
    vulnerable: "Clone breached",
    blocked: "PoC halted",
    not_feasible: "No net PoC",
    error: "Error",
  }[exploitAgent.state] || exploitAgent.state;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 grid gap-2 duration-500">
      {/* Trigger Conduit from Affected Production VM */}
      <div aria-hidden="true" className="flex flex-col items-center">
        <svg viewBox="0 0 24 28" className="h-7 w-6 overflow-visible" fill="none">
          <line x1="12" y1="0" x2="12" y2="26" stroke="#fb7185" strokeWidth="2.5" className={patchAgent.busy ? "animate-beam-flow" : ""} />
          <circle cx="12" cy="25" r="3.5" fill="#fb7185" />
        </svg>
        <span className="rounded-sm border border-affected/45 bg-card px-2.5 py-0.5 font-mono text-[10px] tracking-wider uppercase text-affected">
          {affectedHosts.length > 1
            ? `${affectedHosts.length} servers affected → triggers Agent 02`
            : `${sandbox.sourceHost} affected → triggers Agent 02`}
        </span>
      </div>

      <section
        aria-label="Isolated sandbox multi-agent verification"
        className="grid gap-3.5 rounded-md border-2 border-dashed border-primary/45 bg-[#070d18]/95 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            <h3 className="font-mono text-xs font-semibold tracking-wider uppercase text-foreground">
              Isolated sandbox · production VM never touched
            </h3>
            {(cloneVm.destroyed || attackerVm.destroyed) && (
              <Badge variant="secondary">Disposable sandbox VMs destroyed</Badge>
            )}
          </div>
          {affectedHosts.length > 1 && onSelectSandboxHost && (
            <div role="tablist" aria-label="Affected servers in sandbox" className="flex flex-wrap gap-1.5">
              {affectedHosts.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="tab"
                  aria-selected={h === sandbox.sourceHost}
                  onClick={() => onSelectSandboxHost(h)}
                  className={`rounded-sm border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    h === sandbox.sourceHost
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-card/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ROW 1: AGENT 02 (PATCH AGENT)  ──►  AGENT 03 (EXPLOIT AGENT) */}
        <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_84px_minmax(0,1fr)]">
          {/* AGENT 02: Patch Engineer Bot */}
          <div className={`grid gap-2.5 rounded-md border-2 p-3.5 transition-all duration-500 ${
            patchPassed ? "border-not-affected/80 bg-not-affected/[0.06]"
              : patchFailed ? "border-affected/80 bg-affected/[0.06]"
              : "border-primary bg-primary/[0.07] shadow-[0_0_24px_-6px_rgba(34,211,238,0.4)]"
          }`}>
            <div className="flex items-start gap-3">
              <PatchBotAvatar active={patchAgent.busy} passed={patchPassed} failed={patchFailed} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-mono text-[10px] font-semibold tracking-wider uppercase text-primary">
                    Agent 02 · Patch agent
                  </span>
                  <Badge variant={patchPassed ? "not_affected" : patchFailed ? "affected" : "outline"}>
                    {patchAgent.busy && <Spinner aria-hidden="true" />}
                    {patchStatusLabel}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Clones affected servers into an isolated sandbox and applies fix commands without touching production.
                </p>
                <div className="mt-1.5 flex items-center gap-1 font-mono text-[11px] text-foreground">
                  <Cpu aria-hidden="true" className="size-3 shrink-0 text-primary" />
                  <span className="truncate">{patchAgent.model}</span>
                </div>
              </div>
            </div>

            <ul className="grid gap-1 border-t border-border/60 pt-2">
              <StepDot state={step1State} label={`Snapshot & clone ${sandbox.sourceHost}`} />
              <StepDot state={step2State} label={`Apply upgrade commands (${patchAgent.commandsCount} run)`} />
              <StepDot state={step3State} label="Verify vulnerability fixed & services healthy" />
            </ul>

            {patchAgent.currentCmd && (
              <div className="truncate rounded border border-border/80 bg-background/85 px-2 py-1 font-mono text-[11px] text-primary" title={patchAgent.currentCmd}>
                $ {patchAgent.currentCmd}
              </div>
            )}
          </div>

          {/* Handoff Conduit: Agent 02 -> Agent 03 */}
          <div aria-hidden="true" className="hidden flex-col items-center justify-center gap-1 text-center md:flex">
            <span className={`font-mono text-[9px] tracking-wider uppercase ${exploitAgent.triggered ? "text-not-affected" : "text-muted-foreground/60"}`}>
              {exploitAgent.triggered ? "Fix passed" : "If fixed"}
            </span>
            <svg viewBox="0 0 80 24" className="h-6 w-20 overflow-visible" fill="none">
              <line
                x1="2"
                y1="12"
                x2="70"
                y2="12"
                stroke={exploitAgent.triggered ? "#34d399" : "#1e2b40"}
                strokeWidth="2.5"
                className={exploitAgent.busy ? "animate-beam-flow" : ""}
              />
              <path
                d="M63 6l9 6-9 6"
                stroke={exploitAgent.triggered ? "#34d399" : "#1e2b40"}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground">
              Triggers PoC
            </span>
          </div>

          {/* AGENT 03: Red-Team Exploit Bot */}
          <div className={`grid gap-2.5 rounded-md border-2 p-3.5 transition-all duration-500 ${
            expStandby ? "border-border/70 bg-card/45 opacity-65"
              : expBlockedAttack ? "border-not-affected/75 bg-not-affected/[0.06]"
              : exploitAgent.busy ? "border-affected bg-affected/[0.08] shadow-[0_0_26px_-6px_rgba(251,113,133,0.45)]"
              : "border-likely/75 bg-likely/[0.06]"
          }`}>
            <div className="flex items-start gap-3">
              <ExploitBotAvatar active={exploitAgent.busy} standby={expStandby} blocked={expBlockedAttack} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className={`font-mono text-[10px] font-semibold tracking-wider uppercase ${expStandby ? "text-muted-foreground" : "text-affected"}`}>
                    Agent 03 · Exploit agent
                  </span>
                  <Badge variant={expStandby ? "secondary" : expBlockedAttack ? "not_affected" : exploitAgent.busy || expVulnerable ? "affected" : "likely"}>
                    {exploitAgent.busy && <Spinner aria-hidden="true" />}
                    {exploitStatusLabel}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Generates one proof-of-concept exploit per CVE and fires it from an attacker VM against each patched clone.
                </p>
                <div className="mt-1.5 flex items-center gap-1 font-mono text-[11px] text-foreground">
                  <Cpu aria-hidden="true" className="size-3 shrink-0 text-affected" />
                  <span className="truncate">{exploitAgent.model}</span>
                </div>
              </div>
            </div>

            {/* PoC Exploit Script Artifact */}
            <div className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 font-mono text-[11px] ${
              exploitAgent.pocStatus === "writing" ? "border-likely/60 bg-likely/10 text-likely"
                : (exploitAgent.pocStatus === "ready" || exploitAgent.pocStatus === "reused") ? "border-affected/50 bg-affected/10 text-foreground"
                : expHaltedEarly ? "border-likely/50 bg-background/80 text-likely"
                : "border-border/70 bg-background/50 text-muted-foreground"
            }`}>
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                <FileCode2 aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{exploitAgent.pocFile}</span>
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider">
                {exploitAgent.pocStatus === "writing" ? "Generating…"
                  : exploitAgent.pocStatus === "reused" ? "PoC reused"
                  : exploitAgent.pocStatus === "ready" ? "PoC created"
                  : exploitAgent.pocStatus === "blocked" ? "Blocked"
                  : exploitAgent.pocStatus === "not_feasible" ? "Skipped"
                  : "Pending"}
              </span>
            </div>

            <ul className="grid gap-1 border-t border-border/60 pt-2">
              <StepDot
                state={expStep1}
                label={exploitAgent.reusedPoc ? `Reuse CVE PoC (${exploitAgent.pocFile})` : `Create PoC exploit once (${exploitAgent.pocFile})`}
              />
              <StepDot state={expStep2} label="Boot isolated Attacker VM" />
              <StepDot state={expStep3} label="Fire PoC at patched snapshot clone" />
            </ul>
          </div>
        </div>

        {/* VERTICAL CONTROL BEAMS: Agent 02 -> Clone VM | Agent 03 -> Attacker VM */}
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_84px_minmax(0,1fr)] items-center md:grid">
          <div className="flex flex-col items-center">
            <svg viewBox="0 0 24 34" className="h-8 w-6 overflow-visible" fill="none">
              <line
                x1="12"
                y1="0"
                x2="12"
                y2="30"
                stroke={patchPassed ? "#34d399" : "#22d3ee"}
                strokeWidth="2.5"
                className={patchAgent.busy ? "animate-beam-flow" : ""}
              />
              <path d="M7 24l5 7 5-7" stroke={patchPassed ? "#34d399" : "#22d3ee"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div />
          <div className="flex flex-col items-center">
            <svg viewBox="0 0 24 34" className="h-8 w-6 overflow-visible" fill="none">
              <line
                x1="12"
                y1="0"
                x2="12"
                y2="30"
                stroke={attackerVm.spawned ? "#fb7185" : "#1e2b40"}
                strokeWidth="2.5"
                className={exploitAgent.busy && attackerVm.spawned ? "animate-beam-flow" : ""}
              />
              <path d="M7 24l5 7 5-7" stroke={attackerVm.spawned ? "#fb7185" : "#1e2b40"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* ROW 2: SNAPSHOT CLONE VM  ◄══🛡️══  ATTACKER VM */}
        <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
          {/* Left VM: Snapshot Clone */}
          <div className={`relative overflow-hidden rounded-md border-2 p-3 transition-all duration-500 ${cloneStyle.card}`}>
            {cloneActive && (
              <div
                aria-hidden="true"
                className="animate-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-primary/25 to-transparent"
              />
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold tracking-wider uppercase">
                Snapshot clone VM
              </span>
              <Badge variant={cloneStyle.badge}>
                {cloneActive && <Spinner aria-hidden="true" />}
                {patchPassed ? "Patched" : cloneActive ? "Patching" : patchFailed ? "Unpatched" : "Affected copy"}
              </Badge>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <ServerNodeArt state={cloneVm.visualState} compact />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm font-semibold text-foreground">{cloneVm.name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  from {cloneVm.snapshotName}
                </div>
                {cloneVm.destroyed && (
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Destroyed after test</span>
                )}
              </div>
            </div>
          </div>

          {/* Center Horizontal Attack Vector & Defense Shield */}
          <div className="flex flex-col items-center justify-center gap-1.5 py-1 text-center">
            {attackerVm.spawned ? (
              <>
                <svg aria-hidden="true" viewBox="0 0 140 48" className="h-12 w-full overflow-visible" fill="none">
                  <line
                    x1="134"
                    y1="24"
                    x2={expBlockedAttack ? "54" : "10"}
                    y2="24"
                    stroke={expBlockedAttack ? "#34d399" : "#fb7185"}
                    strokeWidth="3"
                    className={attackerVm.attacking ? "animate-attack-flow" : ""}
                    strokeOpacity={attackerVm.attacking || expVulnerable ? 0.95 : 0.55}
                  />
                  <path
                    d={expBlockedAttack ? "M64 17l-10 7 10 7" : "M20 17l-10 7 10 7"}
                    stroke={expBlockedAttack ? "#34d399" : "#fb7185"}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {expBlockedAttack && (
                    <g>
                      <path
                        d="M34 7l14 5v11c0 9-6 16-14 18.5C26 39 20 32 20 23V12l14-5z"
                        fill="#06281e"
                        stroke="#34d399"
                        strokeWidth="2.4"
                      />
                      <path d="M29 24l3.5 3.5L39.5 20" stroke="#34d399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )}
                  {expVulnerable && (
                    <g>
                      <path
                        d="M34 7l14 5v11c0 9-6 16-14 18.5C26 39 20 32 20 23V12l14-5z"
                        fill="#2a0912"
                        stroke="#fb7185"
                        strokeWidth="2.4"
                      />
                      <path d="M30 18l8 12M38 18l-8 12" stroke="#fb7185" strokeWidth="2.2" strokeLinecap="round" />
                    </g>
                  )}
                </svg>
                <Badge variant={expBlockedAttack ? "not_affected" : expVulnerable ? "affected" : "affected"}>
                  {attackerVm.attacking && <Spinner aria-hidden="true" />}
                  {expBlockedAttack ? "Attack blocked" : expVulnerable ? "Clone breached" : "Firing PoC…"}
                </Badge>
              </>
            ) : (
              <span className="px-1 font-mono text-[10px] leading-snug text-muted-foreground">
                {expHaltedEarly
                  ? (exploitAgent.note || "PoC stopped before VM boot")
                  : "Attack runs once PoC & Attacker VM boot"}
              </span>
            )}
          </div>

          {/* Right VM: Ephemeral Attacker VM */}
          <div className={`rounded-md border-2 p-3 transition-all duration-500 ${
            !attackerVm.spawned ? "border-border/60 bg-card/40 text-muted-foreground opacity-65"
              : expBlockedAttack ? "border-border bg-card/85 text-muted-foreground"
              : "border-affected bg-affected/[0.09] text-affected shadow-[0_0_24px_-6px_rgba(251,113,133,0.45)]"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold tracking-wider uppercase">
                Attacker VM
              </span>
              <Badge variant={!attackerVm.spawned ? "secondary" : expBlockedAttack ? "not_affected" : "affected"}>
                {attackerVm.attacking && <Spinner aria-hidden="true" />}
                {!attackerVm.spawned ? "Not booted" : expBlockedAttack ? "Neutralized" : attackerVm.attacking ? "Firing PoC" : "Booting"}
              </Badge>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <ServerNodeArt state={!attackerVm.spawned ? "idle" : expBlockedAttack ? "idle" : "affected"} compact />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm font-semibold text-foreground">{attackerVm.name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {attackerVm.spawned ? `Runs ${exploitAgent.pocFile} over private net` : "Isolated private network"}
                </div>
                {attackerVm.destroyed && (
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Destroyed after test</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Main Cyber Stage ---------- */

export default function GraphicsStage({ scene, onSelectFinding, onSelectSandboxHost }) {
  const { cve, cveId, juryBusy, juryModels, judgingHost, vmNodes, sandbox } = scene;
  const gridCols = vmNodes.length <= 1
    ? "sm:grid-cols-1 max-w-xs mx-auto"
    : vmNodes.length === 2
      ? "sm:grid-cols-2 max-w-2xl mx-auto"
      : vmNodes.length === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <Card className="grid min-w-0 gap-4 border-border/90 bg-card/70 p-4 sm:p-5">
      {/* Top Tier: Threat Feed -> Agent 01 (AI Jury) */}
      <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1.15fr)]">
        <div className={`relative flex items-center gap-3.5 rounded-md border p-3.5 ${cveId ? "border-primary/45 bg-background/80" : "border-border bg-background/50"}`}>
          <div className={`relative flex size-11 shrink-0 items-center justify-center rounded-full border ${cveId ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {cveId && juryBusy && (
              <span aria-hidden="true" className="animate-radar-ring pointer-events-none absolute inset-0 rounded-full border border-primary" />
            )}
            <Radio aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
              Threat feed
            </div>
            {cveId ? (
              <>
                <div className="font-mono text-sm font-semibold">
                  <CveLink id={cveId} />
                </div>
                <div className="truncate text-xs text-muted-foreground" title={cve?.title}>
                  {cve?.title || "Published vulnerability record"}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Listening for new CVEs…</div>
            )}
          </div>
        </div>

        <div aria-hidden="true" className="hidden items-center justify-center md:flex">
          <svg viewBox="0 0 56 24" className="h-6 w-14 overflow-visible" fill="none">
            <line
              x1="0"
              y1="12"
              x2="48"
              y2="12"
              stroke={cveId ? "#22d3ee" : "#1e2b40"}
              strokeWidth="2.5"
              className={juryBusy ? "animate-beam-flow" : ""}
            />
            <path d="M42 6l8 6-8 6" stroke={cveId ? "#22d3ee" : "#1e2b40"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className={`flex items-center gap-3.5 rounded-md border p-3.5 ${juryBusy ? "border-primary bg-primary/[0.06]" : "border-border bg-background/80"}`}>
          <JuryBotAvatar active={juryBusy} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-semibold tracking-wider uppercase text-primary">
                Agent 01 · Jury agent
              </span>
              {judgingHost ? (
                <Badge variant="outline" className="border-primary/45 text-primary">
                  <Spinner aria-hidden="true" />
                  Checking {judgingHost}
                </Badge>
              ) : juryBusy ? (
                <Badge variant="outline" className="border-primary/45 text-primary">Active</Badge>
              ) : cveId ? (
                <Badge variant="not_affected">
                  <CheckCircle2 aria-hidden="true" className="size-3" />
                  Done
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Inspects each server&apos;s packages, services, and open ports to vote whether it is affected.
            </p>
            {juryModels.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {juryModels.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    <Cpu aria-hidden="true" className="size-3 text-primary" />
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ScanConduits vmNodes={vmNodes} />

      {/* Middle Tier: Monitored Production VMs */}
      {vmNodes.length > 0 ? (
        <div className={`grid w-full gap-3.5 ${gridCols}`}>
          {vmNodes.map((vm) => (
            <VmCyberNode key={vm.host} vm={vm} onSelect={onSelectFinding} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No VMs added yet. Add a host on the Dashboard tab to watch live vulnerability checks here.
        </div>
      )}

      {/* Bottom Tier: Agent 02 (Patch) + Agent 03 (Exploit) + Sandbox VMs */}
      <SandboxArena sandbox={sandbox} onSelectSandboxHost={onSelectSandboxHost} />
    </Card>
  );
}
