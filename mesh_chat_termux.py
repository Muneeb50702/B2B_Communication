#!/usr/bin/env python3
"""
Mesh Chat for Termux (Android)
Zero configuration peer-to-peer messaging
"""

import socket
import threading
import time
import json
import uuid
import sys
from datetime import datetime
from typing import Dict, Set


class MeshNode:
    """Mesh network node for mobile devices"""
    
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.peers: Dict[str, float] = {}
        self.message_ids_seen: Set[str] = set()
        self.udp_port = 9999
        self.sock = None
        self.running = False
        self.local_ip = self._get_local_ip()
        self._lock = threading.Lock()
    
    def _get_local_ip(self) -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def start(self) -> bool:
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self.sock.bind(("", self.udp_port))
            self.sock.settimeout(0.5)
            
            self.running = True
            threading.Thread(target=self._receive_loop, daemon=True).start()
            threading.Thread(target=self._heartbeat_loop, daemon=True).start()
            threading.Thread(target=self._cleanup_loop, daemon=True).start()
            
            return True
        except Exception as e:
            print(f"Error starting node: {e}")
            return False
    
    def stop(self):
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
    
    def send_message(self, dest_id: str, message: str) -> bool:
        msg_id = f"{self.node_id}:{int(time.time()*1000)}:{uuid.uuid4().hex[:8]}"
        
        packet = {
            "type": "MESSAGE",
            "msg_id": msg_id,
            "from": self.node_id,
            "to": dest_id,
            "payload": message,
            "ttl": 10,
            "timestamp": time.time()
        }
        
        try:
            data = json.dumps(packet).encode('utf-8')
            self.sock.sendto(data, ('<broadcast>', self.udp_port))
            return True
        except:
            return False
    
    def _receive_loop(self):
        while self.running:
            try:
                data, addr = self.sock.recvfrom(8192)
                
                if addr[0] == self.local_ip:
                    continue
                
                packet = json.loads(data.decode('utf-8'))
                self._handle_packet(packet)
            except socket.timeout:
                continue
            except:
                pass
    
    def _handle_packet(self, packet: dict):
        ptype = packet.get("type")
        
        if ptype == "HELLO":
            peer_id = packet.get("node_id")
            if peer_id and peer_id != self.node_id:
                with self._lock:
                    was_new = peer_id not in self.peers
                    self.peers[peer_id] = time.time()
                
                if was_new:
                    print(f"\n✓ Found: {peer_id}")
                    print(">>> ", end="", flush=True)
        
        elif ptype == "MESSAGE":
            msg_id = packet.get("msg_id")
            dest_id = packet.get("to")
            from_id = packet.get("from")
            payload = packet.get("payload")
            ttl = packet.get("ttl", 0)
            
            if msg_id in self.message_ids_seen:
                return
            self.message_ids_seen.add(msg_id)
            
            if len(self.message_ids_seen) > 1000:
                self.message_ids_seen = set(list(self.message_ids_seen)[-500:])
            
            if dest_id == self.node_id:
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"\n[{ts}] {from_id}: {payload}")
                print(">>> ", end="", flush=True)
                return
            
            if ttl > 0:
                packet["ttl"] = ttl - 1
                data = json.dumps(packet).encode('utf-8')
                try:
                    self.sock.sendto(data, ('<broadcast>', self.udp_port))
                except:
                    pass
    
    def _heartbeat_loop(self):
        while self.running:
            packet = {
                "type": "HELLO",
                "node_id": self.node_id,
                "ip": self.local_ip,
                "timestamp": time.time()
            }
            try:
                data = json.dumps(packet).encode('utf-8')
                self.sock.sendto(data, ('<broadcast>', self.udp_port))
            except:
                pass
            time.sleep(3)
    
    def _cleanup_loop(self):
        while self.running:
            time.sleep(5)
            now = time.time()
            with self._lock:
                stale = [p for p, t in self.peers.items() if now - t > 15]
                for peer_id in stale:
                    del self.peers[peer_id]
                    print(f"\n✗ Lost: {peer_id}")
                    print(">>> ", end="", flush=True)
    
    def get_peers(self) -> list:
        with self._lock:
            return list(self.peers.keys())


def main():
    print("=" * 50)
    print("     MESH CHAT - TERMUX VERSION")
    print("=" * 50)
    
    # Generate unique ID
    node_id = f"User_{uuid.uuid4().hex[:6].upper()}"
    
    print(f"\nYour ID: {node_id}")
    print("Starting mesh node...")
    
    node = MeshNode(node_id)
    
    if not node.start():
        print("Failed to start! Check network connection.")
        sys.exit(1)
    
    print(f"✓ Running on {node.local_ip}:{node.udp_port}")
    print("✓ Searching for nearby devices...\n")
    
    print("Commands:")
    print("  /list          - Show online users")
    print("  /send <ID>     - Send message to user")
    print("  /quit          - Exit\n")
    
    recipient = None
    
    try:
        while True:
            try:
                msg = input(">>> ").strip()
            except EOFError:
                break
            
            if not msg:
                continue
            
            if msg == "/quit":
                break
            
            elif msg == "/list":
                peers = node.get_peers()
                if peers:
                    print("\nOnline Users:")
                    for i, peer in enumerate(peers, 1):
                        print(f"  {i}. {peer}")
                    print()
                else:
                    print("\nNo users found yet. Wait a few seconds...\n")
            
            elif msg.startswith("/send "):
                parts = msg.split(maxsplit=1)
                if len(parts) == 2:
                    recipient = parts[1].strip()
                    if recipient in node.get_peers():
                        print(f"\n✓ Now sending to: {recipient}")
                        print("Type your message (or /send <ID> to change recipient)\n")
                    else:
                        print(f"\n✗ User '{recipient}' not found. Use /list to see available users.\n")
                        recipient = None
                else:
                    print("\nUsage: /send <User_ID>\n")
            
            else:
                if recipient:
                    if node.send_message(recipient, msg):
                        ts = datetime.now().strftime("%H:%M:%S")
                        print(f"[{ts}] You → {recipient}: {msg}")
                    else:
                        print("✗ Failed to send")
                else:
                    print("\n⚠ No recipient selected. Use: /send <User_ID>\n")
    
    except KeyboardInterrupt:
        print("\n\nShutting down...")
    
    finally:
        node.stop()
        print("Goodbye!")


if __name__ == "__main__":
    main()
