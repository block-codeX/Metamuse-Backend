import { PartialType } from '@nestjs/mapped-types';
import { CreateDrawingDto } from './create-drawing.dto';

export class UpdateDrawingDto extends PartialType(CreateDrawingDto) {
  id: number;
}
