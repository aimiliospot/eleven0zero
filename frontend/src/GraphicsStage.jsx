import { CheckCircle2, Radio, ShieldCheck } from "lucide-react";
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
    card: "border-primary/80 bg-primary/[0.07] text-primary shadow-[0_0_24px_-6px_rgba(34,211,238,0.45)]",
    badge: "outline",
    label: "Scanning",
    wire: "#22d3ee",
  },
  judging: {
    card: "border-primary bg-primary/[0.09] text-primary shadow-[0_0_26px_-6px_rgba(34,211,238,0.5)]",
    badge: "outline",
    label: "Checking",
    wire: "#22d3ee",
  },
  not_affected: {
    card: "border-not-affected/85 bg-not-affected/[0.08] text-not-affected",
    badge: "not_affected",
    label: "Safe",
    wire: "#34d399",
  },
  verified: {
    card: "border-not-affected/85 bg-not-affected/[0.08] text-not-affected",
    badge: "not_affected",
    label: "Fix verified",
    wire: "#34d399",
  },
  likely: {
    card: "border-likely/90 bg-likely/[0.09] text-likely",
    badge: "likely",
    label: "Likely",
    wire: "#fbbf24",
  },
  affected: {
    card: "border-affected bg-affected/[0.10] text-affected shadow-[0_0_28px_-6px_rgba(251,113,133,0.5)]",
    badge: "affected",
    label: "Affected",
    wire: "#fb7185",
  },
  shutdown: {
    card: "border-likely bg-likely/[0.09] text-likely shadow-[0_0_26px_-6px_rgba(251,191,36,0.42)]",
    badge: "likely",
    label: "⏻ Shut down",
    wire: "#fbbf24",
  },
  error: {
    card: "border-border bg-muted/40 text-muted-foreground",
    badge: "secondary",
    label: "Error",
    wire: "#475569",
  },
};

/* ---------- Specialist Agent Avatars ---------- */

function JuryBotAvatar({ active }) {
  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
      {active && <span aria-hidden="true" className="animate-radar-ring pointer-events-none absolute inset-0 rounded-md border border-primary" />}
      <svg aria-hidden="true" viewBox="0 0 40 40" className="size-7" fill="none">
        <line x1="20" y1="4" x2="20" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="20" cy="3.5" r="2" fill="currentColor" />
        <rect x="7" y="10" width="26" height="21" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" />
        <rect x="11" y="15" width="18" height="7" rx="2" fill="#05080f" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="15.5" cy="18.5" r="2" fill="currentColor" className={active ? "animate-pulse" : ""} />
        <circle cx="24.5" cy="18.5" r="2" fill="currentColor" className={active ? "animate-pulse" : ""} />
        <line x1="14" y1="26" x2="26" y2="26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 3" />
      </svg>
    </div>
  );
}

/* ---------- Server Chassis Art ---------- */

