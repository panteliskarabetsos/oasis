'use client';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

export default function UnderConstruction() {
  return (
    <main className="min-h-screen bg-[#f4f1ec] dark:bg-[#111] flex items-center justify-center text-center px-6">
      <motion.div
        className="max-w-2xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="bg-[#8b6f47] p-4 rounded-full"
          >
            <Construction size={48} color="white" />
          </motion.div>
        </div>
        <h1 className="text-4xl md:text-5xl font-serif text-[#5a4a3f] dark:text-[#e9e4da] mb-4">
          This page is under construction
        </h1>
        <p className="text-lg text-[#4a4a4a] dark:text-[#ccc]">
          We're working hard to bring this space to life. Check back soon for something beautiful 🌿
        </p>
      </motion.div>
    </main>
  );
}
