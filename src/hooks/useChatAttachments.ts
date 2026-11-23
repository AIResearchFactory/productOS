import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatImageAttachmentPayload } from '@/api/contracts';

export const MAX_CHAT_ATTACHMENTS = 4;
export const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 2048;

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export interface PendingImageAttachment {
  id: string;
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  sizeBytes: number;
  previewUrl: string;
  dataUrl?: string;
  width?: number;
  height?: number;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  source: 'button' | 'drop' | 'paste';
}

function resolveMimeType(file: File): string {
  const raw = String(file.type || '').trim().toLowerCase();
  if (raw === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_IMAGE_MIMES.has(raw)) return raw;

  const lowerName = String(file.name || '').toLowerCase();
  const extMatch = lowerName.match(/\.(png|jpe?g|webp|gif)$/);
  if (extMatch) {
    return EXT_TO_MIME[`.${extMatch[1]}`] || '';
  }
  return '';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image data'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImageDimensions(srcUrl: string): Promise<{ img: HTMLImageElement; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        img,
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      });
    };
    img.onerror = () => resolve(null);
    img.src = srcUrl;
  });
}

async function processImageFile(
  file: File,
  mimeType: string,
  previewUrl: string
): Promise<{ dataUrl: string; width?: number; height?: number; sizeBytes: number }> {
  const originalDataUrl = await readFileAsDataUrl(file);
  const loaded = await loadImageDimensions(originalDataUrl).catch(() => null);
  if (!loaded || !loaded.width || !loaded.height) {
    return { dataUrl: originalDataUrl, sizeBytes: file.size };
  }

  const { img, width, height } = loaded;
  const maxSide = Math.max(width, height);

  // Preserve animated GIFs and images already within dimension bounds
  if (maxSide <= MAX_IMAGE_DIMENSION || mimeType === 'image/gif') {
    return { dataUrl: originalDataUrl, width, height, sizeBytes: file.size };
  }

  const scale = MAX_IMAGE_DIMENSION / maxSide;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { dataUrl: originalDataUrl, width, height, sizeBytes: file.size };
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const quality = mimeType === 'image/jpeg' || mimeType === 'image/webp' ? 0.88 : undefined;
    const resizedDataUrl = canvas.toDataURL(mimeType, quality);
    if (!resizedDataUrl || !resizedDataUrl.startsWith('data:image/')) {
      return { dataUrl: originalDataUrl, width, height, sizeBytes: file.size };
    }
    const base64Part = resizedDataUrl.split(',')[1] || '';
    const estimatedBytes = Math.floor((base64Part.length * 3) / 4);
    return {
      dataUrl: resizedDataUrl,
      width: targetWidth,
      height: targetHeight,
      sizeBytes: estimatedBytes || file.size,
    };
  } catch {
    // Fallback if canvas tainted/unavailable
    void previewUrl;
    return { dataUrl: originalDataUrl, width, height, sizeBytes: file.size };
  }
}

interface UseChatAttachmentsOptions {
  onReject?: (title: string, description: string) => void;
}

