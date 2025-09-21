'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowLeft,CheckCircle, CalendarDays, MapPin, Users, StickyNote, Home } from 'lucide-react';

export default function BookingConfirmedPage() {
  const { id } = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchBooking = async () => {
      try {
        const res = await fetch(`/api/admin/reservations/${id}`);
        if (!res.ok) throw new Error('Failed to fetch booking');
        const data = await res.json();
        setBooking(data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#5a4a3f]">
        Loading your booking...
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 font-semibold">
        Booking not found.
      </div>
    );
  }

  const { user, numberOfPeople, notes, scheduleSlot } = booking;
  const { date, experience } = scheduleSlot || {};

  return (
    <div className="min-h-screen bg-[#f4f1ec] flex items-center justify-center px-6 py-16">
      <div className="max-w-2xl w-full bg-[#fffaf4] border border-[#e8e4db] shadow-xl rounded-3xl p-8 text-[#5a4a3f]">
  
        {/* Header */}
        <div className="text-center mb-10">
          <CheckCircle className="w-12 h-12 mx-auto text-[#8b6f47]" />
          <h1 className="text-3xl font-serif font-bold mt-4">Booking Confirmed</h1>
          <p className="text-lg mt-2">Thank you <strong>{user?.name || user?.email}</strong>! We’re excited to welcome you.</p>
        </div>
  
        {/* Booking Summary */}
        <div className="space-y-6 text-sm sm:text-base bg-white p-6 rounded-2xl border border-[#e3dfd4] shadow-sm">
        <div className="flex items-start gap-3">
          <CalendarDays className="w-5 h-5 mt-1 text-[#8b6f47]" />
          <div>
            <p className="font-medium">Date & Time</p>
            {date ? (
              <>
                <p>{format(parseISO(date), 'PPPP')}</p>
                <p className="text-sm text-[#7a6a58]">{format(parseISO(date), 'p')}</p>
              </>
            ) : (
              <p>—</p>
            )}
          </div>
        </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 mt-1 text-[#8b6f47]" />
            <div>
              <p className="font-medium">Location</p>
              <p>{experience?.location || '—'}</p>
            </div>
          </div>
  
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 mt-1 text-[#8b6f47]" />
            <div>
              <p className="font-medium">Number of People</p>
              <p>{numberOfPeople}</p>
            </div>
          </div>
  
          <div className="flex items-start gap-3">
            <Home className="w-5 h-5 mt-1 text-[#8b6f47]" />
            <div>
              <p className="font-medium">Experience</p>
              <p>{experience?.name || '—'}</p>
            </div>
          </div>
  
          {notes && (
            <div className="flex items-start gap-3">
              <StickyNote className="w-5 h-5 mt-1 text-[#8b6f47]" />
              <div>
                <p className="font-medium">Notes</p>
                <p>{notes}</p>
              </div>
            </div>
          )}
        </div>
  
        {/* CTA Button */}
        <div className="mt-10 text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-block px-6 py-3 bg-[#8b6f47] hover:bg-[#7a5f3a] text-white font-medium rounded-lg transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
