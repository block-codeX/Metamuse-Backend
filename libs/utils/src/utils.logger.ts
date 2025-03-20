import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    Logger,
    HttpStatus,
    ConsoleLogger,
  } from '@nestjs/common';
  
  @Catch() // No specific exception type => This will catch all exceptions
  export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new ConsoleLogger(AllExceptionsFilter.name);
  
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse();
      const request = ctx.getRequest();
  
      const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    
    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';
    
    // For Fastify, use send() instead of json()
    response.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}