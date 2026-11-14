import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  if (!cfg) return <p className="empty small">Loading settings…</p>;
  return (
    <form className="settings" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <section className="card">
        <fieldset className="min-w-0">
          <legend><h2>Models (up to {MAX_MODELS})</h2></legend>
          {!avail.listed && <p className="warn">Couldn’t load the model lists — add a model id manually below (Venice models start with venice:).</p>}
          <div className="models">
            {options.map((m) => (
              <label key={m} className={`model ${picked.includes(m) ? "on" : ""}`}>
                <input type="checkbox" checked={picked.includes(m)} onChange={() => toggle(m)} disabled={!picked.includes(m) && picked.length >= MAX_MODELS} />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row">
          <Input
            className="grow w-auto" aria-label="Model ID" value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} // add the model instead of saving the page
            placeholder="gemini-4-carbon" spellCheck="false"
          />
          <Button type="button" variant="outline" onClick={addCustom}>Add</Button>
        </div>
      </section>

      <section className="card">
        <h2 id="remediation-model">Remediation model</h2>
        <Select value={fixModel || FIRST_SELECTED} onValueChange={(v) => setFixModel(v === FIRST_SELECTED ? "" : v)}>
          <SelectTrigger className="w-full" aria-labelledby="remediation-model"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={FIRST_SELECTED}>Same as the first selected model</SelectItem>
            {[...new Set([...options, fixModel].filter(Boolean))].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      <section className="card">
        <h2 id="exploitation-model">Exploitation model</h2>
        <Select value={exploitModel || undefined} onValueChange={setExploitModel}>
          <SelectTrigger className="w-full" aria-labelledby="exploitation-model"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[...new Set([...options, exploitModel].filter(Boolean))].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      <div className="row">
        <Button disabled={!dirty || !picked.length}>Save settings</Button>
        {!picked.length && <span className="muted">Select at least one model</span>}
      </div>
    </form>
  );
}
