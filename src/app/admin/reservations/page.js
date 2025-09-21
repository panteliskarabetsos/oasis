"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import * as XLSX from "xlsx";

const AdminReservationsPage = () => {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [isAdmin, setIsAdmin] = useState(null); // null = unknown, true/false when resolved
  const [booted, setBooted] = useState(false);

  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedExperienceId, setSelectedExperienceId] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState(1);
  const [notes, setNotes] = useState("");
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [experiences, setExperiences] = useState([]);

  const [grouped, setGrouped] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedExperience, setSelectedExperience] = useState("");

  const [editingBooking, setEditingBooking] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState("today"); // today | all | upcoming | past
  const [isLoadingGrouped, setIsLoadingGrouped] = useState(true);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserList, setShowUserList] = useState(false);
  const [formError, setFormError] = useState("");

  const userSearchRef = useRef();
  const isFormValid =
    !!selectedUser &&
    !!selectedExperienceId &&
    !!selectedSlotId &&
    numberOfPeople > 0;

  const filteredUsers = users.filter(
    (u) =>
      `${u.name} ${u.surname}`
        .toLowerCase()
        .includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ----- Resolve admin role using /api/me (fallback to Supabase metadata)
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

  // ----- Redirect non-admins
  useEffect(() => {
    if (!loading && booted && isAdmin === false) {
      router.replace("/");
    }
  }, [loading, booted, isAdmin, router]);

  // ----- Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userSearchRef.current && !userSearchRef.current.contains(e.target)) {
        setShowUserList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ----- Export to Excel (unchanged)
  const exportToExcel = () => {
    if (!bookings || bookings.length === 0) {
      alert("No bookings available to export.");
      return;
    }
    setIsLoadingGrouped(true);
    const now = new Date();

    const filteredBookings = bookings.filter((b) => {
      const date = new Date(b.scheduleSlot?.date);
      const isToday = date.toDateString() === now.toDateString();
      const isAfterToday = date > now && !isToday;
      const isBeforeNow = date < now && !isToday;

      switch (viewMode) {
        case "today":
          return isToday;
        case "upcoming":
          return isAfterToday;
        case "past":
          return isBeforeNow;
        case "all":
        default:
          return true;
      }
    });

    if (filteredBookings.length === 0) {
      alert("No bookings to export for selected view.");
      setIsLoadingGrouped(false);
      return;
    }

    const workbook = XLSX.utils.book_new();
    const sheetData = [];
    const merges = [];

    const groupedByExperience = filteredBookings.reduce((acc, b) => {
      const expName = b.experience?.name || "Unknown Experience";
      if (!acc[expName]) acc[expName] = [];
      acc[expName].push({
        Name: `${b.user?.name ?? "—"} ${b.user?.surname ?? ""}`.trim(),
        Email: b.user?.email ?? "—",
        Phone: b.user?.phone ?? "—",
        Date: new Date(b.scheduleSlot?.date),
      });
      return acc;
    }, {});

    let rowIndex = 0;

    Object.entries(groupedByExperience).forEach(
      ([experienceName, rows], index, array) => {
        sheetData.push([`${experienceName} Reservations`]);
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 3 } });
        rowIndex++;

        const headers = ["Name", "Email", "Phone", "Date"];
        sheetData.push(headers);
        rowIndex++;

        rows
          .sort((a, b) => a.Date - b.Date)
          .forEach((row) => {
            sheetData.push([
              row.Name,
              row.Email,
              row.Phone,
              row.Date.toLocaleString(),
            ]);
            rowIndex++;
          });

        if (index < array.length - 1) {
          sheetData.push([]);
          rowIndex++;
        }
      }
    );

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet["!merges"] = merges;
    worksheet["!cols"] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 25 }];

    Object.keys(worksheet).forEach((cell) => {
      if (!cell.startsWith("!")) {
        const cellRef = XLSX.utils.decode_cell(cell);
        const value = worksheet[cell].v;

        if (
          typeof value === "string" &&
          value.includes("Reservations") &&
          cellRef.c === 0
        ) {
          worksheet[cell].s = {
            font: { bold: true, sz: 14 },
            alignment: { horizontal: "center" },
          };
        }

        if (
          sheetData[cellRef.r]?.[0] === "Name" &&
          ["Name", "Email", "Phone", "Date"].includes(value)
        ) {
          worksheet[cell].s = {
            font: { bold: true },
            alignment: { horizontal: "left" },
            fill: { fgColor: { rgb: "E8EAF6" } },
          };
        }

        worksheet[cell].s = {
          ...(worksheet[cell].s || {}),
          border: {
            top: { style: "thin", color: { auto: 1 } },
            bottom: { style: "thin", color: { auto: 1 } },
            left: { style: "thin", color: { auto: 1 } },
            right: { style: "thin", color: { auto: 1 } },
          },
          alignment: {
            ...(worksheet[cell].s?.alignment || {}),
            vertical: "center",
          },
        };
      }
    });

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `Reservations - ${viewMode}`
    );
    XLSX.writeFile(
      workbook,
      `reservations-${viewMode}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    setIsLoadingGrouped(false);
  };

  // ----- Load available slots when experience changes
  useEffect(() => {
    if (!selectedExperienceId) {
      setAvailableSlots([]);
      return;
    }

    const loadSlots = async () => {
      setIsLoadingSlots(true);
      const res = await fetch(
        `/api/admin/schedule?experienceId=${selectedExperienceId}`
      );
      const data = await res.json();

      const futureSlots = data.filter(
        (slot) =>
          new Date(slot.date) >= new Date() &&
          slot.totalSlots > slot.bookedSlots &&
          !slot.isCancelled
      );

      // include current slot of an editing booking if not in the future list
      if (
        editingBooking?.scheduleSlot?.experience?.id === selectedExperienceId
      ) {
        const currentSlot = editingBooking.scheduleSlot;
        const alreadyIncluded = futureSlots.some(
          (slot) => slot.id === currentSlot.id
        );
        if (!alreadyIncluded) futureSlots.push(currentSlot);
      }

      futureSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
      setAvailableSlots(futureSlots);
      setIsLoadingSlots(false);
    };

    loadSlots();
  }, [selectedExperienceId, editingBooking]);

  // ----- Fetch bookings/users/experiences once admin is confirmed
  useEffect(() => {
    async function fetchAllData() {
      setIsLoadingGrouped(true);
      const [bookingsRes, usersRes, experiencesRes] = await Promise.all([
        fetch("/api/admin/reservations"),
        fetch("/api/admin/users"),
        fetch("/api/admin/experiences"),
      ]);

      const [bookingsData, usersData, experiencesData] = await Promise.all([
        bookingsRes.json(),
        usersRes.json(),
        experiencesRes.json(),
      ]);

      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setExperiences(Array.isArray(experiencesData) ? experiencesData : []);
      setIsLoadingGrouped(false);
    }

    if (isAdmin) fetchAllData();
  }, [isAdmin]);

  // ----- Filter & group bookings for view
  useEffect(() => {
    const now = new Date();
    setIsLoadingGrouped(true);

    const filtered = bookings.filter((b) => {
      const bookingDate = new Date(b.scheduleSlot?.date);
      const matchesExperience = selectedExperience
        ? b.scheduleSlot?.experience?.id?.toString() === selectedExperience
        : true;
      const matchesDate = selectedDate
        ? new Date(b.scheduleSlot?.date).toISOString().slice(0, 10) ===
          selectedDate
        : true;

      if (!matchesExperience || !matchesDate) return false;

      const isToday = bookingDate.toDateString() === now.toDateString();
      const isAfterToday = bookingDate > now && !isToday;
      const isBeforeNow = bookingDate < now && !isToday;

      switch (viewMode) {
        case "today":
          return isToday;
        case "upcoming":
          return isAfterToday;
        case "past":
          return isBeforeNow || (isToday && bookingDate < now);
        case "all":
        default:
          return true;
      }
    });

    const groupedByExperience = filtered.reduce((acc, booking) => {
      const expId = booking.scheduleSlot?.experience?.id;
      if (!expId) return acc;

      const bookingDate = new Date(booking.scheduleSlot?.date);
      const isToday = bookingDate.toDateString() === now.toDateString();

      const group = isToday
        ? bookingDate > now
          ? "upcoming"
          : "past" // today split into upcoming/past
        : bookingDate > now
        ? "future"
        : "past"; // future vs past for other days

      if (!acc[expId]) {
        acc[expId] = {
          experience: booking.scheduleSlot?.experience,
          upcoming: [],
          past: [],
          future: [],
        };
      }
      acc[expId][group].push(booking);
      return acc;
    }, {});

    setGrouped(groupedByExperience);
    setIsLoadingGrouped(false);
  }, [bookings, selectedDate, selectedExperience, viewMode]);

  // ----- Delete booking
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this booking?")) return;

    const res = await fetch("/api/admin/reservations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      setBookings((prev) => prev.filter((b) => b.id !== id));
    }
  };

  // ----- Create / Update booking
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSaving(true);

    const form = e.target;
    const people = Number(form.numberOfPeople.value);

    const selectedSlot = availableSlots.find(
      (slot) => slot.id === selectedSlotId
    );
    if (selectedSlot) {
      const remaining = selectedSlot.totalSlots - selectedSlot.bookedSlots;
      if (people > remaining) {
        setFormError(
          `Only ${remaining} spot${
            remaining > 1 ? "s" : ""
          } left for this slot.`
        );
        setIsSaving(false);
        return;
      }
    }

    const bookingData = {
      id: editingBooking?.id,
      userId: form.userId.value,
      scheduleSlotId: form.slotId.value,
      numberOfPeople: people,
      notes: form.notes.value || null,
    };

    const method = editingBooking ? "PATCH" : "POST";

    try {
      const res = await fetch("/api/admin/reservations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      const result = await res.json();

      if (!res.ok) {
        setFormError(
          result?.error || "Something went wrong while saving the reservation."
        );
        setIsSaving(false);
        return;
      }

      setBookings((prev) =>
        editingBooking
          ? prev.map((b) => (b.id === result.id ? result : b))
          : [...prev, result]
      );

      setEditingBooking(null);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setFormError("Unexpected error. Please try again.");
    }

    setIsSaving(false);
  };

  // ----- Loading/redirect states
  if (loading || !booted || isAdmin === null) return null;
  if (!isAdmin) return null;

  return (
    <div className="p-6 max-w-screen-xl mx-auto print:block">
      <h1 className="text-3xl font-serif font-semibold text-[#5a4a3f] mb-8 text-center">
        Reservations per Experience
      </h1>

      <div className="flex flex-wrap gap-4 mb-8 justify-center sm:justify-start print:hidden">
        {/* Back to Dashboard */}
        <button
          onClick={() => router.push("/admin/")}
          className="px-5 py-2.5 rounded-full bg-[#f4f1ec] text-[#5a4a3f] border border-[#d8cfc3] shadow-sm hover:bg-[#eae5df] transition-all text-sm font-medium"
        >
          ← Back to Dashboard
        </button>

        {/* Add Reservation */}
        <button
          onClick={() => {
            setEditingBooking(null);
            setSelectedUser(null);
            setUserSearch("");
            setSelectedExperienceId("");
            setSelectedSlotId("");
            setNumberOfPeople(1);
            setNotes("");
            setShowForm(true);
          }}
          className="px-5 py-2.5 rounded-full bg-[#8b6f47] text-white shadow hover:bg-[#a78b62] transition-all text-sm font-medium"
        >
          + Add Reservation
        </button>

        {/* Export Excel */}
        <button
          onClick={exportToExcel}
          className="px-5 py-2.5 rounded-full bg-[#6b63ff] text-white shadow hover:bg-[#5852dc] transition-all text-sm font-medium"
        >
          Download Excel
        </button>

        {/* Print Reservations */}
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 rounded-full bg-[#5a4a3f] text-white shadow hover:bg-[#463c33] transition-all text-sm font-medium"
        >
          Print Reservations
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-8 print:hidden">
        {/* Date Picker */}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 rounded-full border border-[#d8cfc3] bg-[#fefcf9] text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47] font-serif"
        />

        {/* Experience Select */}
        <select
          value={selectedExperience}
          onChange={(e) => setSelectedExperience(e.target.value)}
          className="px-4 py-2 rounded-full border border-[#d8cfc3] bg-[#fefcf9] text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47] font-serif"
        >
          <option value="">All Experiences</option>
          {experiences.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.name}
            </option>
          ))}
        </select>

        {/* View Mode */}
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          className="px-4 py-2 rounded-full border border-[#d8cfc3] bg-[#fefcf9] text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47] font-serif"
        >
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Grouped bookings */}
      <div className="space-y-12 print:block">
        {isLoadingGrouped ? (
          <div className="flex flex-col items-center justify-center mt-12 text-[#5a4a3f] font-serif text-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#8b6f47] border-t-transparent mb-4" />
            Loading reservations...
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-center text-[#5a4a3f] text-lg font-serif italic mt-12">
            No {viewMode} reservations found.
          </p>
        ) : (
          Object.entries(grouped).map(
            ([expId, { experience, upcoming, past, future }]) => (
              <div
                key={expId}
                className="bg-white shadow-lg rounded-2xl p-8 border border-[#e6e0d3] print:border-none print:shadow-none"
              >
                <h2 className="text-2xl font-serif font-semibold text-[#5a4a3f] mb-6 print:text黑">
                  {experience.name}
                </h2>

                {[
                  {
                    title: "Upcoming Today",
                    data: upcoming,
                    color: "text-green-700",
                    border: "border-l-4 border-green-400",
                  },
                  {
                    title: "Past Today",
                    data: past,
                    color: "text-gray-600",
                    border: "border-l-4 border-gray-300",
                  },
                  {
                    title: "Future Reservations",
                    data: future,
                    color: "text-purple-700",
                    border: "border-l-4 border-purple-300",
                  },
                ].map(
                  ({ title, data, color, border }) =>
                    data?.length > 0 && (
                      <div key={title} className={`mb-8 pl-4 ${border}`}>
                        <h3
                          className={`text-lg font-medium mb-3 ${color} print:text-black`}
                        >
                          {title}
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-[#e0dcd4] print:border-black">
                          <table className="w-full text-left text-[#5a4a3f] print:text-black text-sm">
                            <thead className="bg-[#f7f5f1] text-sm print:bg-white print:border-b print:border-black">
                              <tr>
                                <th className="p-3 font-normal">User</th>
                                <th className="p-3 font-normal">Email</th>
                                <th className="p-3 font-normal">Phone</th>
                                <th className="p-3 font-normal">Date</th>
                                <th className="p-3 font-normal">Comments</th>
                                <th className="p-3 font-normal print:hidden">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.map((b) => (
                                <tr
                                  key={b.id}
                                  className="border-t border-[#f0ece6] hover:bg-[#f9f7f4] transition print:hover:bg-transparent"
                                >
                                  <td className="p-3">
                                    {b.user?.name} {b.user?.surname}
                                  </td>
                                  <td className="p-3">{b.user?.email}</td>
                                  <td className="p-3">{b.user?.phone}</td>
                                  <td className="p-3">
                                    {new Date(
                                      b.scheduleSlot?.date
                                    ).toLocaleString()}
                                  </td>
                                  <td className="p-3">{b.notes || "—"}</td>
                                  <td className="p-3 space-x-2 print:hidden">
                                    <button
                                      onClick={() => {
                                        setEditingBooking(b);
                                        setSelectedUser(b.user);
                                        setUserSearch(
                                          `${b.user?.name || ""} ${
                                            b.user?.surname || ""
                                          }`
                                        );
                                        setSelectedExperienceId(
                                          b.scheduleSlot?.experience?.id || ""
                                        );
                                        setSelectedSlotId(
                                          b.scheduleSlot?.id || ""
                                        );
                                        setNumberOfPeople(
                                          b.numberOfPeople || 1
                                        );
                                        setNotes(b.notes || "");
                                        setShowForm(true);
                                      }}
                                      className="px-3 py-1 rounded-full bg-yellow-400 text-white hover:bg-yellow-500 transition-all text-sm"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(b.id)}
                                      className="px-3 py-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all text-sm"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                )}
              </div>
            )
          )
        )}
      </div>

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded-2xl shadow-xl border border-[#e5ded2] w-full max-w-md space-y-5"
          >
            <h2 className="text-2xl font-semibold text-[#5a4a3f] mb-2 text-center">
              Manage Booking
            </h2>

            {/* Search User */}
            <div>
              <label className="block text-sm text-[#5a4a3f] mb-1">
                Search User
              </label>
              <div ref={userSearchRef} className="relative">
                <input
                  type="text"
                  placeholder="Type to search user..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setShowUserList(true);
                    setSelectedUser(null);
                  }}
                  className="w-full border border-[#e0dcd4] rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
                />
                {showUserList && (
                  <div className="absolute z-10 w-full max-h-40 overflow-y-auto border border-[#e0dcd4] rounded-md bg-white shadow-md">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setUserSearch(`${u.name} ${u.surname}`);
                          setShowUserList(false);
                        }}
                        className="px-4 py-2 hover:bg-[#f5f3ef] cursor-pointer text-sm text-[#5a4a3f]"
                      >
                        {u.name} {u.surname} ({u.email})
                      </div>
                    ))}
                    {filteredUsers.length === 0 && userSearch.length > 0 && (
                      <div className="px-4 py-2 text-sm text-red-600 font-medium">
                        No users found with that name or email.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input
                type="hidden"
                name="userId"
                value={selectedUser?.id || ""}
              />
            </div>

            {/* Experience and Slot */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm text-[#5a4a3f] mb-1">
                  Experience
                </label>
                <select
                  name="experienceId"
                  required
                  value={selectedExperienceId}
                  onChange={(e) => {
                    setSelectedExperienceId(e.target.value);
                    setSelectedSlotId("");
                  }}
                  className="w-full border border-[#e0dcd4] rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
                >
                  <option value="">Select Experience</option>
                  {experiences.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#5a4a3f] mb-1">
                  Slot
                </label>
                <select
                  name="slotId"
                  required
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="w-full border border-[#e0dcd4] rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
                >
                  <option value="">Select Slot</option>
                  {availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {new Date(slot.date).toLocaleString()} —{" "}
                      {slot.totalSlots - slot.bookedSlots} spots left
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Number of People */}
            <div>
              <label className="block text-sm text-[#5a4a3f] mb-1">
                Number of People
              </label>
              <input
                type="number"
                name="numberOfPeople"
                min={1}
                value={numberOfPeople}
                onChange={(e) => setNumberOfPeople(Number(e.target.value))}
                required
                className="w-full border border-[#e0dcd4] rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-[#5a4a3f] mb-1">
                Notes (optional)
              </label>
              <textarea
                name="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-[#e0dcd4] rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
                placeholder="e.g. Vegetarian meal, accessibility needs..."
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600 font-medium text-center -mt-2">
                {formError}
              </p>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={!isFormValid || isSaving || isLoadingSlots}
                className={`px-4 py-2 rounded-full transition-all ${
                  !isFormValid || isSaving || isLoadingSlots
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#8b6f47] text-white hover:bg-[#a78b62]"
                }`}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-300 text-[#5a4a3f] rounded-full hover:bg-gray-400 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminReservationsPage;
