import os
import sys
import time

# Ensure src is on sys.path when running directly
ROOT = os.path.dirname(os.path.dirname(__file__))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from mesh.mesh_node import MeshNode


def main():
    a = MeshNode("A", 5201)
    b = MeshNode("B", 5202)
    c = MeshNode("C", 5203)
    a.start(); b.start(); c.start()

    a.connect_to_peer("127.0.0.1", 5202)
    b.connect_to_peer("127.0.0.1", 5201)
    b.connect_to_peer("127.0.0.1", 5203)
    c.connect_to_peer("127.0.0.1", 5202)

    time.sleep(0.5)

    a.send_message("C", "Hello from A to C via B!")

    t0 = time.time()
    delivered = False
    while time.time() - t0 < 3.0:
        inbox_c = c.get_inbox()
        if any(m.get("payload") == "Hello from A to C via B!" for m in inbox_c):
            delivered = True
            break
        time.sleep(0.05)

    print("DELIVERED:" if delivered else "FAILED:", delivered)

    a.stop(); b.stop(); c.stop()


if __name__ == "__main__":
    main()
