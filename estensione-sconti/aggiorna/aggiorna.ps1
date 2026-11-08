# Aggiorna Cacciasconti: scarica SOLO la cartella "estensione-sconti" del repository in %LOCALAPPDATA%\Cacciasconti.
# Usa le credenziali git che hai già. Non serve essere amministratore.
# Uso:   .\aggiorna.ps1 [-Repo https://github.com/UTENTE/REPO.git] [-Ramo main]
param(
  [string]$Repo = $env:CACCIASCONTI_REPO,
  [string]$Ramo = $(if ($env:CACCIASCONTI_RAMO) { $env:CACCIASCONTI_RAMO } else { 'main' }),
  [string]$Cartella = (Join-Path $env:LOCALAPPDATA 'Cacciasconti')
)
$ErrorActionPreference = 'Stop'
$log = Join-Path $Cartella 'aggiorna.log'
function Scrivi($t) { $riga = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $t; Write-Host $riga; if (Test-Path $Cartella) { Add-Content -Path $log -Value $riga } }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git non è installato: installa Git for Windows e riprova.' }
if (-not $Repo) {
  $file = Join-Path $Cartella 'repo.txt'
  if (Test-Path $file) { $Repo = (Get-Content $file -Raw).Trim() }
}
if (-not $Repo) { throw 'Indica il repository: .\aggiorna.ps1 -Repo https://github.com/UTENTE/REPO.git (viene ricordato per le volte dopo).' }

New-Item -ItemType Directory -Force -Path $Cartella | Out-Null
Set-Content -Path (Join-Path $Cartella 'repo.txt') -Value $Repo
$copia = Join-Path $Cartella 'repo'

if (-not (Test-Path (Join-Path $copia '.git'))) {
  Scrivi "Prima installazione da $Repo ($Ramo)"
  git clone --filter=blob:none --no-checkout --branch $Ramo $Repo $copia
  if ($LASTEXITCODE -ne 0) { throw 'git clone non è riuscito.' }
  git -C $copia sparse-checkout init --cone
  git -C $copia sparse-checkout set estensione-sconti
  git -C $copia checkout $Ramo
  if ($LASTEXITCODE -ne 0) { throw 'git checkout non è riuscito.' }
} else {
  git -C $copia fetch origin $Ramo
  if ($LASTEXITCODE -ne 0) { throw 'git fetch non è riuscito (rete o credenziali).' }
  $prima = (git -C $copia rev-parse HEAD)
  git -C $copia checkout $Ramo 2>$null
  git -C $copia reset --hard "origin/$Ramo"
  $dopo = (git -C $copia rev-parse HEAD)
  if ($prima -eq $dopo) { Scrivi 'Già aggiornato.' } else { Scrivi "Aggiornato: $($prima.Substring(0,7)) -> $($dopo.Substring(0,7))" }
}

# Cartella da caricare nel browser (una sola volta): è un collegamento stabile alla sottocartella del repository.
$estensione = Join-Path $copia 'estensione-sconti'
$collegamento = Join-Path $Cartella 'estensione-sconti'
if (-not (Test-Path $collegamento)) {
  try { New-Item -ItemType Junction -Path $collegamento -Target $estensione | Out-Null } catch { Scrivi "Collegamento non creato: usa $estensione" }
}
if (Test-Path (Join-Path $estensione 'manifest.json')) {
  $v = (Get-Content (Join-Path $estensione 'manifest.json') -Raw | ConvertFrom-Json).version
  Scrivi "Versione su disco: $v. Carica nel browser la cartella: $collegamento"
} else { throw 'manifest.json non trovato dopo l''aggiornamento.' }
