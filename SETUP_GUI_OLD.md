# 🚀 GUI Chat - Direct P2P Setup Guide# Mesh Chat GUI - Setup & Usage Guide



## ✅ YOUR PROJECT IS RUNNING!## 🌐 What You Need



**Congratulations!** The GUI is working. Now let's connect your two PCs **directly** (no router needed).### Requirements

- **WiFi Network**: Both PCs must be on the **same WiFi network** (home router, office WiFi, etc.)

---- **No Internet Required**: The chat works purely over your local network (LAN)

- **Python 3.7+**: Standard library only (tkinter is built-in)

## 📋 STEP-BY-STEP: Connect Two PCs- **Firewall**: May need to allow Python or the specific port (default: 5000)



### **PHASE 1: PC1 (Windows - Hotspot Creator)**### Connection Methods Supported

✅ **WiFi (LAN)** - Currently implemented (UDP broadcast over local network)  

#### 1️⃣ Create WiFi Hotspot⏳ **Bluetooth** - Planned for future (requires different libraries like pybluez/bleak)



**Windows 10/11 GUI Method:**---

```

Settings → Network & Internet → Mobile hotspot## 🚀 How to Run

→ Turn ON

→ Set Network name: MeshNet### Step 1: Clone Repo on Both PCs

→ Set Password: password123```bash

```# PC 1 and PC 2

cd Desktop

**OR Command Line Method (Run as Admin):**git clone <your-repo-url> CN_Project

```bashcd CN_Project

netsh wlan set hostednetwork mode=allow ssid=MeshNet key=password123```

netsh wlan start hostednetwork

```### Step 2: Get IP Address of First PC



✅ **Your PC1 IP will ALWAYS be:** `192.168.137.1`**On PC 1** (Windows):

```bash

#### 2️⃣ Verify Hotspot is Runningipconfig

```

```bashLook for "IPv4 Address" under your WiFi adapter, e.g., `192.168.1.100`

ipconfig

```**On PC 1** (Linux/Mac):

```bash

Look for "Wireless LAN adapter Local Area Connection*":ip addr show

```# or

IPv4 Address: 192.168.137.1ifconfig

Subnet Mask: 255.255.255.0```

```

### Step 3: Start GUI on PC 1 (First Node)

#### 3️⃣ Launch GUI on PC1

```bash

```bashpython src/gui/gui_chat.py

cd C:/Users/Possible/OneDrive/Desktop/CN_Project/B2B_Communication```

python src/gui/gui_chat.py

```In the connection dialog:

- **Your Node ID**: `PC1` (or any name)

#### 4️⃣ Configure as SERVER- **Listen Port**: `5000`

- **Seed Peer**: Leave empty or delete placeholder

When the connection dialog appears:- Click **CONNECT**



- **Your Node ID**: `PCDESKTOP` (or any name)The GUI will show:

- **Mode**: Select **"♦♦♦ Server (Wait)"**- Status: 🟢 CONNECTED

- Click **"⚡ START / CONNECT"**- Network Info panel will show your IP (e.g., `192.168.1.100`)



✅ **Status should turn green:** `♦♦♦ CONNECTED`### Step 4: Start GUI on PC 2 (Second Node)



**Keep this window open!** PC1 is now waiting for PC2 to connect.```bash

python src/gui/gui_chat.py

---```



### **PHASE 2: PC2 (Mac or Windows - Client)**In the connection dialog:

- **Your Node ID**: `PC2` (different from PC1)

#### 1️⃣ Connect to PC1's Hotspot- **Listen Port**: `5000` (same port is fine)

