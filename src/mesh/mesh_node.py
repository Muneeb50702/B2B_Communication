import json
import socket
import threading
import time
import uuid
from typing import Callable, Dict, Optional, Tuple, List


class MeshNode:
    """
    Minimal UDP-based mesh node for desktop simulation.
    - Neighbor discovery via HELLO handshake (manual seed via connect_to_peer)
    - DATA messages with TTL and flooding; simple routing_table learning for direct neighbors
    - Duplicate suppression via msg_id set
    - ACK on delivery to destination
    - In-memory inbox to assert in tests or attach a callback

    This is a learning/prototyping scaffold; no cryptography here yet.
    """

    def __init__(self, node_id: str, listen_port: int, on_message: Optional[Callable[[dict], None]] = None):
        self.node_id = node_id
        self.listen_port = listen_port
        self.neighbors: Dict[str, Tuple[str, int]] = {}  # neighbor_id -> (ip, port)
        self.routing_table: Dict[str, str] = {}  # dest_id -> next_hop_id
        self.sequence_num = 0
        self.delivered_messages: set[str] = set()
        self.running = False
        self.inbox: List[dict] = []
        self.on_message = on_message

        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.bind(("127.0.0.1", listen_port))  # loopback for local sim
        self._sock.settimeout(0.5)
        self._listen_thread: Optional[threading.Thread] = None
        self._hb_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    # ----- lifecycle -----
    def start(self):
        if self.running:
            return
        self.running = True
        self._listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._listen_thread.start()
        self._hb_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._hb_thread.start()

    def stop(self):
        self.running = False
        try:
            self._sock.close()
        except Exception:
            pass
        if self._listen_thread:
            self._listen_thread.join(timeout=1.0)
        if self._hb_thread:
            self._hb_thread.join(timeout=1.0)

    # ----- networking -----
    def _listen_loop(self):
        while self.running:
            try:
                data, addr = self._sock.recvfrom(8192)
            except socket.timeout:
                continue
            except OSError:
                break
            try:
                packet = json.loads(data.decode("utf-8"))
            except Exception:
                continue
            self._handle_packet(packet, addr)

    def _send(self, packet: dict, addr: Tuple[str, int]):
        try:
            self._sock.sendto(json.dumps(packet).encode("utf-8"), addr)
        except OSError:
            pass

    def _heartbeat_loop(self):
        # Periodic HELLO to maintain neighbor liveness
        while self.running:
            with self._lock:
                neighbors = list(self.neighbors.items())
            for neighbor_id, addr in neighbors:
                self._send_hello(addr)
            time.sleep(5)

    # ----- packet handling -----
    def _handle_packet(self, packet: dict, addr: Tuple[str, int]):
        ptype = packet.get("type")
        if ptype == "HELLO":
            self._handle_hello(packet, addr)
        elif ptype == "DATA":
            self._handle_data(packet)
        elif ptype == "ACK":
            # For now just print; could manage retries here later
            # print(f"{self.node_id}: ACK for {packet.get('msg_id')} from {packet.get('source')}")
            pass

    def _handle_hello(self, packet: dict, addr: Tuple[str, int]):
        neighbor_id = packet.get("node_id")
        if not neighbor_id:
            return
        with self._lock:
            self.neighbors[neighbor_id] = addr
            # learn direct route
            self.routing_table[neighbor_id] = neighbor_id
        # respond with HELLO
        self._send_hello(addr)

    def _handle_data(self, packet: dict):
        msg_id = packet.get("msg_id")
        if not msg_id:
            return
        # duplicate suppression
        if msg_id in self.delivered_messages:
            return
        self.delivered_messages.add(msg_id)

        dest = packet.get("dest")
        ttl = int(packet.get("ttl", 0))
        source = packet.get("source")
        # Learn reverse route: route to source via prev_hop if present
        prev_hop = packet.get("prev_hop")
        if prev_hop and source:
            with self._lock:
                self.routing_table[source] = prev_hop

        if dest == self.node_id:
            # deliver locally
            payload = packet.get("payload")
            delivery = {
                "from": source,
                "id": msg_id,
                "payload": payload,
                "timestamp": time.time(),
            }
            with self._lock:
                self.inbox.append(delivery)
            if self.on_message:
                try:
                    self.on_message(delivery)
                except Exception:
                    pass
            # send ACK back toward source if possible
            self._send_ack(source, msg_id)
            return

        # forward if TTL
        if ttl <= 0:
            return
        packet["ttl"] = ttl - 1
        packet["prev_hop"] = self.node_id
        self._forward(packet)

    # ----- message building -----
    def _send_hello(self, addr: Tuple[str, int]):
        packet = {
            "type": "HELLO",
            "node_id": self.node_id,
            "port": self.listen_port,
            "timestamp": time.time(),
        }
        self._send(packet, addr)

    def send_message(self, dest_id: str, payload: str, ttl: int = 7):
        self.sequence_num += 1
        # unique message id
        msg_id = f"{self.node_id}:{self.sequence_num}:{uuid.uuid4().hex[:8]}"
        packet = {
            "type": "DATA",
            "msg_id": msg_id,
            "source": self.node_id,
            "dest": dest_id,
            "ttl": ttl,
            "payload": payload,
            "timestamp": time.time(),
        }
        # send via route or flood
        next_hop = None
        with self._lock:
            next_hop = self.routing_table.get(dest_id)
            neighbors_items = list(self.neighbors.items())
        if next_hop and next_hop in dict(neighbors_items):
            self._send(packet, dict(neighbors_items)[next_hop])
        else:
            # flood
            for neighbor_id, addr in neighbors_items:
                self._send(packet, addr)

    def _forward(self, packet: dict):
        dest = packet.get("dest")
        with self._lock:
            next_hop = self.routing_table.get(dest)
            neighbors_items = list(self.neighbors.items())
        neighbors_map = dict(neighbors_items)
        if next_hop and next_hop in neighbors_map:
            self._send(packet, neighbors_map[next_hop])
        else:
            # flood to all except the prev_hop
            prev_hop = packet.get("prev_hop")
            for neighbor_id, addr in neighbors_items:
                if neighbor_id == prev_hop:
                    continue
                self._send(packet, addr)

    def _send_ack(self, dest: Optional[str], msg_id: str):
        if not dest:
            return
        packet = {
            "type": "ACK",
            "msg_id": msg_id,
            "source": self.node_id,
            "dest": dest,
            "timestamp": time.time(),
        }
        # try best-effort to send toward dest using routing table or direct neighbor if known
        with self._lock:
            next_hop = self.routing_table.get(dest)
            neighbors_items = list(self.neighbors.items())
        neighbors_map = dict(neighbors_items)
        if next_hop and next_hop in neighbors_map:
            self._send(packet, neighbors_map[next_hop])
        elif dest in neighbors_map:
            self._send(packet, neighbors_map[dest])
        else:
            # flood as fallback
            for _, addr in neighbors_items:
                self._send(packet, addr)

    # ----- public API -----
    def connect_to_peer(self, ip: str, port: int):
        # initial seed peer
        self._send_hello((ip, port))

    def get_inbox(self) -> List[dict]:
        with self._lock:
            return list(self.inbox)

    def add_static_neighbor(self, neighbor_id: str, ip: str, port: int):
        # optional manual wiring for tests
        with self._lock:
            self.neighbors[neighbor_id] = (ip, port)
            self.routing_table[neighbor_id] = neighbor_id
