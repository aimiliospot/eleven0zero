# Full reset + rebuild for a fresh docker build: deletes the 3 demo boxd VMs and ALL boxd snapshots
# in the active org (cannot be undone), resets the SQLite DB (drops the docker volumes), recreates
# the demo VMs, then rebuilds and restarts the stack. Run this INSTEAD OF `docker compose up --build`.
# Run:  powershell -ExecutionPolicy Bypass -File .\rebuild.ps1

$vms = @("keen-pond", "free-sky", "cve-2024-6387-lab")

Write-Host "Deleting demo VMs..."
foreach ($v in $vms) { boxd machine remove $v -y 2>$null | Out-Null }  # ponytail: best-effort, ok if a VM is already gone

Write-Host "Deleting all boxd snapshots..."
$snaps = @(boxd snapshots list --json | ConvertFrom-Json | ForEach-Object { $_.name })
foreach ($s in $snaps) {
    boxd snapshots remove $s -y
    if ($LASTEXITCODE) { Write-Host "failed to remove snapshot $s" -ForegroundColor Red }
}

Write-Host "Recreating demo VMs..."
& "$PSScriptRoot\setup-vms.ps1"

Write-Host "Resetting the database (dropping docker volumes) and rebuilding..."
docker compose down -v
docker compose up --build -d
