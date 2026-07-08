#!/bin/bash
set -e
cd /var/www/daromadchi
echo "Pulling latest code..."
git pull origin main
echo "Installing dependencies..."
npm install
echo "Building..."
npm run build
echo "Restarting app..."
pm2 restart daromadchi
echo "Deploy complete."
