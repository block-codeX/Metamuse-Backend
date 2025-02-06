export default class BaseError extends Error {
    code: number = 400
    name: string = 'Something went wrong'
    constructor (message: string, code?: number, name?: string) {
      super(message)
      if (name) this.name = name
      if (code) this.code = code
    }
  }
  export class NotFoundError extends BaseError {
    code = 404
    name = 'Not found'
  }
  
  export class UnauthorizedError extends BaseError {
    code = 401
    name = 'Unauthorized'
  }
  export class ForbiddenError extends BaseError {
    code = 403
    name = 'Forbidden'
  }
  
  export class ValidationError extends BaseError {
    code = 400
    name = 'Validation failed'
  }
  export class IntegrityError extends BaseError {
    code = 400
    name = 'Uniqueness failed'
  }