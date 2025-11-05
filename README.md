# CN_Project — Decentralized Mesh MVP (Simulator)

This repository contains a minimal, runnable desktop simulator for a decentralized mesh messaging network. Each node runs as a small UDP process on localhost and can relay messages over multiple hops (A → B → C) using flooding with TTL and simple reverse-route learning.

Goals:
- Learn the flow of a mesh network end-to-end (discovery → routing → forwarding → delivery → ACK)
- Provide a foundation for adding security (E2E + hop-by-hop), reliability, and advanced routing
- Keep dependencies minimal and code readable

## Features (MVP)
- HELLO handshake for neighbor discovery (manual seed)
- DATA messages with TTL and duplicate suppression
- Flooding + basic next-hop routing table (learned from traffic)
- ACK on delivery to destination
- In-memory inbox for tests or inspection

Not included yet: cryptography, duty cycling, energy-aware routing, DHT, ICE/STUN/TURN. These are planned next steps.

## Layout
- `src/mesh/mesh_node.py` — Core node implementation (UDP, JSON packets)
- `src/mesh/run_node.py` — CLI to run a node interactively
- `tests/test_simulation.py` — Single-process integration test spinning up A,B,C

## How to run (Windows bash)

Run three terminals (or run test):

```bash
# Terminal 1
python -m src.mesh.run_node A

# Terminal 2 (seed with A's port, shown by Terminal 1)
python -m src.mesh.run_node B 127.0.0.1:5XXX

# Terminal 3 (seed with B's port, shown by Terminal 2)
python -m src.mesh.run_node C 127.0.0.1:5YYY
```

From node A terminal:

```bash
send C Hello from A to C via B!
```

Alternatively, run the bundled simulation test:

```bash
python -m pytest -q tests/test_simulation.py
```

## Next steps
- Add hop-by-hop authentication (HMAC) and replay protection (seq + nonce + timestamp)
- Add E2E encryption using Noise protocol (XX pattern) and PFS
- Replace pure flooding with controlled flooding (MPR) and/or hybrid routing (cluster-local proactive + on-demand inter-cluster)
- Introduce store-and-forward with TTL and friend-node caching
- Build Android PoC using Bluetooth LE/Wi‑Fi Direct with similar packet schema

## License
For educational and research use.
