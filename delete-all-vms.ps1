# Deletes EVERY machine in the active boxd org (disks included, cannot be undone).
# Lists them first and asks you to type "delete" to continue.
# Run:  powershell -ExecutionPolicy Bypass -File .\delete-all-vms.ps1

$names = @(boxd machine list --json | ConvertFrom-Json | ForEach-Object { $_.name })
if ($LASTEXITCODE) { throw "could not list machines" }
if (-not $names) { Write-Host "No machines."; return }

Write-Host "These machines will be PERMANENTLY deleted:"
$names | ForEach-Object { Write-Host "  $_" }
if ((Read-Host "Type 'delete' to continue") -ne "delete") { Write-Host "Aborted."; return }

foreach ($n in $names) {
    boxd machine remove $n -y
    if ($LASTEXITCODE) { Write-Host "failed to remove $n" -ForegroundColor Red }
}
