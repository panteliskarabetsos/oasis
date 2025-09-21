'use client';
import { useRouter } from 'next/navigation';  
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function AdminSchedulePage() {
  const router = useRouter();

  const [experiences, setExperiences] = useState([]);
  const [selectedExperienceId, setSelectedExperienceId] = useState('');
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({
    date: '',
    time: '',
    totalSlots: '',
  });
  
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [editedAvailableSlots, setEditedAvailableSlots] = useState('');
  const [editedBookedSlots, setEditedBookedSlots] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const now = new Date();
  const upcomingSlots = slots.filter(slot => new Date(slot.date) >= now);
  const pastSlots = slots.filter(slot => new Date(slot.date) < now);

  useEffect(() => {
    fetch('/api/admin/experiences')
      .then(res => res.json())
      .then(setExperiences)
      .catch(() => toast.error('Failed to load experiences.'));
  }, []);

  useEffect(() => {
    if (selectedExperienceId) {
      const experience = experiences.find(exp => exp.id === Number(selectedExperienceId));
      setSelectedExperience(experience);

      setLoading(true);
      fetch(`/api/admin/schedule?experienceId=${selectedExperienceId}`)
        .then(res => res.json())
        .then(setSlots)
        .catch(() => toast.error('Failed to load slots.'))
        .finally(() => setLoading(false));
    } else {
      setSelectedExperience(null);
      setSlots([]);
    }
  }, [selectedExperienceId, experiences]);
  const handleAddSlot = async () => {
    const { date, time, totalSlots } = newSlot;
  
    if (!date || !time || !totalSlots) {
      toast.error('Please fill in all fields.');
      return;
    }
  
    const slotDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    if (!selectedExperience.frequency.includes(slotDay)) {
      toast.error(`The selected date (${slotDay}) is not within the allowed days.`);
      return;
    }
  
    const isoDateTime = new Date(`${date}T${time}`).toISOString();
  
    const res = await fetch('/api/admin/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceId: Number(selectedExperienceId),
        date: isoDateTime,
        totalSlots: Number(totalSlots),
      }),
    });
  
    if (res.ok) {
      const newEntry = await res.json();
      setSlots([...slots, newEntry]);
      setNewSlot({ date: '', time: '', totalSlots: '' }); // 👈 reset
      toast.success('Slot added successfully.');
    } else {
      toast.error('Failed to add slot.');
    }
  };
  

  const handleDeleteSlot = async (id) => {
    const confirmed = window.confirm(
      "⚠️ This will also delete all bookings related to this slot.\n\nAre you sure you want to proceed?"
    );
  
    if (!confirmed) return;
  
    const res = await fetch(`/api/admin/schedule?id=${id}`, {
      method: 'DELETE',
    });
  
    if (res.ok) {
      setSlots(slots.filter(slot => slot.id !== id));
      toast.success('Slot and related bookings deleted.');
    } else {
      toast.error('Failed to delete slot.');
    }
  };

  const handleEditClick = (slot) => {
    setEditingSlotId(slot.id);
    setEditedAvailableSlots(slot.totalSlots - slot.bookedSlots);
  };

  const handleCancelEdit = () => {
    setEditingSlotId(null);
    setEditedAvailableSlots('');
    setEditedBookedSlots('');
  };
  const confirmDeleteSlot = async () => {
    if (!confirmDeleteId) return;
  
    const res = await fetch(`/api/admin/schedule?id=${confirmDeleteId}`, {
      method: 'DELETE',
    });
  
    if (res.ok) {
      setSlots(slots.filter(slot => slot.id !== confirmDeleteId));
      toast.success('Slot deleted.');
    } else {
      toast.error('Failed to delete slot.');
    }
  
    setShowDeleteModal(false);
    setConfirmDeleteId(null);
  };
  
  const handleSaveEdit = async () => {
    const available = Number(editedAvailableSlots);
    const slot = slots.find((s) => s.id === editingSlotId);
  
    if (!slot) {
      toast.error("Slot not found.");
      return;
    }
  
    const booked = slot.bookedSlots;
    const totalSlots = available + booked;
  
    if (available < 0) {
      toast.error("Available slots cannot be negative.");
      return;
    }
  
    const res = await fetch(`/api/admin/schedule/${editingSlotId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalSlots }),
    });
  
    if (res.ok) {
      const updatedSlot = await res.json();
      setSlots(slots.map(slot => (slot.id === editingSlotId ? updatedSlot : slot)));
      toast.success('Slot updated.');
      handleCancelEdit();
    } else {
      toast.error('Failed to update slot.');
    }
  };


  return (
    <main className="max-w-5xl mx-auto pt-24 px-4 sm:px-6 lg:px-8">
      {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full border border-[#e5ded2]">
              <h2 className="text-lg font-semibold text-[#5a4a3f] mb-4 text-center">
                Are you sure you want to delete this slot?
              </h2>
              <p className="text-sm text-center text-[#6b5e53] mb-6">
                This will <strong>also delete all related bookings</strong> for this slot.
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={confirmDeleteSlot}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmDeleteId(null);
                  }}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-[#5a4a3f] rounded-full font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
         {/* Back to Dashboard */}
         <main className="max-w-5xl mx-auto pt-24 px-4 sm:px-6 lg:px-8">

      <div className="sticky top-20 z-10 mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#f4f1ec] text-[#5a4a3f] border border-[#d8cfc3] shadow hover:bg-[#eae5df] transition text-sm font-medium"
        >
          ← Back to Dashboard
        </button>
      </div>

    </main>
      <h1 className="text-4xl font-bold mb-10 text-center font-serif text-[#5a4a3f]">
        Schedule Management
      </h1>

      <div className="bg-[#f8f6f1] p-6 rounded-lg shadow-md border border-[#e3dcd2]">
        <label className="block text-sm font-medium text-[#5a4a3f] mb-2">Select Experience</label>
        <select
          value={selectedExperienceId}
          onChange={e => setSelectedExperienceId(e.target.value)}
          className="w-full p-3 rounded-md border border-[#d8cfc3] bg-white text-[#5a4a3f] mb-4"
        >
          <option value="" disabled>Select an experience</option>
          {experiences.map(exp => (
            <option key={exp.id} value={exp.id}>{exp.name}</option>
          ))}
        </select>

        {selectedExperience && (
          <div className="mb-6 text-sm text-[#6b5e53]">
            <p><strong>Allowed Days:</strong></p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {selectedExperience.frequency.map(day => (
                <li
                  key={day}
                  className="bg-[#eae6de] text-[#5a4a3f] px-3 py-1 rounded-full text-xs font-semibold tracking-wide shadow-sm"
                >
                  {day}
                </li>
              ))}
            </ul>
          </div>
        )}

        {selectedExperienceId && (
          <>
          <div className="bg-white p-6 rounded-xl shadow border border-[#e3dcd2] mb-10">
          <h2 className="text-lg font-semibold text-[#5a4a3f] mb-4">Add New Slot</h2>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            {/* Date */}
            <input
              type="date"
              value={newSlot.date}
              onChange={e => setNewSlot({ ...newSlot, date: e.target.value })}
              className="p-2 rounded border border-[#ccc] bg-white text-[#5a4a3f] shadow-sm w-full sm:w-auto"
            />

            {/* Time */}
            <input
              type="time"
              value={newSlot.time}
              onChange={e => setNewSlot({ ...newSlot, time: e.target.value })}
              className="p-2 rounded border border-[#ccc] bg-white text-[#5a4a3f] shadow-sm w-full sm:w-auto"
            />

            {/* Slots */}
            <input
              type="number"
              min={1}
              placeholder="Total Slots"
              value={newSlot.totalSlots}
              onChange={e => setNewSlot({ ...newSlot, totalSlots: e.target.value })}
              className="p-2 rounded border border-[#ccc] bg-white text-[#5a4a3f] shadow-sm w-full sm:w-40"
            />

            <button
              onClick={handleAddSlot}
              className="bg-[#8b6f47] hover:bg-[#7a5f3a] text-white px-5 py-2 rounded-lg transition shadow-md"
            >
              Add Slot
            </button>
          </div>
        </div>

        <div className="mt-10">
       <h2 className="text-lg font-semibold text-[#5a4a3f] mb-6">Scheduled Slots</h2>

      {loading ? (
        <p className="text-sm text-gray-500">Loading slots...</p>
      ) : slots.length > 0 ? (
        <>
          {/* Split slots into upcoming and past */}
          {(() => {
            const now = new Date();
            const upcomingSlots = slots.filter(slot => new Date(slot.date) >= now);
            const pastSlots = slots.filter(slot => new Date(slot.date) < now);

            const renderSlot = (slot) => {
              const available = slot.totalSlots - slot.bookedSlots;
              const dateLabel = new Date(slot.date).toLocaleDateString();
              const dayOfWeek = new Date(slot.date).toLocaleDateString('en-US', { weekday: 'long' });

              return (
                <div key={slot.id} className="bg-white rounded-xl border border-[#e4ddd3] shadow-md p-5 space-y-2 relative">
                  <div className="absolute top-4 right-4 text-xs px-3 py-1 rounded-full bg-[#8b6f47] text-white">
                    {new Date(slot.date) >= now ? 'Upcoming' : 'Past'}
                  </div>

                  <div className="text-[#5a4a3f] font-semibold text-sm">
                    {dayOfWeek} — <span className="font-normal">{dateLabel}</span>
                  </div>

                  {editingSlotId === slot.id ? (
                    <>
                      <label className="block text-xs mt-2 text-[#5a4a3f]">Available Slots</label>
                      <input
                        type="number"
                        min={0}
                        value={editedAvailableSlots}
                        onChange={e => setEditedAvailableSlots(e.target.value)}
                        className="p-2 rounded border w-full border-[#ccc] bg-[#fdfcf9]"
                      />
                      <div className="flex justify-end gap-2 mt-3">
                        <button
                          onClick={handleSaveEdit}
                          className="bg-[#5a4a3f] text-white px-4 py-1.5 rounded-lg text-sm hover:bg-[#473a30]"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-[#7a6a5a] hover:text-[#5a4a3f] text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm"><strong>Total:</strong> {slot.totalSlots}</p>
                      <p className="text-sm"><strong>Booked:</strong> {slot.bookedSlots}</p>
                      <p className="text-sm"><strong>Available:</strong> {available}</p>
                      <div className="flex justify-end gap-4 mt-3 text-sm">
                        <button
                          onClick={() => handleEditClick(slot)}
                          className="text-[#5a4a3f] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDeleteId(slot.id);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            };

            return (
              <>
                {/* Upcoming Slots */}
                <div className="mb-12">
                  <h3 className="text-2xl font-semibold text-[#5a4a3f] mb-4">Upcoming Slots</h3>
                  {upcomingSlots.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-6">
                      {upcomingSlots.map(renderSlot)}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No upcoming slots.</p>
                  )}
                </div>

                {/* Past Slots */}
                <div className="mt-12">
                  <h3 className="text-2xl font-semibold text-[#5a4a3f] mb-4">Past Slots</h3>
                  {pastSlots.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-6">
                      {pastSlots.map(renderSlot)}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No past slots.</p>
                  )}
                </div>
              </>
            );
          })()}
        </>
      ) : (
        <p className="text-sm text-gray-500">No slots found for this experience.</p>
      )}
    </div>

          </>
        )}
      </div>
    </main>
  );
}
