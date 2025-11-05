"""
Bluetooth transport layer for mesh network
Enables direct PC-to-PC communication without WiFi router
Cross-platform: Windows, Mac, Linux
"""
import socket
import threading
import time
from typing import Optional, Callable, Tuple
import json


# Try to import Bluetooth libraries (platform-specific)
BLUETOOTH_AVAILABLE = False
BT_LIB = None

try:
    import bluetooth  # PyBluez
    BLUETOOTH_AVAILABLE = True
    BT_LIB = "pybluez"
except ImportError:
    try:
        import bleak  # BLE alternative for Mac
        BLUETOOTH_AVAILABLE = True
        BT_LIB = "bleak"
    except ImportError:
        pass


class BluetoothTransport:
    """
    Bluetooth RFCOMM transport for mesh networking
    Server mode: Creates Bluetooth service and waits
    Client mode: Scans and connects to server
    """
    
    SERVICE_UUID = "94f39d29-7d6d-437d-973b-fba39e49d4ee"
    SERVICE_NAME = "MeshChat"
    
    def __init__(self, node_id: str, on_data_received: Optional[Callable[[bytes, str], None]] = None):
        self.node_id = node_id
        self.on_data_received = on_data_received
        self.running = False
        self.server_sock = None
        self.client_sock = None
        self.connections = {}  # addr -> socket
        self._lock = threading.Lock()
        
        if not BLUETOOTH_AVAILABLE:
            raise RuntimeError("Bluetooth not available. Install: pip install pybluez (or bleak on Mac)")
    
    def start_server(self, port: int = 1) -> Tuple[bool, str]:
        """
        Start Bluetooth server (advertise service)
        Returns: (success, message)
        """
        if BT_LIB != "pybluez":
            return False, "Server mode requires PyBluez"
        
        try:
            self.server_sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
            self.server_sock.bind(("", port))
            self.server_sock.listen(5)
            
            # Advertise service
            bluetooth.advertise_service(
                self.server_sock,
                self.SERVICE_NAME,
                service_id=self.SERVICE_UUID,
                service_classes=[self.SERVICE_UUID, bluetooth.SERIAL_PORT_CLASS],
                profiles=[bluetooth.SERIAL_PORT_PROFILE]
            )
            
            self.running = True
            threading.Thread(target=self._accept_loop, daemon=True).start()
            
            # Get local BT address
            local_addr = bluetooth.read_local_bdaddr()[0]
            return True, f"Bluetooth server started on {local_addr}"
            
        except Exception as e:
            return False, f"Failed to start BT server: {e}"
    
    def start_client(self, target_addr: str, port: int = 1) -> Tuple[bool, str]:
        """
        Connect to Bluetooth server
        target_addr: Bluetooth MAC address (e.g., "00:1A:7D:DA:71:13")
        """
        if BT_LIB != "pybluez":
            return False, "Client mode requires PyBluez"
        
        try:
            self.client_sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
            self.client_sock.connect((target_addr, port))
            
            with self._lock:
                self.connections[target_addr] = self.client_sock
            
            self.running = True
            threading.Thread(target=self._receive_loop, args=(self.client_sock, target_addr), daemon=True).start()
            
            return True, f"Connected to {target_addr}"
            
        except Exception as e:
            return False, f"Failed to connect: {e}"
    
    def scan_devices(self, duration: int = 8) -> list:
        """
        Scan for nearby Bluetooth devices
        Returns: [(name, address), ...]
        """
        if BT_LIB != "pybluez":
            return []
        
        try:
            devices = bluetooth.discover_devices(duration=duration, lookup_names=True, flush_cache=True)
            return devices
        except Exception as e:
            print(f"Bluetooth scan failed: {e}")
            return []
    
    def find_service(self, target_addr: str) -> Optional[int]:
        """Find MeshChat service on target device"""
        if BT_LIB != "pybluez":
            return None
        
        try:
            services = bluetooth.find_service(uuid=self.SERVICE_UUID, address=target_addr)
            if services:
                return services[0]["port"]
        except Exception:
            pass
        return None
    
    def send(self, data: bytes, target: Optional[str] = None) -> bool:
        """
        Send data to connected peer(s)
        target: specific BT address, or None for broadcast to all
        """
        with self._lock:
            if target and target in self.connections:
                try:
                    self.connections[target].send(data)
                    return True
                except Exception:
                    return False
            else:
                # Broadcast to all connections
                for addr, sock in list(self.connections.items()):
                    try:
                        sock.send(data)
                    except Exception:
                        pass
                return len(self.connections) > 0
    
    def _accept_loop(self):
        """Accept incoming connections (server)"""
        while self.running and self.server_sock:
            try:
                client_sock, client_addr = self.server_sock.accept()
                print(f"Accepted connection from {client_addr}")
                
                with self._lock:
                    self.connections[client_addr[0]] = client_sock
                
                threading.Thread(target=self._receive_loop, args=(client_sock, client_addr[0]), daemon=True).start()
                
            except Exception as e:
                if self.running:
                    print(f"Accept error: {e}")
                break
    
    def _receive_loop(self, sock, addr):
        """Receive data from a connection"""
        buffer = b""
        while self.running:
            try:
                chunk = sock.recv(1024)
                if not chunk:
                    break
                
                buffer += chunk
                
                # Simple framing: newline-delimited JSON
                while b'\n' in buffer:
                    line, buffer = buffer.split(b'\n', 1)
                    if line and self.on_data_received:
                        self.on_data_received(line, addr)
                        
            except Exception as e:
                print(f"Receive error from {addr}: {e}")
                break
        
        # Clean up
        with self._lock:
            if addr in self.connections:
                del self.connections[addr]
        try:
            sock.close()
        except:
            pass
    
    def stop(self):
        """Shutdown transport"""
        self.running = False
        
        # Close all connections
        with self._lock:
            for sock in self.connections.values():
                try:
                    sock.close()
                except:
                    pass
            self.connections.clear()
        
        # Close server
        if self.server_sock:
            try:
                bluetooth.stop_advertising(self.server_sock)
                self.server_sock.close()
            except:
                pass
        
        # Close client
        if self.client_sock:
            try:
                self.client_sock.close()
            except:
                pass


