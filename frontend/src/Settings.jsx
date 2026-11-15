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

export default function Settings({ notify }) {
  const [cfg, setCfg] = useState(null); // saved settings from the server
  const [avail, setAvail] = useState({ models: [], listed: true });
  const [picked, setPicked] = useState([]);
  const [custom, setCustom] = useState("");
  const [fixModel, setFixModel] = useState("");
  const [exploitModel, setExploitModel] = useState("");

  const load = () => api("/settings").then((s) => {
    setCfg(s);
    setPicked(s.models);
    setFixModel(s.remediation_model);
    setExploitModel(s.exploitation_model || "");
  });
  useEffect(() => {
    load();
    api("/models").then(setAvail).catch(() => setAvail((a) => ({ ...a, listed: false })));
  }, []);

  const save = async () => {
    try {
      await api("/settings", "PUT", { models: picked, remediation_model: fixModel, exploitation_model: exploitModel });
      await load();
      notify(true, "Settings saved");
    } catch (e) { notify(false, e.message); }
  };
  const toggle = (m) => setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  const addCustom = () => {
    const m = custom.trim();
    if (m && !picked.includes(m) && picked.length < MAX_MODELS) {
      setPicked([...picked, m]);
      setAvail((a) => ({ ...a, models: [...new Set([...a.models, m])] }));
    }
    setCustom("");
  };
  const options = [...new Set([...avail.models, ...picked])];
  const dirty = cfg && (
    picked.join() !== cfg.models.join() ||
    fixModel !== cfg.remediation_model ||
    exploitModel !== (cfg.exploitation_model || "")
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

        <div className="flex items-center gap-3">
          <Button disabled={!dirty || !picked.length} className="w-full font-mono text-xs font-semibold uppercase tracking-wider sm:w-auto">
            Save settings
          </Button>
          {!picked.length && <span className="text-sm text-muted-foreground">Select at least one model</span>}
        </div>
      </div>
    </form>
  );
}
