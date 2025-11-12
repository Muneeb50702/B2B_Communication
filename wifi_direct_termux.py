#!/usr/bin/env python3
"""
WiFi Direct P2P Mesh Chat for Termux
Attempts to use WiFi Direct via multiple methods
"""

import socket
import json
import threading
import time
import uuid
import subprocess
import sys
from datetime import datetime

class WiFiDirectNode:
    def __init__(self, username):
        self.username = username
        self.node_id = f"{username}_{str(uuid.uuid4())[:8]}"
        self.peers = {}  # {node_id: {'ip': ..., 'username': ..., 'last_seen': ...}}
        self.message_ids_seen = set()
        self.sock = None
        self.running = False
        
        # WiFi Direct specific
        self.p2p_interface = None
        self.p2p_ip = None
        
    def detect_p2p_interface(self):
        """Try to detect WiFi Direct interface"""
        try:
            # Method 1: Check for p2p interface
            result = subprocess.run(['ip', 'addr'], capture_output=True, text=True)
            lines = result.stdout.split('\n')
            
            for line in lines:
                if 'p2p-wlan' in line or 'p2p0' in line:
                    # Found WiFi Direct interface
                    interface = line.split(':')[1].strip().split('@')[0]
                    print(f"✓ Found WiFi Direct interface: {interface}")
                    self.p2p_interface = interface
                    return True
                    
            print("✗ No WiFi Direct interface found")
            return False
            
        except Exception as e:
            print(f"✗ Error detecting P2P interface: {e}")
            return False
    
    def enable_wifi_direct(self):
        """Attempt to enable WiFi Direct"""
        print("\n[Attempting WiFi Direct Setup]")
        
        # Method 1: Check if wpa_cli is available
        try:
            result = subprocess.run(['which', 'wpa_cli'], capture_output=True, text=True)
            if result.returncode == 0:
                print("✓ wpa_cli found - attempting P2P setup")
                
                # Try to enable P2P
                commands = [
                    ['wpa_cli', 'p2p_find'],
                    ['wpa_cli', 'p2p_listen']
                ]
                
                for cmd in commands:
                    try:
                        result = subprocess.run(cmd, capture_output=True, text=True, timeout=2)
                        print(f"  {' '.join(cmd)}: {result.stdout.strip()}")
                    except:
                        pass
                        
        except Exception as e:
            print(f"✗ wpa_cli not available: {e}")
        
        # Method 2: Use Termux-API if available
        try:
            result = subprocess.run(['which', 'termux-wifi-connectioninfo'], 
                                   capture_output=True, text=True)
            if result.returncode == 0:
                print("✓ Termux-API found - checking WiFi status")
                result = subprocess.run(['termux-wifi-connectioninfo'], 
                                      capture_output=True, text=True)
                print(f"  WiFi Info: {result.stdout.strip()}")
        except:
            print("✗ Termux-API not available (install: pkg install termux-api)")
        
        # Method 3: Check current network interfaces
        self.detect_p2p_interface()
        
        # Fallback: Use any available network interface
        if not self.p2p_interface:
            print("\n[Falling back to standard WiFi networking]")
            return self.get_wifi_ip()
        
        return True
    
    def get_wifi_ip(self):
        """Get IP address from any available interface"""
        try:
            result = subprocess.run(['ip', 'addr'], capture_output=True, text=True)
            lines = result.stdout.split('\n')
            
            for i, line in enumerate(lines):
                # Look for wlan or p2p interfaces
                if any(x in line for x in ['wlan', 'p2p', 'eth']):
                    # Get the next few lines to find IP
                    for j in range(i, min(i+5, len(lines))):
                        if 'inet ' in lines[j] and '127.0.0.1' not in lines[j]:
                            ip = lines[j].strip().split()[1].split('/')[0]
                            print(f"✓ Using IP: {ip}")
                            self.p2p_ip = ip
                            return True
            
            print("✗ No valid IP address found")
            return False
            
        except Exception as e:
            print(f"✗ Error getting IP: {e}")
            return False
    
    def setup_socket(self):
        """Setup UDP socket for P2P communication"""
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            
            # Bind to all interfaces
            self.sock.bind(('', 9999))
            
            # Set timeout for non-blocking receives
            self.sock.settimeout(1.0)
            
            print(f"✓ Socket bound to port 9999")
            return True
            
        except Exception as e:
            print(f"✗ Socket setup failed: {e}")
            return False
    
    def start(self):
        """Start the WiFi Direct node"""
        print(f"\n{'='*50}")
        print(f"WiFi Direct Mesh Chat - {self.username}")
        print(f"Node ID: {self.node_id}")
        print(f"{'='*50}\n")
        
        # Try WiFi Direct, fallback to regular WiFi
        if not self.enable_wifi_direct():
            print("\n⚠ WiFi Direct not available - using standard WiFi")
            if not self.get_wifi_ip():
                print("\n✗ No network connection available!")
                return False
        
        if not self.setup_socket():
            return False
        
        self.running = True
        
        # Start background threads
        threading.Thread(target=self._receive_loop, daemon=True).start()
        threading.Thread(target=self._heartbeat_loop, daemon=True).start()
        threading.Thread(target=self._cleanup_loop, daemon=True).start()
        
        print("\n[Commands]")
        print("  /list          - Show connected peers")
        print("  /send <user>   - Send message to user")
        print("  /send ALL      - Broadcast to all")
        print("  /peers         - Show peer discovery details")
        print("  /quit          - Exit")
        print("\nWaiting for peers...\n")
        
        return True
    
    def _receive_loop(self):
        """Receive and process messages"""
        while self.running:
            try:
                data, addr = self.sock.recvfrom(4096)
                message = json.loads(data.decode())
                
                if message['type'] == 'HELLO':
                    self._handle_hello(message, addr)
                elif message['type'] == 'MESSAGE':
                    self._handle_message(message)
                    
            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    pass  # Ignore parsing errors
    
    def _handle_hello(self, message, addr):
        """Handle peer discovery"""
        node_id = message['node_id']
        if node_id == self.node_id:
            return
        
        self.peers[node_id] = {
            'username': message['username'],
            'ip': addr[0],
            'last_seen': time.time()
        }
    
    def _handle_message(self, message):
        """Handle incoming messages"""
        msg_id = message['msg_id']
        
        # Check for duplicates
        if msg_id in self.message_ids_seen:
            return
        
        self.message_ids_seen.add(msg_id)
        
        # Check if message is for us or broadcast
        to = message['to']
        if to not in [self.node_id, 'ALL']:
            # Forward to next hop
            self._forward_message(message)
            return
        
        # Display message
        from_user = message['from_username']
        payload = message['payload']
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        print(f"\n[{timestamp}] {from_user}: {payload}")
        print("> ", end="", flush=True)
    
    def _forward_message(self, message):
        """Forward message to peers (multi-hop)"""
        message['ttl'] = message.get('ttl', 10) - 1
        
        if message['ttl'] <= 0:
            return
        
        # Broadcast to all known peers
        for peer in self.peers.values():
            try:
                self.sock.sendto(
                    json.dumps(message).encode(),
                    (peer['ip'], 9999)
                )
            except:
                pass
    
    def _heartbeat_loop(self):
        """Send periodic HELLO broadcasts"""
        while self.running:
            try:
                hello = {
                    'type': 'HELLO',
                    'node_id': self.node_id,
                    'username': self.username,
                    'timestamp': time.time()
                }
                
                # Broadcast on local network
                self.sock.sendto(
                    json.dumps(hello).encode(),
                    ('255.255.255.255', 9999)
                )
                
            except Exception as e:
                pass
            
            time.sleep(3)
    
    def _cleanup_loop(self):
        """Remove stale peers"""
        while self.running:
            time.sleep(5)
            now = time.time()
            
            stale = [
                node_id for node_id, peer in self.peers.items()
                if now - peer['last_seen'] > 15
            ]
            
            for node_id in stale:
                username = self.peers[node_id]['username']
                del self.peers[node_id]
                print(f"\n⚠ {username} disconnected")
                print("> ", end="", flush=True)
    
    def send_message(self, to_username, payload):
        """Send message to a peer"""
        # Find target node_id
        to_node_id = None
        
        if to_username.upper() == 'ALL':
            to_node_id = 'ALL'
        else:
            for node_id, peer in self.peers.items():
                if peer['username'].lower() == to_username.lower():
                    to_node_id = node_id
                    break
        
        if not to_node_id:
            print(f"✗ User '{to_username}' not found. Use /list to see connected peers.")
            return
        
        # Create message
        message = {
            'type': 'MESSAGE',
            'msg_id': str(uuid.uuid4()),
            'from': self.node_id,
            'from_username': self.username,
            'to': to_node_id,
            'payload': payload,
            'ttl': 10,
            'timestamp': time.time()
        }
        
        # Send to all peers (they'll forward if needed)
        if to_node_id == 'ALL':
            recipients = list(self.peers.values())
        else:
            target_peer = self.peers.get(to_node_id)
            recipients = [target_peer] if target_peer else []
        
        if not recipients:
            print("✗ No peers available")
            return
        
        for peer in recipients:
            try:
                self.sock.sendto(
                    json.dumps(message).encode(),
                    (peer['ip'], 9999)
                )
            except Exception as e:
                print(f"✗ Failed to send to {peer['username']}: {e}")
        
        print(f"✓ Message sent to {to_username}")
    
    def list_peers(self):
        """Show connected peers"""
        if not self.peers:
            print("\n✗ No peers connected")
            return
        
        print(f"\n{'='*50}")
        print(f"Connected Peers ({len(self.peers)}):")
        print(f"{'='*50}")
        for peer in self.peers.values():
            print(f"  • {peer['username']} ({peer['ip']})")
        print(f"{'='*50}\n")
    
    def show_peer_details(self):
        """Show detailed peer information"""
        print(f"\n{'='*50}")
        print(f"Peer Discovery Details:")
        print(f"{'='*50}")
        print(f"My Node ID: {self.node_id}")
        print(f"My IP: {self.p2p_ip or 'Unknown'}")
        print(f"Interface: {self.p2p_interface or 'Standard WiFi'}")
        print(f"\nDiscovered Peers ({len(self.peers)}):")
        
        for node_id, peer in self.peers.items():
            age = int(time.time() - peer['last_seen'])
            print(f"  • {peer['username']}")
            print(f"    - Node ID: {node_id}")
            print(f"    - IP: {peer['ip']}")
            print(f"    - Last seen: {age}s ago")
        print(f"{'='*50}\n")
    
    def stop(self):
        """Stop the node"""
        self.running = False
        if self.sock:
            self.sock.close()


def main():
    print("=" * 50)
    print("WiFi Direct P2P Mesh Chat (Termux)")
    print("=" * 50)
    
    username = input("Enter your username: ").strip()
    if not username:
        print("✗ Username cannot be empty")
        return
    
    node = WiFiDirectNode(username)
    
    if not node.start():
        print("\n✗ Failed to start node")
        return
    
    # Main command loop
    try:
        while True:
            try:
                cmd = input("> ").strip()
                
                if not cmd:
                    continue
                
                if cmd == '/quit':
                    break
                elif cmd == '/list':
                    node.list_peers()
                elif cmd == '/peers':
                    node.show_peer_details()
                elif cmd.startswith('/send '):
                    parts = cmd.split(' ', 2)
                    if len(parts) < 3:
                        print("Usage: /send <username> <message>")
                        continue
                    
                    to_user = parts[1]
                    message = parts[2]
                    node.send_message(to_user, message)
                else:
                    print("Unknown command. Available: /list, /send, /peers, /quit")
                    
            except EOFError:
                break
                
    except KeyboardInterrupt:
        pass
    finally:
        print("\n\nShutting down...")
        node.stop()


if __name__ == '__main__':
    main()
