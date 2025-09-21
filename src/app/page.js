'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion'; // Import necessary hooks from framer-motion
import { useRef } from 'react'; // Import useRef from React
import Link from 'next/link';
import LinkWithLoader from './components/LinkWithLoader';
import { useEffect, useState } from 'react'; 


export default function Home() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);



  const [experiences, setExperiences] = useState([]);

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const res = await fetch('/api/experiences');
        const data = await res.json();
        setExperiences(data);
      } catch (error) {
        console.error('Failed to load experiences', error);
      }
    };

    fetchExperiences();
  }, []);

  return (
    <main className="font-light text-[#2f2f2f] bg-[#f4f1ec]">
      {/*HERO */}
      <section ref={heroRef} className="relative min-h-screen w-full flex items-center justify-center text-center overflow-hidden">
        <motion.div style={{ y }} className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src="/background.jpeg"
            alt="Crete landscape"
            fill
            priority
            className="object-cover object-center brightness-[.5]"
          />
        </motion.div>
        <div className="relative z-10 px-6 max-w-3xl space-y-8">
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-serif text-white leading-tight tracking-tight drop-shadow-xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            Agrotourism & Wellness<br />
            <span className="text-[#e8d2b2] font-normal">Rooted in Crete</span>
          </motion.h1>
          <motion.p
            className="text-white text-lg md:text-xl max-w-xl mx-auto drop-shadow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            Curated rituals and nature-immersive journeys for your inner peace.
          </motion.p>
          
          <LinkWithLoader href="/experiences">
            <motion.button
              className="mt-6 bg-[#8b6f47] text-white px-8 py-4 rounded-full text-lg font-medium shadow-md hover:bg-[#a78b62] transition-all"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              Discover Experiences
            </motion.button>
          </LinkWithLoader>
        </div>
      </section>

    {/* Essence Section */}
    <section className="py-24 px-6 bg-gradient-to-b from-[#faf9f7] to-[#f4f1ec]">
      <motion.div
        className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
      >
        {/* Text Section */}
        <div className="space-y-8 text-center md:text-left">
          <h2 className="text-4xl md:text-5xl font-serif text-[#5a4a3f] leading-tight">
            The Essence of Slow Living
          </h2>
          <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed">
            In the heart of Crete, time flows differently.  
            Wander through olive groves, gather mountain herbs, and rediscover the art of simply being.  
            Our experiences are invitations to reconnect — with the land, with tradition, and with yourself.
          </p>
          <div className="flex justify-center md:justify-start">
            <Link href="/experiences">
              <button className="mt-4 inline-flex items-center gap-2 bg-[#8b6f47] text-white px-6 py-3 rounded-full text-lg font-medium hover:bg-[#7a5f3a] transition shadow-md">
                Explore Experiences
              </button>
            </Link>
          </div>
        </div>

        {/* Image Section */}
        <motion.div
          className="rounded-3xl overflow-hidden shadow-2xl"
          initial={{ scale: 0.95 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <Image
            src="/gorge.jpg"
            alt="Slow Living Crete"
            width={900}
            height={600}
            className="w-full h-auto object-cover"
          />
        </motion.div>
      </motion.div>
    </section>

      {/* Sustainability Section */}
        <section className="bg-[#faf9f7] py-24 px-6">
          <motion.div
            className="max-w-6xl mx-auto text-center space-y-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <h3 className="text-4xl md:text-5xl font-serif text-[#5a4a3f]">
              Rooted in Sustainability
            </h3>
            <p className="text-lg md:text-xl text-[#4a4a4a] max-w-3xl mx-auto leading-relaxed">
              Every journey we offer respects the land, supports local communities and celebrates traditional ways of living.  
              Sustainability isn’t an add-on — it’s woven into every experience we create.
            </p>
          </motion.div>

          {/* Cards */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto">
            {[
              {
                title: 'Local Partnerships',
                text: 'We collaborate with local farmers, artisans and healers to keep traditions alive and communities thriving.',
                icon: '🌾',
              },
              {
                title: 'Eco-conscious Experiences',
                text: 'Our activities are low-impact, from herb walks to organic farm stays, rooted in harmony with nature.',
                icon: '🌱',
              },
              {
                title: 'Respect for Heritage',
                text: 'We honor Crete’s cultural and natural heritage, creating experiences that nurture both guests and the land.',
                icon: '🏺',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.8 }}
                className="bg-white rounded-3xl shadow-md hover:shadow-2xl p-10 flex flex-col items-center text-center space-y-6 transition-all duration-300 group"
              >
                {/* Icon Container */}
                <div className="w-16 h-16 flex items-center justify-center rounded-full bg-[#e5e0d8] text-4xl group-hover:bg-[#8b6f47] group-hover:text-white transition-colors">
                  {item.icon}
                </div>
                {/* Title */}
                <h4 className="text-2xl font-serif text-[#5a4a3f]">{item.title}</h4>
                {/* Description */}
                <p className="text-base text-[#4a4a4a] leading-relaxed">
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

      {/*Motto */}
      <section className="py-24 px-6 text-center">
        <motion.div
          className="max-w-3xl mx-auto space-y-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h4 className="text-2xl md:text-3xl italic font-serif text-[#5a4a3f]">
            “We don’t offer tours. We offer rooted experiences that breathe.”
          </h4>
          <p className="text-md md:text-lg text-[#4a4a4a]">
            Guests leave not only relaxed — but transformed.
          </p>
        </motion.div>
      </section>

      {/*Call to Action */}
      <section className="bg-[#8b6f47] text-white text-center py-20 px-6">
        <motion.div
          className="max-w-3xl mx-auto space-y-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h5 className="text-3xl md:text-4xl font-serif leading-snug">
            Ready to reconnect with yourself and the land?
          </h5>
          <LinkWithLoader href="/experiences">
          <button className="mt-12 bg-white text-[#5a4a3f] px-8 py-4 rounded-full font-medium hover:bg-[#f4f1ec] transition-all">
            Book a Journey
          </button>
          </LinkWithLoader>
        </motion.div>
      </section>

      {/*Testimonials */}
   <section className="py-24 px-6 bg-[#f9f9f9]">
      <div className="max-w-6xl mx-auto text-center">
        <motion.h3
          className="text-3xl md:text-4xl font-serif text-[#5a4a3f]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          What Our Guests Say
        </motion.h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 mt-12">
        {[
          {
            name: 'Sophia',
            feedback: 'An unforgettable experience that allowed me to truly connect with the land and the local community.',
            image: '/guest1.jpeg',
          },
          {
            name: 'Oliver',
            feedback: 'A peaceful retreat surrounded by nature. The wellness sessions were truly transformative.',
            image: '/guest2.jpeg',
          },
          {
            name: 'Emily',
            feedback: 'Everything felt so authentic and rooted in tradition. A truly enriching journey.',
            image: '/guest3.jpeg',
          },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2, duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-white p-6 rounded-xl shadow-lg text-center transform transition-all hover:scale-105 hover:shadow-2xl"
          >
            <Image
              src={item.image}
              alt={item.name}
              width={120}
              height={120}
              className="rounded-full mx-auto mb-4 border-4 border-[#eae6e0] shadow-lg"
            />
            <p className="text-[#4a4a4a] italic text-lg font-light">{`“${item.feedback}”`}</p>
            <h5 className="mt-4 text-[#5a4a3f] font-semibold text-lg">{item.name}</h5>
          </motion.div>
        ))}
      </div>
    </section>
    </main>
  );
}
