// import { NextResponse } from 'next/server';
// import prisma from '@/lib/prisma';

// export async function GET(req) {
//   const authHeader = req.headers.get('authorization');

//   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

//   //Authorized: now delete old bookings & slots
//   const now = new Date();
//   const oneMonthAgo = new Date(now);
//   oneMonthAgo.setMonth(now.getMonth() - 1);

//   // Example deletion (adjust models as needed)
//   await prisma.booking.deleteMany({
//     where: {
//       createdAt: { lt: oneMonthAgo },
//     },
//   });

//   await prisma.scheduleSlot.deleteMany({
//     where: {
//       date: { lt: oneMonthAgo },
//     },
//   });

//   return NextResponse.json({ success: true });
// }
