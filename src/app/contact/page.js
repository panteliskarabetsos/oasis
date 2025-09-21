'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f1ec] dark:bg-[#111] text-[#2f2f2f] dark:text-[#e9e4da] transition-colors duration-500">
      <section className="py-32 px-6 md:px-12">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-6xl font-serif mb-6">Get in Touch</h1>
          <p className="text-lg md:text-xl text-[#4a4a4a] dark:text-[#ccc] mb-12">
            Whether you're curious about our experiences or ready to start your journey with Oasis,
            we're here to help.
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto space-y-6 bg-white dark:bg-[#1e1e1e] p-10 rounded-3xl shadow-xl"
        >
          <div>
            <label htmlFor="name" className="block mb-2 text-sm font-medium">Name</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-4 rounded-lg border border-[#ccc] dark:border-[#444] bg-[#fafafa] dark:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#a3845b]"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block mb-2 text-sm font-medium">Email</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-4 rounded-lg border border-[#ccc] dark:border-[#444] bg-[#fafafa] dark:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#a3845b]"
              required
            />
          </div>

          <div>
            <label htmlFor="message" className="block mb-2 text-sm font-medium">Message</label>
            <textarea
              id="message"
              rows={5}
              value={formData.message}
              onChange={handleChange}
              className="w-full p-4 rounded-lg border border-[#ccc] dark:border-[#444] bg-[#fafafa] dark:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#a3845b]"
              required
            />
          </div>

          <div className="text-center">
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-[#a3845b] text-white px-8 py-4 rounded-full font-medium hover:bg-[#c9a477] transition-all shadow-md hover:shadow-lg"
            >
              {status === 'loading' ? 'Sending...' : 'Send Message'}
            </button>
          </div>

          {status === 'success' && (
            <motion.div
                className="text-center mt-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <AnimatedCheckmark />
                <p className="text-green-600 font-medium text-lg">Your message has been sent!</p>
            </motion.div>
            )}

                {status === 'error' && (
                <motion.div
                    className="text-center mt-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <AnimatedErrorIcon />
                    <p className="text-red-600 font-medium text-lg">Something went wrong. Please try again.</p>
                </motion.div>
                )}

        </motion.form>

        <motion.div
          className="mt-20 text-center text-[#4a4a4a] dark:text-[#aaa] text-sm"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <p>We'll get back to you as soon as possible. Thank you for reaching out ✨</p>
        </motion.div>
      </section>
    </main>
  );
}

function AnimatedCheckmark() {
    return (
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto mb-4"
        width={60}
        height={60}
        viewBox="0 0 52 52"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        <circle
          cx="26"
          cy="26"
          r="25"
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
        />
        <motion.path
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeLinecap="round"
          d="M14 27 l8 8 l16 -16"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
        />
      </motion.svg>
    );
  }
  

  function AnimatedErrorIcon() {
    return (
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto mb-4"
        width={60}
        height={60}
        viewBox="0 0 52 52"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <circle
          cx="26"
          cy="26"
          r="25"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
        />
        <motion.line
          x1="16"
          y1="16"
          x2="36"
          y2="36"
          stroke="#ef4444"
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
        />
        <motion.line
          x1="36"
          y1="16"
          x2="16"
          y2="36"
          stroke="#ef4444"
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
        />
      </motion.svg>
    );
  }
  