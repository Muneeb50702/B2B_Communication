# Web Mesh Chat Setup

Beautiful web-based mesh chat with real-time GUI!

## Features
✨ Beautiful modern UI
🔄 Real-time updates via WebSocket
📱 Works on PC, Mac, Linux, and Android (Termux)
🌐 Access from any device on your network
👥 Visual peer list with live updates
💬 Chat history and timestamps

---

## Quick Start (PC/Mac/Linux)

### 1. Install Dependencies
```bash
pip install fastapi uvicorn websockets
```

Or use requirements file:
```bash
pip install -r requirements_web.txt
```

### 2. Run the Server
```bash
python web_mesh_chat.py
```

### 3. Open in Browser
```
http://localhost:8000
```

That's it! 🎉

---

## Setup on Android (Termux)

### 1. Install Termux and Clone Repo
```bash
pkg install python git
cd ~
git clone https://github.com/Muneeb50702/B2B_Communication.git
cd B2B_Communication
```

### 2. Install Dependencies
```bash
pip install fastapi uvicorn websockets
```

### 3. Run the Server
```bash
python web_mesh_chat.py
```

### 4. Open in Android Browser
The script will show you the URL. Example:
```
🚀 Open in browser: http://localhost:8000
📱 On same network: http://192.168.1.100:8000
```

Open Chrome/Firefox on your phone and go to that URL!

---

## Testing with Multiple Devices

### Scenario 1: PC + Phone
1. **PC**: Run `python web_mesh_chat.py`
2. **Phone**: Connect to same WiFi
3. **Phone**: Open browser to `http://<PC_IP>:8000`
4. Both will discover each other automatically!

### Scenario 2: Multiple PCs
1. **PC 1**: Run on port 8000
2. **PC 2**: Run on port 8001 (avoid conflict)
   ```bash
   python web_mesh_chat.py 8001
   ```
3. Open browsers on both PCs

### Scenario 3: Phone Hotspot + Multiple Phones
1. **Phone 1**: Create hotspot
2. **Phone 1**: Run web_mesh_chat.py in Termux
3. **Phone 2**: Connect to Phone 1's hotspot
4. **Phone 2**: Run web_mesh_chat.py in Termux (port 8001)
5. Both phones open their respective URLs in browser

---

## Usage

### Chatting
1. Wait for "Online Users" list to populate
2. Click on a user to select them
3. Type message and press Enter or click Send

### Broadcasting
1. Click "📢 Broadcast to All" button
2. Type message
3. All connected users receive it

### Features
- **Auto-discovery**: Peers appear automatically
- **Live status**: See who's online in real-time
- **Multi-hop**: Messages route through intermediate nodes
- **Visual feedback**: Sent messages appear instantly

---

## Troubleshooting

### "Port already in use"
Run on different port:
```bash
python web_mesh_chat.py 8001
```

### "No peers found"
- Ensure all devices on same WiFi
- Check firewall isn't blocking port 9999 (UDP)
- Wait 10 seconds for discovery

### Can't access from other device
- Use the IP shown in console (not localhost)
- Make sure device is on same network
- Check firewall settings

### On Android/Termux
If pip install fails:
```bash
pkg install python-pip
pip install --upgrade pip
pip install fastapi uvicorn websockets
```

---

## Architecture

```
┌─────────────────┐
│   Web Browser   │  ← Beautiful GUI
│  (localhost:8000) │
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│  FastAPI Server │  ← Web server
│   (Port 8000)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Mesh Node     │  ← Same UDP mesh logic
│   (Port 9999)   │     as terminal version
└─────────────────┘
         │
         ▼
  UDP Broadcasts
  (Auto-discovery)
```

---

## Advantages Over Terminal Version

✅ **Better UX**: Click instead of typing commands
✅ **Visual**: See online status at a glance
✅ **History**: Scrollable chat history
✅ **Multi-device**: Open on phone AND PC simultaneously
✅ **Accessible**: Use from any browser on network

---

## Example Session

1. Start server:
```bash
$ python web_mesh_chat.py
Enter your username: Alice

============================================================
  🌐 Mesh Chat Web Interface
============================================================
  Node ID: Alice_A1B2C3
  Local IP: 192.168.1.100
  UDP Port: 9999

  🚀 Open in browser: http://localhost:8000
  📱 On same network: http://192.168.1.100:8000
============================================================
```

2. Open browser → Beautiful chat UI appears
3. Other devices connect → See them in "Online Users"
4. Click user → Start chatting!

---

## Network Diagram

```
   Alice (PC)               Bob (Phone)           Charlie (Laptop)
   ┌─────────┐             ┌──────────┐          ┌──────────┐
   │ Browser │             │  Browser │          │  Browser │
   │ :8000   │             │  :8000   │          │  :8001   │
   └────┬────┘             └─────┬────┘          └─────┬────┘
        │                        │                     │
        │    WiFi Network        │                     │
        └───────┬────────────────┴─────────────────────┘
                │
         UDP Broadcasts
         (Auto-discovery
          & Messaging)
```

---

## Next Steps

1. **Test it**: Run on your PC and phone
2. **Customize**: Edit HTML/CSS in web_mesh_chat.py
3. **Deploy**: Put on a server for permanent access
4. **Extend**: Add file sharing, voice notes, etc.

---

## Comparison

| Feature | Terminal Version | Web Version |
|---------|-----------------|-------------|
| Setup | Simple | Requires FastAPI |
| Interface | Text commands | Visual GUI |
| User-friendly | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Resource usage | Low | Medium |
| Mobile friendly | OK | Excellent |
| Multiple windows | No | Yes |

---

**Enjoy your mesh network with a beautiful web interface!** 🎨