function ServerNodeArt({ state, compact = false }) {
  const active = state === "judging" || state === "scanning";
  const isOff = state === "shutdown";
  const ok = state === "not_affected" || state === "verified";
  return (
    <div className="relative flex items-center justify-center py-0.5">
      <svg aria-hidden="true" viewBox="0 0 88 62" className={compact ? "h-11 w-15" : "h-14 w-19"} fill="none">
        <rect x="10" y="6" width="68" height="16" rx="3" fill="#080c14" stroke="currentColor" strokeWidth="1.8" strokeOpacity={isOff ? 0.65 : 1} />
        <circle cx="18" cy="14" r="2.2" fill="currentColor" fillOpacity={isOff ? 0.15 : 1} className={active ? "animate-ping" : ""} />
        <circle cx="25" cy="14" r="2.2" fill="currentColor" fillOpacity={isOff ? 0.1 : 0.5} />
        <line x1="48" y1="14" x2="70" y2="14" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.35" strokeLinecap="round" />

        <rect x="10" y="26" width="68" height="16" rx="3" fill="#080c14" stroke="currentColor" strokeWidth="1.8" strokeOpacity={isOff ? 0.65 : 1} />
        <circle cx="18" cy="34" r="2.2" fill="currentColor" fillOpacity={isOff ? 0.15 : 1} />
        <circle cx="25" cy="34" r="2.2" fill="currentColor" fillOpacity={isOff ? 0.1 : 0.5} />
        <line x1="48" y1="34" x2="70" y2="34" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.35" strokeLinecap="round" />

        <path d="M22 42v8M66 42v8M14 50h60" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.55" />

        <path
          d="M44 19l12 4.5v8.5c0 7.5-5.2 13.4-12 15.5-6.8-2.1-12-8-12-15.5v-8.5L44 19z"
          fill="#0b1220"
          stroke="currentColor"
          strokeWidth="2"
        />
        {ok && (
          <path d="M39 33l3.5 3.5L50 29" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {(state === "affected" || state === "likely") && (
          <path d="M44 27v7M44 38.5h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        )}
        {isOff && (
          <>
            <path d="M44 26v6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
            <path d="M40.2 28.5a5.5 5.5 0 1 0 7.6 0" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          </>
        )}
        {active && (
          <circle cx="44" cy="33" r="4" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
        )}
        {(state === "idle" || state === "error") && (
          <circle cx="44" cy="33" r="2.5" fill="currentColor" fillOpacity="0.55" />
        )}
      </svg>
    </div>
  );
}

function visualVmState(vm) {
  return vm.fixVerified && vm.pocBlocked ? "verified" : vm.state;
}

function VmCyberNode({ vm, onSelect }) {
  const vState = visualVmState(vm);
  const style = VM_STYLE[vState] || VM_STYLE.idle;
  const active = vm.state === "judging" || vm.state === "scanning";
  const clickable = Boolean(vm.finding);
  const rem = vm.finding?.remediation;
  const caption = vm.state === "shutdown" && rem?.cvss != null && rem?.threshold != null
    ? `CVSS ${rem.cvss} ≥ ${rem.threshold}`
    : (vm.os || vm.note);

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={clickable ? "Click to view report" : undefined}
      onClick={() => clickable && onSelect(vm.finding)}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(vm.finding);
        }
      }}
      className={`relative flex min-w-0 flex-col justify-between gap-2 overflow-hidden rounded-md border-2 p-3 transition-all duration-300 ${style.card} ${clickable ? "cursor-pointer hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
    >
      {active && (
        <div
          aria-hidden="true"
          className="animate-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-transparent via-primary/25 to-transparent"
        />
      )}

      <div className="flex items-center justify-center">
        <Badge variant={style.badge} className={active ? "border-primary/50 text-primary" : ""}>
          {active && <Spinner aria-hidden="true" />}
          {style.label}
        </Badge>
      </div>

      <ServerNodeArt state={vState} />

      <div className="grid min-w-0 gap-0.5 text-center">
        <strong className="truncate font-mono text-xs font-semibold text-foreground" title={vm.host}>
          {vm.host}
        </strong>
        <span className="truncate font-mono text-[11px] text-muted-foreground" title={caption}>
          {caption}
        </span>
      </div>
    </div>
  );
}

function ScanConduits({ vmNodes }) {
  if (!vmNodes.length) return null;
  const n = vmNodes.length;
  return (
    <div aria-hidden="true" className="relative -my-2 hidden h-11 w-full sm:block">
      <svg viewBox="0 0 1000 54" preserveAspectRatio="none" className="size-full overflow-visible">
        {vmNodes.map((vm, i) => {
          const x = n === 1 ? 500 : ((i + 0.5) / n) * 1000;
          const vState = visualVmState(vm);
          const s = VM_STYLE[vState] || VM_STYLE.idle;
          const active = vm.state === "judging" || vm.state === "scanning";
          const d = `M 500 0 C 500 28, ${x} 22, ${x} 52`;
          return (
            <g key={vm.host}>
              <path
                d={d}
                fill="none"
                stroke={s.wire}
                strokeOpacity={vm.state === "idle" ? 0.55 : 0.85}
                strokeWidth={active ? "3" : "2"}
                className={active ? "animate-beam-flow" : ""}
              />
              <circle cx={x} cy="51" r={active ? "4.5" : "3"} fill={s.wire} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Simplified 1-Row Safe Test Room: Agent 2 ──► Temporary Copy ◄── Agent 3 ---------- */

function SandboxArena({ sandbox, vmNodes, onSelectSandboxHost }) {
  if (!sandbox) return null;

  const { patchAgent, cloneVm, exploitAgent, attackerVm, affectedHosts = [] } = sandbox;
  const patchPassed = patchAgent.state === "passed";
  const patchFailed = patchAgent.state === "failed" || patchAgent.state === "error";

  const expStandby = exploitAgent.state === "standby";
  const expBlocked = exploitAgent.state === "patched";
  const expVulnerable = exploitAgent.state === "vulnerable";

  const patchLabel = patchPassed ? "Fix passed" : patchFailed ? "Update failed" : patchAgent.busy ? "Updating…" : "Starting";
  const expLabel = expBlocked ? "Attack blocked" : expVulnerable ? "Copy breached" : exploitAgent.busy ? "Testing…" : expStandby ? "Waiting" : "Skipped";
  const copyLabel = expBlocked ? "🛡️ Attack blocked"
    : expVulnerable ? "Copy breached"
    : exploitAgent.busy ? "Under test…"
    : patchPassed ? "Updated"
    : patchAgent.busy ? "Updating…"
    : "At risk";

  const sbIdx = vmNodes.findIndex((v) => v.host === sandbox.sourceHost);
  const sbX = vmNodes.length <= 1 || sbIdx < 0 ? 500 : ((sbIdx + 0.5) / vmNodes.length) * 1000;
  const wireDone = expBlocked || (patchPassed && !exploitAgent.busy);

  const copyTone = expBlocked || patchPassed
    ? "border-not-affected/80 bg-not-affected/[0.06] text-not-affected"
    : patchAgent.busy
      ? "border-primary bg-primary/[0.06] text-primary"
      : "border-affected bg-affected/[0.08] text-affected";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 grid gap-1.5 duration-300">
      <div aria-hidden="true" className="hidden h-7 w-full sm:block">
        <svg viewBox="0 0 1000 32" preserveAspectRatio="none" className="size-full overflow-visible">
          <path
            d={`M ${sbX} 0 C ${sbX} 18, 500 14, 500 30`}
            fill="none"
            stroke={wireDone ? "#34d399" : "#22d3ee"}
            strokeWidth="2.2"
            className={patchAgent.busy || exploitAgent.busy ? "animate-beam-flow" : ""}
          />
          <circle cx="500" cy="30" r="3.5" fill={wireDone ? "#34d399" : "#22d3ee"} />
        </svg>
      </div>

      <section
        aria-label="Safe test room"
        className="grid gap-3 rounded-md border-2 border-dashed border-primary/45 bg-[#070d18]/95 p-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            <h3 className="font-mono text-xs font-semibold tracking-wider uppercase text-foreground">
              Safe Test Room · Copy of {sandbox.sourceHost}
            </h3>
            {(cloneVm.destroyed || attackerVm.destroyed) && (
              <Badge variant="secondary">Copy deleted after test</Badge>
            )}
          </div>
          {affectedHosts.length > 1 && onSelectSandboxHost && (
            <div role="tablist" aria-label="Affected servers in test room" className="flex flex-wrap gap-1.5">
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

        <div className="grid items-stretch gap-2.5 lg:grid-cols-[minmax(0,1fr)_36px_minmax(0,0.88fr)_36px_minmax(0,1fr)]">
          {/* Agent 2 */}
          <div className={`flex flex-col justify-center gap-1.5 rounded-md border-2 p-3 ${
            patchPassed ? "border-not-affected/80 bg-not-affected/[0.06]"
              : patchFailed ? "border-affected/80 bg-affected/[0.06]"
              : "border-primary bg-primary/[0.06]"
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="font-mono text-[10px] font-semibold tracking-wider uppercase text-primary">
                Agent 2 · Fix Tester
              </span>
              <Badge variant={patchPassed ? "not_affected" : patchFailed ? "affected" : "outline"}>
                {patchAgent.busy && <Spinner aria-hidden="true" />}
                {patchLabel}
              </Badge>
            </div>
            <p className="text-xs leading-snug text-muted-foreground">
              Updates a temporary copy of the server without touching live traffic.
            </p>
          </div>

          {/* Left Arrow */}
          <div aria-hidden="true" className="hidden items-center justify-center lg:flex">
            <svg viewBox="0 0 36 20" className="h-5 w-9 overflow-visible" fill="none">
              <line
                x1="2"
                y1="10"
                x2="30"
                y2="10"
                stroke={patchPassed ? "#34d399" : "#22d3ee"}
                strokeWidth="2.4"
                className={patchAgent.busy ? "animate-beam-flow" : ""}
              />
              <path d="M25 5l7 5-7 5" stroke={patchPassed ? "#34d399" : "#22d3ee"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Center: Temporary Server Copy */}
          <div className={`flex flex-col items-center justify-center gap-1.5 rounded-md border-2 p-3 text-center ${copyTone}`}>
            <Badge variant={expBlocked || patchPassed ? "not_affected" : patchAgent.busy ? "outline" : "affected"}>
              {(patchAgent.busy || exploitAgent.busy) && <Spinner aria-hidden="true" />}
              {copyLabel}
            </Badge>
            <ServerNodeArt state={cloneVm.visualState} compact />
            <strong className="max-w-full truncate font-mono text-xs font-semibold text-foreground">
              Copy of {sandbox.sourceHost}
            </strong>
          </div>

          {/* Right Arrow */}
          <div aria-hidden="true" className="hidden items-center justify-center lg:flex">
            <svg viewBox="0 0 36 20" className="h-5 w-9 overflow-visible" fill="none">
              <line
                x1="34"
                y1="10"
                x2="6"
                y2="10"
                stroke={expBlocked ? "#34d399" : expStandby ? "#1e2b40" : "#fb7185"}
                strokeWidth="2.4"
                className={exploitAgent.state === "attacking" ? "animate-attack-flow" : ""}
              />
              <path d="M11 5l-7 5 7 5" stroke={expBlocked ? "#34d399" : expStandby ? "#1e2b40" : "#fb7185"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Agent 3 */}
          <div className={`flex flex-col justify-center gap-1.5 rounded-md border-2 p-3 ${
            expStandby ? "border-border/70 bg-card/45 opacity-60"
              : expBlocked ? "border-not-affected/80 bg-not-affected/[0.06]"
              : "border-affected bg-affected/[0.08]"
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className={`font-mono text-[10px] font-semibold tracking-wider uppercase ${expStandby ? "text-muted-foreground" : "text-affected"}`}>
                Agent 3 · Attack Simulator
              </span>
              <Badge variant={expStandby ? "secondary" : expBlocked ? "not_affected" : "affected"}>
                {exploitAgent.busy && <Spinner aria-hidden="true" />}
                {expLabel}
              </Badge>
            </div>
            <p className="text-xs leading-snug text-muted-foreground">
              Generates one simulated attack for this threat and tests the updated copy.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Main Stage ---------- */

export default function GraphicsStage({ scene, onSelectFinding, onSelectSandboxHost }) {
  const { cve, cveId, juryBusy, judgingHost, vmNodes, sandbox } = scene;
  const isCritical = cve?.cvss != null && cve.cvss >= 9.0;
  const gridCols = vmNodes.length <= 1
    ? "sm:grid-cols-1 max-w-xs mx-auto"
    : vmNodes.length === 2
      ? "sm:grid-cols-2 max-w-2xl mx-auto"
      : vmNodes.length === 3
        ? "sm:grid-cols-3"
        : vmNodes.length === 5
          ? "sm:grid-cols-3 xl:grid-cols-5"
          : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <Card className="grid min-w-0 gap-4 border-border/90 bg-card/70 p-4 sm:p-5">
      {/* Tier 1: New Threat -> Agent 1 (Security Inspector) */}
      <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_54px_minmax(0,1.15fr)]">
        <div className={`relative flex items-center gap-3 rounded-md border p-3 ${
          isCritical ? "border-affected/65 bg-affected/[0.07]" : cveId ? "border-primary/45 bg-background/80" : "border-border bg-background/50"
        }`}>
          <div className={`relative flex size-11 shrink-0 items-center justify-center rounded-md border ${
            isCritical ? "border-affected/55 bg-affected/12 text-affected" : cveId ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"
          }`}>
            {cveId && juryBusy && (
              <span aria-hidden="true" className="animate-radar-ring pointer-events-none absolute inset-0 rounded-md border border-current" />
            )}
            <Radio aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
              New security threat
              {cve?.cvss != null && (
                <span className={isCritical ? " text-affected" : " text-primary"}> · CVSS {cve.cvss}</span>
              )}
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
              <div className="text-xs text-muted-foreground">Listening for new threats…</div>
            )}
          </div>
        </div>

        <div aria-hidden="true" className="hidden items-center justify-center md:flex">
          <svg viewBox="0 0 54 24" className="h-6 w-14 overflow-visible" fill="none">
            <line
              x1="0"
              y1="12"
              x2="46"
              y2="12"
              stroke={!cveId ? "#1e2b40" : isCritical ? "#fb7185" : "#22d3ee"}
              strokeWidth="2.5"
              className={juryBusy ? "animate-beam-flow" : ""}
            />
            <path d="M40 6l8 6-8 6" stroke={!cveId ? "#1e2b40" : isCritical ? "#fb7185" : "#22d3ee"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className={`flex items-center gap-3 rounded-md border p-3 ${juryBusy ? "border-primary bg-primary/[0.06]" : "border-border bg-background/80"}`}>
          <JuryBotAvatar active={juryBusy} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-semibold tracking-wider uppercase text-primary">
                Agent 1 · Security Inspector
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
              Checks each server to see if it uses the vulnerable software.
            </p>
          </div>
        </div>
      </div>

      <ScanConduits vmNodes={vmNodes} />

      {/* Tier 2: Monitored Servers */}
      {vmNodes.length > 0 ? (
        <div className={`grid w-full gap-3 ${gridCols}`}>
          {vmNodes.map((vm) => (
            <VmCyberNode key={vm.host} vm={vm} onSelect={onSelectFinding} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No servers added yet. Add a server on the Dashboard tab to watch live security checks here.
        </div>
      )}

      {/* Tier 3: Simplified 1-Row Safe Test Room */}
      <SandboxArena sandbox={sandbox} vmNodes={vmNodes} onSelectSandboxHost={onSelectSandboxHost} />
    </Card>
  );
}
