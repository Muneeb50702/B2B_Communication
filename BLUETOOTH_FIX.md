# IMPORTANT: Bluetooth Installation Guide

## 🔴 Python 3.14 Compatibility Issue

PyBluez doesn't work with Python 3.14+ due to deprecated `use_2to3` directive.

### ✅ SOLUTIONS:

#### Option 1: WiFi Hotspot Mode (Works Now - No Extra Install)
**Recommended for Windows + Mac cross-platform**

- PC1: Create WiFi Hotspot in Windows Settings
- PC2: Connect to that hotspot
- Both run the app in WiFi mode
- **Fast and reliable!**

#### Option 2: Use Python 3.11 or 3.12
```bash
# Install Python 3.12 from python.org
# Then:
py -3.12 -m pip install pybluez
py -3.12 src/gui/gui_chat.py
```

#### Option 3: Windows-Only Bluetooth (socket-based)
The app will work in WiFi mode even without Bluetooth libraries.

---

## 📡 WiFi Hotspot Setup (EASY & FAST)

### Windows PC1 (Creates Hotspot):
1. Settings → Network & Internet → Mobile Hotspot
2. Toggle ON
3. Note the Network name and Password
4. Run app → WiFi Hotspot → Server mode
5. Your IP will be `192.168.137.1`

### Mac PC2 (Connects):
1. WiFi icon → Connect to Windows hotspot name
2. Enter password
3. Run app → WiFi Hotspot → Client mode
4. Enter `192.168.137.1` as target
5. Connect!

**Speed**: 50-100 Mbps (much faster than Bluetooth!)
**Range**: 30-100 meters

---

## 🎯 Recommendation

**Use WiFi Hotspot mode** - it's:
- ✅ Faster than Bluetooth
- ✅ Works with Python 3.14
- ✅ No extra libraries needed
- ✅ Better range
- ✅ Cross-platform Windows ↔ Mac

You already have everything needed!

---

## 📝 Quick Start (WiFi Mode)

```bash
# PC1 (Windows)
python src/gui/gui_chat.py
# Select: WiFi Hotspot → Server → START

# PC2 (Mac)
python src/gui/gui_chat.py
# Select: WiFi Hotspot → Client → Enter 192.168.137.1 → CONNECT
```

Done! Start chatting. 🚀
