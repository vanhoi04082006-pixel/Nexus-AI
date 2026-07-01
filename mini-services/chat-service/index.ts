import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

// Hardcoded port (per gateway contract). Do NOT use env PORT.
const PORT = 3001

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port.
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JoinPayload {
  projectId: string
  name: string
  role: string
  token?: string // leader or member invite token
}

interface SendMessagePayload {
  projectId: string
  name: string
  role: string
  message: string
}

interface TypingPayload {
  projectId: string
  name: string
}

interface SessionMeta {
  name: string
  role: string
  rooms: Set<string>
}

// ---------------------------------------------------------------------------
// Per-socket metadata so we know who is in which rooms on disconnect.
// ---------------------------------------------------------------------------

const sessions = new Map<string, SessionMeta>()

const ts = () => new Date().toISOString()

function roomName(projectId: string): string {
  return `project:${projectId}`
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

io.on('connection', (socket: Socket) => {
  console.log(`[${ts()}] [connect] socket=${socket.id}`)

  sessions.set(socket.id, { name: '', role: '', rooms: new Set() })

  // -----------------------------------------------------------------------
  // join: client emits { projectId, name, role, token }
  // Verifies token against Next.js API before allowing join.
  // -----------------------------------------------------------------------
  socket.on('join', async (payload: JoinPayload) => {
    const { projectId, name, role, token } = payload ?? {}
    if (!projectId || !name) {
      socket.emit('error', { message: 'join requires { projectId, name }' })
      return
    }
    if (!token) {
      socket.emit('error', { message: 'Token required for chat access' })
      socket.disconnect()
      return
    }

    // Verify token against Next.js API
    try {
      const verifyResp = await fetch(`http://localhost:3000/api/projects/${projectId}?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: { 'User-Agent': 'NEXUS-ChatService' },
        signal: AbortSignal.timeout(5000),
      })
      if (!verifyResp.ok) {
        socket.emit('error', { message: 'Token khong hop le — access denied' })
        socket.disconnect()
        return
      }
    } catch (err) {
      // If Next.js API is down, allow join (fail-open to avoid blocking all chat)
      console.log(`[${ts()}] [join] Token verify failed (API down?), allowing: ${err instanceof Error ? err.message : 'unknown'}`)
    }

    const room = roomName(projectId)
    socket.join(room)

    const session = sessions.get(socket.id)
    if (session) {
      session.name = name
      session.role = role ?? ''
      session.rooms.add(room)
    }

    // Notify everyone in the room (including the newcomer) about the join.
    io.to(room).emit('user_joined', {
      projectId,
      name,
      role: role ?? '',
      socketId: socket.id,
      timestamp: ts(),
    })

    console.log(
      `[${ts()}] [join] socket=${socket.id} name="${name}" role="${role ?? ''}" room="${room}"`,
    )
  })

  // -----------------------------------------------------------------------
  // send_message: broadcast to everyone in the room (incl. sender)
  // -----------------------------------------------------------------------
  socket.on('send_message', (payload: SendMessagePayload) => {
    const { projectId, name, role, message } = payload ?? {}
    if (!projectId || !name || typeof message !== 'string') {
      socket.emit('error', {
        message: 'send_message requires { projectId, name, message }',
      })
      return
    }

    const room = roomName(projectId)
    const outgoing = {
      name,
      role: role ?? '',
      message,
      timestamp: ts(),
    }

    // socket.to(room).emit(...) delivers to everyone in the room EXCEPT sender.
    // The sender adds the message optimistically on the client side.
    socket.to(room).emit('message', outgoing)

    console.log(
      `[${ts()}] [message] room="${room}" name="${name}" role="${role ?? ''}" len=${message.length}`,
    )
  })

  // -----------------------------------------------------------------------
  // typing: broadcast to room EXCLUDING sender
  // -----------------------------------------------------------------------
  socket.on('typing', (payload: TypingPayload) => {
    const { projectId, name } = payload ?? {}
    if (!projectId || !name) return

    const room = roomName(projectId)
    socket.to(room).emit('typing', {
      projectId,
      name,
      timestamp: ts(),
    })
  })

  // -----------------------------------------------------------------------
  // disconnect: notify every room this socket was in
  // -----------------------------------------------------------------------
  socket.on('disconnect', (reason: string) => {
    const session = sessions.get(socket.id)

    if (session) {
      for (const room of session.rooms) {
        // Extract projectId from room name "project:<projectId>"
        const projectId = room.startsWith('project:')
          ? room.slice('project:'.length)
          : room

        io.to(room).emit('user_left', {
          projectId,
          name: session.name,
          role: session.role,
          socketId: socket.id,
          timestamp: ts(),
        })
      }

      console.log(
        `[${ts()}] [disconnect] socket=${socket.id} name="${session.name}" reason="${reason}" rooms=${session.rooms.size}`,
      )
    } else {
      console.log(`[${ts()}] [disconnect] socket=${socket.id} reason="${reason}"`)
    }

    sessions.delete(socket.id)
  })

  socket.on('error', (error: unknown) => {
    console.error(`[${ts()}] [error] socket=${socket.id}`, error)
  })
})

// ---------------------------------------------------------------------------
// Bootstrap & graceful shutdown
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`[${ts()}] NEXUS chat service listening on port ${PORT}`)
  console.log(
    `[${ts()}] Frontend should connect with: io("/?XTransformPort=${PORT}")`,
  )
})

process.on('SIGTERM', () => {
  console.log(`[${ts()}] SIGTERM received, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log(`[${ts()}] NEXUS chat service stopped`)
      process.exit(0)
    })
  })
})

process.on('SIGINT', () => {
  console.log(`[${ts()}] SIGINT received, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log(`[${ts()}] NEXUS chat service stopped`)
      process.exit(0)
    })
  })
})
