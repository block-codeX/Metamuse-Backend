import { type Request } from 'express'


export class BasePermission {
    message = 'You do not have permission to perform this action.'
    code = 403
    permissionAction = () => {}
    objAction = () => {}
  
    constructor(message?: string, code?: number, permissionAction?: () => void, objAction?: () => void) {
      this.message = message || this.message;
      this.code = code || this.code;
      this.permissionAction = permissionAction || this.permissionAction;
      this.objAction = objAction || this.objAction;
    }
  
  
  
  
    hasPermission (request: any, action?: string): boolean {
      this.permissionAction()
      return true
    }
  
    hasObjectPermission (request: any, resource: any, action?: string): boolean {
      this.objAction()
      return true
    }
  }

export default class AuthPermissions {
  static checkPermissions (
    permissions: BasePermission[],
    request: Request,
    action?: string
  ) {
    for (const Permission of permissions) {
      if (!Permission.hasPermission(request, action)) { return { success: false, error: Permission.message } }
    }
    return { success: true, error: null }
  }

  static checkObjPermissions (
    permissions: BasePermission[],
    request: Request,
    resource: any,
    action?: string
  ) {
    for (const Permission of permissions) {
      if (!Permission.hasObjectPermission(request, resource, action)) { return { success: false, error: Permission.message } }
    }
    return { success: true, error: null }
  }
}