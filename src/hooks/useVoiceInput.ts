import { useState, useRef, useEffect, useCallback } from 'react';
import { appApi } from '@/api/app';
import type { GlobalSettings, VoiceCapabilities } from '@/api/contracts';

export type VoiceInputStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'transcribing'
  | 'unsupported'
  | 'error';

export type VoiceCaptureMode = 'web-speech' | 'backend-fallback' | 'unsupported';

export const VOICE_LOCALE_OPTIONS = [
  { value: 'auto', label: 'Browser Default' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'he-IL', label: 'Hebrew' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'pt-BR', label: 'Portuguese (BR)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
];

interface UseVoiceInputOptions {
  settings?: GlobalSettings | null;
  activeProjectId?: string;
  onTranscriptReady: (text: string, meta: { mode: VoiceCaptureMode; locale: string }) => void;
  onError?: (message: string) => void;
}

function getSpeechRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const commaIdx = reader.result.indexOf(',');
        resolve(commaIdx !== -1 ? reader.result.slice(commaIdx + 1) : reader.result);
      } else {
        reject(new Error('Failed to encode audio recording'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read audio recording'));
    reader.readAsDataURL(blob);
  });
}

function pickSupportedRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export function useVoiceInput({
  settings,
  activeProjectId,
  onTranscriptReady,
  onError,
}: UseVoiceInputOptions) {
  const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null);
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string>(() => {
    return settings?.voiceInput?.language || 'auto';
  });

  const browserLocale =
    (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const effectiveLocale =
    selectedLocale && selectedLocale !== 'auto' ? selectedLocale : browserLocale;

  const hasWebSpeech = Boolean(getSpeechRecognitionCtor());
  const hasMediaRecorder =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  const hasFallbackProvider = Boolean(capabilities?.resolvedFallback);
  const effectiveMode: VoiceCaptureMode = hasWebSpeech
    ? 'web-speech'
    : hasMediaRecorder && hasFallbackProvider
      ? 'backend-fallback'
      : 'unsupported';

  const onTranscriptRef = useRef(onTranscriptReady);
  onTranscriptRef.current = onTranscriptReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const finalSpeechRef = useRef('');
  const interimSpeechRef = useRef('');
  const stopIntentRef = useRef<'none' | 'commit' | 'cancel'>('none');
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCapabilities = useCallback(async () => {
    try {
      const caps = await appApi.getVoiceCapabilities();
      setCapabilities(caps);
    } catch {
      setCapabilities(null);
    }
  }, []);

  useEffect(() => {
    refreshCapabilities();
    const handler = () => {
      void refreshCapabilities();
    };
    window.addEventListener('productos:settings-changed', handler);
    return () => window.removeEventListener('productos:settings-changed', handler);
  }, [refreshCapabilities]);

  useEffect(() => {
    if (settings?.voiceInput?.language) {
      setSelectedLocale(settings.voiceInput.language);
    }
  }, [settings?.voiceInput?.language]);

  // Keep status synchronized with unsupported detection when idle
  useEffect(() => {
    if (effectiveMode === 'unsupported' && status === 'idle') {
      setStatus('unsupported');
    } else if (effectiveMode !== 'unsupported' && status === 'unsupported') {
      setStatus('idle');
    }
  }, [effectiveMode, status]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      }
      mediaStreamRef.current = null;
    }
  }, []);

  const cleanupAll = useCallback(() => {
    stopTimer();
    stopIntentRef.current = 'cancel';

    if (transcribeAbortRef.current) {
      transcribeAbortRef.current.abort();
      transcribeAbortRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    stopMediaTracks();
    setInterimTranscript('');
    setElapsedSeconds(0);
  }, [stopMediaTracks, stopTimer]);

  // Cancel active capture on project switch or unmount
  useEffect(() => {
    cleanupAll();
    setStatus(effectiveMode === 'unsupported' ? 'unsupported' : 'idle');
  }, [activeProjectId]);

  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, [cleanupAll]);

  const startTimer = useCallback(() => {
    stopTimer();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    if (effectiveMode === 'unsupported') {
      const msg =
        'Voice recording is unsupported in this browser without a transcription fallback. Use Chrome, or configure Google (AGY/Gemini) or OpenAI in Settings -> AI & Models.';
      setErrorMessage(msg);
      setStatus('unsupported');
      onErrorRef.current?.(msg);
      return;
    }

    if (status === 'recording' || status === 'requesting' || status === 'transcribing') {
      return;
    }

    setErrorMessage(null);
    setInterimTranscript('');
    finalSpeechRef.current = '';
    interimSpeechRef.current = '';
    stopIntentRef.current = 'none';

    if (effectiveMode === 'web-speech') {
      const SpeechCtor = getSpeechRecognitionCtor();
      if (!SpeechCtor) {
        setStatus('unsupported');
        return;
      }
      try {
        setStatus('requesting');
        const recognition = new SpeechCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = effectiveLocale;

        recognition.onstart = () => {
          setStatus('recording');
          startTimer();
        };

        recognition.onresult = (event: any) => {
          let finalized = finalSpeechRef.current;
          let interim = '';
          const results = event?.results || [];
          const startIdx = typeof event?.resultIndex === 'number' ? event.resultIndex : 0;

          for (let i = startIdx; i < results.length; i++) {
            const res = results[i];
            const transcript = res?.[0]?.transcript || '';
            if (res?.isFinal) {
              finalized = `${finalized} ${transcript}`.trim();
            } else {
              interim = `${interim} ${transcript}`.trim();
            }
          }

          finalSpeechRef.current = finalized;
          interimSpeechRef.current = interim;
          setInterimTranscript([finalized, interim].filter(Boolean).join(' ').trim());
        };

        recognition.onerror = (event: any) => {
          stopTimer();
          const code = String(event?.error || 'unknown');
          if (code === 'aborted' && stopIntentRef.current === 'cancel') {
            return;
          }
          const msg =
            code === 'not-allowed' || code === 'service-not-allowed'
              ? 'Microphone access was denied. Grant microphone permissions in your browser settings and try again.'
              : code === 'no-speech'
                ? 'No speech detected. Try speaking closer to the microphone.'
                : `Speech recognition failed (${code}).`;
          setErrorMessage(msg);
          setStatus('error');
          onErrorRef.current?.(msg);
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          stopTimer();
          const intent = stopIntentRef.current;
          const combined = [finalSpeechRef.current, interimSpeechRef.current]
            .filter(Boolean)
            .join(' ')
            .trim();
          recognitionRef.current = null;
          setInterimTranscript('');
          setElapsedSeconds(0);

          if (intent !== 'cancel' && combined) {
            onTranscriptRef.current(combined, {
              mode: 'web-speech',
              locale: effectiveLocale,
            });
          }
          setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        stopTimer();
        const msg = err?.message || 'Unable to start speech recognition';
        setErrorMessage(msg);
        setStatus('error');
        onErrorRef.current?.(msg);
      }
      return;
    }

    // Fallback MediaRecorder -> POST /api/chat/transcribe
    try {
      setStatus('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = pickSupportedRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onerror = () => {
        stopTimer();
        stopMediaTracks();
        const msg = 'Audio recording failed. Please check your microphone device.';
        setErrorMessage(msg);
        setStatus('error');
        onErrorRef.current?.(msg);
      };

      recorder.onstop = async () => {
        stopTimer();
        stopMediaTracks();
        const intent = stopIntentRef.current;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setElapsedSeconds(0);

        if (intent === 'cancel' || chunks.length === 0) {
          setStatus('idle');
          return;
        }

        const recordedMime = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: recordedMime });

        try {
          setStatus('transcribing');
          const audioBase64 = await blobToBase64(audioBlob);
          const controller = new AbortController();
          transcribeAbortRef.current = controller;

          const result = await appApi.transcribeAudio(
            {
              audioBase64,
              mimeType: recordedMime,
              language: effectiveLocale,
              preferredProvider: settings?.voiceInput?.fallbackProvider,
            },
            controller.signal
          );

          if (stopIntentRef.current === 'cancel') {
            setStatus('idle');
            return;
          }

          const transcript = (result?.text || '').trim();
          if (transcript) {
            onTranscriptRef.current(transcript, {
              mode: 'backend-fallback',
              locale: effectiveLocale,
            });
          } else {
            onErrorRef.current?.('No speech detected in the recording.');
          }
          setStatus('idle');
        } catch (err: any) {
          if (err?.name === 'AbortError' || stopIntentRef.current === 'cancel') {
            setStatus('idle');
            return;
          }
          const msg = err?.message || 'Transcription failed. Please try again.';
          setErrorMessage(msg);
          setStatus('error');
          onErrorRef.current?.(msg);
        } finally {
          transcribeAbortRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setStatus('recording');
      startTimer();
    } catch (err: any) {
      stopTimer();
      stopMediaTracks();
      const msg =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Microphone access was denied. Grant microphone permissions in your browser settings and try again.'
          : err?.message || 'Unable to access microphone.';
      setErrorMessage(msg);
      setStatus('error');
      onErrorRef.current?.(msg);
    }
  }, [effectiveLocale, effectiveMode, settings?.voiceInput?.fallbackProvider, startTimer, status, stopMediaTracks, stopTimer]);

  const stopRecording = useCallback(() => {
    stopIntentRef.current = 'commit';
    stopTimer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        recognitionRef.current = null;
        setStatus('idle');
      }
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        stopMediaTracks();
        setStatus('idle');
      }
    }
  }, [stopMediaTracks, stopTimer]);

  const cancelRecording = useCallback(() => {
    cleanupAll();
    setErrorMessage(null);
    setStatus(effectiveMode === 'unsupported' ? 'unsupported' : 'idle');
  }, [cleanupAll, effectiveMode]);

  return {
    status,
    effectiveMode,
    capabilities,
    elapsedSeconds,
    interimTranscript,
    errorMessage,
    selectedLocale,
    effectiveLocale,
    setSelectedLocale,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