export function useChatAttachments(options: UseChatAttachmentsOptions = {}) {
  const [attachments, setAttachments] = useState<PendingImageAttachment[]>([]);
  const attachmentsRef = useRef<PendingImageAttachment[]>([]);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const onRejectRef = useRef(options.onReject);
  onRejectRef.current = options.onReject;

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const revokeUrl = useCallback((url?: string) => {
    if (!url || !url.startsWith('blob:')) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup errors
    }
    objectUrlsRef.current.delete(url);
  }, []);

  const revokeAllUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore cleanup errors
      }
    }
    objectUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    const handleUnload = () => revokeAllUrls();
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      revokeAllUrls();
    };
  }, [revokeAllUrls]);

  const addFiles = useCallback(
    async (fileInput: FileList | File[], source: 'button' | 'drop' | 'paste' = 'button') => {
      const files = Array.from(fileInput || []);
      if (files.length === 0) return 0;

      const currentCount = attachmentsRef.current.length;
      const availableSlots = MAX_CHAT_ATTACHMENTS - currentCount;

      if (availableSlots <= 0) {
        onRejectRef.current?.(
          'Attachment Limit Reached',
          `You can attach up to ${MAX_CHAT_ATTACHMENTS} images per message.`
        );
        return 0;
      }

      const validEntries: Array<{
        id: string;
        file: File;
        mimeType: PendingImageAttachment['mimeType'];
        previewUrl: string;
      }> = [];
      let rejectedCount = 0;
      let overLimitIgnored = 0;

      for (const file of files) {
        const mimeType = resolveMimeType(file) as PendingImageAttachment['mimeType'];
        if (!mimeType || !ALLOWED_IMAGE_MIMES.has(mimeType)) {
          rejectedCount++;
          continue;
        }
        if (file.size === 0 || file.size > MAX_CHAT_IMAGE_BYTES) {
          rejectedCount++;
          continue;
        }
        if (validEntries.length >= availableSlots) {
          overLimitIgnored++;
          continue;
        }

        const id =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const previewUrl =
          typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(file)
            : '';
        if (previewUrl) {
          objectUrlsRef.current.add(previewUrl);
        }

        validEntries.push({ id, file, mimeType, previewUrl });
      }

      if (rejectedCount > 0) {
        onRejectRef.current?.(
          'Unsupported Image',
          'Only PNG, JPEG, WebP, and GIF images up to 10 MB are supported.'
        );
      } else if (overLimitIgnored > 0) {
        onRejectRef.current?.(
          'Attachment Limit Reached',
          `Maximum ${MAX_CHAT_ATTACHMENTS} images per message. Extra image(s) were skipped.`
        );
      }

      if (validEntries.length === 0) {
        return 0;
      }

      const initialPending: PendingImageAttachment[] = validEntries.map((entry) => ({
        id: entry.id,
        name: entry.file.name || `image-${Date.now()}.${entry.mimeType.split('/')[1] || 'png'}`,
        mimeType: entry.mimeType,
        sizeBytes: entry.file.size,
        previewUrl: entry.previewUrl,
        status: 'processing',
        source,
      }));

      setAttachments((prev) => [...prev, ...initialPending]);

      await Promise.all(
        validEntries.map(async (entry) => {
          try {
            const processed = await processImageFile(entry.file, entry.mimeType, entry.previewUrl);
            setAttachments((prev) =>
              prev.map((att) =>
                att.id === entry.id
                  ? {
                      ...att,
                      dataUrl: processed.dataUrl,
                      previewUrl: att.previewUrl || processed.dataUrl,
                      width: processed.width,
                      height: processed.height,
                      sizeBytes: processed.sizeBytes,
                      status: 'ready',
                    }
                  : att
              )
            );
          } catch (err: any) {
            setAttachments((prev) =>
              prev.map((att) =>
                att.id === entry.id
                  ? {
                      ...att,
                      status: 'error',
                      error: err?.message || 'Failed to process image',
                    }
                  : att
              )
            );
          }
        })
      );

      return validEntries.length;
    },
    []
  );

  const removeAttachment = useCallback(
    (id: string) => {
      setAttachments((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target?.previewUrl) {
          revokeUrl(target.previewUrl);
        }
        return prev.filter((item) => item.id !== id);
      });
    },
    [revokeUrl]
  );

  const clearAttachments = useCallback(() => {
    revokeAllUrls();
    setAttachments([]);
  }, [revokeAllUrls]);

  const toPayloads = useCallback((items: PendingImageAttachment[]): ChatImageAttachmentPayload[] => {
    return items
      .filter((item) => item.status === 'ready' && item.dataUrl)
      .map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        dataUrl: item.dataUrl!,
        sizeBytes: item.sizeBytes,
        width: item.width,
        height: item.height,
      }));
  }, []);

  const isProcessing = attachments.some((att) => att.status === 'processing');
  const hasErrors = attachments.some((att) => att.status === 'error');
  const readyAttachments = attachments.filter((att) => att.status === 'ready' && att.dataUrl);

  return {
    attachments,
    readyAttachments,
    isProcessing,
    hasErrors,
    addFiles,
    removeAttachment,
    clearAttachments,
    toPayloads,
  };
}
