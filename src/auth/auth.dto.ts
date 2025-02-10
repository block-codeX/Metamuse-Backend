
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

export type SignupDto = z.infer<typeof signupSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type LogoutDto = z.infer<typeof logoutSchema>;


