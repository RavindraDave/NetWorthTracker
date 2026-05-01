#!/bin/bash

echo "======================================"
echo " WealthPulse macOS Installer"
echo "======================================"

echo "[0/6] Checking System Requirements..."
if ! command -v node &> /dev/null
then
    echo "Node.js is not installed. Attempting to install automatically..."
    if ! command -v brew &> /dev/null
    then
        echo "Homebrew not found. Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    echo "Installing Node.js..."
    brew install node
fi

echo "[1/6] Installing dependencies..."
npm install

echo "[2/6] Building production app..."
npm run build

echo "[3/6] Installing PM2 process manager (requires admin privileges)..."
sudo npm install -g pm2

echo "[4/6] Starting WealthPulse in the background..."
pm2 delete wealthpulse 2>/dev/null || true
pm2 serve dist 3000 --spa --name "wealthpulse"

echo "[5/6] Configuring macOS to launch WealthPulse on startup..."
# Get the path to PM2 and Node safely
PM2_PATH=$(which pm2)
NODE_DIR=$(dirname $(which node))

# Generate and execute the startup script for launchd (macOS)
sudo env PATH=$PATH:$NODE_DIR $PM2_PATH startup launchd -u $USER --hp $HOME

echo "[6/6] Saving configuration..."
pm2 save

echo "======================================"
echo "✅ Installation Complete!"
echo "WealthPulse is now running silently in the background."
echo "It will automatically start whenever you turn on your Mac."
echo ""
echo "Open your browser and visit: http://localhost:3000"
echo "======================================"
