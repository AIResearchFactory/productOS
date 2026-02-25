import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import React from "react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    gradient?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ children, className, gradient = false, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={cn(
                    "glass rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl",
                    "bg-white/70 dark:bg-background/60",
                    "border border-white/30 dark:border-white/10",
                    gradient && "bg-gradient-to-br from-white/70 to-white/40 dark:from-background/80 dark:to-background/40",
                    className
                )}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

GlassCard.displayName = "GlassCard";
