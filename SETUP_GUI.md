# Mesh Chat GUI - Setup & Usage Guide

## 🌐 What You Need

### Requirements
- **WiFi Network**: Both PCs must be on the **same WiFi network** (home router, office WiFi, etc.)
- **No Internet Required**: The chat works purely over your local network (LAN)
- **Python 3.7+**: Standard library only (tkinter is built-in)
- **Firewall**: May need to allow Python or the specific port (default: 5000)

### Connection Methods Supported
✅ **WiFi (LAN)** - Currently implemented (UDP broadcast over local network)  
⏳ **Bluetooth** - Planned for future (requires different libraries like pybluez/bleak)

---

## 🚀 How to Run

### Step 1: Clone Repo on Both PCs
```bash
# PC 1 and PC 2
cd Desktop
git clone <your-repo-url> CN_Project
cd CN_Project
```

### Step 2: Get IP Address of First PC

**On PC 1** (Windows):
```bash
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter, e.g., `192.168.1.100`

**On PC 1** (Linux/Mac):
```bash
ip addr show
# or
ifconfig
```

### Step 3: Start GUI on PC 1 (First Node)

```bash
python src/gui/gui_chat.py
```

In the connection dialog:
- **Your Node ID**: `PC1` (or any name)
- **Listen Port**: `5000`
- **Seed Peer**: Leave empty or delete placeholder
- Click **CONNECT**

The GUI will show:
- Status: 🟢 CONNECTED
- Network Info panel will show your IP (e.g., `192.168.1.100`)

### Step 4: Start GUI on PC 2 (Second Node)

```bash
python src/gui/gui_chat.py
```

In the connection dialog:
- **Your Node ID**: `PC2` (different from PC1)
- **Listen Port**: `5000` (same port is fine)
- **Seed Peer**: `192.168.1.100:5000` (use PC1's IP from Step 2)
- Click **CONNECT**

Within a few seconds, you should see:
- PC1's peer list shows: `● PC2`
- PC2's peer list shows: `● PC1`

### Step 5: Send Messages

**On PC 1:**
1. In the "TO:" field, type `PC2`
2. In the "MSG:" field, type your message
3. Press Enter or click **SEND**

**On PC 2:**
- The message will appear in the chat area instantly

**Quick Tip**: Double-click a peer name in the "CONNECTED PEERS" list to auto-fill the recipient field!

---

## 🎨 GUI Features

### Terminal/Cyberpunk Theme
- Dark background with cyan/green accents
- Monospace Consolas font
- Real-time message stream
- Live peer discovery

### Panels
1. **Message Stream** (left) - Shows all incoming/outgoing messages with timestamps
2. **Connected Peers** (right top) - Live list of discovered nodes on network
3. **Network Info** (right bottom) - Your IP, port, protocol details
4. **Compose Message** (bottom left) - Recipient and message input

### Status Indicators
- 🟢 CONNECTED - Node is active
- ⚫ DISCONNECTED - Not yet connected
- [SYS] - System messages
- [ERR] - Error messages

---

## 🔧 Troubleshooting

### "Peers not showing up"

**Check same network:**
```bash
# PC 1
ipconfig
# Note the "Default Gateway" (e.g., 192.168.1.1)

# PC 2
ipconfig
# Should show SAME gateway
```

**Check firewall:**
- Windows: Settings → Privacy & Security → Windows Security → Firewall → Allow an app
- Add Python or allow port 5000 (UDP)

**Manually test connectivity:**
```bash
# On PC 1
python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.bind(('0.0.0.0', 5000)); print('Listening...'); s.recvfrom(1024)"

# On PC 2
python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.sendto(b'test', ('192.168.1.100', 5000)); print('Sent')"
```

### "Connection refused"
- Ensure both PCs are on WiFi (not one on Ethernet, one on WiFi)
- Try disabling VPN on both machines
- Use a different port if 5000 is blocked: change both to `5001`

### "Messages not arriving"
- Check TTL (Time To Live) - default is 7 hops, should be plenty
- Look for [SYS] messages in chat for routing info
- Try restarting both nodes

---

## 🔐 Security Notes (Current MVP)

⚠️ **This is a proof-of-concept**:
- No encryption yet (messages sent in plain text over LAN)
- No authentication (any node with your IP can send you messages)
- Suitable for **trusted local networks only**

**Planned security features** (coming soon):
- Hop-by-hop HMAC authentication
- End-to-end encryption (Noise protocol)
- Replay protection (sequence numbers + nonces)
- Key exchange and verification

---

## 📡 Network Architecture

```
PC 1 (192.168.1.100:5000)          PC 2 (192.168.1.105:5000)
     │                                    │
     │  1. HELLO handshake (UDP)          │
     │ ──────────────────────────────────>│
     │                                    │
     │  2. HELLO response                 │
     │ <──────────────────────────────────│
     │                                    │
     │  3. DATA message                   │
     │ ──────────────────────────────────>│
     │                                    │
     │  4. ACK acknowledgment             │
     │ <──────────────────────────────────│
```

**Packet Format** (JSON over UDP):
```json
{
  "type": "DATA",
  "msg_id": "PC1:1:abc123",
  "source": "PC1",
  "dest": "PC2",
  "ttl": 7,
  "payload": "Hello!",
  "timestamp": 1699123456.789
}
```

---

## 🔮 Future Enhancements

### Transport Options
- [x] WiFi LAN (UDP)
- [ ] Bluetooth Classic (pybluez)
- [ ] Bluetooth LE Mesh (bleak)
- [ ] WiFi Direct (Android/Linux)
- [ ] USB tethering fallback

### Features
- [ ] File transfer
- [ ] Group chat (broadcast)
- [ ] Offline message queue
- [ ] Voice messages (audio)
- [ ] Contact list with nicknames
- [ ] Message read receipts
- [ ] Typing indicators

---

## 📞 Quick Reference

### Keyboard Shortcuts
- `Enter` in message field → Send message
- `Ctrl+Q` → Quit (planned)

### Commands
- Double-click peer → Auto-fill recipient
- Messages auto-scroll to bottom

### Default Ports
- UDP: `5000` (configurable in connection dialog)

---

## Example Session

**PC 1 Terminal:**
```bash
$ python src/gui/gui_chat.py
[GUI opens]
# Enter: Node ID = "Alice", Port = 5000, Seed = <empty>
# Click CONNECT
```

**PC 2 Terminal:**
```bash
$ python src/gui/gui_chat.py
[GUI opens]
# Enter: Node ID = "Bob", Port = 5000, Seed = "192.168.1.100:5000"
# Click CONNECT
```

**PC 1 GUI:**
```
█ CONNECTED PEERS
  ● Bob

TO: Bob
MSG: Hey Bob, can you see this?
[Press Enter]

[10:30:15] You → Bob: Hey Bob, can you see this?
```

**PC 2 GUI:**
```
█ CONNECTED PEERS
  ● Alice

[10:30:15] Alice → You: Hey Bob, can you see this?

TO: Alice
MSG: Yes! This is awesome!
[Press Enter]
```

---

Enjoy your offline mesh network! 🌐⚡
