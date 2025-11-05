import sys
import time
from mesh_node import MeshNode


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m src.mesh.run_node <node_id> [peer_ip:port]")
        sys.exit(1)

    node_id = sys.argv[1]
    port = 5000 + (abs(hash(node_id)) % 1000)
    node = MeshNode(node_id, port)
    node.start()
    print(f"Node {node_id} listening on 127.0.0.1:{port}")

    if len(sys.argv) > 2:
        peer = sys.argv[2].split(":")
        peer_ip = peer[0]
        peer_port = int(peer[1])
        node.connect_to_peer(peer_ip, peer_port)
        print(f"Seed hello sent to {peer_ip}:{peer_port}")

    try:
        while True:
            cmd = input(f"{node_id}> ").strip()
            if cmd == "quit":
                break
            elif cmd == "neighbors":
                print(f"Neighbors: {list(node.neighbors.keys())}")
            elif cmd == "routes":
                print(f"Routes: {node.routing_table}")
            elif cmd.startswith("send "):
                parts = cmd.split(" ", 2)
                if len(parts) < 3:
                    print("Usage: send <dest_id> <message>")
                    continue
                dest = parts[1]
                msg = parts[2]
                node.send_message(dest, msg)
                print(f"Sent to {dest}")
            elif cmd == "inbox":
                print(node.get_inbox())
            else:
                print("Commands: send <dest_id> <msg> | neighbors | routes | inbox | quit")
    except KeyboardInterrupt:
        pass
    finally:
        node.stop()
        time.sleep(0.2)


if __name__ == "__main__":
    main()
