/**
 * Cloudflare Worker entry point for Secure Chat
 * Handles API routes and WebSocket connections
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

// Types for bindings
interface Env {
  CHAT_ROOM: DurableObjectNamespace;
  SESSIONS: KVNamespace;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
}

// Durable Object for chat rooms
export class ChatRoom {
  private state: DurableObjectState;
  private sockets: Map<string, WebSocket> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const { 0: client, 1: server } = new WebSocketPair();
      this.handleWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  private handleWebSocket(ws: WebSocket) {
    ws.accept();

    ws.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);

        switch (data.type) {
          case 'join':
            this.sockets.set(data.uid, ws);
            ws.send(JSON.stringify({ type: 'joined', timestamp: new Date() }));
            break;

          case 'message':
            // Broadcast to all participants
            for (const [uid, socket] of this.sockets) {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(data));
              }
            }
            break;

          case 'typing':
            // Broadcast typing indicator
            for (const [uid, socket] of this.sockets) {
              if (uid !== data.senderUid && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(data));
              }
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.addEventListener('close', () => {
      for (const [uid, socket] of this.sockets) {
        if (socket === ws) {
          this.sockets.delete(uid);
          break;
        }
      }
    });
  }
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/verify', async (c) => {
  // TODO: Verify Firebase token and return JWT
  const body = await c.req.json();
  return c.json({
    success: true,
    data: {
      jwt: 'placeholder-jwt',
      user: { uid: 'test', username: 'test', email: 'test@test.com' }
    }
  });
});

// User routes
app.get('/api/users/search', async (c) => {
  const query = c.req.query('q');
  // TODO: Search users respecting privacy settings
  return c.json({ success: true, data: [] });
});

app.get('/api/users/:uid/publicKey', async (c) => {
  const uid = c.req.param('uid');
  // TODO: Get public key from Firestore
  return c.json({ success: true, data: { uid, publicKey: null } });
});

// Friend routes
app.post('/api/friend/request', async (c) => {
  // TODO: Send friend request
  return c.json({ success: true, data: { message: 'Friend request sent' } });
});

app.post('/api/friend/accept', async (c) => {
  // TODO: Accept friend request
  return c.json({ success: true });
});

app.post('/api/friend/reject', async (c) => {
  // TODO: Reject friend request
  return c.json({ success: true });
});

app.get('/api/friends', async (c) => {
  // TODO: Get friends list
  return c.json({ success: true, data: [] });
});

// Chat routes
app.post('/api/chat/create', async (c) => {
  // TODO: Create new chat
  return c.json({
    success: true,
    data: { chatId: 'test-chat-id', participants: [] }
  });
});

app.get('/api/chats', async (c) => {
  // TODO: Get user's chats
  return c.json({ success: true, data: [] });
});

app.post('/api/chat/message', async (c) => {
  // TODO: Send message
  const body = await c.req.json();
  return c.json({
    success: true,
    data: {
      messageId: 'test-message-id',
      chatId: body.chatId,
      timestamp: new Date()
    }
  });
});

app.get('/api/chat/:chatId/messages', async (c) => {
  // TODO: Get messages
  return c.json({ success: true, data: [] });
});

// WebSocket upgrade endpoint
app.get('/ws', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get chat room durable object
  const id = c.env.CHAT_ROOM.idFromName('global');
  const room = c.env.CHAT_ROOM.get(id);

  return room.fetch(c.req.raw);
});

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, { status: 404 });
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ success: false, error: 'Internal server error' }, { status: 500 });
});

export default app;
