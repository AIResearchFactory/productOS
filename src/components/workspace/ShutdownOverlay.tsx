import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Loader2 } from 'lucide-react';

interface ShutdownOverlayProps {
  isShuttingDown: boolean;
}

export const ShutdownOverlay: React.FC<ShutdownOverlayProps> = ({ isShuttingDown }) => {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (isShuttingDown) {
      const timers = [
        setTimeout(() => setStep(1), 500),
        setTimeout(() => setStep(2), 1000),
        setTimeout(() => setStep(3), 1400)
      ];
      return () => timers.forEach(clearTimeout);
    } else {
      setStep(0);
    }
  }, [isShuttingDown]);

  const steps = [
    "Purging memory...",
    "Memory purged • Locking secrets...",
    "Memory purged • Secrets locked • Safe to close",
    "Memory purged • Secrets locked • Safe to close"
  ];

  return (
    <AnimatePresence>
      {isShuttingDown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-8 text-center px-6"
          >
            <div className="relative">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  borderColor: ['hsla(183,70%,48%,0.2)', 'hsla(183,70%,48%,0.6)', 'hsla(183,70%,48%,0.2)']
                }}
                transition={{ 
                  duration: 0.75,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-20 h-20 rounded-full border-2 border-primary/20 flex items-center justify-center"
              >
                <Power className="w-8 h-8 text-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              </motion.div>
              
              <motion.div 
                animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 1.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute -inset-4 border border-primary/20 rounded-full"
              />
            </div>

            <div className="flex flex-col items-center gap-4">
              <motion.h2 
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold tracking-tight text-white h-8"
              >
                {step === 0 && "Shutting Down"}
                {step === 1 && "Memory Purged"}
                {step === 2 && "Secrets Locked"}
                {step === 3 && "Safe to Close"}
              </motion.h2>

              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-primary/80">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm font-medium tracking-wide">SAFELY TERMINATING SERVER</p>
                </div>
                
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: 240 }}
                  transition={{ duration: 1.5, ease: "linear" }}
                  className="h-1 bg-white/10 rounded-full overflow-hidden w-[240px]"
                >
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, ease: "linear" }}
                    className="h-full bg-primary shadow-[0_0_10px_#3b82f6]"
                  />
                </motion.div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.p 
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-medium"
              >
                {steps[step]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
