import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'

// Hardcoded port (per gateway contract). Do NOT use env PORT.
const PORT = 3002

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'nexus-notification-service', connections: io.engine.clientsCount }))
    return
  }

  // Broadcast endpoint — called by Next.js API routes when a notification is created.
  // POST /broadcast { projectId, recipientEmail, notification: {...} }
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const payload = JSON.parse(body) as {
        projectId: string
        recipientEmail?: string | null
        notification: Record<string, unknown> & { id: string }
      }
      if (!payload.projectId || !payload.notification?.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'projectId and notification.id required' }))
        return
      }

      // Broadcast to the project room (everyone viewing that project)
      const room = `project:${payload.projectId}`
      io.to(room).emit('notification:new', {
        projectId: payload.projectId,
        recipientEmail: payload.recipientEmail ?? null,
        notification: payload.notification,
        timestamp: new Date().toISOString(),
      })

      // If targeted to a specific user, also emit on their personal channel
      if (payload.recipientEmail) {
        io.to(`user:${payload.recipientEmail}`).emit('notification:new', {
          projectId: payload.projectId,
          recipientEmail: payload.recipientEmail,
          notification: payload.notification,
          timestamp: new Date().toISOString(),
        })
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, broadcast: true }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON', details: err instanceof Error ? err.message : 'unknown' }))
    }
    return
  }

  // Broadcast mail-received event (badge increment on Mail icon)
  // POST /broadcast-mail { projectId, recipientEmails: string[], mail: {...} }
  if (req.method === 'POST' && req.url === '/broadcast-mail') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const payload = JSON.parse(body) as {
        projectId: string
        recipientEmails: string[]
        mail: Record<string, unknown> & { id: string }
      }
      if (!payload.projectId || !payload.mail?.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'projectId and mail.id required' }))
        return
      }
      const room = `project:${payload.projectId}`
      io.to(room).emit('mail:new', {
        projectId: payload.projectId,
        recipientEmails: payload.recipientEmails,
        mail: payload.mail,
        timestamp: new Date().toISOString(),
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, broadcast: true }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON', details: err instanceof Error ? err.message : 'unknown' }))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface JoinPayload {
  projectId: string
  userEmail: string
  token?: string
}

interface SessionMeta {
  userEmail: string
  rooms: Set<string>
}

const sessions = new Map<string, SessionMeta>()
const ts = () => new Date().toISOString()

io.on('connection', (socket: Socket) => {
  console.log(`[${ts()}] [notif:connect] socket=${socket.id}`)
  sessions.set(socket.id, { userEmail: '', rooms: new Set() })

  // join: client emits { projectId, userEmail, token }
  socket.on('join', (payload: JoinPayload) => {
    const { projectId, userEmail, token } = payload ?? {}
    if (!projectId) {
      socket.emit('error', { message: 'join requires { projectId }' })
      return
    }
    if (!token) {
      socket.emit('error', { message: 'Token required' })
      socket.disconnect()
      return
    }

    // Join project room (for broadcast notifications)
    const projectRoom = `project:${projectId}`
    socket.join(projectRoom)

    // Join personal room if userEmail provided (for targeted notifications + mail)
    if (userEmail) {
      socket.join(`user:${userEmail}`)
    }

    const session = sessions.get(socket.id)
    if (session) {
      session.userEmail = userEmail || ''
      session.rooms.add(projectRoom)
      if (userEmail) session.rooms.add(`user:${userEmail}`)
    }

    console.log(
      `[${ts()}] [notif:join] socket=${socket.id} project="${projectId}" user="${userEmail || 'N/A'}"`,
    )
  })

  // Client requests current unread count refresh (optional polling fallback)
  socket.on('request_unread', (payload: { projectId: string }) => {
    if (!payload?.projectId) return
    // Just echo back — client will fetch via REST API
    socket.emit('unread_refresh', { projectId: payload.projectId, timestamp: ts() })
  })

  // Notification read by user — broadcast so other tabs update their badge
  socket.on('notification_read', (payload: { projectId: string; notificationId: string; userEmail: string }) => {
    if (!payload?.projectId || !payload?.notificationId) return
    const room = `project:${payload.projectId}`
    socket.to(room).emit('notification_read', {
      ...payload,
      timestamp: ts(),
    })
  })

  // Mail read by user — broadcast so other tabs update
  socket.on('mail_read', (payload: { projectId: string; mailId: string; userEmail: string }) => {
    if (!payload?.projectId || !payload?.mailId) return
    const room = `project:${payload.projectId}`
    socket.to(room).emit('mail_read', {
      ...payload,
      timestamp: ts(),
    })
  })

  socket.on('disconnect', (reason: string) => {
    const session = sessions.get(socket.id)
    console.log(
      `[${ts()}] [notif:disconnect] socket=${socket.id} user="${session?.userEmail || 'N/A'}" reason="${reason}"`,
    )
    sessions.delete(socket.id)
  })

  socket.on('error', (error: unknown) => {
    console.error(`[${ts()}] [notif:error] socket=${socket.id}`, error)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[${ts()}] NEXUS notification service listening on port ${PORT}`)
  console.log(`[${ts()}] Frontend connects with: io("/?XTransformPort=${PORT}")`)
  console.log(`[${ts()}] API broadcasts to: http://localhost:${PORT}/broadcast`)
})

process.on('SIGTERM', () => {
  console.log(`[${ts()}] SIGTERM received, shutting down...`)
  io.close(() => httpServer.close(() => process.exit(0)))
})
process.on('SIGINT', () => {
  console.log(`[${ts()}] SIGINT received, shutting down...`)
  io.close(() => httpServer.close(() => process.exit(0)))
})
