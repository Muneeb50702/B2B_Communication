# B2B Communication - Development Build Guide

## 🚀 Current Status

Your app is now configured with **full native P2P networking** capabilities including:
- ✅ WiFi Hotspot Management (Android)
- ✅ UDP Discovery (peer-to-peer device discovery)
- ✅ TCP Messaging (reliable message/file transfer)
- ✅ Friend Request System
- ✅ 1-on-1 Messaging
- ✅ QR Code Scanning (ready for Phase 2)

## ⚠️ Important: Expo Go NOT Supported

This app uses **native modules** (`react-native-udp`, `react-native-tcp-socket`, `react-native-wifi-reborn`) that **DO NOT work in Expo Go**. You must create a **custom development build**.

## 📋 Prerequisites

1. **EAS CLI** installed globally:
   ```bash
   npm install -g eas-cli
   ```

2. **Expo Account** (free):
   ```bash
   eas login
   ```

3. **Android Device** with USB debugging enabled or **Android Emulator**

## 🏗️ Building the Development Build

### Option 1: Development Build (Recommended for Testing)

This includes Expo Dev Tools and hot reload:

```bash
# Build development APK
eas build --profile development --platform android

# Wait for build to complete (~15-20 minutes first time)
# Download APK from the link provided
# Install on your device
```

### Option 2: Preview Build (For Testing Without Dev Tools)

```bash
# Build preview APK
eas build --profile preview --platform android
```

### Option 3: Production Build (For Release)

```bash
# Build production AAB for Play Store
eas build --profile production --platform android
```

## 📱 Installing the Build

### Method 1: Direct Download
1. Build completes → QR code appears
2. Scan QR with phone
3. Download and install APK

### Method 2: ADB Install
```bash
# Download APK from EAS
adb install path/to/your-app.apk
```

## 🧪 Running the App

### For Development Build:
```bash
# Start Expo dev server with dev client
npx expo start --dev-client

# Or
npm start
# Then press 'a' for Android
```

### For Preview/Production Build:
Just open the app on your device - no dev server needed.

## 🔧 Testing P2P Features

### Setup (Requires 2 Android Devices)

#### Device A (Host):
1. Open app
2. Enter username (e.g., "Alice")
3. Click "Become Host"
4. App creates WiFi hotspot
5. Wait for Device B to join

#### Device B (Client):
1. Open app
2. Enter username (e.g., "Bob")
3. Click "Join Network"
4. Connect to Device A's hotspot (Settings → WiFi)
5. Return to app

### Expected Behavior:

1. **Discovery**: Both devices should see each other in "Users" tab
2. **Friend Request**: 
   - Alice clicks on Bob → Send Friend Request
   - Bob receives notification
   - Bob accepts request
3. **Messaging**:
   - Both can now see each other in "Chats" tab
   - Send messages back and forth
   - Messages arrive in real-time via TCP

## 📂 Project Structure

```
services/
├── WiFiManager.ts      # Hotspot creation/management
├── UDPDiscovery.ts     # Peer discovery via UDP broadcast
├── TCPMessaging.ts     # Reliable message delivery
└── NetworkService.ts   # Main service integrating all above

context/
└── AppContext.tsx      # Global state + NetworkService integration

app/
├── (tabs)/
│   ├── users.tsx       # Online users + friend requests
│   ├── chats.tsx       # Conversations list
│   └── settings.tsx    # Settings + logout
└── chat/[uid].tsx      # Individual chat screen
```

## 🐛 Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules .expo android ios
npm install --legacy-peer-deps
eas build --profile development --platform android --clear-cache
```

### "No devices found"

**Check:**
- Both devices are on same WiFi network
- Location permissions granted (required for WiFi scanning on Android 10+)
- WiFi is enabled on both devices

### "Cannot connect"

**Check:**
- Firewall not blocking ports 3001 (UDP) and 3002 (TCP)
- Devices are on same subnet
- Try restarting the app on both devices

### Messages not sending

**Check:**
- Both users are friends (sent/accepted friend request)
- TCP connection established (check logs)
- Try sending from other device first

## 📊 Logging & Debugging

Enable logs in dev build:

```bash
# Android logcat
adb logcat | grep -i "NetworkService\|UDPDiscovery\|TCPMessaging"

# Or filter by app
adb logcat | grep B2B
```

Look for:
- `[UDPDiscovery] User discovered:` - peer found
- `[TCPMessaging] Connected to:` - TCP connection established
- `[NetworkService] Packet received:` - message received

## 🎯 Next Development Phases

### Phase 2: Advanced Features (Not Yet Implemented)
- [ ] File transfer with progress
- [ ] Group chats
- [ ] QR code for network joining
- [ ] QR code for quick friend add
- [ ] Profile pictures
- [ ] Voice messages

### Phase 3: Polish
- [ ] Message persistence (store in SQLite)
- [ ] Local push notifications
- [ ] Dark mode theme
- [ ] Settings UI
- [ ] Network status indicators

### Phase 4: iOS Support
- [ ] Replace WiFi modules with Multipeer Connectivity
- [ ] Build iOS app
- [ ] Test cross-platform (Android ↔ iOS)

## 🔐 Permissions Explained

| Permission | Why Needed |
|------------|-----------|
| `ACCESS_WIFI_STATE` | Check WiFi status |
| `CHANGE_WIFI_STATE` | Enable/disable WiFi |
| `CHANGE_NETWORK_STATE` | Create hotspot |
| `ACCESS_FINE_LOCATION` | Required for WiFi scanning (Android 10+) |
| `INTERNET` | Network communication |
| `WRITE_SETTINGS` | Hotspot configuration |
| `CAMERA` | QR code scanning |

## 📝 Configuration Files

### `eas.json`
Build profiles for EAS

### `app.json`
Expo configuration + Android permissions

### `app.plugin.js`
Custom config plugin for Android manifest modifications

### `android/app/src/main/res/xml/network_security_config.xml`
Allows cleartext (non-HTTPS) traffic for local P2P

## 🚀 Quick Commands Reference

```bash
# Setup project
bash setup.sh

# Build development APK
eas build --profile development --platform android

# Build preview APK (no dev tools)
eas build --profile preview --platform android

# Start dev server (after installing dev build)
npx expo start --dev-client

# Check logs
adb logcat | grep B2B

# Install APK via ADB
adb install your-app.apk

# Web version (limited features)
npm run start-web
```

## 📞 Support

If you encounter issues:

1. Check this guide first
2. Check GitHub issues
3. Review logs: `adb logcat`
4. Ensure both devices meet requirements

## ✅ Checklist Before Testing

- [ ] Development build installed on Device A
- [ ] Development build installed on Device B
- [ ] Location permission granted on both devices
- [ ] WiFi enabled on both devices
- [ ] Both devices charged (P2P is battery intensive)
- [ ] Understand host vs client roles

---

**Ready to test?** Build your development APK and install on 2 devices! 🎉
