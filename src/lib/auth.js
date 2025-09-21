// src/lib/auth.js
import NextAuth from 'next-auth';
import { authOptions as options } from '@/app/api/auth/[...nextauth]/route';

export const authOptions = options;
