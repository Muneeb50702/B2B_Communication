# B2B_Communication — Direct P2P Mesh Network

**TRUE Peer-to-Peer**: PC-to-PC communication without WiFi router or internet

This repository contains a cross-platform mesh messaging network that enables direct device-to-device communication using **Bluetooth** or **WiFi Hotspot** mode. No common network required - devices connect directly to each other.

## ✨ Key Features

🔵 **Bluetooth P2P** - Direct PC ↔ PC via Bluetooth (Windows, Mac, Linux)  
📡 **WiFi Hotspot Mode** - One PC creates hotspot, others connect  
🌐 **Cross-Platform** - Windows ↔ Mac ↔ Linux compatibility  
🎨 **Cyberpunk GUI** - Terminal-themed chat interface  
⚡ **Zero Config** - Auto-discovery via Bluetooth scanning  
🔒 **Offline-First** - No internet or router needed

## 🎯 Use Cases

- Chat between two PCs directly (no router)
- Offline communication in areas without infrastructure
- Emergency/disaster communication
- Learning mesh networking concepts
- Foundation for mobile mesh (Android/iOS planned)

## 📦 Quick Start

### 1. Install Dependencies

**Windows:**
```bash
pip install pybluez
```

**Mac:**
```bash
pip install pybluez2
# If above fails, try: pip install bleak
```

**Linux:**
```bash
sudo apt-get install bluetooth libbluetooth-dev
pip install pybluez
```

### 2. Run on PC 1 (Server Mode)

```bash
cd B2B_Communication
python src/gui/gui_chat.py
```

In the dialog:
- Node ID: `PC1`
- Transport: **🔵 Bluetooth**
- Mode: **📍 Server (Wait)**
- Click **⚡ START**

Status shows: `🟢 CONNECTED` and waits for connections.

### 3. Run on PC 2 (Client Mode)

```bash
cd B2B_Communication
python src/gui/gui_chat.py
```

In the dialog:
- Node ID: `PC2`
- Transport: **🔵 Bluetooth**
- Mode: **🔍 Client (Connect)**
- Click **🔍 SCAN DEVICES**
- Select PC1 from the list
- Click **⚡ START / CONNECT**

### 4. Chat!

- Both PCs now show each other in "CONNECTED PEERS"
- Type recipient name (e.g., `PC1`) in the TO field
- Type your message and press Enter
- Messages appear instantly on both sides

**Pro Tip**: Double-click a peer name to auto-fill the recipient field!

---

## 🔌 Connection Methods

### Option 1: Bluetooth (Recommended)
- **Range**: 10-30 meters
- **Setup**: Just enable Bluetooth
- **Speed**: ~1-3 Mbps
- **Works**: Windows ↔ Mac ↔ Linux ✅

### Option 2: WiFi Hotspot (Faster)
- **Range**: 30-100 meters
- **Setup**: PC1 creates hotspot manually in OS
- **Speed**: ~50-100 Mbps
- **Works**: Windows ↔ Mac ↔ Linux ✅

See `DIRECT_P2P_GUIDE.md` for detailed WiFi Hotspot setup.

---

## 📁 Project Structure

```
B2B_Communication/
├── src/
│   ├── mesh/
│   │   ├── mesh_node.py         # Core UDP mesh logic (multi-hop)
│   │   ├── p2p_transport.py     # Bluetooth & WiFi transports
│   │   └── run_node.py          # CLI runner
│   └── gui/
│       └── gui_chat.py          # Main GUI application
├── tests/
│   ├── test_simulation.py       # Multi-hop mesh tests
│   └── run_sim.py               # Quick demo runner
├── DIRECT_P2P_GUIDE.md          # Detailed setup guide
├── SETUP_GUI.md                 # Original LAN setup (legacy)
├── requirements.txt             # Python dependencies
└── README.md                    # This file
```

## 🔧 Troubleshooting

### "Bluetooth not available"
- **Windows**: Check Device Manager → Bluetooth is enabled
- **Mac**: System Preferences → Bluetooth → ON
- **Install library**: See installation commands above

### "No devices found during scan"
- Ensure both PCs have Bluetooth ON
- Start PC1 in Server mode first, then scan from PC2
- Keep PCs within 5-10 meters during initial connection
- On Mac, grant Terminal bluetooth permissions

### "Permission denied" (Mac/Linux)
- **Mac**: System Preferences → Security & Privacy → Bluetooth → Allow Terminal
- **Linux**: Add user to bluetooth group: `sudo usermod -a -G bluetooth $USER`

