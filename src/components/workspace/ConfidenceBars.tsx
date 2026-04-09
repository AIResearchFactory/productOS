import { cn } from '@/lib/utils';

interface ConfidenceBarsProps {
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
  size?: 'sm' | 'md';
  readonly?: boolean;
}

export function ConfidenceBars({ 
  value, 
  onChange, 
  className, 
  size = 'md',
  readonly = false 
}: ConfidenceBarsProps) {
  const levels = [0.25, 0.5, 0.75, 1.0];
  const currentLevel = value !== undefined ? value : 0;

  const getLabel = (v?: number) => {
    if (v === undefined || v === 0) return 'Unrated';
    if (v >= 0.75) return 'High';
    if (v >= 0.5) return 'Medium';
    return 'Low';
  };

  const barWidth = size === 'sm' ? 'w-1.5' : 'w-2';
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1';

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className={cn("flex items-end", gap)}>
        {levels.map((level, idx) => {
          const isActive = currentLevel >= level;
          const height = (idx + 1) * (size === 'sm' ? 4 : 5); // 4-16px or 5-20px
          
          return (
            <div
              key={level}
              className={cn(
                "rounded-t-[1px] transition-all duration-200",
                barWidth,
                isActive ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]" : "bg-muted-foreground/20",
                !readonly && "cursor-pointer hover:bg-primary/60"
              )}
              style={{ height: `${height}px` }}
              onClick={() => !readonly && onChange?.(level === currentLevel ? 0 : level)}
              title={!readonly ? `Set confidence to ${Math.round(level * 100)}%` : undefined}
            />
          );
        })}
        {size !== 'sm' && (
          <span className="text-[10px] ml-2 text-muted-foreground uppercase font-medium tracking-tight">
            {getLabel(value)}
          </span>
        )}
      </div>
    </div>
  );
}
