# Troubleshooting Guide

## Issue: Phone with hotspot shows "127.0.0.1" or can't discover peers

**What happened:**
- Phone 1 (hotspot): Shows "Running on 127.0.0.1:9999" 
- Phone 2: Shows "Running on 10.168.x.x:9999"
- Phone 2 sees Phone 1, but Phone 1 can't see Phone 2
- Messages fail to send

**Root Cause:**
The IP detection method tried to connect to internet (8.8.8.8), which fails when hotspot is active without data connection.

**Fix Applied (v2):**
Updated `mesh_chat_termux.py` with:
1. Multiple IP detection methods
2. Parse `ip addr` command to find real network interface IPs
3. Removed IP-based packet filtering (was blocking legitimate packets)
4. Better handling of hotspot IP ranges (192.168.x.x, 10.x.x.x)

---

## How to Update and Test Again

On both phones in Termux:

```bash
cd ~/B2B_Communication
git pull
python mesh_chat_termux.py
```

**Expected Output Now:**

**Phone 1 (hotspot):**
```
Your ID: User_FBCF28
Starting mesh node...
✓ Running on 192.168.43.1:9999  ← Should show real hotspot IP now
✓ Searching for nearby devices...
```

**Phone 2 (connected):**
```
Your ID: User_774454
Starting mesh node...
✓ Running on 10.168.206.161:9999  ← Your actual IP on the hotspot
✓ Searching for nearby devices...
```

**Within 3-10 seconds:**
Both phones should see:
```
✓ Found: User_XXXXXX
```

---

## Testing Steps

1. **Check IPs are correct:**
   - Neither phone should show `127.0.0.1`
   - Hotspot phone typically shows: `192.168.43.1` or `192.168.x.1`
   - Connected phone shows: `192.168.43.x` or `10.168.x.x`

2. **Wait for discovery:**
   - Type `/list` on both phones after 10 seconds
   - Both should see each other

3. **Test messaging:**
   ```
   Phone 1: /send User_774454
   Phone 1: hello from phone 1
   ```
   Phone 2 should receive it immediately

4. **Test reverse:**
   ```
   Phone 2: /send User_FBCF28
   Phone 2: hello back!
   ```
   Phone 1 should receive it

---

## Still Having Issues?

### Check Network Connectivity

On both phones, open a NEW Termux window (swipe from left) and run:

```bash
# See your IP address
ip addr | grep inet

# Check if you can ping broadcast
ping -c 3 255.255.255.255

# Check what's listening on port 9999
ss -ulnp | grep 9999
```

### Verify Both on Same Network

```bash
# On Phone 2, ping Phone 1's hotspot gateway
ping -c 3 192.168.43.1
```

### Check Firewall/Permissions

```bash
# Make sure Termux has network permissions
termux-setup-storage
```

### Manual IP Test

If you know both phone IPs, you can test UDP directly:

**Phone 1:**
```bash
# Listen for UDP packets
nc -ul 9999
```

**Phone 2:**
```bash
# Send test packet (replace with Phone 1's IP)
echo "test" | nc -u 192.168.43.1 9999
```

Phone 1 should display "test"

---

## Common Errors

### "Failed to send"
- Recipient is not in peer list
- Use `/list` first to confirm peer is online
- Wait 5-10 seconds after starting both apps

### "No users found yet"
- Peers haven't discovered each other
- Check both phones show correct IPs (not 127.0.0.1)
- Verify both on same WiFi network
- Try restarting both apps

### "User 'User_XXXXX' not found"
- Typo in username
- Copy/paste the exact ID from `/list` output
- IDs are case-sensitive

---

## Debug Mode

To see what's happening, add debug output:

On any phone, open Python and test:

```python
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
s.bind(('', 9999))
s.settimeout(5)

print("Listening for broadcasts...")
try:
    data, addr = s.recvfrom(1024)
    print(f"Received from {addr}: {data}")
except:
    print("No broadcasts received")
s.close()
```

This will show if broadcasts are working at all.

---

## Success Indicators

✅ **Working correctly when you see:**
1. Both phones show real IP addresses (not 127.0.0.1)
2. Both phones discover each other within 10 seconds
3. `/list` shows peers on both sides
4. Messages send and receive instantly
5. No "Failed to send" errors

---

## Next Steps After It Works

Once basic messaging works:
1. Test with 3 phones (multi-hop routing)
2. Try moving phones apart (test range)
3. Test message forwarding (A → B → C)
4. Stress test with rapid messages
5. Test reconnection after one phone disconnects

---

## Report Issues

If still not working after trying everything:
1. Run `ip addr` on both phones and note the output
2. Run `ss -ulnp | grep 9999` on both phones
3. Try the manual UDP test with `nc`
4. Check if Android has any battery optimization blocking Termux

Post the results and we'll debug further!
