# Architecture
```
Browser (React) ──HTTPS──▶ Express REST  ┐
        └────WebSocket───▶ Socket.IO ────┼─▶ repository layer ─▶ Supabase PostgreSQL
                          room state     ┘   (pgRepo | MemoryRepo for tests)
                          (process memory)
```
- **Daily Dangal / challenges:** server serves one question at a time, scores each answer, saves the final attempt (unique ranked attempt per player/day; idempotency keys). In-progress runs are in memory.
- **Live rooms:** waiting → countdown → playing → reveal → … → completed (or voided). Server owns questions, deadlines and scoring; clients only submit choices. Finalization is guarded by an in-memory flag and a DB idempotency key. Disconnects get a 30 s grace period; idle rooms expire (TTL).
- **Restart behaviour:** active rooms are lost; finished results remain in Postgres; clients see "room not found / match interrupted".
- **Scaling:** one backend instance only. Before adding more: Socket.IO Redis adapter, shared room/progress state, sticky sessions.
