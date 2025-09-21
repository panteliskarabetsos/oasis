// src/app/api/recaptcha/verify/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ ok: false }, { status: 400 });

    const body = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY || '',
      response: token,
    });

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await res.json();
    const ok = !!data?.success && (typeof data.score !== 'number' || data.score >= 0.5);

    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