class WiFiDirectTransport:
    """
    WiFi hotspot/ad-hoc transport (fallback when no Bluetooth)
    Server creates hotspot, clients connect and use UDP
    """
    
    def __init__(self, node_id: str, on_data_received: Optional[Callable[[bytes, str], None]] = None):
        self.node_id = node_id
        self.on_data_received = on_data_received
        self.running = False
        self.sock = None
        self.port = 5000
        self._lock = threading.Lock()
    
    def start_server(self, port: int = 5000) -> Tuple[bool, str]:
        """
        Start WiFi hotspot server (bind to 0.0.0.0 and broadcast)
        Note: User must manually create WiFi hotspot in OS settings
        """
        try:
            self.port = port
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self.sock.bind(("0.0.0.0", port))
            self.sock.settimeout(0.5)
            
            self.running = True
            threading.Thread(target=self._receive_loop, daemon=True).start()
            
            # Get hotspot IP
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
                s.close()
            except:
                local_ip = "0.0.0.0"
            
            return True, f"WiFi server started on {local_ip}:{port}"
            
        except Exception as e:
            return False, f"Failed to start WiFi server: {e}"
    
    def start_client(self, hotspot_ip: str, port: int = 5000) -> Tuple[bool, str]:
        """
        Connect to WiFi hotspot (client mode)
        hotspot_ip: IP of hotspot creator (usually 192.168.137.1 or 192.168.2.1)
        Note: User must manually connect to hotspot WiFi in OS settings first
        """
        try:
            self.port = port
            self.hotspot_ip = hotspot_ip
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind(("0.0.0.0", port))
            self.sock.settimeout(0.5)
            
            self.running = True
            threading.Thread(target=self._receive_loop, daemon=True).start()
            
            # Send initial HELLO to announce presence
            hello = json.dumps({"type": "HELLO", "node_id": self.node_id}).encode() + b'\n'
            self.sock.sendto(hello, (hotspot_ip, port))
            
            return True, f"Connected to hotspot {hotspot_ip}:{port}"
            
        except Exception as e:
            return False, f"Failed to connect to hotspot: {e}"
    
    def send(self, data: bytes, target: Optional[str] = None) -> bool:
        """
        Send data via UDP
        target: IP address, or None for broadcast
        """
        if not self.sock or not self.running:
            return False
        
        try:
            if target:
                self.sock.sendto(data, (target, self.port))
            else:
                # Broadcast
                self.sock.sendto(data, ("255.255.255.255", self.port))
            return True
        except Exception:
            return False
    
    def _receive_loop(self):
        """Receive UDP packets"""
        while self.running and self.sock:
            try:
                data, addr = self.sock.recvfrom(8192)
                if data and self.on_data_received:
                    self.on_data_received(data.rstrip(b'\n'), addr[0])
            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    print(f"Receive error: {e}")
                break
    
    def stop(self):
        """Shutdown transport"""
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
