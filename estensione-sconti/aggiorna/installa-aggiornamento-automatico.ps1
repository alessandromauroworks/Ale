# Crea un'attività pianificata PER TE (senza amministratore) che lancia aggiorna.ps1 ogni giorno e a ogni accesso.
# Uso:   .\installa-aggiornamento-automatico.ps1 -Repo https://github.com/UTENTE/REPO.git [-Ramo main] [-Ora 12:30]
param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [string]$Ramo = 'main',
  [string]$Ora = '12:30',
  [string]$NomeAttivita = 'Cacciasconti - aggiornamento'
)
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'aggiorna.ps1'
if (-not (Test-Path $script)) { throw "Non trovo $script" }
$argomenti = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Repo `"$Repo`" -Ramo `"$Ramo`""
$azione = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argomenti
$trigger = @((New-ScheduledTaskTrigger -Daily -At $Ora), (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME))
$impostazioni = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$principale = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $NomeAttivita -Action $azione -Trigger $trigger -Settings $impostazioni -Principal $principale -Force | Out-Null
Write-Host "Attività '$NomeAttivita' creata: ogni giorno alle $Ora e a ogni accesso."
Write-Host 'Primo aggiornamento adesso...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Repo $Repo -Ramo $Ramo
Write-Host 'Fatto. Per toglierla: Unregister-ScheduledTask -TaskName "Cacciasconti - aggiornamento" -Confirm:$false'
