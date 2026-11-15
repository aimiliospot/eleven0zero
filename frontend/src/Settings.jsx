import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const MAX_MODELS = 5;
const FIRST_SELECTED = "first-selected"; // radix Select items can't have an empty value

function cvssBand(score) {
  if (score >= 9.0) return "Critical (9.0–10.0)";
  if (score >= 7.0) return "High & Critical (≥ 7.0)";
  if (score >= 4.0) return "Medium+ (≥ 4.0)";
  return "Low+ (≥ 0.1)";
}

export default function Settings({ vms = [], notify }) {
  const [cfg, setCfg] = useState(null); // saved settings from the server
  const [avail, setAvail] = useState({ models: [], listed: true });
  const [picked, setPicked] = useState([]);
  const [custom, setCustom] = useState("");
  const [fixModel, setFixModel] = useState("");
  const [exploitModel, setExploitModel] = useState("");
  const [autoShutdown, setAutoShutdown] = useState(true);
  const [threshold, setThreshold] = useState("9.0");
  const [shutdownHosts, setShutdownHosts] = useState([]);

  const load = () => api("/settings").then((s) => {
    setCfg(s);
    setPicked(s.models);
    setFixModel(s.remediation_model);
    setExploitModel(s.exploitation_model || "");
    const ct = s.criticality_threshold;
    setAutoShutdown(ct !== null && ct !== undefined);
    setThreshold(ct !== null && ct !== undefined ? String(ct) : "9.0");
    setShutdownHosts(s.shutdown_hosts || []);
  });
  useEffect(() => {
    load();
    api("/models").then(setAvail).catch(() => setAvail((a) => ({ ...a, listed: false })));
  }, []);

  const parsedThreshold = autoShutdown ? Math.round(Number(threshold) * 10) / 10 : null;
  const thresholdValid = !autoShutdown || (Number.isFinite(parsedThreshold) && parsedThreshold >= 0.1 && parsedThreshold <= 10.0);

  const allVmHosts = vms.map((v) => v.host);
  const activeShutdownHosts = shutdownHosts.filter((h) => allVmHosts.includes(h));

  const save = async () => {
    if (!thresholdValid) {
      notify(false, "Criticality threshold must be between 0.1 and 10.0");
      return;
    }
    try {
      await api("/settings", "PUT", {
        models: picked,
        remediation_model: fixModel,
        exploitation_model: exploitModel,
        criticality_threshold: parsedThreshold,
        shutdown_hosts: activeShutdownHosts,
      });
      await load();
      notify(true, "Settings saved");
    } catch (e) { notify(false, e.message); }
  };
  const toggle = (m) => setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  const toggleHost = (h) => setShutdownHosts((p) => (p.includes(h) ? p.filter((x) => x !== h) : [...p, h]));
  const addCustom = () => {
    const m = custom.trim();
    if (m && !picked.includes(m) && picked.length < MAX_MODELS) {
      setPicked([...picked, m]);
      setAvail((a) => ({ ...a, models: [...new Set([...a.models, m])] }));
    }
    setCustom("");
  };
  const options = [...new Set([...avail.models, ...picked])];
  const savedCt = cfg?.criticality_threshold ?? null;
  const savedHosts = (cfg?.shutdown_hosts || []).filter((h) => allVmHosts.includes(h));
  const dirty = cfg && (
    picked.join() !== cfg.models.join() ||
    fixModel !== cfg.remediation_model ||
    exploitModel !== (cfg.exploitation_model || "") ||
    parsedThreshold !== savedCt ||
    [...activeShutdownHosts].sort().join() !== [...savedHosts].sort().join()
  );

  if (!cfg) return <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground"><Spinner aria-hidden="true" />Loading settings…</p>;
  return (
    <form className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Card className="min-w-0 gap-3.5 px-5 py-4">
        <fieldset className="grid min-w-0 gap-3">
          <legend className="mb-3">
            <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              Models ({picked.length}/{MAX_MODELS})
            </h2>
          </legend>
          {!avail.listed && <Alert><AlertDescription>Couldn’t load the model lists — add a model id manually below (Venice models start with venice:).</AlertDescription></Alert>}
          <div className="grid max-h-[520px] grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2 overflow-y-auto pr-1">
            {options.map((m) => (
              <Label
                key={m}
                title={m}
                className="min-w-0 cursor-pointer rounded-md border border-border bg-background/60 px-3 py-2.5 font-mono text-xs font-normal transition-colors hover:border-border/90 hover:bg-accent/50 has-data-[state=checked]:border-primary/65 has-data-[state=checked]:bg-primary/10 has-data-[state=checked]:text-primary"
              >
                <Checkbox checked={picked.includes(m)} onCheckedChange={() => toggle(m)} disabled={!picked.includes(m) && picked.length >= MAX_MODELS} />
                <span className="min-w-0 truncate">{m}</span>
              </Label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2 pt-1">
          <Input
            className="min-w-0 flex-1 font-mono text-xs" aria-label="Model ID" value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} // add the model instead of saving the page
            placeholder="gemini-4-carbon" spellCheck="false"
          />
          <Button type="button" variant="outline" className="shrink-0 font-mono text-xs uppercase tracking-wider" onClick={addCustom}>Add</Button>
        </div>
      </Card>

      <div className="grid min-w-0 gap-4">
        <Card className="gap-3 px-5 py-4">
          <h2 id="remediation-model" className="font-mono text-xs font-semibold tracking-wider uppercase text-muted-foreground">Remediation model</h2>
          <Select value={fixModel || FIRST_SELECTED} onValueChange={(v) => setFixModel(v === FIRST_SELECTED ? "" : v)}>
            <SelectTrigger className="w-full font-mono text-xs" aria-labelledby="remediation-model"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FIRST_SELECTED}>Same as the first selected model</SelectItem>
              {[...new Set([...options, fixModel].filter(Boolean))].map((m) => <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>

        <Card className="gap-3 px-5 py-4">
          <h2 id="exploitation-model" className="font-mono text-xs font-semibold tracking-wider uppercase text-muted-foreground">Exploitation model</h2>
          <Select value={exploitModel || undefined} onValueChange={setExploitModel}>
            <SelectTrigger className="w-full font-mono text-xs" aria-labelledby="exploitation-model"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...new Set([...options, exploitModel].filter(Boolean))].map((m) => <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>

        <Card className="gap-3 px-5 py-4">
          <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            Criticality threshold (CVSS)
          </h2>
          <Label className="cursor-pointer items-start gap-2.5 text-xs font-normal leading-snug text-foreground">
            <Checkbox checked={autoShutdown} onCheckedChange={(v) => setAutoShutdown(Boolean(v))} className="mt-0.5" />
            <span>Shut down selected affected servers immediately when CVE criticality meets or exceeds this score</span>
          </Label>
          {autoShutdown && (
            <div className="grid gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  aria-label="CVSS criticality threshold"
                  className="w-28 font-mono text-xs tabular-nums"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
                {thresholdValid && (
                  <span className="font-mono text-xs text-likely">
                    {cvssBand(parsedThreshold)}
                  </span>
                )}
              </div>

              <div className="grid gap-2 border-t border-border/70 pt-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                    Servers to shut down ({activeShutdownHosts.length}/{allVmHosts.length})
                  </span>
                  {allVmHosts.length > 1 && (
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="xs" className="font-mono text-[10px] uppercase" onClick={() => setShutdownHosts(allVmHosts)}>
                        All
                      </Button>
                      <Button type="button" variant="ghost" size="xs" className="font-mono text-[10px] uppercase" onClick={() => setShutdownHosts([])}>
                        None
                      </Button>
                    </div>
                  )}
                </div>
                {allVmHosts.length > 0 ? (
                  <div className="grid max-h-48 gap-1.5 overflow-y-auto pr-0.5">
                    {allVmHosts.map((h) => (
                      <Label
                        key={h}
                        className="min-w-0 cursor-pointer rounded-md border border-border bg-background/60 px-2.5 py-2 font-mono text-xs font-normal transition-colors hover:bg-accent/50 has-data-[state=checked]:border-likely/60 has-data-[state=checked]:bg-likely/10 has-data-[state=checked]:text-foreground"
                      >
                        <Checkbox checked={activeShutdownHosts.includes(h)} onCheckedChange={() => toggleHost(h)} />
                        <span className="min-w-0 truncate">{h}</span>
                      </Label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No servers added yet. Add servers on the Dashboard tab.</p>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="flex items-center gap-3">
          <Button disabled={!dirty || !picked.length || !thresholdValid} className="w-full font-mono text-xs font-semibold uppercase tracking-wider sm:w-auto">
            Save settings
          </Button>
          {!picked.length && <span className="text-sm text-muted-foreground">Select at least one model</span>}
        </div>
      </div>
    </form>
  );
}
