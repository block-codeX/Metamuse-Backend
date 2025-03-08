import { Test, TestingModule } from '@nestjs/testing';
import { DrawingGateway } from './drawing.gateway';
import { DrawingService } from './drawing.service';

describe('DrawingGateway', () => {
  let gateway: DrawingGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DrawingGateway, DrawingService],
    }).compile();

    gateway = module.get<DrawingGateway>(DrawingGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
