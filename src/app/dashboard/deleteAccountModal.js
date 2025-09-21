import { useState } from 'react';

export default function DeleteAccountModal({ isOpen, onClose, onConfirm, message, isError }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
        <h2 className="text-lg font-semibold text-[#5a4a3f]">Confirm Account Deletion</h2>
        <p className="text-sm text-[#7a6a5f] mt-2">
          Are you sure you want to delete your account? This action can not be undone.
        </p>

        {/* Show the response message */}
        {message && (
          <div
            className={`mt-4 p-4 rounded-lg ${isError ? 'bg-[#f8d7da] text-[#721c24]' : 'bg-[#d4edda] text-[#155724]'}`}
          >
            {message}
          </div>
        )}

        <div className="mt-4 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-[#5a4a3f] rounded-lg hover:bg-gray-400 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-[#d9534f] text-white rounded-lg hover:bg-[#c9302c] transition-all"
          >
            Confirm Deletion
          </button>
        </div>
      </div>
    </div>
  );
}