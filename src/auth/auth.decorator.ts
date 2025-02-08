
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const AllowAny = () => SetMetadata(IS_PUBLIC_KEY, true);
