#!/bin/bash

# B2B Communication App - Complete Setup Script
# This script sets up the entire project from scratch

set -e  # Exit on any error

echo "=================================="
echo "B2B Communication App Setup"
echo "=================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"
echo ""

# Clean previous installations
echo "Cleaning previous installations..."
if [ -d "node_modules" ]; then
    echo "Removing node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo "Removing package-lock.json..."
    rm -f package-lock.json
fi

if [ -f "bun.lock" ]; then
    echo "Removing bun.lock..."
    rm -f bun.lock
fi

if [ -d ".expo" ]; then
    echo "Removing .expo cache..."
    rm -rf .expo
fi

if [ -d "android" ]; then
    echo "Removing android folder..."
    rm -rf android
fi

if [ -d "ios" ]; then
    echo "Removing ios folder..."
    rm -rf ios
fi

echo ""
echo "Installing dependencies..."
npm install --legacy-peer-deps

echo ""
echo "Verifying Expo SDK compatibility..."
npx expo-doctor

echo ""
echo "=================================="
echo "Setup Complete!"
echo "=================================="
echo ""
echo "Available commands:"
echo "  npm start           - Start Expo dev server"
echo "  npm run start-web   - Start web only"
echo "  npm run android     - Start Android"
echo ""
echo "⚠️  IMPORTANT: Native P2P Features Require Development Build"
echo ""
echo "This app uses native modules (UDP, TCP, WiFi) that don't work in Expo Go."
echo "You need to create a custom development build:"
echo ""
echo "For Development Testing:"
echo "  eas build --profile development --platform android"
echo "  (Install the generated APK on your device)"
echo "  npx expo start --dev-client"
echo ""
echo "For Preview/Production:"
echo "  eas build --profile preview --platform android    (APK)"
echo "  eas build --profile production --platform android (AAB for Play Store)"
echo ""
echo "Web version has limited functionality (no P2P networking)."
echo "To start development with full features, run: npm start"
echo ""
