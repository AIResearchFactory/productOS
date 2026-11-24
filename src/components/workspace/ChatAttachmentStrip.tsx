import React from 'react';
import { AlertCircle, AlertTriangle, Loader2, X, Image as ImageIcon } from 'lucide-react';
import type { PendingImageAttachment } from '@/hooks/useChatAttachments';
import type { VisionCapabilityResult } from '@/lib/visionCapabilities';
import type { ChatAttachmentMeta, ChatImageAttachmentPayload } from '@/api/contracts';

interface ChatAttachmentStripProps {
  attachments: PendingImageAttachment[];
  visionCapability: VisionCapabilityResult;
  onRemove: (id: string) => void;
  isSending?: boolean;
}

export const ChatAttachmentStrip: React.FC<ChatAttachmentStripProps> = ({
  attachments,
  visionCapability,
  onRemove,
  isSending = false,
}) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const isUnsupported = visionCapability.status === 'unsupported';
  const isUnverified = visionCapability.status === 'unverified';

  return (
    <div className="mb-2 space-y-1.5" data-testid="chat-attachment-strip">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
        {attachments.map((att) => {
          const showPending = att.status === 'processing' || isSending;
          const borderClass = isUnsupported
            ? 'border-red-500 ring-1 ring-red-500/40'
            : isUnverified
              ? 'border-amber-500/80 ring-1 ring-amber-500/30'
              : 'border-border';

          return (
            <div
              key={att.id}
              data-testid="chat-attachment-item"
              data-status={att.status}
              data-vision-state={visionCapability.status}
              title={att.name}
              className={`group/thumb relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/40 ${borderClass}`}
            >
              {att.previewUrl || att.dataUrl ? (
                <img
                  src={att.previewUrl || att.dataUrl}
                  alt={att.name}
                  className={`h-full w-full object-cover transition-opacity ${showPending ? 'opacity-50' : 'opacity-100'}`}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}

              {showPending && (
                <div
                  data-testid="chat-attachment-pending"
                  aria-label="Processing image attachment"
                  className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}

              {isUnsupported && (
                <div
                  data-testid="chat-attachment-error"
                  title={visionCapability.reason}
                  aria-label={visionCapability.reason}
                  className="absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow"
                >
                  <AlertCircle className="h-3 w-3" />
                </div>
              )}

              {!isUnsupported && isUnverified && (
                <div
                  data-testid="chat-attachment-warning"
                  title={visionCapability.reason}
                  aria-label={visionCapability.reason}
                  className="absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow"
                >
                  <AlertTriangle className="h-3 w-3" />
                </div>
              )}

              <button
                type="button"
                data-testid="chat-attachment-remove"
                aria-label={`Remove ${att.name}`}
                onClick={() => onRemove(att.id)}
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/90 text-foreground opacity-90 shadow transition hover:bg-destructive hover:text-destructive-foreground focus:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>

      {isUnsupported && (
        <div
          role="alert"
          data-testid="chat-vision-error-banner"
          className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-500"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{visionCapability.reason}</span>
        </div>
      )}

      {!isUnsupported && isUnverified && (
        <div
          role="status"
          data-testid="chat-vision-warning-banner"
          className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-400"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{visionCapability.reason}</span>
        </div>
      )}
    </div>
  );
};

interface MessageAttachmentPreviewProps {
  attachments?: ChatImageAttachmentPayload[];
  attachmentMeta?: ChatAttachmentMeta[];
  isPending?: boolean;
}

export const MessageAttachmentPreview: React.FC<MessageAttachmentPreviewProps> = ({
  attachments,
  attachmentMeta,
  isPending = false,
}) => {
  const hasImages = Array.isArray(attachments) && attachments.length > 0;
  const metaList = hasImages
    ? attachments!.map((a) => ({ name: a.name, dataUrl: a.dataUrl }))
    : (attachmentMeta || []).map((m) => ({ name: m.name, dataUrl: undefined }));

  if (metaList.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {metaList.map((item, idx) =>
        item.dataUrl ? (
          <div
            key={`${item.name}-${idx}`}
            className="relative h-12 w-12 overflow-hidden rounded border border-border/70 bg-muted/40"
            title={item.name}
          >
            <img
              src={item.dataUrl}
              alt={item.name}
              className={`h-full w-full object-cover ${isPending ? 'opacity-60' : ''}`}
            />
            {isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              </div>
            )}
          </div>
        ) : (
          <span
            key={`${item.name}-${idx}`}
            className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <ImageIcon className="h-3 w-3" />
            <span className="max-w-[140px] truncate">{item.name}</span>
          </span>
        )
      )}
    </div>
  );
};
