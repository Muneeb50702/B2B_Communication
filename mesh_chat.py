#!/usr/bin/env python3
"""
Automatic Mesh Network Chat
- Zero configuration
- Auto-discovery of nearby devices
- Multi-hop routing
- Works offline without internet/router
"""

import socket
import threading
import time
import json
import uuid
import tkinter as tk
from tkinter import scrolledtext, ttk
from datetime import datetime
from typing import Dict, Set, Optional


class MeshNode:
    """
    Mesh network node with automatic discovery and routing
    """
    
    def __init__(self, node_id: str, on_message=None, on_peers_update=None):
        self.node_id = node_id
        self.on_message = on_message
        self.on_peers_update = on_peers_update
        
        # Network state
        self.peers: Dict[str, float] = {}  # {node_id: last_seen_timestamp}
        self.routing_table: Dict[str, str] = {}  # {dest_id: next_hop_id}
        self.message_ids_seen: Set[str] = set()  # For duplicate detection
        
        # Sockets
        self.udp_port = 9999
        self.sock = None
        self.running = False
        self.local_ip = self._get_local_ip()
        
        # Threading
        self._lock = threading.Lock()
    
    def _get_local_ip(self) -> str:
        """Get local IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def start(self) -> bool:
        """Start the mesh node"""
        try:
            # Create UDP socket for broadcast
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self.sock.bind(("", self.udp_port))
            self.sock.settimeout(0.5)
            
            self.running = True
            
            # Start threads
            threading.Thread(target=self._receive_loop, daemon=True).start()
            threading.Thread(target=self._heartbeat_loop, daemon=True).start()
            threading.Thread(target=self._cleanup_loop, daemon=True).start()
            
            return True
        except Exception as e:
            print(f"Failed to start mesh node: {e}")
            return False
    
    def stop(self):
        """Stop the mesh node"""
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
    
    def send_message(self, dest_id: str, message: str) -> bool:
        """
        Send message to destination (may route through intermediate nodes)
        """
        msg_id = f"{self.node_id}:{int(time.time() * 1000)}:{uuid.uuid4().hex[:8]}"
        
        packet = {
            "type": "MESSAGE",
            "msg_id": msg_id,
            "from": self.node_id,
            "to": dest_id,
            "payload": message,
            "ttl": 10,  # Max hops
            "timestamp": time.time()
        }
        
        return self._send_packet(packet)
    
    def _send_packet(self, packet: dict) -> bool:
        """Broadcast packet to all peers"""
        try:
            data = json.dumps(packet).encode('utf-8')
            
            # Broadcast to local network
            self.sock.sendto(data, ('<broadcast>', self.udp_port))
            return True
        except Exception as e:
            print(f"Send error: {e}")
            return False
    
    def _receive_loop(self):
        """Receive and process packets"""
        while self.running:
            try:
                data, addr = self.sock.recvfrom(8192)
                
                # Ignore our own broadcasts
                if addr[0] == self.local_ip:
                    continue
                
                packet = json.loads(data.decode('utf-8'))
                self._handle_packet(packet, addr[0])
                
            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    print(f"Receive error: {e}")
    
    def _handle_packet(self, packet: dict, sender_ip: str):
        """Handle received packet"""
        ptype = packet.get("type")
        
        if ptype == "HELLO":
            self._handle_hello(packet, sender_ip)
        elif ptype == "MESSAGE":
            self._handle_message(packet)
    
    def _handle_hello(self, packet: dict, sender_ip: str):
        """Handle discovery HELLO packet"""
        peer_id = packet.get("node_id")
        if not peer_id or peer_id == self.node_id:
            return
        
        with self._lock:
            # Update peer table
            self.peers[peer_id] = time.time()
            
            # Update routing (direct peer)
            self.routing_table[peer_id] = peer_id
        
        # Notify GUI
        if self.on_peers_update:
            self.on_peers_update()
    
    def _handle_message(self, packet: dict):
        """Handle MESSAGE packet"""
        msg_id = packet.get("msg_id")
        dest_id = packet.get("to")
        from_id = packet.get("from")
        payload = packet.get("payload")
        ttl = packet.get("ttl", 0)
        
        # Duplicate detection
        if msg_id in self.message_ids_seen:
            return
        self.message_ids_seen.add(msg_id)
        
        # Keep only last 1000 message IDs
        if len(self.message_ids_seen) > 1000:
            self.message_ids_seen = set(list(self.message_ids_seen)[-500:])
        
        # Is this message for us?
        if dest_id == self.node_id:
            # Deliver to user
            if self.on_message:
                self.on_message(from_id, payload)
            return
        
        # Forward if TTL allows
        if ttl > 0:
            packet["ttl"] = ttl - 1
            self._send_packet(packet)
    
    def _heartbeat_loop(self):
        """Send periodic HELLO broadcasts"""
        while self.running:
            packet = {
                "type": "HELLO",
                "node_id": self.node_id,
                "ip": self.local_ip,
                "timestamp": time.time()
            }
            self._send_packet(packet)
            time.sleep(3)
    
    def _cleanup_loop(self):
        """Remove stale peers"""
        while self.running:
            time.sleep(5)
            
            now = time.time()
            with self._lock:
                # Remove peers not seen in 15 seconds
                stale_peers = [
                    peer_id for peer_id, last_seen in self.peers.items()
                    if now - last_seen > 15
                ]
                
                for peer_id in stale_peers:
                    del self.peers[peer_id]
                    if peer_id in self.routing_table:
                        del self.routing_table[peer_id]
            
            if stale_peers and self.on_peers_update:
                self.on_peers_update()
    
    def get_active_peers(self) -> list:
        """Get list of active peer IDs"""
        with self._lock:
            return list(self.peers.keys())


class MeshChatGUI:
    """Simple GUI for mesh chat"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("Mesh Chat - Auto Discovery")
        self.root.geometry("800x600")
        self.root.configure(bg="#1a1a2e")
        
        # Generate unique node ID
        self.node_id = f"User_{uuid.uuid4().hex[:6].upper()}"
        
        # Create mesh node
        self.mesh = MeshNode(
            self.node_id,
            on_message=self.on_receive_message,
            on_peers_update=self.on_peers_update
        )
        
        self._build_ui()
        self._start_mesh()
    
    def _build_ui(self):
        """Build the GUI"""
        
        # Header
        header = tk.Frame(self.root, bg="#16213e", height=80)
        header.pack(fill=tk.X)
        header.pack_propagate(False)
        
        tk.Label(
            header, text="🌐 Mesh Chat", 
            font=("Arial", 18, "bold"),
            bg="#16213e", fg="#00fff7"
        ).pack(pady=5)
        
        tk.Label(
            header, text="Automatic Discovery • No Router Needed", 
            font=("Arial", 10),
            bg="#16213e", fg="#aaaaaa"
        ).pack()
        
        # Status bar
        status_frame = tk.Frame(self.root, bg="#0f3460")
        status_frame.pack(fill=tk.X)
        
        self.status_label = tk.Label(
            status_frame, 
            text=f"Your ID: {self.node_id} | IP: {self.mesh.local_ip} | Peers: 0",
            font=("Consolas", 9),
            bg="#0f3460", fg="#00ff00", anchor="w", padx=15, pady=8
        )
        self.status_label.pack(fill=tk.X)
        
        # Main container
        main = tk.Frame(self.root, bg="#1a1a2e")
        main.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left: Chat area
        left = tk.Frame(main, bg="#1a1a2e")
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        tk.Label(
            left, text="💬 Messages", 
            font=("Arial", 11, "bold"),
            bg="#1a1a2e", fg="#00fff7", anchor="w"
        ).pack(fill=tk.X, pady=(0, 5))
        
        self.chat_area = scrolledtext.ScrolledText(
            left, wrap=tk.WORD, font=("Consolas", 10),
            bg="#0f1923", fg="#ffffff", insertbackground="#00fff7",
            state=tk.DISABLED, relief=tk.FLAT
        )
        self.chat_area.pack(fill=tk.BOTH, expand=True)
        
        # Input area
        input_frame = tk.Frame(left, bg="#1a1a2e")
        input_frame.pack(fill=tk.X, pady=(10, 0))
        
        tk.Label(
            input_frame, text="To:", 
            font=("Arial", 9, "bold"),
            bg="#1a1a2e", fg="#aaaaaa"
        ).pack(side=tk.LEFT, padx=(0, 5))
        
        self.recipient_var = tk.StringVar()
        self.recipient_combo = ttk.Combobox(
            input_frame, 
            textvariable=self.recipient_var,
            font=("Arial", 10),
            width=15,
            state="readonly"
        )
        self.recipient_combo.pack(side=tk.LEFT, padx=(0, 10))
        
        self.message_entry = tk.Entry(
            input_frame, font=("Arial", 11),
            bg="#0f3460", fg="#ffffff", insertbackground="#00fff7"
        )
        self.message_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        self.message_entry.bind("<Return>", lambda e: self.send_message())
        
        tk.Button(
            input_frame, text="Send", 
            font=("Arial", 10, "bold"),
            bg="#00fff7", fg="#1a1a2e",
            command=self.send_message, width=8
        ).pack(side=tk.RIGHT)
        
        # Right: Peers list
        right = tk.Frame(main, bg="#1a1a2e", width=200)
        right.pack(side=tk.RIGHT, fill=tk.Y, padx=(10, 0))
        right.pack_propagate(False)
        
        tk.Label(
            right, text="👥 Online Users", 
            font=("Arial", 11, "bold"),
            bg="#1a1a2e", fg="#00fff7", anchor="w"
        ).pack(fill=tk.X, pady=(0, 5))
        
        self.peers_listbox = tk.Listbox(
            right, font=("Consolas", 9),
            bg="#0f3460", fg="#ffffff",
            relief=tk.FLAT, selectmode=tk.SINGLE
        )
        self.peers_listbox.pack(fill=tk.BOTH, expand=True)
        self.peers_listbox.bind("<<ListboxSelect>>", self.on_peer_select)
    
    def _start_mesh(self):
        """Start the mesh network"""
        if self.mesh.start():
            self.log_system(f"✓ Mesh node started")
            self.log_system(f"✓ Your ID: {self.node_id}")
            self.log_system(f"✓ Broadcasting on {self.mesh.local_ip}:{self.mesh.udp_port}")
            self.log_system(f"✓ Searching for nearby devices...")
        else:
            self.log_system("✗ Failed to start mesh node!")
    
    def send_message(self):
        """Send message to selected peer"""
        recipient = self.recipient_var.get()
        message = self.message_entry.get().strip()
        
        if not recipient:
            self.log_system("⚠ Please select a recipient")
            return
        
        if not message:
            return
        
        if self.mesh.send_message(recipient, message):
            self.log_outgoing(recipient, message)
            self.message_entry.delete(0, tk.END)
        else:
            self.log_system("✗ Failed to send message")
    
    def on_receive_message(self, from_id, message):
        """Handle received message"""
        self.root.after(0, lambda: self.log_incoming(from_id, message))
    
    def on_peers_update(self):
        """Handle peers list update"""
        self.root.after(0, self.update_peers_list)
    
    def update_peers_list(self):
        """Update the peers listbox"""
        peers = self.mesh.get_active_peers()
        
        # Update status
        self.status_label.config(
            text=f"Your ID: {self.node_id} | IP: {self.mesh.local_ip} | Peers: {len(peers)}"
        )
        
        # Update listbox
        self.peers_listbox.delete(0, tk.END)
        for peer in sorted(peers):
            self.peers_listbox.insert(tk.END, f"● {peer}")
        
        # Update recipient dropdown
        current = self.recipient_var.get()
        self.recipient_combo['values'] = peers
        
        if current not in peers and peers:
            self.recipient_var.set(peers[0])
        elif not peers:
            self.recipient_var.set("")
        
        # Log new peers
        if peers and not hasattr(self, '_logged_peers'):
            self._logged_peers = set()
        
        for peer in peers:
            if peer not in getattr(self, '_logged_peers', set()):
                self.log_system(f"✓ Found peer: {peer}")
                if not hasattr(self, '_logged_peers'):
                    self._logged_peers = set()
                self._logged_peers.add(peer)
    
    def on_peer_select(self, event):
        """Handle peer selection"""
        selection = self.peers_listbox.curselection()
        if selection:
            peer = self.peers_listbox.get(selection[0]).replace("● ", "")
            self.recipient_var.set(peer)
    
    def log_system(self, text):
        """Log system message"""
        ts = datetime.now().strftime("%H:%M:%S")
        self.chat_area.config(state=tk.NORMAL)
        self.chat_area.insert(tk.END, f"[{ts}] [SYS] {text}\n", "system")
        self.chat_area.tag_config("system", foreground="#ffd700")
        self.chat_area.config(state=tk.DISABLED)
        self.chat_area.see(tk.END)
    
    def log_incoming(self, from_id, message):
        """Log incoming message"""
        ts = datetime.now().strftime("%H:%M:%S")
        self.chat_area.config(state=tk.NORMAL)
        self.chat_area.insert(tk.END, f"[{ts}] ", "time")
        self.chat_area.insert(tk.END, f"{from_id}: ", "peer")
        self.chat_area.insert(tk.END, f"{message}\n", "message")
        self.chat_area.tag_config("time", foreground="#888888")
        self.chat_area.tag_config("peer", foreground="#00ff00", font=("Consolas", 10, "bold"))
        self.chat_area.tag_config("message", foreground="#ffffff")
        self.chat_area.config(state=tk.DISABLED)
        self.chat_area.see(tk.END)
    
    def log_outgoing(self, to_id, message):
        """Log outgoing message"""
        ts = datetime.now().strftime("%H:%M:%S")
        self.chat_area.config(state=tk.NORMAL)
        self.chat_area.insert(tk.END, f"[{ts}] ", "time")
        self.chat_area.insert(tk.END, f"You → {to_id}: ", "you")
        self.chat_area.insert(tk.END, f"{message}\n", "message")
        self.chat_area.tag_config("you", foreground="#00fff7", font=("Consolas", 10, "bold"))
        self.chat_area.config(state=tk.DISABLED)
        self.chat_area.see(tk.END)
    
    def on_closing(self):
        """Handle window close"""
        self.mesh.stop()
        self.root.destroy()


def main():
    root = tk.Tk()
    app = MeshChatGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()


if __name__ == "__main__":
    main()
