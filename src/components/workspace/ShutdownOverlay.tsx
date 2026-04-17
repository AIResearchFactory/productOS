import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Loader2 } from 'lucide-react';

interface ShutdownOverlayProps {
  isShuttingDown: boolean;
}

export const ShutdownOverlay: React.FC<ShutdownOverlayProps> = ({ isShuttingDown }) => {
  return (
    <AnimatePresence>
      {isShuttingDown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              type: "spring",
              damping: 20,
              stiffness: 100
            }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 360],
                  borderColor: ['hsla(183,70%,48%,0.2)', 'hsla(183,70%,48%,0.6)', 'hsla(183,70%,48%,0.2)']
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-24 h-24 rounded-full border-2 border-primary/20 flex items-center justify-center"
              >
                <Power className="w-10 h-10 text-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              </motion.div>
              
              <motion.div 
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute -inset-4 border border-primary/10 rounded-full"
              />
            </div>

            <div className="flex flex-col items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Shutting Down</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <p className="text-sm font-medium">Safely terminating productOS server...</p>
              </div>
            </div>

            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="h-1 bg-primary/20 rounded-full overflow-hidden"
            >
              <motion.div 
                animate={{ x: [-200, 200] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="h-full w-full bg-primary shadow-[0_0_10px_#3b82f6]"
              />
            </motion.div>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-12 text-xs text-muted-foreground uppercase tracking-widest"
          >
            Memory purged • Secrets locked • Safe to close
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
