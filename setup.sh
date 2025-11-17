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
echo "To build APK:"
echo "  eas build --platform android --profile preview"
echo ""
echo "To start development, run: npm start"
echo ""
