#!/bin/bash

# 🚀 Automatyczna instalacja AI-SQL-Interface na VPS

echo "🔧 Aktualizacja systemu..."
sudo apt update && sudo apt upgrade -y

echo "📦 Instalacja Node.js, npm i git..."
sudo apt install nodejs npm git curl -y

echo "🚀 Instalacja PM2 (menedżera procesów)..."
sudo npm install -g pm2

echo "📁 Klonowanie projektu AI-SQL-Interface..."
git clone https://github.com/NAZWA_UZYTKOWNIKA/ai-sql-interface.git
cd ai-sql-interface

echo "📦 Instalacja zależności npm..."
npm install

echo "📃 Upewnij się, że plik .env i schema.json są obecne..."
if [ ! -f ".env" ]; then
  echo "⚠️ UWAGA: Brak pliku .env. Prześlij dane konfiguracji ręcznie!"
fi

if [ ! -f "schema.json" ]; then
  echo "⚠️ UWAGA: Brak pliku schema.json. Aplikacja może nie działać poprawnie!"
fi

echo "🚀 Uruchamianie aplikacji za pomocą PM2..."
pm2 start server.js --name ai-sql
pm2 save

echo "🔓 Odblokowywanie portu 8080 (jeśli UFW jest zainstalowany)..."
sudo ufw allow 8080/tcp || echo "⚠️ UFW nieaktywny lub nieużywany."

echo "✅ Gotowe! Aplikacja AI-SQL działa w tle na porcie 8080."
echo "🌍 Dostęp: http://$(curl -s ifconfig.me):8080"
