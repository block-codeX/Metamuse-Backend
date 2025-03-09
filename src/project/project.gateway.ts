import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  ConnectedSocket,
} from '@nestjs/websockets';
import { ProjectService } from './project.service';
import { AuthWsMiddleware } from 'src/auth/auth.middleware';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UsersService } from 'src/users/users.service';

import { Injectable, Logger } from '@nestjs/common';
import { CRDTService } from './project.service';
import { Types } from 'mongoose';
import * as Y from 'yjs';


@WebSocketGateway({
  cors: {
    origin: '*', // In production, this should be more restrictive
  },
  namespace: 'drawing',
})
@Injectable()
export class ProjectGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ProjectGateway.name);
  private readonly activeUsers = new Map<
    string,
    { userId: string | null; projectId: string | null }
  >();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly crdtService: CRDTService,
    private readonly usersService: UsersService,
    private readonly projectService: ProjectService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  afterInit(server: Server) {
    server.use(
      AuthWsMiddleware(this.jwtService, this.authService, this.usersService),
    );
    // server.use(RoomWsMiddleware(this.conversationService));
    this.logger.log('Drawing WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Authentication should happen here
    // For example:
    const token = client.handshake.auth.token;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      // Validate user token (implementation depends on your auth system)
      const userId = await this.validateToken(token);
      if (!userId) {
        client.disconnect();
        return;
      }

      // Store user connection info
      this.activeUsers.set(client.id, {
        userId,
        projectId: null, // Will be set when user joins a project
      });
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      client.disconnect();
    }
  }
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Get user info
    const userInfo = this.activeUsers.get(client.id);

    // Clean up if user was in a project
    if (userInfo && userInfo.projectId) {
      client.leave(`project:${userInfo.projectId}`);
      this.server.to(`project:${userInfo.projectId}`).emit('user:left', {
        userId: userInfo.userId,
      });

      // Broadcast updated user list
      this.broadcastProjectUsers(userInfo.projectId);
    }

    // Remove from active users
    this.activeUsers.delete(client.id);
    client.rooms.forEach((room: string) => {
      client.leave(room);
    });
    console.log('Client disconnected');
  }

  @SubscribeMessage('project:join')
  async handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    try {
      const userInfo = this.activeUsers.get(client.id);
      if (!userInfo) {
        throw new Error('User not authenticated');
      }

      const { projectId } = data;

      // Verify user has access to this project
      const project = await this.projectService.findOne(
        new Types.ObjectId(projectId),
      );
      const hasAccess = project.collaborators.some(
        (collaborator) => collaborator.toString() === userInfo.userId,
      );

      if (!hasAccess) {
        throw new Error('Access denied to project');
      }

      // Leave previous project if any
      if (userInfo.projectId) {
        client.leave(`project:${userInfo.projectId}`);
        this.server.to(`project:${userInfo.projectId}`).emit('user:left', {
          userId: userInfo.userId,
        });
        this.broadcastProjectUsers(userInfo.projectId);
      }

      // Join new project room
      client.join(`project:${projectId}`);
      userInfo.projectId = projectId;
      this.activeUsers.set(client.id, userInfo);

      // Get initial document state
      const doc = await this.crdtService.getDocument(projectId);
      const initialState = Y.encodeStateAsUpdate(doc);

      // Send initial data to the joining user
      client.emit('project:initial-state', {
        update: Array.from(initialState),
        projectData: {
          id: project._id,
          title: project.title,
          description: project.description,
        },
      });

      // Notify others that user joined
      client.to(`project:${projectId}`).emit('user:joined', {
        userId: userInfo.userId,
      });

      // Broadcast updated user list
      this.broadcastProjectUsers(projectId);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error joining project: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('project:leave')
  async handleLeaveProject(@ConnectedSocket() client: Socket) {
    const userInfo = this.activeUsers.get(client.id);
    if (userInfo && userInfo.projectId) {
      client.leave(`project:${userInfo.projectId}`);

      // Update user info
      userInfo.projectId = null;
      this.activeUsers.set(client.id, userInfo);

      // Notify others
      this.server.to(`project:${userInfo.projectId}`).emit('user:left', {
        userId: userInfo.userId,
      });

      // Broadcast updated user list
      this.broadcastProjectUsers(userInfo.projectId as any);

      return { success: true };
    }

    return { success: false, error: 'Not in a project' };
  }

  @SubscribeMessage('update:sync')
  async handleSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { update: number[] },
  ) {
    const userInfo = this.activeUsers.get(client.id);
    if (!userInfo || !userInfo.projectId) {
      return { success: false, error: 'Not in a project' };
    }

    try {
      const { projectId } = userInfo;
      const update = new Uint8Array(data.update);

      // Get document
      const doc = await this.crdtService.getDocument(projectId);

      // Apply update to the document
      Y.applyUpdate(doc, update);

      // Broadcast to all other clients in the same project
      client.to(`project:${projectId}`).emit('update:sync', {
        update: data.update,
        source: userInfo.userId,
      });

      // Throttled save to persistence
      this.crdtService.throttledSaveToMongoDB(projectId, doc);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error syncing update: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('canvas:update')
  async handleCanvasUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { settings: any },
  ) {
    const userInfo = this.activeUsers.get(client.id);
    if (!userInfo || !userInfo.projectId) {
      return { success: false, error: 'Not in a project' };
    }

    try {
      await this.crdtService.applyCanvasSettings(
        userInfo.projectId,
        data.settings,
      );

      // Broadcast canvas update to others
      client.to(`project:${userInfo.projectId}`).emit('canvas:update', {
        settings: data.settings,
        source: userInfo.userId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error updating canvas: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('object:add')
  async handleObjectAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { objects: any[] },
  ) {
    const userInfo = this.activeUsers.get(client.id);
    if (!userInfo || !userInfo.projectId) {
      return { success: false, error: 'Not in a project' };
    }

    try {
      await this.crdtService.applyFabricObjects(
        userInfo.projectId,
        data.objects,
      );

      // Broadcast to others
      client.to(`project:${userInfo.projectId}`).emit('object:add', {
        objects: data.objects,
        source: userInfo.userId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error adding objects: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('object:update')
  async handleObjectUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { objectId: string; properties: any },
  ) {
    const userInfo = this.activeUsers.get(client.id);
    if (!userInfo || !userInfo.projectId) {
      return { success: false, error: 'Not in a project' };
    }

    try {
      await this.crdtService.updateFabricObject(
        userInfo.projectId,
        data.objectId,
        data.properties,
      );

      // Broadcast to others
      client.to(`project:${userInfo.projectId}`).emit('object:update', {
        objectId: data.objectId,
        properties: data.properties,
        source: userInfo.userId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error updating object: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('object:delete')
  async handleObjectDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { objectIds: string[] },
  ) {
    const userInfo = this.activeUsers.get(client.id);
    if (!userInfo || !userInfo.projectId) {
      return { success: false, error: 'Not in a project' };
    }

    try {
      await this.crdtService.deleteFabricObjects(
        userInfo.projectId,
        data.objectIds,
      );

      // Broadcast to others
      client.to(`project:${userInfo.projectId}`).emit('object:delete', {
        objectIds: data.objectIds,
        source: userInfo.userId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting objects: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('snapshot:create')
  async handleCreateSnapshot(@ConnectedSocket() client: Socket) {
    const userInfo = this.activeUsers.get(client.id);
    if (!userInfo || !userInfo.projectId) {
      return { success: false, error: 'Not in a project' };
    }

    try {
      const snapshotId = await this.crdtService.createSnapshot(
        userInfo.projectId,
        userInfo.userId as string,
      );

      // Notify everyone in the project about the new snapshot
      this.server.to(`project:${userInfo.projectId}`).emit('snapshot:created', {
        snapshotId,
        creator: userInfo.userId,
        timestamp: Date.now(),
      });

      return { success: true, snapshotId };
    } catch (error) {
      this.logger.error(`Error creating snapshot: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('project:fork')
  async handleForkProject(@ConnectedSocket() client: Socket) {
    const userInfo = this.activeUsers.get(client.id);
    if (!userInfo || !userInfo.projectId) {
      return { success: false, error: 'Not in a project' };
    }

    try {
      // Fork the project
      const forkedProject = await this.crdtService.forkProject(
        userInfo.projectId,
        userInfo.userId as string,
      );

      return {
        success: true,
        project: {
          id: forkedProject._id,
          title: forkedProject.title,
          description: forkedProject.description,
        },
      };
    } catch (error) {
      this.logger.error(`Error forking project: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('cursor:position')
  handleCursorPosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { x: number; y: number },
  ) {
    const userInfo = this.activeUsers.get(client.id);
    if (!userInfo || !userInfo.projectId) {
      return { success: false, error: 'Not in a project' };
    }

    // Broadcast cursor position to other users in the project
    client.to(`project:${userInfo.projectId}`).emit('cursor:position', {
      userId: userInfo.userId,
      position: data,
    });

    return { success: true };
  }

  // Helper methods
  private async validateToken(token: string): Promise<string | null> {
    // Implementation depends on your authentication system
    // This is a placeholder for the actual validation logic
    // Return the userId if token is valid, null otherwise
    try {
      // Example: const user = await this.authService.validateToken(token);
      // return user?._id?.toString() || null;

      // Placeholder - replace with actual implementation
      return token ? 'user-id-from-token' : null;
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      return null;
    }
  }

  private async broadcastProjectUsers(projectId: string) {
    // Get all connected users for this project
    const projectUsers = Array.from(this.activeUsers.entries())
      .filter(([_, info]) => info.projectId === projectId)
      .map(([_, info]) => new Types.ObjectId(info.userId as string));

    // Get user details from database
    const userDetails = await this.usersService.findAll({filters: {_id: {$in: projectUsers}}} as any);

    // Broadcast to all clients in the project
    this.server.to(`project:${projectId}`).emit('project:users', {
      users: userDetails.docs.map((user: any) => ({
        id: user._id,
        name: user.firstName,
        email: user.email,
        // Other non-sensitive user data
      })),
    });
  }
}
