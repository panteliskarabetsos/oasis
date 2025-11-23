'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
    } else {
      setStatus('error');
    }

    setTimeout(() => setStatus(null), 6000);

  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto text-left relative">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50"
          placeholder="Your name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50"
          placeholder="you@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Message</label>
        <textarea
          className="w-full px-4 py-3 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50"
          placeholder="Your message..."
          rows="5"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          required
        />
      </div>

      <button
        type="submit"
        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white font-semibold py-3 px-6 rounded-full transition"
      >
        {status === 'loading' ? 'Sending...' : 'Send Message'}
      </button>


      <AnimatePresence>
  {status === 'success' && (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.4 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl shadow-xl z-50 border
        text-sm font-medium flex items-center gap-3
        backdrop-blur-md
        bg-gradient-to-br from-green-400 to-green-600 text-white border-green-300
        dark:from-green-600 dark:to-emerald-700 dark:text-emerald-100 dark:border-emerald-400"
    >
      <svg className="w-5 h-5 text-white dark:text-emerald-200 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      Your message was sent! I’ll be in touch soon.
    </motion.div>
  )}

  {status === 'error' && (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.4 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl shadow-xl z-50 border
        text-sm font-medium flex items-center gap-3
        backdrop-blur-md
        bg-gradient-to-br from-red-500 to-pink-600 text-white border-red-300
        dark:from-red-600 dark:to-pink-700 dark:text-pink-100 dark:border-pink-400"
    >
      <svg className="w-5 h-5 text-white dark:text-pink-200 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      Oops! Something went wrong. Please try again.
    </motion.div>
  )}
</AnimatePresence>

    </form>
  );
}
