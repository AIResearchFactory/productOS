import React from 'react';
import { ImagePlus } from 'lucide-react';

interface ChatDropOverlayProps {
  visible: boolean;
}

export const ChatDropOverlay: React.FC<ChatDropOverlayProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div
      data-testid="chat-drop-overlay"
      className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/85 p-6 text-center backdrop-blur-sm"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <ImagePlus className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Drop images to reference in chat
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Temporary context only — images are not imported into your project.
      </p>
    </div>
  );
};
