# =====================================
#  AI SQL Interface - Full Deploy Script (PowerShell)
# =====================================

$serverIP   = "130.162.227.150"
$user       = "ubuntu"
$keyPath    = "$env:USERPROFILE\.ssh\ssh-key-2025-09-18.key"
$localDir   = "ai-sql-interface"
$remoteDir  = "/home/ubuntu/ai-sql-interface"

Write-Host ""
Write-Host "=== DEPLOY AI SQL INTERFACE ===" -ForegroundColor Cyan
Write-Host ""

# --- 1️⃣ Test SSH ---
Write-Host "Testowanie połączenia SSH..." -ForegroundColor Yellow
$sshTest = & ssh -i $keyPath "$user@$serverIP" "echo 'SSH dziala poprawnie'" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Błąd połączenia SSH:" -ForegroundColor Red
    Write-Host $sshTest
    exit 1
}
Write-Host "Połączenie SSH działa!" -ForegroundColor Green

# --- 2️⃣ Wgrywanie plików ---
Write-Host ""
Write-Host "Wgrywanie plików..." -ForegroundColor Yellow
& scp -i $keyPath -r "${localDir}\*" "${user}@${serverIP}:${remoteDir}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Błąd podczas kopiowania plików!" -ForegroundColor Red
    exit 1
}
Write-Host "Pliki zostały przesłane." -ForegroundColor Green

# --- 3️⃣ Komendy zdalne (bash) ---
Write-Host ""
Write-Host "Aktualizacja zależności i restart aplikacji..." -ForegroundColor Yellow
$commands = @"
cd ~/ai-sql-interface
npm install --silent
pm2 stop all || true
pm2 delete all || true
pm2 start server.js --name ai-sql-interface
pm2 save
sudo systemctl restart nginx
"@

ssh -i $keyPath "${user}@${serverIP}" $commands
if ($LASTEXITCODE -ne 0) {
    Write-Host "Błąd podczas restartu aplikacji!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Wdrożenie zakończone!" -ForegroundColor Green
Write-Host ("Aplikacja działa, a na: http://" + $serverIP) -ForegroundColor Green



Write-Host "==============================================" -ForegroundColor Cyan

