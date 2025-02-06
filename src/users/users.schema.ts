import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';


export type UserDocument = HydratedDocument<User>;
@Schema()
export class User {
    @Prop({ required: true, minlength: 1, maxlength: 100 })
    firstName: string;
    @Prop({ required: true, minlength: 1, maxlength: 100 })
    lastName: string;
    @Prop({ required: true, minlength: 1, maxlength: 100 })
    email: string;
    @Prop({ required: true, minlength: 6})
    password: string;
}
export const UserSchema =
    SchemaFactory.createForClass(User);

