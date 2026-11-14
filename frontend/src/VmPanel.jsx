import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ago = (iso) => {
  if (!iso) return "pending";
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function VmCard({ vm, onRemove }) {
  return (
    <li className="card vm">
      <div className="row">
        <span className={`dot ${vm.error ? "bad" : vm.collected_at ? "ok" : "wait"}`} />
        <strong className="grow">{vm.host}</strong>
        <Button variant="ghost" size="icon-xs" aria-label={`Remove ${vm.host}`} onClick={() => confirm(`Remove ${vm.host}?`) && onRemove(vm.host)}><X /></Button>
      </div>
      <div className="meta"><span>{vm.os || "collecting…"}</span></div>
      <div className="meta"><span>{vm.npkg} packages</span><span>scanned {ago(vm.collected_at)}</span></div>
      {vm.ports.length > 0 && (
        <div className="chips">{vm.ports.map((p) => <span key={p} className="chip">{p}</span>)}</div>
      )}
      {vm.error && <div className="err">{vm.error}</div>}
    </li>
  );
}

export default function VmPanel({ vms, onAdd, onRemove }) {
  const [host, setHost] = useState("");
  return (
    <section>
      <h2>Virtual machines</h2>
      <form className="bar slim" onSubmit={async (e) => { e.preventDefault(); if (await onAdd(host.trim())) setHost(""); }}>
        <Input aria-label="VM SSH address" value={host} onChange={(e) => setHost(e.target.value)} placeholder="root@my-vm.boxd.sh:22" required spellCheck="false" />
        <Button variant="outline">Add</Button>
      </form>
      {vms.length
        ? <ul>{vms.map((vm) => <VmCard key={vm.host} vm={vm} onRemove={onRemove} />)}</ul>
        : <p className="empty small">No VMs yet. Add one above.</p>}
    </section>
  );
}
