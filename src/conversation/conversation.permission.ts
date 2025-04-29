import { BasePermission } from '@app/utils/utils.permission';
import { Types } from 'mongoose';

export class IsConversationCreator extends BasePermission {
  hasObjectPermission(request: any, resource: any, action: string): boolean {
    return request.user && resource && resource.creator._id.equals( request.user._id);
  }
}

export class IsConversationAdmin extends BasePermission {
  hasObjectPermission(request: any, resource: any, action: string): boolean {
    return (
      request.user &&
      resource &&
      resource.admins.some((admin: Types.ObjectId) => admin.equals(request.user._id))
    );
  }
}
export class IsConversationMember extends BasePermission {
  hasObjectPermission(request: any, resource: any, action: string): boolean {
    return (
      request.user &&
      resource &&
      resource.members.some((member: Types.ObjectId) => member.equals(request.user._id))
    );
  }
}
