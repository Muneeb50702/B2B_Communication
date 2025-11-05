"""
Mesh Network Chat GUI - Terminal/Cyberpunk Theme
Runs over WiFi (LAN) - no internet needed, just same local network
"""
import tkinter as tk
from tkinter import scrolledtext, messagebox
import threading
import time
import socket
from datetime import datetime
import sys
import os

# Add parent to path for imports
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

from mesh.mesh_node import MeshNode


class MeshChatGUI:
    # Cyberpunk/Terminal color scheme
    BG_DARK = "#0a0e27"
    BG_MID = "#151935"
    BG_INPUT = "#1a1f3a"
    TEXT_PRIMARY = "#00ff41"
    TEXT_SECONDARY = "#00d9ff"
    TEXT_MUTED = "#5a7c8c"
    TEXT_ERROR = "#ff0055"
    TEXT_WARNING = "#ffaa00"
    ACCENT = "#00ffff"
    BORDER = "#2a3f5f"

    def __init__(self, master):
        self.master = master
        self.master.title("🌐 Mesh Chat - Offline Network")
        self.master.geometry("900x700")
        self.master.configure(bg=self.BG_DARK)
        self.master.resizable(True, True)

        # State
        self.node = None
        self.node_id = None
        self.running = False
        self.auto_scroll = True

        self._build_ui()
        self._start_connection_dialog()

    def _build_ui(self):
        # Top bar - Status
        top_frame = tk.Frame(self.master, bg=self.BG_MID, height=60)
        top_frame.pack(fill=tk.X, padx=0, pady=0)
        top_frame.pack_propagate(False)

        self.status_label = tk.Label(
            top_frame,
            text="⚫ DISCONNECTED",
            font=("Consolas", 11, "bold"),
            bg=self.BG_MID,
            fg=self.TEXT_ERROR,
            anchor="w",
            padx=20,
        )
        self.status_label.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.node_label = tk.Label(
            top_frame,
            text="Node: ---",
            font=("Consolas", 10),
            bg=self.BG_MID,
            fg=self.TEXT_MUTED,
            anchor="e",
            padx=20,
        )
        self.node_label.pack(side=tk.RIGHT)

        # Main container
        main_container = tk.Frame(self.master, bg=self.BG_DARK)
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Left side - Chat + Input
        chat_frame = tk.Frame(main_container, bg=self.BG_DARK)
        chat_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Chat history with custom scrollbar
        chat_label = tk.Label(
            chat_frame,
            text="█ MESSAGE STREAM",
            font=("Consolas", 10, "bold"),
            bg=self.BG_DARK,
            fg=self.TEXT_SECONDARY,
            anchor="w",
        )
        chat_label.pack(fill=tk.X, pady=(0, 5))

        chat_container = tk.Frame(chat_frame, bg=self.BORDER, bd=0)
        chat_container.pack(fill=tk.BOTH, expand=True)

        self.chat_area = scrolledtext.ScrolledText(
            chat_container,
            wrap=tk.WORD,
            font=("Consolas", 10),
            bg=self.BG_MID,
            fg=self.TEXT_PRIMARY,
            insertbackground=self.ACCENT,
            relief=tk.FLAT,
            padx=10,
            pady=10,
            state=tk.DISABLED,
            borderwidth=2,
            highlightthickness=0,
        )
        self.chat_area.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)

        # Input area
        input_frame = tk.Frame(chat_frame, bg=self.BG_DARK)
        input_frame.pack(fill=tk.X, pady=(10, 0))

        input_label = tk.Label(
            input_frame,
            text="█ COMPOSE MESSAGE",
            font=("Consolas", 10, "bold"),
            bg=self.BG_DARK,
            fg=self.TEXT_SECONDARY,
            anchor="w",
        )
        input_label.pack(fill=tk.X, pady=(0, 5))

        input_container = tk.Frame(input_frame, bg=self.BG_DARK)
        input_container.pack(fill=tk.X)

        # Recipient field
        recipient_row = tk.Frame(input_container, bg=self.BG_DARK)
        recipient_row.pack(fill=tk.X, pady=(0, 5))

        tk.Label(
            recipient_row,
            text="TO:",
            font=("Consolas", 9, "bold"),
            bg=self.BG_DARK,
            fg=self.TEXT_MUTED,
            width=5,
            anchor="w",
        ).pack(side=tk.LEFT)

        self.recipient_entry = tk.Entry(
            recipient_row,
            font=("Consolas", 10),
            bg=self.BG_INPUT,
            fg=self.TEXT_PRIMARY,
            insertbackground=self.ACCENT,
            relief=tk.FLAT,
            borderwidth=2,
            highlightthickness=1,
            highlightbackground=self.BORDER,
            highlightcolor=self.ACCENT,
        )
        self.recipient_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))

        # Message field
        message_row = tk.Frame(input_container, bg=self.BG_DARK)
        message_row.pack(fill=tk.X)

        tk.Label(
            message_row,
            text="MSG:",
            font=("Consolas", 9, "bold"),
            bg=self.BG_DARK,
            fg=self.TEXT_MUTED,
            width=5,
            anchor="w",
        ).pack(side=tk.LEFT)

        self.message_entry = tk.Entry(
            message_row,
            font=("Consolas", 10),
            bg=self.BG_INPUT,
            fg=self.TEXT_PRIMARY,
            insertbackground=self.ACCENT,
            relief=tk.FLAT,
            borderwidth=2,
            highlightthickness=1,
            highlightbackground=self.BORDER,
            highlightcolor=self.ACCENT,
        )
        self.message_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 5))
        self.message_entry.bind("<Return>", lambda e: self._send_message())

        self.send_btn = tk.Button(
            message_row,
            text="⚡ SEND",
            font=("Consolas", 10, "bold"),
            bg=self.ACCENT,
            fg=self.BG_DARK,
            activebackground=self.TEXT_SECONDARY,
            activeforeground=self.BG_DARK,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._send_message,
            width=10,
        )
        self.send_btn.pack(side=tk.LEFT)

        # Right sidebar - Peers & Info
        sidebar = tk.Frame(main_container, bg=self.BG_DARK, width=250)
        sidebar.pack(side=tk.RIGHT, fill=tk.Y, padx=(10, 0))
        sidebar.pack_propagate(False)

        # Peers section
        peers_label = tk.Label(
            sidebar,
            text="█ CONNECTED PEERS",
            font=("Consolas", 10, "bold"),
            bg=self.BG_DARK,
            fg=self.TEXT_SECONDARY,
            anchor="w",
        )
        peers_label.pack(fill=tk.X, pady=(0, 5))

        peers_container = tk.Frame(sidebar, bg=self.BORDER, bd=0)
        peers_container.pack(fill=tk.BOTH, expand=True)

        self.peers_listbox = tk.Listbox(
            peers_container,
            font=("Consolas", 9),
            bg=self.BG_MID,
            fg=self.TEXT_PRIMARY,
            selectbackground=self.ACCENT,
            selectforeground=self.BG_DARK,
            relief=tk.FLAT,
            borderwidth=2,
            highlightthickness=0,
            activestyle="none",
        )
        self.peers_listbox.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)
        self.peers_listbox.bind("<Double-Button-1>", self._on_peer_double_click)

        # Info section
        info_label = tk.Label(
            sidebar,
            text="█ NETWORK INFO",
            font=("Consolas", 10, "bold"),
            bg=self.BG_DARK,
            fg=self.TEXT_SECONDARY,
            anchor="w",
        )
        info_label.pack(fill=tk.X, pady=(15, 5))

        info_container = tk.Frame(sidebar, bg=self.BORDER, bd=0)
        info_container.pack(fill=tk.X)

        self.info_text = tk.Text(
            info_container,
            height=8,
            font=("Consolas", 8),
            bg=self.BG_MID,
            fg=self.TEXT_MUTED,
            relief=tk.FLAT,
            borderwidth=2,
            highlightthickness=0,
            state=tk.DISABLED,
            wrap=tk.WORD,
        )
        self.info_text.pack(fill=tk.X, padx=2, pady=2)

        # Footer
        footer = tk.Frame(self.master, bg=self.BG_MID, height=30)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        footer.pack_propagate(False)

        self.footer_label = tk.Label(
            footer,
            text="⚡ Ready to connect",
            font=("Consolas", 9),
            bg=self.BG_MID,
            fg=self.TEXT_MUTED,
            anchor="w",
            padx=20,
        )
        self.footer_label.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def _start_connection_dialog(self):
        """Simple dialog to get node ID and optionally a seed peer"""
        dialog = tk.Toplevel(self.master)
        dialog.title("Connect to Mesh Network")
        dialog.geometry("450x280")
        dialog.configure(bg=self.BG_DARK)
        dialog.resizable(False, False)
        dialog.transient(self.master)
        dialog.grab_set()

        # Center dialog
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - (450 // 2)
        y = (dialog.winfo_screenheight() // 2) - (280 // 2)
        dialog.geometry(f"450x280+{x}+{y}")

        tk.Label(
            dialog,
            text="🌐 JOIN MESH NETWORK",
            font=("Consolas", 14, "bold"),
            bg=self.BG_DARK,
            fg=self.ACCENT,
        ).pack(pady=(20, 10))

        tk.Label(
            dialog,
            text="WiFi LAN • No Internet Required",
            font=("Consolas", 9),
            bg=self.BG_DARK,
            fg=self.TEXT_MUTED,
        ).pack(pady=(0, 20))

        # Node ID
        frame1 = tk.Frame(dialog, bg=self.BG_DARK)
        frame1.pack(fill=tk.X, padx=30, pady=5)
        tk.Label(
            frame1,
            text="Your Node ID:",
            font=("Consolas", 10),
            bg=self.BG_DARK,
            fg=self.TEXT_SECONDARY,
            width=15,
            anchor="w",
        ).pack(side=tk.LEFT)
        node_id_entry = tk.Entry(
            frame1,
            font=("Consolas", 10),
            bg=self.BG_INPUT,
            fg=self.TEXT_PRIMARY,
            insertbackground=self.ACCENT,
        )
        node_id_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        node_id_entry.insert(0, f"Node{socket.gethostname()[:8]}")

        # Port
        frame2 = tk.Frame(dialog, bg=self.BG_DARK)
        frame2.pack(fill=tk.X, padx=30, pady=5)
        tk.Label(
            frame2,
            text="Listen Port:",
            font=("Consolas", 10),
            bg=self.BG_DARK,
            fg=self.TEXT_SECONDARY,
            width=15,
            anchor="w",
        ).pack(side=tk.LEFT)
        port_entry = tk.Entry(
            frame2,
            font=("Consolas", 10),
            bg=self.BG_INPUT,
            fg=self.TEXT_PRIMARY,
            insertbackground=self.ACCENT,
        )
        port_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        port_entry.insert(0, "5000")

        # Seed peer (optional)
        frame3 = tk.Frame(dialog, bg=self.BG_DARK)
        frame3.pack(fill=tk.X, padx=30, pady=5)
        tk.Label(
            frame3,
            text="Seed Peer (opt):",
            font=("Consolas", 10),
            bg=self.BG_DARK,
            fg=self.TEXT_SECONDARY,
            width=15,
            anchor="w",
        ).pack(side=tk.LEFT)
        seed_entry = tk.Entry(
            frame3,
            font=("Consolas", 10),
            bg=self.BG_INPUT,
            fg=self.TEXT_PRIMARY,
            insertbackground=self.ACCENT,
        )
        seed_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        seed_entry.insert(0, "192.168.x.x:5000")

        tk.Label(
            dialog,
            text="Tip: Leave seed empty on first PC, fill on second PC",
            font=("Consolas", 8),
            bg=self.BG_DARK,
            fg=self.TEXT_MUTED,
        ).pack(pady=(10, 10))

        def on_connect():
            node_id = node_id_entry.get().strip()
            port_str = port_entry.get().strip()
            seed = seed_entry.get().strip()

            if not node_id:
                messagebox.showerror("Error", "Node ID is required")
                return
            try:
                port = int(port_str)
            except ValueError:
                messagebox.showerror("Error", "Port must be a number")
                return

            dialog.destroy()
            self._connect_to_network(node_id, port, seed if seed and "x" not in seed else None)

        btn = tk.Button(
            dialog,
            text="⚡ CONNECT",
            font=("Consolas", 11, "bold"),
            bg=self.ACCENT,
            fg=self.BG_DARK,
            activebackground=self.TEXT_SECONDARY,
            activeforeground=self.BG_DARK,
            relief=tk.FLAT,
            cursor="hand2",
            command=on_connect,
            width=20,
        )
        btn.pack(pady=(10, 20))

    def _connect_to_network(self, node_id, port, seed_peer):
        self.node_id = node_id
        
        # Get local IP
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except:
            local_ip = "127.0.0.1"

        # Create node - bind to all interfaces for LAN communication
        self.node = MeshNode(node_id, port, on_message=self._on_message_received)
        # Patch socket to bind to 0.0.0.0 for LAN
        self.node._sock.close()
        self.node._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.node._sock.bind(("0.0.0.0", port))
        self.node._sock.settimeout(0.5)
        
        self.node.start()
        self.running = True

        self.status_label.config(text="🟢 CONNECTED", fg=self.TEXT_PRIMARY)
        self.node_label.config(text=f"Node: {node_id}", fg=self.TEXT_PRIMARY)
        
        self._log_system(f"Node '{node_id}' online at {local_ip}:{port}")
        
        # Update info
        self._update_info_panel(local_ip, port)

        # Connect to seed if provided
        if seed_peer:
            try:
                peer_ip, peer_port = seed_peer.split(":")
                peer_port = int(peer_port)
                self.node.connect_to_peer(peer_ip, peer_port)
                self._log_system(f"Connecting to seed: {peer_ip}:{peer_port}")
            except Exception as e:
                self._log_error(f"Invalid seed peer format: {e}")

        # Start UI update loop
        self._update_peers_loop()

    def _on_message_received(self, delivery):
        """Callback from MeshNode when message arrives"""
        sender = delivery.get("from", "Unknown")
        payload = delivery.get("payload", "")
        msg_id = delivery.get("id", "")
        
        self.master.after(0, lambda: self._log_incoming(sender, payload))

    def _send_message(self):
        if not self.running or not self.node:
            messagebox.showwarning("Not Connected", "Connect to network first")
            return

        recipient = self.recipient_entry.get().strip()
        message = self.message_entry.get().strip()

        if not recipient:
            messagebox.showwarning("No Recipient", "Enter recipient Node ID")
            return
        if not message:
            return

        # Send via mesh
        self.node.send_message(recipient, message)
        self._log_outgoing(recipient, message)
        self.message_entry.delete(0, tk.END)
        self.footer_label.config(text=f"⚡ Sent to {recipient}")

    def _log_system(self, text):
        self._append_to_chat(f"[SYS] {text}", self.TEXT_WARNING)

    def _log_error(self, text):
        self._append_to_chat(f"[ERR] {text}", self.TEXT_ERROR)

    def _log_incoming(self, sender, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self._append_to_chat(f"[{timestamp}] ", self.TEXT_MUTED, newline=False)
        self._append_to_chat(f"{sender}", self.TEXT_SECONDARY, newline=False)
        self._append_to_chat(f" → You: ", self.TEXT_MUTED, newline=False)
        self._append_to_chat(f"{message}", self.TEXT_PRIMARY)

    def _log_outgoing(self, recipient, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self._append_to_chat(f"[{timestamp}] ", self.TEXT_MUTED, newline=False)
        self._append_to_chat(f"You", self.ACCENT, newline=False)
        self._append_to_chat(f" → {recipient}: ", self.TEXT_MUTED, newline=False)
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

    def _update_peers_loop(self):
        if not self.running:
            return
        
        if self.node:
            peers = list(self.node.neighbors.keys())
            current = set(self.peers_listbox.get(0, tk.END))
            new_set = set(peers)
            
            if current != new_set:
                self.peers_listbox.delete(0, tk.END)
                for peer in sorted(peers):
                    self.peers_listbox.insert(tk.END, f"● {peer}")
        
        self.master.after(2000, self._update_peers_loop)

    def _update_info_panel(self, ip, port):
        info = f"IP: {ip}\n"
        info += f"Port: {port}\n"
        info += f"Protocol: UDP\n"
        info += f"Transport: WiFi LAN\n"
        info += f"Encryption: None (MVP)\n"
        info += f"Status: Active\n"
        
        self.info_text.config(state=tk.NORMAL)
        self.info_text.delete(1.0, tk.END)
        self.info_text.insert(1.0, info)
        self.info_text.config(state=tk.DISABLED)

    def _on_peer_double_click(self, event):
        selection = self.peers_listbox.curselection()
        if selection:
            peer = self.peers_listbox.get(selection[0]).replace("● ", "")
            self.recipient_entry.delete(0, tk.END)
            self.recipient_entry.insert(0, peer)
            self.message_entry.focus()

    def on_closing(self):
        if self.node:
            self.running = False
            self.node.stop()
        self.master.destroy()


def main():
    root = tk.Tk()
    app = MeshChatGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()


if __name__ == "__main__":
    main()
