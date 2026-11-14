# Creates the 3 demo VMs in boxd. Safe to re-run: VMs that already exist are kept, not recreated.
#   keen-pond, free-sky   plain machines (patched, should come back "not affected")
#   cve-2024-6387-lab     isolated; one outdated package (PyYAML 5.3.1, CVE-2020-14343) for CVE Watchdog to flag
# Run:  powershell -ExecutionPolicy Bypass -File .\setup-vms.ps1

$lab = "cve-2024-6387-lab"

function New-Vm($name, [string[]]$extra) {
    boxd machine get $name 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "${name}: exists, skipping create"; return }
    boxd machine new $name @extra
    if ($LASTEXITCODE) { throw "could not create $name" }
}

New-Vm keen-pond "--vcpu", "2", "--memory", "8G"
New-Vm free-sky  "--vcpu", "1", "--memory", "4G"
New-Vm $lab      "--isolated"

# --- one outdated package for CVE Watchdog to flag; the fix is a single pip upgrade ---
$null | boxd machine exec $lab --timeout 240 -- 'pip3 install --break-system-packages --ignore-installed PyYAML==5.3.1'
if ($LASTEXITCODE) { throw "failed: package install" }

Write-Host ""
Write-Host "Done. Add keen-pond.boxd, free-sky.boxd and $lab.boxd in CVE Watchdog."
Write-Host "Watchdog copies ~/.ssh/config only at startup: docker restart genai-summit-hackathon-1100-watchdog-1"
