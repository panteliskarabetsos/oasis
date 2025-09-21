'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const RouteLoaderContext = createContext();

export function useRouteLoader() {
  return useContext(RouteLoaderContext);
}

export function RouteLoader({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [nextPath, setNextPath] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (nextPath) {
      setIsLoading(true);
      const timeout = setTimeout(() => {
        router.push(nextPath);
        setIsLoading(false);
        setNextPath(null);
      }, 1000); // page transition
      return () => clearTimeout(timeout);
    }
  }, [nextPath]);

  const triggerRouteChange = (to) => {
    if (!to) return;
    setNextPath(to);
  };

  return (
    <RouteLoaderContext.Provider value={{ triggerRouteChange }}>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#f4f1ec] via-[#eae6e0] to-[#f4f1ec] backdrop-blur-2xl px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl font-serif text-[#8b6f47] tracking-wide drop-shadow-lg text-center mb-8 sm:mb-10"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              OASIS
            </motion.h1>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <svg
                viewBox="0 0 120 40"
                className="w-60 sm:w-72 h-24 sm:h-28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {[0, 10, 20].map((offset, i) => (
                  <motion.path
                    key={i}
                    d={`M0 ${14 + i * 6} Q30 ${0 + i * 6} 60 ${14 + i * 6} T120 ${14 + i * 6}`}
                    stroke="#8b6f47"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                      duration: 1.4 + i * 0.2, // Faster waves
                      repeat: Infinity,
                      repeatType: 'loop',
                      ease: 'easeInOut'
                    }}
                  />
                ))}
              </svg>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </RouteLoaderContext.Provider>
  );
}