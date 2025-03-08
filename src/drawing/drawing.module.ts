import { Module } from '@nestjs/common';
import { DrawingService } from './drawing.service';
import { DrawingGateway } from './drawing.gateway';

@Module({
  providers: [DrawingGateway, DrawingService],
})
export class DrawingModule {}
