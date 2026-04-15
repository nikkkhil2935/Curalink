import { motion } from 'framer-motion';

export default function MagicBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 top-[-120px] h-[320px] w-[320px] rounded-full bg-blue-500/25 blur-3xl"
        animate={{ x: [0, 30, -20, 0], y: [0, 20, -10, 0] }}
        transition={{ repeat: Infinity, duration: 16, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[-90px] top-[80px] h-[280px] w-[280px] rounded-full bg-cyan-400/20 blur-3xl"
        animate={{ x: [0, -25, 15, 0], y: [0, -18, 10, 0] }}
        transition={{ repeat: Infinity, duration: 18, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-160px] left-1/2 h-[360px] w-[420px] -translate-x-1/2 rounded-full bg-violet-400/12 blur-3xl"
        animate={{ scale: [1, 1.06, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
      />
    </div>
  );
}
