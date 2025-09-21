"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";

export default function AdminHelpPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [isAdmin, setIsAdmin] = useState(null); // null = unknown, true/false once resolved
  const [booted, setBooted] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

  // Resolve role from DB (fallback to supabase metadata)
  useEffect(() => {
    let cancel = false;
    async function resolveRole() {
      if (!user) {
        setIsAdmin(false);
        setBooted(true);
        return;
      }
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = res.ok ? await res.json() : null;
        const role =
          data?.role ||
          user?.app_metadata?.role ||
          user?.user_metadata?.role ||
          "user";
        if (!cancel) {
          setIsAdmin(role === "admin");
          setBooted(true);
        }
      } catch {
        const fallback =
          user?.app_metadata?.role || user?.user_metadata?.role || "user";
        if (!cancel) {
          setIsAdmin(fallback === "admin");
          setBooted(true);
        }
      }
    }
    if (!loading) resolveRole();
    return () => {
      cancel = true;
    };
  }, [user, loading]);

  // Redirect non-admins
  useEffect(() => {
    if (!loading && booted && isAdmin === false) router.replace("/");
  }, [loading, booted, isAdmin, router]);

  if (loading || !booted || isAdmin === null) return <Skeleton />;
  if (!isAdmin) return null;

  const toggleFAQ = (i) => setOpenIndex(openIndex === i ? null : i);

  const faqs = [
    {
      q: "How do I add a new Experience?",
      a: `Go to “Manage Experiences”. Click “Add Experience” and fill in title, description,
images, and availability (e.g., specific weekdays). Save to publish immediately. You can
edit or delete later if needed.`,
    },
    {
      q: "How do I manage client bookings?",
      a: `Open “Manage Reservations”. You can review, edit, create, or cancel bookings.
Reservations are grouped by experience and date for quick scanning. Always confirm major changes with the client.`,
    },
    {
      q: "How do I add a new schedule slot for an experience?",
      a: `In “Manage Schedule”, pick an experience and add a date/time + total available seats.
The date must match the experience’s allowed days (e.g., weekends only if specified). Once saved,
the slot is bookable immediately.`,
    },
    {
      q: "What happens if I delete a schedule slot?",
      a: `Deleting a slot also removes all reservations attached to it. A confirmation warning
appears before deletion so you can cancel if needed.`,
    },
    {
      q: "Can I manually create a reservation for a user?",
      a: `Yes. In “Manage Reservations”, create a booking by selecting the user, experience,
and an available slot—useful for phone/email/manual requests.`,
    },
    {
      q: "When are old slots and bookings deleted automatically?",
      a: `Expired slots and their reservations older than 1 month are removed automatically
by a scheduled cleanup task to keep the system tidy.`,
    },
    {
      q: "Can I edit an existing slot’s capacity?",
      a: `Yes, but you cannot set capacity below the number already booked. For example,
if 5 seats are booked out of 10, the minimum you can set is 5.`,
    },
    {
      q: "How can I manage or remove users?",
      a: `Use “Manage Clients” to view users. Deleting a user is permanent and removes
their bookings and personal data—proceed carefully.`,
    },
    {
      q: "What security measures are in place?",
      a: `Authentication is handled by Supabase Auth. Passwords are hashed securely
(e.g., bcrypt). reCAPTCHA is used on signup to mitigate bots. Admin access is restricted
to users with the 'admin' role. Sensitive actions have confirmation prompts, and background
tasks use secret-protected endpoints.`,
    },
    {
      q: "How do users check available dates for an experience?",
      a: `Each experience has a “Check Availability” view showing all upcoming dates and time
slots with remaining capacity.`,
    },
    {
      q: "How does the booking process work?",
      a: `Users pick a slot, set number of participants (up to the maximum), and optionally
leave notes. If capacity allows, the booking confirms instantly and they receive a confirmation email.`,
    },
    {
      q: "Can users cancel or modify their bookings?",
      a: `Currently, users contact the admin team for changes. Admins can modify/cancel
bookings in the dashboard.`,
    },
    {
      q: "What happens if someone tries to overbook?",
      a: `The system prevents reservations that exceed remaining capacity and shows a warning.`,
    },
    {
      q: "How are email notifications handled?",
      a: `New users get a welcome email. Confirmed bookings send a details email. Admin-created
or canceled bookings also notify the user via email using a trusted email provider.`,
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#f4f1ec] overflow-hidden">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80" />

      <div className="relative mx-auto px-6 py-8 lg:py-12 max-w-4xl lg:max-w-5xl">
        {/* top bar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push("/admin")}
            className="inline-flex items-center gap-2 text-[#8b6f47] text-sm border border-[#d8cfc3] px-4 py-2 rounded-full hover:bg-[#f4f1ec] hover:text-[#5a4a3f] transition-all shadow-sm"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <span className="inline-flex items-center gap-2 text-xs rounded-full px-3 py-1 border border-[#e8e2d9] bg-[#f6f4f0] text-[#5a4a3f]">
            <ShieldCheck size={14} /> Admin access
          </span>
        </div>

        {/* header */}
        <header className="mb-8">
          <h1 className="text-4xl font-serif tracking-tight leading-tight text-[#5a4a3f]">
            <span className="opacity-70">Oasis</span>{" "}
            <span className="bg-gradient-to-r from-[#8b6f47] to-[#a78b62] bg-clip-text text-transparent">
              Admin Help Center
            </span>
          </h1>
          <p className="mt-3 text-[#7a6a5f]">
            Handy answers for common admin tasks and policies.
          </p>
        </header>

        {/* FAQs */}
        <div className="space-y-4">
          {faqs.map((item, i) => {
            const open = openIndex === i;
            return (
              <div
                key={i}
                className="bg-white/85 backdrop-blur rounded-2xl border border-[#e0dcd4] shadow-md overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(i)}
                  className="w-full flex justify-between items-center px-5 py-4 text-left text-[#5a4a3f] font-medium hover:bg-[#faf9f7] transition"
                >
                  <span className="pr-4">{item.q}</span>
                  {open ? (
                    <ChevronUp className="w-5 h-5 text-[#8b6f47]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#8b6f47]" />
                  )}
                </button>
                {open && (
                  <div className="px-5 pb-5 text-[#4a4a4a] text-sm leading-relaxed whitespace-pre-line">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* help button */}
        <div className="mt-12 flex items-center justify-center">
          <button
            onClick={() => router.push("/admin")}
            className="inline-flex items-center gap-2 bg-[#8b6f47] text-white px-6 py-3 rounded-full hover:bg-[#a78b62] transition shadow"
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
          <button
            onClick={() => router.push("/admin/help/contact")}
            className="ml-3 inline-flex items-center gap-2 border border-[#d8cfc3] bg-[#fdfaf5] text-[#5a4a3f] px-6 py-3 rounded-full hover:bg-[#f1ede7] transition shadow-sm"
          >
            <LifeBuoy size={18} /> Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

/* simple loader to avoid layout shift */
function Skeleton() {
  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      <div className="mx-auto px-6 py-10 max-w-4xl">
        <div className="h-5 w-28 bg-[#e8e2d9] rounded mb-4" />
        <div className="h-10 w-80 bg-[#e8e2d9] rounded mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="h-20 bg-[#e8e2d9] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
