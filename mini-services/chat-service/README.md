# NEXUS Chat Service

A standalone **Socket.io** real-time chat mini-service for the NEXUS AI app.

- **Port:** `3001` (hardcoded — the Caddy gateway forwards traffic here based on the `XTransformPort` query param).
- **Runtime:** [Bun](https://bun.sh) with `bun --hot` for auto-reload during development.
- **Module system:** ESM (`"type": "module"`).

## Run

```bash
cd mini-services/chat-service
bun install
bun run dev
```

The dev script uses `bun --hot index.ts`, so the service auto-restarts when files change.

## How the frontend connects

The Next.js app sits behind a Caddy gateway that only exposes one external port.
**Never** connect directly to `http://localhost:3001`. Instead, let the gateway
forward the request by putting the port in the `XTransformPort` query parameter
and keeping the path as `/`:

```ts
import { io } from 'socket.io-client'

const socket = io('/?XTransformPort=3001', {
  transports: ['websocket', 'polling'],
})
```

## Room model

Each project maps to a room named `project:<projectId>`. All chat events are
scoped to that room.

## Protocol

| Client → Server        | Payload                                            | Description                                  |
| ---------------------- | -------------------------------------------------- | -------------------------------------------- |
| `join`                 | `{ projectId, name, role }`                        | Join `project:<projectId>` room.             |
| `send_message`         | `{ projectId, name, role, message }`               | Broadcast a chat message to the room.        |
| `typing`               | `{ projectId, name }`                              | Notify others that the user is typing.       |

| Server → Client        | Payload                                            | Description                                  |
| ---------------------- | -------------------------------------------------- | -------------------------------------------- |
| `user_joined`          | `{ projectId, name, role, socketId, timestamp }`   | A user joined the room (incl. to the joiner).|
| `message`              | `{ name, role, message, timestamp }`               | A chat message — sent to everyone in the room (incl. sender). |
| `typing`               | `{ projectId, name, timestamp }`                   | Someone is typing (excludes the typist).     |
| `user_left`            | `{ projectId, name, role, socketId, timestamp }`   | A user left the room.                        |
| `error`                | `{ message }`                                      | Malformed event payload.                     |
