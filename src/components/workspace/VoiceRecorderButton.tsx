import React, { useState } from 'react';
import { Mic, MicOff, Square, X, Loader2, Globe, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VOICE_LOCALE_OPTIONS, type VoiceInputStatus } from '@/hooks/useVoiceInput';

interface VoiceRecorderButtonProps {
  status: VoiceInputStatus;
  elapsedSeconds: number;
  interimTranscript: string;
  selectedLocale: string;
  effectiveLocale: string;
  onSelectLocale: (locale: string) => void;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

function formatRecordingTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function shortLocaleLabel(locale: string): string {
  const code = String(locale || 'en').split(/[-_]/)[0].toUpperCase();
  return code || 'EN';
}

export const VoiceRecorderBar: React.FC<{
  status: VoiceInputStatus;
  elapsedSeconds: number;
  interimTranscript: string;
  onStop: () => void;
  onCancel: () => void;
}> = ({ status, elapsedSeconds, interimTranscript, onStop, onCancel }) => {
  if (status !== 'recording' && status !== 'transcribing' && status !== 'requesting') {
    return null;
  }

  return (
    <div
      data-testid="chat-voice-recording-bar"
      role="status"
      aria-live="polite"
      className="mb-2 flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {status === 'transcribing' || status === 'requesting' ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
        ) : (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        )}
        <span className="shrink-0 font-mono text-[11px] font-semibold text-foreground">
          {status === 'requesting'
            ? 'Starting mic...'
            : status === 'transcribing'
              ? 'Transcribing audio...'
              : formatRecordingTimer(elapsedSeconds)}
        </span>
        {interimTranscript && status === 'recording' && (
          <span className="truncate italic text-muted-foreground">
            {interimTranscript}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-testid="chat-voice-cancel-btn"
          onClick={onCancel}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
          title="Cancel recording"
        >
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
        {status === 'recording' && (
          <Button
            type="button"
            size="sm"
            data-testid="chat-voice-stop-btn"
            onClick={onStop}
            className="h-6 bg-primary px-2.5 text-[11px] text-primary-foreground hover:bg-primary/90"
            title="Stop recording and insert text"
          >
            <Square className="mr-1 h-2.5 w-2.5 fill-current" />
            Done
          </Button>
        )}
      </div>
    </div>
  );
};

export const VoiceRecorderControls: React.FC<VoiceRecorderButtonProps> = ({
  status,
  selectedLocale,
  effectiveLocale,
  onSelectLocale,
  onStart,
  onCancel,
  onStop,
  disabled = false,
}) => {
  const [showUnsupportedTip, setShowUnsupportedTip] = useState(false);

  const isUnsupported = status === 'unsupported';
  const isRecording = status === 'recording' || status === 'requesting';
  const isTranscribing = status === 'transcribing';

  const handleMicClick = () => {
    if (isUnsupported) {
      setShowUnsupportedTip((prev) => !prev);
      return;
    }
    if (isRecording) {
      onStop();
      return;
    }
    if (isTranscribing) {
      onCancel();
      return;
    }
    setShowUnsupportedTip(false);
    onStart();
  };

  return (
    <div className="relative flex items-center gap-1">
      {showUnsupportedTip && isUnsupported && (
        <div
          role="alert"
          data-testid="chat-voice-unsupported-popover"
          className="absolute bottom-full right-0 z-50 mb-2 w-72 rounded-md border border-amber-500/30 bg-popover p-3 text-xs text-popover-foreground shadow-lg"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground">Voice Recording Unsupported</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                This browser does not support built-in speech recognition and no transcription fallback is configured. Switch to Chrome, or configure OpenAI or Google (AGY/Gemini) in Settings &rarr; AI &amp; Models.
              </p>
              <button
                type="button"
                onClick={() => setShowUnsupportedTip(false)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact dictation language switcher */}
      {!isUnsupported && !isRecording && !isTranscribing && (
        <div className="relative flex items-center" title={`Dictation language: ${effectiveLocale}`}>
          <Globe className="pointer-events-none absolute left-1.5 h-3 w-3 text-muted-foreground" />
          <select
            aria-label="Dictation language"
            data-testid="chat-voice-locale-select"
            value={selectedLocale}
            onChange={(e) => onSelectLocale(e.target.value)}
            disabled={disabled}
            className="h-7 cursor-pointer appearance-none rounded border border-border/70 bg-muted/40 pl-5 pr-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {VOICE_LOCALE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 'auto'
                  ? `${shortLocaleLabel(effectiveLocale)} (Auto)`
                  : `${shortLocaleLabel(opt.value)} — ${opt.label}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <Button
        type="button"
        size="icon"
        variant="ghost"
        data-testid="chat-voice-btn"
        data-voice-state={status}
        aria-pressed={isRecording}
        aria-disabled={disabled && !isUnsupported ? true : undefined}
        aria-label={
          isUnsupported
            ? 'Voice recording unsupported — configure OpenAI or AGY/Gemini or use Chrome'
            : isRecording
              ? 'Stop voice recording'
              : isTranscribing
                ? 'Transcribing audio'
                : 'Record voice message'
        }
        title={
          isUnsupported
            ? 'Voice recording unsupported in this browser. Use Chrome or configure AGY/Gemini or OpenAI in Settings -> AI & Models.'
            : isRecording
              ? 'Stop recording'
              : 'Dictate message'
        }
        onClick={handleMicClick}
        disabled={disabled && !isUnsupported}
        className={`h-7 w-7 rounded transition-all ${
          isRecording
            ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25'
            : isUnsupported
              ? 'text-muted-foreground/60 hover:bg-amber-500/10 hover:text-amber-500'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        {isTranscribing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isUnsupported ? (
          <MicOff className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
};
