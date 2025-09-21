import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  const session = await getServerSession({ req, ...authOptions });

  if (!session || !session.user?.email) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { name, email, phone, password, dateOfBirth } = await req.json();

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const updates = {
      name,
      email,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    };

    if (password) {
      // Validate strength
      const isStrongPassword = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
      if (!isStrongPassword.test(password)) {
        return NextResponse.json(
          { message: 'Password must be at least 8 characters and include letters and numbers.' },
          { status: 400 }
        );
      }

      // Handle password change limits
      const now = new Date();
      const THIRTY_DAYS_AGO = new Date(now);
      THIRTY_DAYS_AGO.setDate(now.getDate() - 30);

      let history = user.passwordChangeHistory || [];

      // Filter only the last 30 days history
      history = history.filter((timestamp) => {
        const date = new Date(timestamp);
        return date > THIRTY_DAYS_AGO;
      });

      if (history.length >= 2) {
        return NextResponse.json(
          { message: 'You can only update your password 2 times per 30 days.' },
          { status: 403 }
        );
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      updates.password = hashedPassword;
      updates.passwordChangeHistory = [...history, now.toISOString()]; // Update history
    }

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: updates,
    });

    return NextResponse.json({ message: 'Account updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ message: 'Failed to update account' }, { status: 500 });
  }
}