- **Seed Peer**: `192.168.1.100:5000` (use PC1's IP from Step 2)

**On Mac:**- Click **CONNECT**

```

WiFi menu → Select "MeshNet" → Enter password123Within a few seconds, you should see:

```- PC1's peer list shows: `● PC2`

- PC2's peer list shows: `● PC1`

**On Windows:**

```### Step 5: Send Messages

WiFi icon → Available networks → "MeshNet" → Connect → Enter password123

```**On PC 1:**

1. In the "TO:" field, type `PC2`

#### 2️⃣ Verify You're Connected2. In the "MSG:" field, type your message

3. Press Enter or click **SEND**

**Check your IP address:**

**On PC 2:**

**Mac:**- The message will appear in the chat area instantly

```bash

ifconfig | grep "inet "**Quick Tip**: Double-click a peer name in the "CONNECTED PEERS" list to auto-fill the recipient field!

# Should show: inet 192.168.137.X (X = 2, 3, 4, etc.)

```---



**Windows:**## 🎨 GUI Features

```bash

ipconfig### Terminal/Cyberpunk Theme

# Look for IPv4 Address: 192.168.137.X- Dark background with cyan/green accents

```- Monospace Consolas font

- Real-time message stream

**Test connectivity to PC1:**- Live peer discovery

```bash

ping 192.168.137.1### Panels

# Should get replies! (10-50ms)1. **Message Stream** (left) - Shows all incoming/outgoing messages with timestamps

```2. **Connected Peers** (right top) - Live list of discovered nodes on network

3. **Network Info** (right bottom) - Your IP, port, protocol details

✅ If you see replies, you're connected!4. **Compose Message** (bottom left) - Recipient and message input



#### 3️⃣ Launch GUI on PC2### Status Indicators

- 🟢 CONNECTED - Node is active

**On Mac:**- ⚫ DISCONNECTED - Not yet connected

```bash- [SYS] - System messages

cd ~/Desktop/B2B_Communication- [ERR] - Error messages

python3 src/gui/gui_chat.py

```---



**On Windows:**## 🔧 Troubleshooting

```bash

cd Desktop/B2B_Communication### "Peers not showing up"

python src/gui/gui_chat.py

```**Check same network:**

```bash

#### 4️⃣ Configure as CLIENT# PC 1

ipconfig

When the connection dialog appears:# Note the "Default Gateway" (e.g., 192.168.1.1)



- **Your Node ID**: `PCMACBOOK` (or any different name)# PC 2

- **Mode**: Select **"♦♦ Client (Connect)"**ipconfig

- **Hotspot IP**: Enter `192.168.137.1`# Should show SAME gateway

- Click **"⚡ START / CONNECT"**```



✅ **Status should turn green:** `♦♦♦ CONNECTED`**Check firewall:**

- Windows: Settings → Privacy & Security → Windows Security → Firewall → Allow an app

---- Add Python or allow port 5000 (UDP)



## 💬 Test the Connection!**Manually test connectivity:**

```bash

### Send Messages Between PCs# On PC 1

python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.bind(('0.0.0.0', 5000)); print('Listening...'); s.recvfrom(1024)"

**On PC1 (PCDESKTOP):**

1. Type in the message box: `Hello from Windows!`# On PC 2

2. Click **⚡ SEND**python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.sendto(b'test', ('192.168.1.100', 5000)); print('Sent')"

```

**On PC2 (PCMACBOOK):**

- You should instantly see: `[PCDESKTOP] Hello from Windows!`### "Connection refused"

- Ensure both PCs are on WiFi (not one on Ethernet, one on WiFi)

**Now reply from PC2:**- Try disabling VPN on both machines

1. Type: `Hey from Mac! Connection works!`- Use a different port if 5000 is blocked: change both to `5001`

2. Click **⚡ SEND**

### "Messages not arriving"

**On PC1:**- Check TTL (Time To Live) - default is 7 hops, should be plenty

- You should see: `[PCMACBOOK] Hey from Mac! Connection works!`- Look for [SYS] messages in chat for routing info

- Try restarting both nodes

### Check Peer List

---

- **PC1 peer list** should show: `PCMACBOOK`

- **PC2 peer list** should show: `PCDESKTOP`## 🔐 Security Notes (Current MVP)



---⚠️ **This is a proof-of-concept**:

- No encryption yet (messages sent in plain text over LAN)

## 🎉 SUCCESS! What Just Happened?- No authentication (any node with your IP can send you messages)

- Suitable for **trusted local networks only**

### You Built a TRUE P2P Mesh Network!

**Planned security features** (coming soon):

```- Hop-by-hop HMAC authentication

┌─────────────────────────┐- End-to-end encryption (Noise protocol)

│   PC1 (Windows)         │- Replay protection (sequence numbers + nonces)

│   PCDESKTOP             │- Key exchange and verification

│   192.168.137.1:5000    │

│   ♦♦♦ SERVER MODE       │---

│   [WiFi Hotspot ON]     │

└───────────┬─────────────┘## 📡 Network Architecture

            │

            │ WiFi Direct```

            │ NO ROUTER!PC 1 (192.168.1.100:5000)          PC 2 (192.168.1.105:5000)

            │ NO INTERNET!     │                                    │

            │     │  1. HELLO handshake (UDP)          │

┌───────────▼─────────────┐     │ ──────────────────────────────────>│

│   PC2 (Mac/Windows)     │     │                                    │

│   PCMACBOOK             │     │  2. HELLO response                 │

│   192.168.137.X:5000    │     │ <──────────────────────────────────│

│   ♦♦ CLIENT MODE        │     │                                    │

│   [Connected to PC1]    │     │  3. DATA message                   │

└─────────────────────────┘     │ ──────────────────────────────────>│

```     │                                    │

     │  4. ACK acknowledgment             │

### How It Works:     │ <──────────────────────────────────│

```

1. **PC1 creates WiFi hotspot** → Becomes mini access point

2. **PC2 connects to PC1's hotspot** → Like connecting to WiFi router**Packet Format** (JSON over UDP):

3. **BUT** there's no router! PC1 IS the network```json

4. **Direct UDP communication** → Messages go straight PC1 ↔ PC2{

5. **No internet needed** → Pure local P2P communication  "type": "DATA",

  "msg_id": "PC1:1:abc123",

---  "source": "PC1",

  "dest": "PC2",

## 🔧 Troubleshooting  "ttl": 7,

  "payload": "Hello!",

### ❌ "Connection failed" on PC2  "timestamp": 1699123456.789

}

**Check 1: Is hotspot running?**```

```bash

# On PC1 (Windows):---

netsh wlan show hostednetwork

```## 🔮 Future Enhancements

Should say: `Status: Started`

### Transport Options

**Fix:** Restart hotspot- [x] WiFi LAN (UDP)

```bash- [ ] Bluetooth Classic (pybluez)

netsh wlan stop hostednetwork- [ ] Bluetooth LE Mesh (bleak)

netsh wlan start hostednetwork- [ ] WiFi Direct (Android/Linux)

```- [ ] USB tethering fallback



**Check 2: Is PC2 connected to hotspot?**### Features

```bash- [ ] File transfer

# On PC2:- [ ] Group chat (broadcast)

ping 192.168.137.1- [ ] Offline message queue

```- [ ] Voice messages (audio)

Should get replies.- [ ] Contact list with nicknames

- [ ] Message read receipts

**Fix:** Reconnect to WiFi hotspot "MeshNet"- [ ] Typing indicators



**Check 3: Firewall blocking?**---

- Windows Defender Firewall → Allow an app

- Add: `python.exe` and `pythonw.exe`## 📞 Quick Reference

- Allow: Private and Public networks

### Keyboard Shortcuts

### ❌ "No peers found"- `Enter` in message field → Send message

- `Ctrl+Q` → Quit (planned)

**Solution: Start in correct order!**

1. PC1 (Server) FIRST### Commands

2. Wait 5 seconds- Double-click peer → Auto-fill recipient

3. PC2 (Client) SECOND- Messages auto-scroll to bottom



**Check port 5000 is open:**### Default Ports

```bash- UDP: `5000` (configurable in connection dialog)

# On PC1:

netstat -an | findstr 5000---

# Should show: 0.0.0.0:5000

```## Example Session



### ❌ GUI won't start**PC 1 Terminal:**

```bash

**Verify Python and tkinter:**$ python src/gui/gui_chat.py

```bash[GUI opens]

python --version# Enter: Node ID = "Alice", Port = 5000, Seed = <empty>

# Should be 3.7+# Click CONNECT

```

python -m tkinter

# Should open test window**PC 2 Terminal:**

``````bash

$ python src/gui/gui_chat.py

**Check file location:**[GUI opens]

```bash# Enter: Node ID = "Bob", Port = 5000, Seed = "192.168.1.100:5000"

pwd# Click CONNECT

# Should be: .../B2B_Communication```



ls src/gui/**PC 1 GUI:**

# Should show: gui_chat.py```

```█ CONNECTED PEERS

  ● Bob

---

TO: Bob

## 📱 Quick Reference CardMSG: Hey Bob, can you see this?

[Press Enter]

| Step | PC1 (Windows) | PC2 (Mac/Windows) |

|------|---------------|-------------------|[10:30:15] You → Bob: Hey Bob, can you see this?

| **1. Network** | Create hotspot "MeshNet" | Connect to "MeshNet" |```

| **2. IP** | Always 192.168.137.1 | Auto: 192.168.137.X |

| **3. Launch** | `python src/gui/gui_chat.py` | `python src/gui/gui_chat.py` |**PC 2 GUI:**

| **4. Mode** | Select "Server (Wait)" | Select "Client (Connect)" |```

| **5. IP Field** | N/A (server doesn't need target) | Enter `192.168.137.1` |█ CONNECTED PEERS

| **6. Click** | START / CONNECT | START / CONNECT |  ● Alice

| **7. Status** | ♦♦♦ CONNECTED (green) | ♦♦♦ CONNECTED (green) |

[10:30:15] Alice → You: Hey Bob, can you see this?

---

TO: Alice

## 🎓 What You've LearnedMSG: Yes! This is awesome!

[Press Enter]

### This Project Demonstrates:```



✅ **Direct P2P Communication** - No central server, no router  ---

✅ **WiFi Hotspot Mode** - Turn PC into access point  

✅ **UDP Broadcasting** - Fast connectionless protocol  Enjoy your offline mesh network! 🌐⚡

✅ **Peer Discovery** - Automatic HELLO handshakes  
✅ **Real-time Messaging** - Instant delivery  
✅ **Cross-platform** - Python works on Windows + Mac  
✅ **Foundation for Mesh** - Ready to add multi-hop relay

### Real-World Applications:

🌍 **Disaster Recovery** - Communication when internet is down  
🔒 **Privacy** - Messages never leave your devices  
🏕️ **Remote Areas** - Chat without cell service  
🎮 **LAN Gaming** - Low-latency direct connections  
📚 **Learning** - Understand networking fundamentals  

---

## 🚀 Next Steps (Future Enhancements)

### Phase 2: Security 🔐
- [ ] End-to-end encryption (AES-256)
- [ ] Public key authentication
- [ ] Message signing with HMAC
- [ ] Replay attack protection

### Phase 3: Multi-Hop Routing 🛣️
- [ ] A → B → C relay
- [ ] Automatic route discovery (AODV)
- [ ] Load balancing across paths
- [ ] Route maintenance

### Phase 4: Mobile Apps 📱
- [ ] Android app (Kotlin + WiFi Direct)
- [ ] iOS app (Swift + Multipeer Connectivity)
- [ ] Bluetooth Low Energy
- [ ] Cross-device messaging

### Phase 5: Features ✨
- [ ] File transfer
- [ ] Group chat (broadcast)
- [ ] Voice messages
- [ ] Offline message queue
- [ ] Read receipts

---

## ✅ Success Checklist

Before moving to Phase 2, verify:

- [x] Python 3.14 installed
- [x] tkinter working
- [x] GUI launches successfully
- [ ] PC1 hotspot created (192.168.137.1)
- [ ] PC2 connected to hotspot
- [ ] PC1 shows "CONNECTED" status
- [ ] PC2 shows "CONNECTED" status
- [ ] PC1 sees PC2 in peer list
- [ ] PC2 sees PC1 in peer list
- [ ] Message from PC1 appears on PC2
- [ ] Message from PC2 appears on PC1
- [ ] No firewall errors

---

## 🎯 Commands Cheat Sheet

### PC1 (Windows - Server)
```bash
# 1. Create hotspot
netsh wlan set hostednetwork mode=allow ssid=MeshNet key=password123
netsh wlan start hostednetwork

# 2. Check IP (should be 192.168.137.1)
ipconfig

# 3. Launch GUI
cd C:/Users/Possible/OneDrive/Desktop/CN_Project/B2B_Communication
python src/gui/gui_chat.py
```

### PC2 (Mac - Client)
```bash
# 1. Connect to WiFi "MeshNet" via GUI

# 2. Check connection
ping 192.168.137.1

# 3. Launch GUI
cd ~/Desktop/B2B_Communication
python3 src/gui/gui_chat.py
```

### PC2 (Windows - Client)
```bash
# 1. Connect to WiFi "MeshNet" via Settings

# 2. Check connection
ping 192.168.137.1

# 3. Launch GUI
cd Desktop/B2B_Communication
python src/gui/gui_chat.py
```

---

## 💡 Pro Tips

1. **Keep PC1 as Server** - Windows hotspot is most reliable
2. **Client can be any OS** - Mac, Windows, Linux all work
3. **Port 5000** - Make sure firewall allows UDP on this port
4. **Restart order matters** - Always start Server first, Client second
5. **Static IP** - PC1 is always 192.168.137.1 (reliable!)
6. **Multiple clients** - Can connect 3rd, 4th PC... all use 192.168.137.1

---

**YOU DID IT! 🎉 Now go test it with your two PCs!**

If you have any issues, check the troubleshooting section or ask for help.

**Happy Meshing! 🌐⚡**
