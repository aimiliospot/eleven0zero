import { useState } from "react";
import { Server, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ago = (iso) => {
  if (!iso) return "pending";
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const EDGE = {
  affected: "border-l-2 border-l-affected",
  not_affected: "border-l-2 border-l-not-affected/60",
  likely: "border-l-2 border-l-likely",
};

function RemoveVm({ host, onRemove }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${host}`}><X /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono text-base">Remove {host}?</AlertDialogTitle>
          <AlertDialogDescription>Its findings are deleted too.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-mono text-xs uppercase tracking-wider">Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" className="font-mono text-xs uppercase tracking-wider" onClick={() => onRemove(host)}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function VmCard({ vm, onRemove }) {
  const [variant, status] = vm.error ? ["affected", "Error"] : vm.collected_at ? ["not_affected", "Scanned"] : ["likely", "Collecting"];
  return (
    <Card className={`gap-1.5 px-3.5 py-3 ${EDGE[variant]}`}>
      <div className="flex items-center gap-2">
        <Server aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <strong className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold">{vm.host}</strong>
        <Badge variant={variant}>{status}</Badge>
        <RemoveVm host={vm.host} onRemove={onRemove} />
      </div>
      <div className="truncate text-xs text-muted-foreground">{vm.os || "collecting…"}</div>
      <div className="flex flex-wrap gap-x-3 font-mono text-[11px] tabular-nums text-muted-foreground">
        <span>{vm.npkg} pkgs</span>
        <span>·</span>
        <span>scanned {ago(vm.collected_at)}</span>
      </div>
      {vm.ports.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {vm.ports.map((p) => (
            <Badge key={p} variant="outline" className="normal-case tracking-normal text-primary/90">{p}</Badge>
          ))}
        </div>
      )}
      {vm.error && (
        <Alert variant="destructive" className="mt-1 px-3 py-2">
          <AlertDescription className="font-mono text-xs break-words">{vm.error}</AlertDescription>
        </Alert>
      )}
    </Card>
  );
}

export default function VmPanel({ vms, onAdd, onRemove }) {
  const [host, setHost] = useState("");
  return (
    <section className="grid min-w-0 gap-3">
      <div className="flex min-h-8 items-center gap-2">
        <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-muted-foreground">Virtual machines</h2>
        {vms.length > 0 && <span className="font-mono text-xs tabular-nums text-muted-foreground">{vms.length}</span>}
      </div>
      <form className="flex min-w-0 gap-2" onSubmit={async (e) => { e.preventDefault(); if (await onAdd(host.trim())) setHost(""); }}>
        <Input
          aria-label="VM SSH address"
          className="min-w-0 flex-1 font-mono text-xs"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="root@my-vm.boxd.sh:22"
          required
          spellCheck="false"
        />
        <Button variant="outline" className="shrink-0 font-mono text-xs uppercase tracking-wider">Add</Button>
      </form>
      {vms.length
        ? <ul className="grid min-w-0 gap-2.5">{vms.map((vm) => <li key={vm.host} className="min-w-0"><VmCard vm={vm} onRemove={onRemove} /></li>)}</ul>
        : <p className="rounded-md border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">No VMs yet. Add one above.</p>}
    </section>
  );
}
