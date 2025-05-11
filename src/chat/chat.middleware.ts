import { UnauthorizedError } from '@app/utils';
import { Types } from 'mongoose';
import { ConversationService } from 'src/conversation/conversation.service';

export const RoomWsMiddleware = (conversationService: ConversationService) => {
  return async (socket: any, next: (err?: Error) => void) => {
    try {
      const roomId = socket.handshake.query.room_id as string;
      if (!roomId) {
        return next(new Error('room_id is required'));
      }
      const conversation = await conversationService.findOne(
        new Types.ObjectId(roomId),
      );
      if (
        !conversation.members.some((memberId) =>
          memberId.equals(socket.user._id),
        )
      ) {
        throw new Error('User not a member of this conversation');
      }
      console.log(`Joining room: ${roomId} for user ${socket.user._id}`);
      const chat_room = `chat_${conversation._id.toString()}`;
      socket.join(chat_room);
      socket.roomId = roomId;
      next();
    } catch (error) {
      console.error('Room Join Error:', error.message);
      next(new Error('Could not join room: ' + error.message));
    }
  };
};

export const functionRoomAuth = async (
  socket,
  conversationService: ConversationService,
) => {
  try {
    const roomId = socket.handshake.query.roomId as string;
    if (!roomId) {
      throw new UnauthorizedError('room_id is required');
    }
    const conversation = await conversationService.findOne(
      new Types.ObjectId(roomId),
    );
    if (
      !conversation.members.some((memberId) => memberId.equals(socket.user._id))
    ) {
      throw new Error('User not a member of this conversation');
    }
    console.log(`Joining room: ${roomId} for user ${socket.user._id}`);
    const chat_room = `chat_${conversation._id.toString()}`;
    socket.roomId = roomId;
    return chat_room;
  } catch (error) {
    console.error(error);
    throw new UnauthorizedError(error.message);
  }
};
