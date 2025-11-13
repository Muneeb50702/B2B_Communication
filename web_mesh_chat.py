#!/usr/bin/env python3
"""
Web-based Mesh Chat with FastAPI
Beautiful GUI running on localhost:8000
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import json
import socket
import threading
import time
import uuid
from datetime import datetime
from typing import Dict, Set, List

# Mesh Node (same logic as before)
class MeshNode:
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.peers: Dict[str, float] = {}
        self.message_ids_seen: Set[str] = set()
        self.udp_port = 9999
        self.sock = None
        self.running = False
        self.local_ip = self._get_local_ip()
        self._lock = threading.Lock()
        self.message_callbacks = []
        
    def _get_local_ip(self) -> str:
        try:
            import subprocess
            result = subprocess.run(['ip', 'addr'], capture_output=True, text=True, timeout=1)
            lines = result.stdout.split('\n')
            
            for line in lines:
                if 'inet ' in line and '127.0.0.1' not in line:
                    parts = line.strip().split()
                    for i, part in enumerate(parts):
                        if part == 'inet' and i + 1 < len(parts):
                            ip = parts[i + 1].split('/')[0]
                            if ip.startswith(('192.168.', '10.', '172.')):
                                return ip
        except:
            pass
        
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            if ip != "127.0.0.1":
                return ip
        except:
            pass
        
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
            self.sock.sendto(data, ('255.255.255.255', self.udp_port))
            return True
        except Exception as e:
            return False
    
    def _receive_loop(self):
        while self.running:
            try:
                data, addr = self.sock.recvfrom(8192)
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
                    self._notify_peer_change()
        
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
            
            if dest_id == self.node_id or dest_id == "ALL":
                ts = datetime.now().strftime("%H:%M:%S")
                for callback in self.message_callbacks:
                    callback({
                        "from": from_id,
                        "message": payload,
                        "timestamp": ts
                    })
                return
            
            if ttl > 0:
                packet["ttl"] = ttl - 1
                data = json.dumps(packet).encode('utf-8')
                try:
                    self.sock.sendto(data, ('255.255.255.255', self.udp_port))
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
                self.sock.sendto(data, ('255.255.255.255', self.udp_port))
            except:
                pass
            time.sleep(3)
    
    def _cleanup_loop(self):
        while self.running:
            time.sleep(5)
            now = time.time()
            with self._lock:
                stale = [p for p, t in self.peers.items() if now - t > 15]
                if stale:
                    for peer_id in stale:
                        del self.peers[peer_id]
                    self._notify_peer_change()
    
    def _notify_peer_change(self):
        # Notify all connected websockets about peer changes
        for callback in self.message_callbacks:
            callback({"type": "peer_update", "peers": self.get_peers()})
    
    def get_peers(self) -> list:
        with self._lock:
            return list(self.peers.keys())
    
    def register_callback(self, callback):
        self.message_callbacks.append(callback)


# FastAPI App
app = FastAPI(title="Mesh Chat Web")

# Global mesh node
mesh_node = None
connected_websockets: Set[WebSocket] = set()


@app.get("/", response_class=HTMLResponse)
async def get_home():
    """Serve the web interface"""
    return HTML_CONTENT


@app.get("/api/info")
async def get_info():
    """Get node information"""
    if not mesh_node:
        return {"error": "Node not started"}
    
    return {
        "node_id": mesh_node.node_id,
        "local_ip": mesh_node.local_ip,
        "port": mesh_node.udp_port,
        "peers": mesh_node.get_peers()
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time communication"""
    await websocket.accept()
    connected_websockets.add(websocket)
    
    # Send initial info
    await websocket.send_json({
        "type": "init",
        "node_id": mesh_node.node_id,
        "local_ip": mesh_node.local_ip,
        "peers": mesh_node.get_peers()
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "send_message":
                success = mesh_node.send_message(
                    data["to"],
                    data["message"]
                )
                await websocket.send_json({
                    "type": "send_status",
                    "success": success
                })
            
            elif data["type"] == "get_peers":
                await websocket.send_json({
                    "type": "peer_list",
                    "peers": mesh_node.get_peers()
                })
    
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)


async def broadcast_to_websockets(message: dict):
    """Send message to all connected WebSocket clients"""
    for ws in connected_websockets.copy():
        try:
            await ws.send_json(message)
        except:
            connected_websockets.remove(ws)


# HTML Content
HTML_CONTENT = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mesh Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 900px;
            height: 600px;
            display: grid;
            grid-template-columns: 250px 1fr;
            overflow: hidden;
        }
        
        .sidebar {
            background: #f8f9fa;
            border-right: 1px solid #dee2e6;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            padding: 20px;
            background: #667eea;
            color: white;
            text-align: center;
        }
        
        .node-info {
            padding: 15px;
            background: #e9ecef;
            border-bottom: 1px solid #dee2e6;
            font-size: 12px;
        }
        
        .node-id {
            font-weight: bold;
            color: #667eea;
            word-break: break-all;
        }
        
        .peers-section {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
        }
        
        .peers-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #495057;
        }
        
        .peer-item {
            padding: 10px;
            margin-bottom: 8px;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            border: 2px solid transparent;
        }
        
        .peer-item:hover {
            background: #f1f3f5;
            transform: translateX(5px);
        }
        
        .peer-item.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        
        .main-chat {
            display: flex;
            flex-direction: column;
        }
        
        .chat-header {
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 2px solid #dee2e6;
        }
        
        .chat-title {
            font-size: 18px;
            font-weight: bold;
            color: #495057;
        }
        
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f8f9fa;
        }
        
        .message {
            margin-bottom: 15px;
            animation: fadeIn 0.3s;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .message.sent {
            text-align: right;
        }
        
        .message-bubble {
            display: inline-block;
            padding: 10px 15px;
            border-radius: 18px;
            max-width: 70%;
            word-wrap: break-word;
        }
        
        .message.received .message-bubble {
            background: white;
            border: 1px solid #dee2e6;
            text-align: left;
        }
        
        .message.sent .message-bubble {
            background: #667eea;
            color: white;
        }
        
        .message-sender {
            font-size: 11px;
            color: #6c757d;
            margin-bottom: 3px;
        }
        
        .message-time {
            font-size: 10px;
            color: #adb5bd;
            margin-top: 3px;
        }
        
        .input-area {
            padding: 20px;
            background: white;
            border-top: 1px solid #dee2e6;
            display: flex;
            gap: 10px;
        }
        
        .message-input {
            flex: 1;
            padding: 12px 15px;
            border: 2px solid #dee2e6;
            border-radius: 25px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        
        .message-input:focus {
            border-color: #667eea;
        }
        
        .send-button {
            padding: 12px 30px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.2s;
        }
        
        .send-button:hover {
            background: #764ba2;
            transform: scale(1.05);
        }
        
        .send-button:active {
            transform: scale(0.95);
        }
        
        .status {
            padding: 10px;
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            margin: 10px;
            font-size: 12px;
            color: #155724;
        }
        
        .no-peers {
            text-align: center;
            color: #6c757d;
            padding: 20px;
            font-size: 14px;
        }
        
        .broadcast-btn {
            padding: 8px 15px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 15px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 10px;
        }
        
        .broadcast-btn:hover {
            background: #218838;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="sidebar">
            <div class="header">
                <h2>📡 Mesh Chat</h2>
            </div>
            
            <div class="node-info">
                <div>Your ID:</div>
                <div class="node-id" id="nodeId">Loading...</div>
                <div style="margin-top: 8px; font-size: 11px;">
                    IP: <span id="nodeIp">-</span>
                </div>
            </div>
            
            <div class="peers-section">
                <div class="peers-title">Online Users (<span id="peerCount">0</span>)</div>
                <button class="broadcast-btn" onclick="selectBroadcast()">📢 Broadcast to All</button>
                <div id="peersList"></div>
            </div>
        </div>
        
        <div class="main-chat">
            <div class="chat-header">
                <div class="chat-title" id="chatTitle">Select a user to chat</div>
            </div>
            
            <div class="messages" id="messages">
                <div class="no-peers">
                    Waiting for peers to connect...<br>
                    <small>Make sure other devices are on the same network</small>
                </div>
            </div>
            
            <div class="input-area">
                <input 
                    type="text" 
                    class="message-input" 
                    id="messageInput" 
                    placeholder="Type a message..."
                    disabled
                >
                <button class="send-button" id="sendButton" onclick="sendMessage()" disabled>
                    Send
                </button>
            </div>
        </div>
    </div>
    
    <script>
        let ws;
        let currentRecipient = null;
        let myNodeId = null;
        
        function connect() {
            ws = new WebSocket(`ws://${window.location.host}/ws`);
            
            ws.onopen = () => {
                console.log('Connected to mesh node');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleMessage(data);
            };
            
            ws.onclose = () => {
                console.log('Disconnected. Reconnecting...');
                setTimeout(connect, 2000);
            };
        }
        
        function handleMessage(data) {
            if (data.type === 'init') {
                myNodeId = data.node_id;
                document.getElementById('nodeId').textContent = data.node_id;
                document.getElementById('nodeIp').textContent = data.local_ip;
                updatePeersList(data.peers);
            }
            else if (data.type === 'peer_list' || data.type === 'peer_update') {
                updatePeersList(data.peers);
            }
            else if (data.from && data.message) {
                addMessage(data.from, data.message, data.timestamp, false);
            }
        }
        
        function updatePeersList(peers) {
            const peersList = document.getElementById('peersList');
            const peerCount = document.getElementById('peerCount');
            
            peerCount.textContent = peers.length;
            
            if (peers.length === 0) {
                peersList.innerHTML = '<div class="no-peers">No users online yet</div>';
                return;
            }
            
            peersList.innerHTML = '';
            peers.forEach(peer => {
                const div = document.createElement('div');
                div.className = 'peer-item';
                if (peer === currentRecipient) {
                    div.className += ' active';
                }
                div.textContent = peer;
                div.onclick = () => selectPeer(peer);
                peersList.appendChild(div);
            });
        }
        
        function selectPeer(peerId) {
            currentRecipient = peerId;
            document.getElementById('chatTitle').textContent = `Chat with ${peerId}`;
            document.getElementById('messageInput').disabled = false;
            document.getElementById('sendButton').disabled = false;
            document.getElementById('messageInput').focus();
            
            // Update active state
            document.querySelectorAll('.peer-item').forEach(item => {
                item.classList.remove('active');
                if (item.textContent === peerId) {
                    item.classList.add('active');
                }
            });
        }
        
        function selectBroadcast() {
            currentRecipient = 'ALL';
            document.getElementById('chatTitle').textContent = '📢 Broadcasting to ALL';
            document.getElementById('messageInput').disabled = false;
            document.getElementById('sendButton').disabled = false;
            document.getElementById('messageInput').focus();
            
            document.querySelectorAll('.peer-item').forEach(item => {
                item.classList.remove('active');
            });
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (!message || !currentRecipient) return;
            
            ws.send(JSON.stringify({
                type: 'send_message',
                to: currentRecipient,
                message: message
            }));
            
            const now = new Date();
            const timestamp = now.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
            
            addMessage('You', message, timestamp, true);
            input.value = '';
        }
        
        function addMessage(from, message, timestamp, isSent) {
            const messagesDiv = document.getElementById('messages');
            
            // Remove "no peers" message if present
            const noPeers = messagesDiv.querySelector('.no-peers');
            if (noPeers) noPeers.remove();
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            
            messageDiv.innerHTML = `
                <div class="message-sender">${from}</div>
                <div class="message-bubble">${escapeHtml(message)}</div>
                <div class="message-time">${timestamp}</div>
            `;
            
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Handle Enter key
        document.addEventListener('DOMContentLoaded', () => {
            const input = document.getElementById('messageInput');
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
            
            connect();
        });
        
        // Request peer list every 5 seconds
        setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'get_peers' }));
            }
        }, 5000);
    </script>
</body>
</html>
"""


def start_server(username: str, port: int = 8000):
    """Start the web server"""
    global mesh_node
    
    # Create node ID
    node_id = f"{username}_{str(uuid.uuid4())[:6]}"
    mesh_node = MeshNode(node_id)
    
    # Start mesh networking
    if not mesh_node.start():
        print("Failed to start mesh node!")
        return
    
    # Setup callback for new messages
    def message_callback(data):
        asyncio.run(broadcast_to_websockets(data))
    
    mesh_node.register_callback(message_callback)
    
    print(f"\n{'='*60}")
    print(f"  🌐 Mesh Chat Web Interface")
    print(f"{'='*60}")
    print(f"  Node ID: {mesh_node.node_id}")
    print(f"  Local IP: {mesh_node.local_ip}")
    print(f"  UDP Port: {mesh_node.udp_port}")
    print(f"\n  🚀 Open in browser: http://localhost:{port}")
    print(f"  📱 On same network: http://{mesh_node.local_ip}:{port}")
    print(f"{'='*60}\n")
    
    # Start FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")


if __name__ == "__main__":
    import sys
    
    username = input("Enter your username: ").strip() or "User"
    port = 8000
    
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except:
            pass
    
    start_server(username, port)
