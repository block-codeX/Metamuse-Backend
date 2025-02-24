import { BasePermission } from '@app/utils/utils.permission';

export class IsConversationCreator extends BasePermission {
  hasObjectPermission(request: any, resource: any, action: string): boolean {
    return request.user && resource && resource.creator._id === request.user._id;
  }
}

export class IsConversationAdmin extends BasePermission {
  hasObjectPermission(request: any, resource: any, action: string): boolean {
    return (
      request.user && resource && resource.admins.includes(request.user._id)
    );
  }
}
export class IsConversationMember extends BasePermission {
  hasObjectPermission(request: any, resource: any, action: string): boolean {
    return (
      request.user && resource && resource.members.includes(request.user._id)
    );
  }
}