### WiFi Hotspot not working?
See `DIRECT_P2P_GUIDE.md` for platform-specific hotspot setup.

---

## 🎨 GUI Preview

```
┌──────────────────────────────────────────────────────────────────┐
│ 🟢 CONNECTED                          Node: PC1                  │
├───────────────────────────────────────────┬──────────────────────┤
│ █ MESSAGE STREAM                          │ █ CONNECTED PEERS    │
│                                           │ ● PC2                │
│ [10:30:15] You → PC2: Hello!             │                      │
│ [10:30:16] PC2 → You: Hi from Mac!       │ █ CONNECTION INFO    │
│                                           │ Node ID: PC1         │
│                                           │ Transport: BLUETOOTH │
│                                           │ Mode: SERVER         │
├───────────────────────────────────────────┤ Status: Active       │
│ █ COMPOSE MESSAGE                         │ Library: pybluez     │
│ TO:  [PC2                          ]      │                      │
│ MSG: [Type here...              ] ⚡ SEND │ Direct P2P           │
└───────────────────────────────────────────┴──────────────────────┤
│ ⚡ Sent to PC2                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Colors**: Cyberpunk theme with Matrix green, cyan, and dark navy background

---

## 🔐 Security Status

⚠️ **Current Version (MVP)**: 
- No encryption (messages visible to anyone in range)
- No authentication (anyone can impersonate nodes)
- **Use only in trusted environments**

**Planned Security Features**:
- [ ] AES-256 end-to-end encryption
- [ ] HMAC message authentication
- [ ] Replay protection (nonce + timestamps)
- [ ] Perfect Forward Secrecy (Noise protocol)
- [ ] Key exchange and verification

---

## 📊 Performance

| Metric | Bluetooth | WiFi Hotspot |
|--------|-----------|--------------|
| Bandwidth | 1-3 Mbps | 50-100 Mbps |
| Latency | 50-100ms | 5-20ms |
| Range | 10-30m | 30-100m |
| Setup | Easy ✅ | Medium ⚠️ |
| Battery | Medium | High 🔋 |

---

## 🚀 Roadmap

### Phase 1: Core P2P (✅ DONE)
- [x] Bluetooth transport (RFCOMM)
- [x] WiFi Hotspot mode
- [x] Cross-platform GUI
- [x] Auto-discovery

### Phase 2: Security (In Progress)
- [ ] End-to-end encryption
- [ ] Hop-by-hop authentication
- [ ] Key management
- [ ] Replay protection

### Phase 3: Multi-Hop Mesh
- [ ] Multi-hop routing (A→B→C)
- [ ] Controlled flooding
- [ ] Store-and-forward
- [ ] Mesh healing

### Phase 4: Mobile
- [ ] Android app (Bluetooth + WiFi Direct)
- [ ] iOS app (MultipeerConnectivity)
- [ ] Desktop ↔ Mobile communication

### Phase 5: Advanced
- [ ] File transfer
- [ ] Voice messages
- [ ] Group chat
- [ ] Offline message queue

---

## 📱 Platform Status

| Platform | Bluetooth | WiFi Hotspot | Status |
|----------|-----------|--------------|--------|
| Windows 10/11 | ✅ | ✅ | Fully tested |
| macOS | ✅ | ✅ | Tested on Monterey+ |
| Linux | ✅ | ✅ | Tested on Ubuntu 22.04 |
| Android | 🔄 | 🔄 | Planned |
| iOS | 🔄 | ❌ | Planned (BT only) |

---

## 🤝 Contributing

This is an educational project. Contributions welcome!

Areas to help:
- Test on different OS versions
- Improve Bluetooth stability
- Add encryption layer
- Mobile app development
- Documentation improvements

---

## 📄 License

MIT License - Free for educational and personal use

---

## 📞 Quick Reference Card

### Bluetooth Setup
```bash
# PC1 (any platform)
python src/gui/gui_chat.py
# → Bluetooth → Server → START

# PC2 (any platform)
python src/gui/gui_chat.py
# → Bluetooth → Client → SCAN → Select PC1 → CONNECT
```

### WiFi Hotspot Setup
```bash
# PC1: Create hotspot in OS first, then:
python src/gui/gui_chat.py
# → WiFi Hotspot → Server → START

# PC2: Connect to PC1's hotspot in OS, then:
python src/gui/gui_chat.py
# → WiFi Hotspot → Client → Enter IP → CONNECT
```

### Requirements
- Python 3.7+
- Windows: `pip install pybluez`
- Mac: `pip install pybluez2`
- Linux: `pip install pybluez`

---

Built with ❤️ for offline communication everywhere 🌍

