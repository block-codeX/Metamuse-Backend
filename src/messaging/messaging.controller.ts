import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CreateMessagingDto } from './messaging.dto';
import { UpdateMessagingDto } from './dto/update-messaging.dto';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  create(@Body() createMessagingDto: CreateMessagingDto) {
    return this.messagingService.create(createMessagingDto);
  }

  @Get()
  findAll() {
    return this.messagingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messagingService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMessagingDto: UpdateMessagingDto) {
    return this.messagingService.update(+id, updateMessagingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.messagingService.remove(+id);
  }
}
