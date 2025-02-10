
import exp from 'constants';
import { z } from 'zod';

export const signupSchema = z
    .object({
        email: z.string().email(),
        password: z.string().min(6),
        firstName: z.string(),
        lastName: z.string(),
    })
    .required();

export const loginSchema = z
    .object({
        email: z.string().email(),
        password: z.string().min(6),
    })
    .required();

export const logoutSchema = z
    .object({
        token: z.string(),
    })
    .required();

export const otpSchema = z
    .object({
        otpId : z.string(),
        otpType: z.enum(['EMAIL', 'AUTHENTICATOR']),
        otp: z.string().length(6).optional(),
        verificationToken: z.string().optional(),
    })
    .required();


export const otpRequestSchema = z
.object({
    email: z.string().email(),
    otpType: z.enum(['EMAIL', 'AUTHENTICATOR']),
    multiUse: z.boolean().optional(),
}).required();
export type SignupDto = z.infer<typeof signupSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type LogoutDto = z.infer<typeof logoutSchema>;
export type OtpDto = z.infer<typeof otpSchema>;
export type OtpRequestDto = z.infer<typeof otpRequestSchema>;
