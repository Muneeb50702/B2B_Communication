import time
import threading
from src.mesh.mesh_node import MeshNode


def run_three_node_simulation():
    a = MeshNode("A", 5101)
    b = MeshNode("B", 5102)
    c = MeshNode("C", 5103)
    a.start(); b.start(); c.start()

    # Seed neighbor discovery chain A<->B and B<->C
    a.connect_to_peer("127.0.0.1", 5102)
    b.connect_to_peer("127.0.0.1", 5101)
    b.connect_to_peer("127.0.0.1", 5103)
    c.connect_to_peer("127.0.0.1", 5102)

    # allow hellos to exchange
    time.sleep(0.5)

    a.send_message("C", "Hello from A to C via B!")

    # wait for delivery
    t0 = time.time()
    delivered = False
    while time.time() - t0 < 3.0:
        inbox_c = c.get_inbox()
        if any(m.get("payload") == "Hello from A to C via B!" for m in inbox_c):
            delivered = True
            break
        time.sleep(0.05)

    # cleanup
    a.stop(); b.stop(); c.stop()

    return delivered


def test_message_delivered_end_to_end():
    assert run_three_node_simulation() is True
