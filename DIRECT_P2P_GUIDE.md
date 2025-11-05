# Direct P2P Mesh Chat - Setup Guide

## 🎯 TRUE Peer-to-Peer (No Router/Common Network)

This app connects PC1 ↔ PC2 **directly** without WiFi router or internet.

---

## 🔌 Connection Methods

### Method 1: Bluetooth (RECOMMENDED - Works Windows ↔ Mac)
- **Range**: ~10-30 meters
- **Setup**: Enable Bluetooth on both PCs (no pairing needed)
- **Works**: Windows ↔ Mac ↔ Linux
- **Pros**: Zero config, auto-discovery
- **Cons**: Slower than WiFi

### Method 2: WiFi Hotspot Mode (Faster, More Setup)
- **Range**: ~30-100 meters  
- **Setup**: PC1 creates hotspot, PC2 connects to it
- **Works**: Windows ↔ Mac ↔ Linux
- **Pros**: Much faster than Bluetooth
- **Cons**: Requires manual hotspot setup

### Method 3: WiFi Direct (Windows-to-Windows only)
- **Range**: ~100 meters
- **Setup**: Both PCs enable WiFi Direct
- **Works**: Windows ↔ Windows only
- **Pros**: Fast and direct
- **Cons**: Not available on Mac

---

## 📦 Installation

### Step 1: Install Python Dependencies

**On Windows:**
```bash
pip install pybluez customtkinter
```

**On Mac:**
```bash
# Install Bluetooth support
brew install python-tk
pip3 install pybluez2 customtkinter

# If pybluez2 fails, use bleak (BLE alternative):
pip3 install bleak customtkinter
```

**On Linux:**
```bash
sudo apt-get install python3-tk bluetooth libbluetooth-dev
pip3 install pybluez customtkinter
```

---

## 🚀 Quick Start

### BLUETOOTH MODE (Easiest)

**PC 1 (Windows or Mac):**
```bash
cd B2B_Communication
python src/gui/gui_chat.py
```
- Select transport: **Bluetooth**
- Node ID: `PC1`
- Mode: **Server** (wait for connections)
- Click **START**

**PC 2 (Windows or Mac):**
```bash
cd B2B_Communication
python src/gui/gui_chat.py
```
- Select transport: **Bluetooth**
- Node ID: `PC2`
- Mode: **Client** (scan & connect)
- Click **SCAN DEVICES**
- Select PC1 from list
- Click **CONNECT**

**Done!** Start chatting.

---

### WIFI HOTSPOT MODE (Faster)

**PC 1 (Creates Hotspot):**

1. **Create WiFi Hotspot manually:**
   - **Windows 11/10:**
     - Settings → Network → Mobile Hotspot
     - Turn ON
     - Note: SSID = `DIRECT-PC1`, Password shown on screen
   
   - **Mac:**
     - System Preferences → Sharing
     - Enable "Internet Sharing" (share from Ethernet/USB to WiFi)
     - Or use: `sudo networksetup -createnetworkservice "Hotspot" Wi-Fi`

2. **Start app:**
   ```bash
   python src/gui/gui_chat.py
   ```
   - Transport: **WiFi Hotspot**
   - Mode: **Hotspot Creator**
   - Port: `5000`
   - Click **START**
   - Note your hotspot IP (usually `192.168.137.1` on Windows, `192.168.2.1` on Mac)

**PC 2 (Connects to Hotspot):**

1. **Connect to PC1's hotspot:**
   - WiFi settings → Connect to `DIRECT-PC1`
   - Enter password

2. **Start app:**
   ```bash
   python src/gui/gui_chat.py
   ```
   - Transport: **WiFi Hotspot**
   - Mode: **Hotspot Client**
   - Hotspot IP: `192.168.137.1` (or whatever PC1 shows)
   - Port: `5000`
   - Click **CONNECT**

**Done!** Messages fly at WiFi speed.

---

## 🔍 How Auto-Discovery Works

### Bluetooth Discovery
1. PC1 (server) opens Bluetooth RFCOMM socket on channel 1
2. PC2 (client) scans for nearby Bluetooth devices
3. PC2 finds PC1's service UUID and connects
4. Mesh protocol runs over Bluetooth serial

### WiFi Hotspot Discovery
1. PC1 creates WiFi AP and binds to `0.0.0.0:5000`
2. PC2 connects to hotspot and gets IP via DHCP
3. PC2 sends UDP broadcast to `255.255.255.255:5000`
4. PC1 responds with HELLO
5. Mesh protocol runs over UDP

---

## 🖥️ Platform Compatibility

