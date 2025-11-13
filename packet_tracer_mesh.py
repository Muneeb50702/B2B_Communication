# Simplified Mesh Node for Cisco Packet Tracer IoT Devices
# Upload this to each SBC device with different NODE_ID

import socket
import json
import time
from threading import Thread

# CONFIGURE THIS FOR EACH DEVICE
NODE_ID = "NodeA"  # Change to NodeB, NodeC for other devices
BROADCAST_PORT = 9999
BROADCAST_IP = "192.168.0.255"  # Adjust based on your subnet

class SimpleMeshNode:
    def __init__(self, node_id):
        self.node_id = node_id
        self.peers = {}  # {node_id: (ip, last_seen)}
        self.seen_messages = set()
        
        # Create UDP socket
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        self.sock.bind(('', BROADCAST_PORT))
        
        print(f"[{self.node_id}] Mesh node started")
    
    def send_hello(self):
        """Broadcast discovery packet"""
        packet = {
            "type": "HELLO",
            "node_id": self.node_id,
            "timestamp": time.time()
        }
        msg = json.dumps(packet) + "\n"
        self.sock.sendto(msg.encode(), (BROADCAST_IP, BROADCAST_PORT))
    
    def send_message(self, to_node, text):
        """Send message to specific node"""
        packet = {
            "type": "MESSAGE",
            "from": self.node_id,
            "to": to_node,
            "text": text,
            "msg_id": f"{self.node_id}_{time.time()}",
            "ttl": 5
        }
        msg = json.dumps(packet) + "\n"
        self.sock.sendto(msg.encode(), (BROADCAST_IP, BROADCAST_PORT))
        print(f"[{self.node_id}] Sent: {text}")
    
    def receive_loop(self):
        """Listen for incoming packets"""
        while True:
            try:
                data, addr = self.sock.recvfrom(4096)
                packet = json.loads(data.decode().strip())
                
                if packet["type"] == "HELLO":
                    peer_id = packet["node_id"]
                    if peer_id != self.node_id:
                        self.peers[peer_id] = (addr[0], time.time())
                        print(f"[{self.node_id}] Discovered: {peer_id} at {addr[0]}")
                
                elif packet["type"] == "MESSAGE":
                    msg_id = packet["msg_id"]
                    if msg_id not in self.seen_messages:
                        self.seen_messages.add(msg_id)
                        
                        # If message is for us
                        if packet["to"] == self.node_id or packet["to"] == "ALL":
                            print(f"\n[{self.node_id}] <<< {packet['from']}: {packet['text']}\n")
                        
                        # Forward if TTL > 0
                        if packet["ttl"] > 0 and packet["to"] != self.node_id:
                            packet["ttl"] -= 1
                            msg = json.dumps(packet) + "\n"
                            self.sock.sendto(msg.encode(), (BROADCAST_IP, BROADCAST_PORT))
            
            except Exception as e:
                print(f"Error: {e}")
    
    def heartbeat_loop(self):
        """Send periodic HELLO packets"""
        while True:
            self.send_hello()
            time.sleep(3)
    
    def list_peers(self):
        """Show discovered peers"""
        print(f"\n[{self.node_id}] Connected peers:")
        for peer_id, (ip, _) in self.peers.items():
            print(f"  - {peer_id} ({ip})")
        print()
    
    def start(self):
        """Start all threads"""
        Thread(target=self.receive_loop, daemon=True).start()
        Thread(target=self.heartbeat_loop, daemon=True).start()
        print(f"[{self.node_id}] Ready! Type commands:")
        print("  /list - show peers")
        print("  /send <node> <message> - send message")
        print()

# Initialize node
node = SimpleMeshNode(NODE_ID)
node.start()

# Demo: Auto-send test messages
time.sleep(5)
node.list_peers()

if NODE_ID == "NodeA":
    time.sleep(2)
    node.send_message("NodeB", "Hello from A!")
elif NODE_ID == "NodeB":
    time.sleep(4)
    node.send_message("NodeC", "Hello from B!")

# Keep running
while True:
    time.sleep(10)
    node.list_peers()
