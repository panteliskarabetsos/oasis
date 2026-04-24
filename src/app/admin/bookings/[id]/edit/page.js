"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  User2,
  FileText,
  Calculator,
  MapPin,
  AlertTriangle,
  Users,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function EditBookingPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalTotal, setOriginalTotal] = useState(0);

  // Available predefined meetup points for this experience
  const [savedMeetupPoints, setSavedMeetupPoints] = useState([]);
  const [isCustomMeetup, setIsCustomMeetup] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    status: "confirmed",
    notes: "",
    customExperienceName: "",
    duration: "",
    meetupPointName: "",

    guestFirstName: "",
    guestLastName: "",
    guestEmail: "",
    guestPhone: "",

    adultsCount: 1,
    kidsCount: 0,
    unitPriceAdult: 0,
    unitPriceKid: 0,
    discountAmount: 0,

    attendees: [],
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/reservations/${id}`);
        if (!res.ok) throw new Error("Failed to load booking");
        const { item } = await res.json();

        setOriginalTotal(item.money?.totalAmount ?? item.totalAmount ?? 0);

        // Extract predefined meetup points from the nested experience object
        // Ensure your GET route selects Experience(..., meetupPoints)
        const expMeetups =
          item.Experience?.meetupPoints ||
          item.experience?.meetupPoints ||
          item.meetupPoints ||
          [];
        setSavedMeetupPoints(expMeetups);

        const currentMeetupName = item.selected_meetup_point?.name || "";

        // If the current meetup isn't empty AND isn't in our saved list, it must be a custom one
        if (
          currentMeetupName &&
          !expMeetups.some((mp) => mp.name === currentMeetupName)
        ) {
          setIsCustomMeetup(true);
        }

        setFormData({
          status: item.status || "confirmed",
          notes: item.notes || "",
          customExperienceName: item.customExperienceName || "",
          duration: item.duration || "",
          meetupPointName: currentMeetupName,

          guestFirstName:
            item.primary_contact?.firstName ||
            item.guestSnapshot?.firstName ||
            "",
          guestLastName:
            item.primary_contact?.lastName ||
            item.guestSnapshot?.lastName ||
            "",
          guestEmail:
            item.primary_contact?.email || item.guestSnapshot?.email || "",
          guestPhone:
            item.primary_contact?.phone || item.guestSnapshot?.phone || "",

          adultsCount: item.adultsCount ?? item.counts?.adults ?? 1,
          kidsCount: item.kidsCount ?? item.counts?.kids ?? 0,
          unitPriceAdult: item.unitPriceAdult ?? item.unitPrices?.adult ?? 0,
          unitPriceKid: item.unitPriceKid ?? item.unitPrices?.kid ?? 0,
          discountAmount:
            item.money?.discountAmount ??
            item.promo?.discountAmount ??
            item.discountAmount ??
            0,

          attendees: Array.isArray(item.attendees) ? item.attendees : [],
        });
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let parsedValue = value;

    if (type === "number") {
      parsedValue = value === "" ? "" : Number(value);
      if (parsedValue < 0) parsedValue = 0;
    }

    setFormData((prev) => ({ ...prev, [name]: parsedValue }));
  };

  const addAttendee = () => {
    setFormData((prev) => ({
      ...prev,
      attendees: [...prev.attendees, { name: "", type: "adult", age: "" }],
    }));
  };

  const removeAttendee = (index) => {
    setFormData((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((_, i) => i !== index),
    }));
  };

  const updateAttendee = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.attendees];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, attendees: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find the full JSON object for the selected meetup point
      let fullMeetupObject = null;
      if (formData.meetupPointName) {
        if (!isCustomMeetup) {
          fullMeetupObject = savedMeetupPoints.find(
            (mp) => mp.name === formData.meetupPointName,
          ) || { name: formData.meetupPointName };
        } else {
          fullMeetupObject = { name: formData.meetupPointName };
        }
      }

      const res = await fetch(`/api/admin/reservations/${id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          newTotalAmount: newTotal,
          fullMeetupObject, // Send the complete object to the backend
        }),
      });

      if (!res.ok)
        throw new Error((await res.json()).error || "Failed to save");

      toast.success("Booking updated successfully");
      router.push(`/admin/bookings/${id}`);
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const subtotal = useMemo(() => {
    return (
      formData.adultsCount * formData.unitPriceAdult +
      formData.kidsCount * formData.unitPriceKid
    );
  }, [
    formData.adultsCount,
    formData.unitPriceAdult,
    formData.kidsCount,
    formData.unitPriceKid,
  ]);

  const newTotal = useMemo(() => {
    return Math.max(0, subtotal - formData.discountAmount);
  }, [subtotal, formData.discountAmount]);

  const totalHeadcount =
    Number(formData.adultsCount) + Number(formData.kidsCount);
  const isHeadcountMismatch =
    totalHeadcount !== formData.attendees.length &&
    formData.attendees.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfcfb]">
        <Loader2 className="animate-spin text-[#8b6f47]" size={32} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fdfcfb] text-[#3f3127] pb-32">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 border-b border-[#e3ddd2] bg-white/90 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-[#e3ddd2] bg-white hover:bg-[#f4f1ec] transition-all shadow-sm"
            >
              <ArrowLeft size={18} className="text-[#3f3127]" />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                Editing Booking
              </p>
              <h1 className="text-xl font-serif text-[#3f3127]">#{id}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Financial Overview & Warning */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-4 shadow-sm"
          >
            <AlertTriangle
              className="text-amber-600 shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <h4 className="text-sm font-bold text-amber-900 uppercase tracking-tight">
                Financial Impact Warning
              </h4>
              <p className="mt-1 text-xs text-amber-800/90 leading-relaxed">
                Updating prices, discounts, or headcounts changes the invoice
                total, but{" "}
                <strong>it does not auto-charge or refund the guest</strong>. Go
                to the "Payment Provisioning" tab after saving to manually
                collect or refund the difference via Stripe.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-[#e3ddd2] bg-white p-6 shadow-sm flex flex-col justify-center"
          >
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                Subtotal
              </p>
              <p className="text-xs text-[#7a6a5f]">€{subtotal.toFixed(2)}</p>
            </div>
            {formData.discountAmount > 0 && (
              <div className="flex justify-between items-center mb-2 border-b border-[#e3ddd2] pb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  Discount
                </p>
                <p className="text-xs text-emerald-600">
                  -€{Number(formData.discountAmount).toFixed(2)}
                </p>
              </div>
            )}
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#3f3127]">
                Calculated Total
              </p>
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <span
                className={`text-3xl font-serif ${newTotal !== originalTotal ? "text-amber-600" : "text-[#2a1f18]"}`}
              >
                €{newTotal.toFixed(2)}
              </span>
              {newTotal !== originalTotal && (
                <span className="text-sm font-medium text-[#7a6a5f] line-through">
                  €{originalTotal.toFixed(2)}
                </span>
              )}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-7 space-y-8">
            {/* Guest Details */}
            <section className="rounded-[2rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[#e3ddd2] bg-[#fcfbf9] px-8 py-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#8b6f47]">
                <User2 size={18} className="opacity-70" /> Primary Contact
              </div>
              <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InputField
                  label="First Name"
                  name="guestFirstName"
                  value={formData.guestFirstName}
                  onChange={handleChange}
                />
                <InputField
                  label="Last Name"
                  name="guestLastName"
                  value={formData.guestLastName}
                  onChange={handleChange}
                />
                <InputField
                  label="Email Address"
                  name="guestEmail"
                  type="email"
                  value={formData.guestEmail}
                  onChange={handleChange}
                  className="sm:col-span-2"
                />
                <InputField
                  label="Phone Number"
                  name="guestPhone"
                  type="tel"
                  value={formData.guestPhone}
                  onChange={handleChange}
                  className="sm:col-span-2"
                />
              </div>
            </section>

            {/* Experience & Logistics */}
            <section className="rounded-[2rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[#e3ddd2] bg-[#fcfbf9] px-8 py-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#8b6f47]">
                <MapPin size={18} className="opacity-70" /> Logistics
              </div>
              <div className="p-8 space-y-6">
                <InputField
                  label="Custom Experience Name (Overrides Default)"
                  name="customExperienceName"
                  value={formData.customExperienceName}
                  onChange={handleChange}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Meetup Point Dropdown / Custom Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] block">
                        Meetup Point
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomMeetup(!isCustomMeetup);
                          setFormData((f) => ({ ...f, meetupPointName: "" })); // Clear when switching
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider text-[#8b6f47] hover:underline"
                      >
                        {isCustomMeetup && savedMeetupPoints.length > 0
                          ? "Choose Saved"
                          : "Enter Custom"}
                      </button>
                    </div>

                    {isCustomMeetup || savedMeetupPoints.length === 0 ? (
                      <input
                        type="text"
                        name="meetupPointName"
                        value={formData.meetupPointName}
                        onChange={handleChange}
                        placeholder="e.g., specific hotel lobby..."
                        className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-4 py-3 text-sm text-[#3f3127] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30"
                      />
                    ) : (
                      <select
                        name="meetupPointName"
                        value={formData.meetupPointName}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-4 py-3 text-sm text-[#3f3127] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30"
                      >
                        <option value="">— Select a Point —</option>
                        {savedMeetupPoints.map((mp, idx) => (
                          <option key={idx} value={mp.name}>
                            {mp.name} {mp.time ? `(${mp.time})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <InputField
                    label="Duration (Minutes)"
                    name="duration"
                    type="number"
                    value={formData.duration}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084]">
                    Booking Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-4 py-3 text-sm text-[#3f3127] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Internal Notes */}
            <section className="rounded-[2rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[#e3ddd2] bg-[#fcfbf9] px-8 py-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#8b6f47]">
                <FileText size={18} className="opacity-70" /> Internal Notes
              </div>
              <div className="p-8">
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Add private notes for the administrative team here..."
                  className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-4 py-3 text-sm text-[#3f3127] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 resize-y"
                />
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-5 space-y-8">
            {/* Headcount & Pricing */}
            <section className="rounded-[2rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[#e3ddd2] bg-[#fcfbf9] px-8 py-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#8b6f47]">
                <Calculator size={18} className="opacity-70" /> Headcount &
                Pricing
              </div>
              <div className="p-8 space-y-6 bg-[#fdfaf5]">
                <div className="flex items-center justify-between gap-4 border-b border-[#e3ddd2]/60 pb-6">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-[#3f3127] block mb-1">
                      Adults
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a6a5f] text-sm">
                        €
                      </span>
                      <input
                        type="number"
                        name="unitPriceAdult"
                        value={formData.unitPriceAdult}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-[#e3ddd2] bg-white pl-8 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-center font-bold text-[#a09084] pt-5">
                    ×
                  </div>
                  <div className="w-24">
                    <label className="text-xs font-bold text-[#3f3127] block mb-1">
                      Count
                    </label>
                    <input
                      type="number"
                      name="adultsCount"
                      min="1"
                      value={formData.adultsCount}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-[#e3ddd2] bg-white px-4 py-2 text-sm text-center focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-[#e3ddd2]/60 pb-6">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-[#3f3127] block mb-1">
                      Kids
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a6a5f] text-sm">
                        €
                      </span>
                      <input
                        type="number"
                        name="unitPriceKid"
                        value={formData.unitPriceKid}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-[#e3ddd2] bg-white pl-8 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-center font-bold text-[#a09084] pt-5">
                    ×
                  </div>
                  <div className="w-24">
                    <label className="text-xs font-bold text-[#3f3127] block mb-1">
                      Count
                    </label>
                    <input
                      type="number"
                      name="kidsCount"
                      min="0"
                      value={formData.kidsCount}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-[#e3ddd2] bg-white px-4 py-2 text-sm text-center focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-emerald-700 block mb-1">
                      Discount Overrides
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 text-sm">
                        −€
                      </span>
                      <input
                        type="number"
                        name="discountAmount"
                        value={formData.discountAmount}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none placeholder-emerald-300"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Attendees List */}
            <section className="rounded-[2rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[#e3ddd2] bg-[#fcfbf9] px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#8b6f47]">
                  <Users size={18} className="opacity-70" /> Attendees (
                  {formData.attendees.length})
                </div>
                <button
                  onClick={addAttendee}
                  className="text-[#8b6f47] hover:bg-[#8b6f47]/10 p-1.5 rounded-full transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {isHeadcountMismatch && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    Warning: You have {totalHeadcount} tickets but{" "}
                    {formData.attendees.length} names listed.
                  </div>
                )}

                <AnimatePresence>
                  {formData.attendees.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-6 text-sm text-[#a09084]"
                    >
                      No individual attendees added.
                    </motion.div>
                  )}
                  {formData.attendees.map((attendee, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex gap-3 items-start group"
                    >
                      <div className="flex-1 space-y-3 bg-[#fdfcfb] border border-[#e3ddd2] rounded-xl p-4">
                        <div className="flex gap-3">
                          <input
                            placeholder="Full Name"
                            value={attendee.name}
                            onChange={(e) =>
                              updateAttendee(index, "name", e.target.value)
                            }
                            className="flex-1 rounded-lg border border-[#e3ddd2] px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                          />
                          <select
                            value={attendee.type || "adult"}
                            onChange={(e) =>
                              updateAttendee(index, "type", e.target.value)
                            }
                            className="w-24 rounded-lg border border-[#e3ddd2] px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#8b6f47]/30 outline-none bg-white"
                          >
                            <option value="adult">Adult</option>
                            <option value="kid">Kid</option>
                          </select>
                        </div>
                        <input
                          placeholder="Dietary requirements or notes (optional)..."
                          value={attendee.notes || attendee.dietary || ""}
                          onChange={(e) =>
                            updateAttendee(index, "notes", e.target.value)
                          }
                          className="w-full rounded-lg border border-[#e3ddd2] bg-white px-3 py-1.5 text-xs text-[#7a6a5f] focus:ring-2 focus:ring-[#8b6f47]/30 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => removeAttendee(index)}
                        className="mt-4 text-[#a09084] hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Floating Action Footer */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-[#e3ddd2] p-4 sm:p-6 z-40 transform transition-transform shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            disabled={saving}
            className="text-sm font-bold text-[#7a6a5f] hover:text-[#3f3127] uppercase tracking-widest px-4"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-3 rounded-full bg-[#1a1a1a] text-white px-8 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {saving ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            {saving ? "Saving Changes..." : "Save Booking"}
          </button>
        </div>
      </div>
    </main>
  );
}

function InputField({
  label,
  name,
  type = "text",
  value,
  onChange,
  className = "",
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] block">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-[#e3ddd2] bg-[#fdfcfb] px-4 py-3 text-sm text-[#3f3127] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 transition-shadow"
      />
    </div>
  );
}