| Feature | Windows | Mac | Linux |
|---------|---------|-----|-------|
| Bluetooth RFCOMM | ✅ | ✅ | ✅ |
| WiFi Hotspot | ✅ | ✅ | ✅ |
| WiFi Direct | ✅ | ❌ | ⚠️ |
| Python tkinter | ✅ | ✅ | ✅ |

**Cross-platform works:**
- Windows PC ↔ Mac laptop via Bluetooth ✅
- Windows PC ↔ Mac laptop via WiFi Hotspot ✅
- Any ↔ Any via Bluetooth ✅

---

## 🔧 Troubleshooting

### Bluetooth Issues

**"No Bluetooth adapter found"**
- Windows: Check Device Manager → Bluetooth
- Mac: System Preferences → Bluetooth (must show "On")
- Ensure Bluetooth is not disabled in BIOS/hardware switch

**"Permission denied"**
- Mac: Grant Terminal "Bluetooth" permission in System Preferences → Security & Privacy
- Linux: Add user to `bluetooth` group: `sudo usermod -a -G bluetooth $USER`

**"Device not found during scan"**
- Make sure both PCs have Bluetooth ON
- Try running server mode first, then scan from client
- Reduce distance to <5 meters for initial pairing

### WiFi Hotspot Issues

**"Cannot create hotspot"**
- Windows: Must have WiFi adapter that supports AP mode (most laptops do)
- Check: `netsh wlan show drivers` → "Hosted network supported: Yes"
- Mac: Requires sharing from Ethernet/USB/Thunderbolt to WiFi

**"Cannot connect to hotspot"**
- Verify correct password
- Check PC1's hotspot IP with `ipconfig` (Windows) or `ifconfig` (Mac)
- Look for `192.168.137.1` (Windows) or `192.168.2.1` (Mac)
- Disable firewall temporarily for testing

**"Connected but no messages"**
- Firewall blocking port 5000
- Windows: `netsh advfirewall firewall add rule name="MeshChat" dir=in action=allow protocol=UDP localport=5000`
- Mac: System Preferences → Security → Firewall → Firewall Options → Allow Python

---

## 📊 Performance Comparison

| Method | Bandwidth | Latency | Range | Setup |
|--------|-----------|---------|-------|-------|
| Bluetooth Classic | ~1-3 Mbps | 50-100ms | 10-30m | Easy ✅ |
| WiFi Hotspot | ~50-100 Mbps | 5-20ms | 30-100m | Medium ⚠️ |
| WiFi Direct | ~100-250 Mbps | 2-10ms | 50-200m | Hard (Win only) ❌ |

**Recommendation**: Start with Bluetooth for simplicity, switch to WiFi Hotspot for file transfer.

---

## 🔐 Security Note

This MVP has **no encryption** yet. Anyone within Bluetooth/WiFi range can:
- See your messages
- Impersonate nodes
- Inject messages

**Safe for**: Testing, learning, trusted environments  
**NOT safe for**: Sensitive data, public spaces

**Coming soon**: AES-256 encryption, HMAC auth, key exchange

---

## 📱 Mobile Planned

Future Android/iOS apps will use:
- Android: Bluetooth + WiFi Direct (native APIs)
- iOS: Bluetooth (MultipeerConnectivity framework)

For now, desktop-to-desktop works perfectly for development.

---

## 🎮 Example Session

```
PC1 (Windows Desktop):
$ python src/gui/gui_chat.py
[Select Bluetooth, Server mode, START]
Status: 🔵 Waiting for connections...

PC2 (Mac Laptop):
$ python src/gui/gui_chat.py
[Select Bluetooth, Client mode, SCAN]
Found devices:
  1. DESKTOP-PC1 [00:1A:7D:DA:71:13]
[Connect to #1]
Status: 🟢 Connected to PC1

PC2 → PC1: "Hey from Mac!"
PC1 → PC2: "Hi from Windows!"
```

---

## 📞 Quick Reference

### Bluetooth Server (PC1)
```bash
python src/gui/gui_chat.py
# Transport: Bluetooth → Mode: Server → START
```

### Bluetooth Client (PC2)
```bash
python src/gui/gui_chat.py
# Transport: Bluetooth → Mode: Client → SCAN → Select → CONNECT
```

### WiFi Hotspot Server (PC1)
```bash
# Manually create hotspot first
python src/gui/gui_chat.py
# Transport: WiFi Hotspot → Mode: Creator → START
```

### WiFi Hotspot Client (PC2)
```bash
# Connect to PC1's hotspot first
python src/gui/gui_chat.py
# Transport: WiFi Hotspot → Mode: Client → Enter IP → CONNECT
```

---

Built with ❤️ for true offline P2P communication
