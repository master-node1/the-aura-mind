import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PUB, REDIS_SUB } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';

const AI_PROCESS = 'TheAuraLab:ai:process';
const AI_RESPONSE = 'TheAuraLab:ai:response';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
  transports: ['websocket'],
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer() server!: Server;
  private logger = new Logger('ChatGateway');
  // userId → Set of socket ids
  private userSockets = new Map<string, Set<string>>();

  constructor(
    @Inject(REDIS_PUB) private pub: Redis,
    @Inject(REDIS_SUB) private sub: Redis,
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialised');
  }

  onModuleInit() {
    // Subscribe to AI responses and forward to correct user socket
    this.sub.subscribe(AI_RESPONSE);
    this.sub.on('message', (_channel, raw) => {
      try {
        const payload = JSON.parse(raw);
        this.sendToUser(payload.userId, 'message', payload);
      } catch (e) {
        this.logger.error('Failed to parse AI response', e);
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      // Token sent as query param: ws://host/ws?token=xxx
      const token = client.handshake.query.token as string;
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET', 'changeme'),
      });

      if (payload.type !== 'access') throw new Error('wrong token type');

      client.data.userId = payload.sub;
      client.data.email = payload.email;

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      this.logger.log(`Connected: user=${payload.sub} socket=${client.id}`);
    } catch {
      this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Disconnected: socket=${client.id}`);
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string; conversationId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    // 1. Ack immediately
    client.emit('ack', { messageId: data.messageId });

    // 2. Show typing indicator
    client.emit('typing', { isTyping: true });

    // 3. Persist user message
    let conversationId = data.conversationId;
    if (!conversationId) {
      const convo = await this.prisma.conversation.create({
        data: { userId, title: data.content.slice(0, 60) },
      });
      conversationId = convo.id;
    }

    await this.prisma.message.create({
      data: { conversationId, role: 'user', content: data.content },
    });

    // 4. Fetch user profile for AI (username + personality)
    // We query the users table that auth-service owns (shared DB)
    const user = await this.prisma.$queryRaw<
      { username: string | null; personality_archetype: string | null }[]
    >`
      SELECT username, personality_archetype FROM users WHERE id = ${userId}::uuid LIMIT 1
    `;
    const username = user?.[0]?.username ?? 'friend';
    const personality = user?.[0]?.personality_archetype ?? 'friend';

    // 5. Publish to AI service via Redis
    await this.pub.publish(AI_PROCESS, JSON.stringify({
      userId,
      messageId: data.messageId,
      content: data.content,
      conversationId,
      username,
      personality,
    }));
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { ts: Date.now() });
  }

  private sendToUser(userId: string, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, data);
    }
  }
}
