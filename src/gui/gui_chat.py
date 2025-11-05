# -*- coding: utf-8 -*-
"""
Mesh Network Chat GUI - Terminal/Cyberpunk Theme
TRUE P2P: Direct PC-to-PC via Bluetooth or WiFi Hotspot (no router needed)
Cross-platform: Windows, Mac, Linux
"""
import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk, simpledialog
import threading
import time
import socket
from datetime import datetime
import sys
import os
import json

# Add parent to path for imports
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

from mesh.p2p_transport import BluetoothTransport, WiFiDirectTransport, BLUETOOTH_AVAILABLE, BT_LIB


class MeshChatGUI:
    # Improved high-contrast color scheme
    BG_DARK = "#1a1a2e"          # Lighter dark background
    BG_MID = "#16213e"           # Mid tone
    BG_INPUT = "#0f3460"         # Brighter input background
    TEXT_PRIMARY = "#ffffff"     # Pure WHITE for maximum readability
    TEXT_SECONDARY = "#00fff7"   # Bright cyan
    TEXT_MUTED = "#94a3b8"       # Light gray (much more visible)
    TEXT_ERROR = "#ff0055"
    TEXT_WARNING = "#ffd700"     # Bright gold
    ACCENT = "#00fff7"           # Bright cyan
    BORDER = "#3a4a6b"

    def __init__(self, master):
        self.master = master
        self.master.title("🌐 Mesh Chat - Direct P2P (No Router)")
        self.master.geometry("950x750")
        self.master.configure(bg=self.BG_DARK)
        self.master.resizable(True, True)

        # State
        self.transport = None
        self.node_id = None
        self.running = False
        self.auto_scroll = True
        self.peers = {}
        self.transport_type = None
        self.mode = None

        self._build_ui()
        self._check_bt_and_start()

    def _check_bt_and_start(self):
        """Check Bluetooth availability"""
        if not BLUETOOTH_AVAILABLE:
            msg = "⚠️ Bluetooth Not Available\n\n"
            msg += "Install: pip install pybluez\n\n"
            msg += "WiFi Hotspot mode will still work."
            messagebox.showwarning("Bluetooth Missing", msg)
        self._start_connection_dialog()

    def _build_ui(self):
        # Top bar
        top_frame = tk.Frame(self.master, bg=self.BG_MID, height=60)
        top_frame.pack(fill=tk.X)
        top_frame.pack_propagate(False)

        self.status_label = tk.Label(
            top_frame, text="● DISCONNECTED", font=("Consolas", 11, "bold"),
            bg=self.BG_MID, fg=self.TEXT_ERROR, anchor="w", padx=20
        )
        self.status_label.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.node_label = tk.Label(
            top_frame, text="Node: ---", font=("Consolas", 10),
            bg=self.BG_MID, fg=self.TEXT_MUTED, anchor="e", padx=20
        )
        self.node_label.pack(side=tk.RIGHT)

        # Main container
        main_container = tk.Frame(self.master, bg=self.BG_DARK)
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Chat area
        chat_frame = tk.Frame(main_container, bg=self.BG_DARK)
        chat_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        tk.Label(chat_frame, text="█ MESSAGE STREAM", font=("Consolas", 10, "bold"),
                bg=self.BG_DARK, fg=self.TEXT_SECONDARY, anchor="w").pack(fill=tk.X, pady=(0, 5))

        chat_container = tk.Frame(chat_frame, bg=self.BORDER)
        chat_container.pack(fill=tk.BOTH, expand=True)

        self.chat_area = scrolledtext.ScrolledText(
            chat_container, wrap=tk.WORD, font=("Consolas", 10),
            bg=self.BG_MID, fg=self.TEXT_PRIMARY, insertbackground=self.ACCENT,
            relief=tk.FLAT, padx=10, pady=10, state=tk.DISABLED, borderwidth=2
        )
        self.chat_area.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)

        # Input area
        input_frame = tk.Frame(chat_frame, bg=self.BG_DARK)
        input_frame.pack(fill=tk.X, pady=(10, 0))

        tk.Label(input_frame, text="█ COMPOSE MESSAGE", font=("Consolas", 10, "bold"),
                bg=self.BG_DARK, fg=self.TEXT_SECONDARY).pack(fill=tk.X, pady=(0, 5))

        input_container = tk.Frame(input_frame, bg=self.BG_DARK)
        input_container.pack(fill=tk.X)

        # Recipient
        recipient_row = tk.Frame(input_container, bg=self.BG_DARK)
        recipient_row.pack(fill=tk.X, pady=(0, 5))

        tk.Label(recipient_row, text="TO:", font=("Consolas", 9, "bold"),
                bg=self.BG_DARK, fg=self.TEXT_MUTED, width=5, anchor="w").pack(side=tk.LEFT)

        self.recipient_entry = tk.Entry(recipient_row, font=("Consolas", 10),
            bg=self.BG_INPUT, fg=self.TEXT_PRIMARY, insertbackground=self.ACCENT, relief=tk.FLAT)
        self.recipient_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))

        # Message
        message_row = tk.Frame(input_container, bg=self.BG_DARK)
        message_row.pack(fill=tk.X)

        tk.Label(message_row, text="MSG:", font=("Consolas", 9, "bold"),
                bg=self.BG_DARK, fg=self.TEXT_MUTED, width=5, anchor="w").pack(side=tk.LEFT)

        self.message_entry = tk.Entry(message_row, font=("Consolas", 12, "bold"),
            bg=self.BG_INPUT, fg="#ffffff", insertbackground="#00fff7", relief=tk.SOLID,
            bd=2, highlightthickness=2, highlightbackground=self.ACCENT, 
            highlightcolor=self.ACCENT)
        self.message_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5), ipady=4)
        self.message_entry.bind("<Return>", lambda e: self._send_message())

        self.send_btn = tk.Button(message_row, text="⚡ SEND", font=("Consolas", 10, "bold"),
            bg=self.ACCENT, fg=self.BG_DARK, relief=tk.FLAT, command=self._send_message, width=10)
        self.send_btn.pack(side=tk.LEFT)

        # Sidebar
        sidebar = tk.Frame(main_container, bg=self.BG_DARK, width=270)
        sidebar.pack(side=tk.RIGHT, fill=tk.Y, padx=(10, 0))
        sidebar.pack_propagate(False)

        tk.Label(sidebar, text="█ CONNECTED PEERS", font=("Consolas", 10, "bold"),
                bg=self.BG_DARK, fg=self.TEXT_SECONDARY).pack(fill=tk.X, pady=(0, 5))

        peers_container = tk.Frame(sidebar, bg=self.BORDER)
        peers_container.pack(fill=tk.BOTH, expand=True)

        self.peers_listbox = tk.Listbox(peers_container, font=("Consolas", 9),
            bg=self.BG_MID, fg=self.TEXT_PRIMARY, relief=tk.FLAT, borderwidth=2)
        self.peers_listbox.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)
        self.peers_listbox.bind("<Double-Button-1>", self._on_peer_double_click)

        tk.Label(sidebar, text="█ CONNECTION INFO", font=("Consolas", 10, "bold"),
                bg=self.BG_DARK, fg=self.TEXT_SECONDARY).pack(fill=tk.X, pady=(15, 5))

        info_container = tk.Frame(sidebar, bg=self.BORDER)
        info_container.pack(fill=tk.X)

        self.info_text = tk.Text(info_container, height=10, font=("Consolas", 8),
            bg=self.BG_MID, fg=self.TEXT_MUTED, relief=tk.FLAT, state=tk.DISABLED, wrap=tk.WORD)
        self.info_text.pack(fill=tk.X, padx=2, pady=2)

        # Footer
        footer = tk.Frame(self.master, bg=self.BG_MID, height=30)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        footer.pack_propagate(False)

        self.footer_label = tk.Label(footer, text="⚡ Select connection method",
            font=("Consolas", 9), bg=self.BG_MID, fg=self.TEXT_MUTED, anchor="w", padx=20)
        self.footer_label.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def _start_connection_dialog(self):
        """Simplified connection dialog for WiFi mode"""
        dialog = tk.Toplevel(self.master)
        dialog.title("Direct P2P Connection")
        dialog.configure(bg=self.BG_DARK)
        dialog.resizable(False, False)
        dialog.transient(self.master)
        dialog.grab_set()

        # Center
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - 325
        y = (dialog.winfo_screenheight() // 2) - 300
        dialog.geometry(f"650x600+{x}+{y}")

        tk.Label(dialog, text="♦♦♦ DIRECT P2P MESH", font=("Consolas", 16, "bold"),
                bg=self.BG_DARK, fg="#00fff7").pack(pady=(20, 5))

        tk.Label(dialog, text="WiFi Hotspot Mode", font=("Consolas", 10),
                bg=self.BG_DARK, fg="#ffffff").pack(pady=(0, 20))

                # Node ID
        frame_node = tk.Frame(dialog, bg=self.BG_DARK)
        frame_node.pack(fill=tk.X, padx=30, pady=15)
        tk.Label(frame_node, text="Your Node ID:", font=("Consolas", 11, "bold"),
                bg=self.BG_DARK, fg="#00fff7", width=15, anchor="w").pack(side=tk.LEFT, padx=(0,10))
        node_id_entry = tk.Entry(frame_node, font=("Consolas", 13, "bold"),
                                 bg="#1a2332", fg="#ffffff", insertbackground="#00fff7",
                                 relief=tk.SOLID, borderwidth=2, highlightthickness=0)
        node_id_entry.config(highlightbackground="#00fff7", highlightcolor="#00fff7")
        node_id_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=8)
        hostname = socket.gethostname().split('-')[-1].upper()  # Get last part
        node_id_entry.insert(0, f"PC_{hostname}")
        node_id_entry.icursor(tk.END)  # Move cursor to end

        # Mode
        mode_var = tk.StringVar(value="server")
        
        frame_mode = tk.Frame(dialog, bg=self.BG_DARK)
        frame_mode.pack(fill=tk.X, padx=30, pady=15)
        
        tk.Label(frame_mode, text="Mode:", font=("Consolas", 11, "bold"),
                bg=self.BG_DARK, fg="#ffd700", width=15, anchor="w").pack(side=tk.LEFT, padx=(0,10))

        tk.Radiobutton(frame_mode, text="SERVER (Wait for connection)", variable=mode_var, value="server",
            font=("Consolas", 11, "bold"), bg=self.BG_DARK, fg="#00ff00",
            selectcolor=self.BG_INPUT, activebackground=self.BG_DARK, 
            activeforeground=self.ACCENT).pack(side=tk.LEFT, padx=10)

        tk.Radiobutton(frame_mode, text="CLIENT (Connect to PC)", variable=mode_var, value="client",
            font=("Consolas", 11, "bold"), bg=self.BG_DARK, fg="#00d9ff",
            selectcolor=self.BG_INPUT, activebackground=self.BG_DARK,
            activeforeground=self.ACCENT).pack(side=tk.LEFT, padx=10)

        # Client target
        client_frame = tk.Frame(dialog, bg=self.BG_DARK)
        client_frame.pack(fill=tk.X, padx=30, pady=10)

        target_label = tk.Label(client_frame, text="Hotspot IP:", font=("Consolas", 11, "bold"),
                               bg=self.BG_DARK, fg="#00fff7", anchor="w")
        target_entry = tk.Entry(client_frame, font=("Consolas", 13, "bold"),
                               bg="#1a2332", fg="#ffffff", insertbackground="#00fff7",
                               relief=tk.SOLID, borderwidth=2, highlightthickness=0)
        target_entry.config(highlightbackground="#00fff7", highlightcolor="#00fff7")
        target_entry.insert(0, "192.168.137.1")

        def update_client_fields(*args):
            if mode_var.get() == "client":
                target_label.pack(fill=tk.X, pady=(0, 8))
                target_entry.pack(fill=tk.X, ipady=8)
            else:
                target_label.pack_forget()
                target_entry.pack_forget()
        
        mode_var.trace_add("write", update_client_fields)

        # Instructions
        inst_text = tk.Text(dialog, height=4, font=("Consolas", 9),
            bg=self.BG_MID, fg="#ffffff", relief=tk.FLAT, wrap=tk.WORD,
            highlightthickness=1, highlightbackground=self.BORDER)
        inst_text.pack(fill=tk.X, padx=30, pady=(15, 15))
        inst_text.insert(1.0, "SETUP:\n\nPC1: Create WiFi hotspot → Select Server → START\nPC2: Connect to hotspot → Select Client → Enter 192.168.137.1 → CONNECT")
        inst_text.config(state=tk.DISABLED)

        def on_connect():
            node_id = node_id_entry.get().strip()
            mode = mode_var.get()
            target = target_entry.get().strip() if mode == "client" else None
            
            if not node_id:
                messagebox.showerror("Error", "Node ID required")
                return
            
            dialog.destroy()
            self._connect_p2p(node_id, "wifi", mode, target)

        tk.Button(dialog, text="⚡ START / CONNECT", font=("Consolas", 12, "bold"),
            bg=self.ACCENT, fg=self.BG_DARK, relief=tk.FLAT,
            command=on_connect, width=25, height=2).pack(pady=(20, 30))

    def _connect_p2p(self, node_id, transport_type, mode, target=None):
        self.node_id = node_id
        self.transport_type = transport_type
        self.mode = mode
        
        self._log_system(f"Initializing WiFi HOTSPOT in {mode.upper()} mode...")
        
        self.transport = WiFiDirectTransport(node_id, on_data_received=self._on_data_received)
        
        def start_transport():
            if mode == "server":
                success, msg = self.transport.start_server()
            else:
                success, msg = self.transport.start_client(target)
            
            self.master.after(0, lambda: self._on_transport_started(success, msg))
        
        threading.Thread(target=start_transport, daemon=True).start()
        self.status_label.config(text="♦♦♦ CONNECTING...", fg=self.TEXT_WARNING)

    def _on_transport_started(self, success, msg):
        if success:
            self.running = True
            self.status_label.config(text="♦♦♦ CONNECTED", fg=self.TEXT_PRIMARY)
            self.node_label.config(text=f"Node: {self.node_id}", fg=self.TEXT_PRIMARY)
            self._log_system(msg)
            self._log_system(f"Ready! ({self.transport_type.upper()} {self.mode.upper()})")
            self._update_info_panel()
            self._start_heartbeat()
        else:
            self.status_label.config(text="⚫ FAILED", fg=self.TEXT_ERROR)
            self._log_error(msg)
            messagebox.showerror("Connection Failed", msg)

    def _on_data_received(self, data: bytes, sender: str):
        try:
            packet = json.loads(data.decode('utf-8'))
            ptype = packet.get("type")
            
            if ptype == "HELLO":
                peer_id = packet.get("node_id")
                if peer_id and peer_id != self.node_id:
                    self.peers[peer_id] = time.time()
                    self.master.after(0, self._update_peers_ui)
                    self._log_system(f"Peer: {peer_id}")
                    reply = json.dumps({"type": "HELLO", "node_id": self.node_id}).encode() + b'\n'
                    self.transport.send(reply)
            
            elif ptype == "MESSAGE":
                from_id = packet.get("from")
                to_id = packet.get("to")
                payload = packet.get("payload")
                
                if to_id == self.node_id or to_id == "ALL":
                    self.master.after(0, lambda: self._log_incoming(from_id, payload))
        
        except Exception as e:
            print(f"Error: {e}")

    def _start_heartbeat(self):
        def heartbeat_loop():
            while self.running:
                hello = json.dumps({"type": "HELLO", "node_id": self.node_id}).encode() + b'\n'
                if self.transport:
                    self.transport.send(hello)
                time.sleep(3)
        threading.Thread(target=heartbeat_loop, daemon=True).start()

    def _send_message(self):
        if not self.running or not self.transport:
            messagebox.showwarning("Not Connected", "Connect first")
            return

        recipient = self.recipient_entry.get().strip()
        message = self.message_entry.get().strip()

        if not recipient or not message:
            return

        packet = {
            "type": "MESSAGE",
            "from": self.node_id,
            "to": recipient,
            "payload": message,
            "id": f"{self.node_id}:{int(time.time()*1000)}",
        }
        
        data = json.dumps(packet).encode() + b'\n'
        if self.transport.send(data):
            self._log_outgoing(recipient, message)
            self.message_entry.delete(0, tk.END)
        else:
            self._log_error("Send failed")

    def _log_system(self, text):
        self._append_to_chat(f"[SYS] {text}", self.TEXT_WARNING)

    def _log_error(self, text):
        self._append_to_chat(f"[ERR] {text}", self.TEXT_ERROR)

    def _log_incoming(self, sender, message):
        ts = datetime.now().strftime("%H:%M:%S")
        self._append_to_chat(f"[{ts}] ", self.TEXT_MUTED, False)
        self._append_to_chat(f"{sender}", self.TEXT_SECONDARY, False)
        self._append_to_chat(f" → You: ", self.TEXT_MUTED, False)
        self._append_to_chat(f"{message}", self.TEXT_PRIMARY)

    def _log_outgoing(self, recipient, message):
        ts = datetime.now().strftime("%H:%M:%S")
        self._append_to_chat(f"[{ts}] ", self.TEXT_MUTED, False)
        self._append_to_chat(f"You", self.ACCENT, False)
        self._append_to_chat(f" → {recipient}: ", self.TEXT_MUTED, False)
        self._append_to_chat(f"{message}", self.TEXT_PRIMARY)

    def _append_to_chat(self, text, color, newline=True):
        self.chat_area.config(state=tk.NORMAL)
        self.chat_area.insert(tk.END, text, color)
        if newline:
            self.chat_area.insert(tk.END, "\n")
        self.chat_area.tag_config(color, foreground=color)
        self.chat_area.config(state=tk.DISABLED)
        if self.auto_scroll:
            self.chat_area.see(tk.END)

    def _update_peers_ui(self):
        self.peers_listbox.delete(0, tk.END)
        now = time.time()
        active = [p for p, t in self.peers.items() if now - t < 15]
        for peer in sorted(active):
            self.peers_listbox.insert(tk.END, f"● {peer}")

    def _update_info_panel(self):
        info = f"Node ID: {self.node_id}\n"
        info += f"Transport: WIFI HOTSPOT\n"
        info += f"Mode: {self.mode.upper()}\n"
        info += f"Status: Active\n\nDirect P2P - No Router"
        
        self.info_text.config(state=tk.NORMAL)
        self.info_text.delete(1.0, tk.END)
        self.info_text.insert(1.0, info)
        self.info_text.config(state=tk.DISABLED)

    def _on_peer_double_click(self, event):
        sel = self.peers_listbox.curselection()
        if sel:
            peer = self.peers_listbox.get(sel[0]).replace("● ", "")
            self.recipient_entry.delete(0, tk.END)
            self.recipient_entry.insert(0, peer)
            self.message_entry.focus()

    def on_closing(self):
        self.running = False
        if self.transport:
            self.transport.stop()
        self.master.destroy()


def main():
    root = tk.Tk()
    app = MeshChatGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()


if __name__ == "__main__":
    main()
