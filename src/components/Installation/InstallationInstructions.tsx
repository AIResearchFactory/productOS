import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { OpenAiAuthStatus } from '@/api/tauri';

interface InstallationInstructionsProps {
  claudeCodeInstructions?: string;
  ollamaInstructions?: string;
  geminiInstructions?: string;
  claudeCodeMissing: boolean;
  ollamaMissing: boolean;
  geminiMissing: boolean;
  openAiAuthStatus?: OpenAiAuthStatus | null;
  selectedProviders: string[];
  onRedetect: () => void;
  onAuthenticate?: (provider: string) => void;
  isRedetecting: boolean;
}

export default function InstallationInstructions({
  claudeCodeInstructions,
  ollamaInstructions,
  geminiInstructions,
  claudeCodeMissing,
  ollamaMissing,
  geminiMissing,
  openAiAuthStatus,
  selectedProviders,
  onRedetect,
  onAuthenticate,
  isRedetecting
}: InstallationInstructionsProps) {
  const [copiedClaudeCode, setCopiedClaudeCode] = useState(false);
  const [copiedOllama, setCopiedOllama] = useState(false);
  const [copiedGemini, setCopiedGemini] = useState(false);

  const copyToClipboard = async (text: string, type: 'claude' | 'ollama' | 'gemini') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'claude') {
        setCopiedClaudeCode(true);
        setTimeout(() => setCopiedClaudeCode(false), 2000);
      } else if (type === 'ollama') {
        setCopiedOllama(true);
        setTimeout(() => setCopiedOllama(false), 2000);
      } else {
        setCopiedGemini(true);
        setTimeout(() => setCopiedGemini(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const extractInstallCommand = (instructions: string): string | null => {
    const curlMatch = instructions.match(/curl -fsSL [^\s]+/);
    const brewMatch = instructions.match(/brew install [^\s\n]+/);
    return curlMatch?.[0] || brewMatch?.[0] || null;
  };

  const renderInstructionCard = (
    name: string,
    instructions: string | undefined,
    isMissing: boolean,
    copiedState: boolean,
    copyType: 'claude' | 'ollama' | 'gemini'
  ) => {
    if (!isMissing || !instructions) return null;

    const installCommand = extractInstallCommand(instructions);

    return (
      <Card className="border-2 border-orange-200 dark:border-orange-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {name} Installation Required
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Follow these steps to install {name}
              </p>
            </div>
          </div>

          {/* Quick Install Command */}
          {installCommand && (
            <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-400">Quick Install</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(installCommand, copyType)}
                  className="h-6 text-gray-400 hover:text-white"
                >
                  {copiedState ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <code className="text-sm text-green-400 font-mono block break-all">
                {installCommand}
              </code>
            </div>
          )}

          {/* Full Instructions */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
              {instructions}
            </pre>
          </div>

          {/* External Links */}
          <div className="flex items-center gap-2 text-sm">
            <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <a
              href={copyType === 'claude' ? 'https://claude.ai/download' : (copyType === 'ollama' ? 'https://ollama.ai/download' : 'https://ai.google.dev/gemini-api/docs/quickstart')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Visit official download page
            </a>
          </div>
        </CardContent>
      </Card>
    );
  };

  const allInstalled = 
    (!selectedProviders.includes('claudeCode') || !claudeCodeMissing) && 
    (!selectedProviders.includes('ollama') || !ollamaMissing) && 
    (!selectedProviders.includes('geminiCli') || !geminiMissing) && 
    (!selectedProviders.includes('openAiCli') || openAiAuthStatus?.connected);

  if (allInstalled) {
    return (
      <Card className="border-2 border-green-200 dark:border-green-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                All Dependencies Installed
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                All required dependencies are detected and ready to use.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {selectedProviders.includes('claudeCode') && renderInstructionCard(
        'Claude Code',
        claudeCodeInstructions,
        claudeCodeMissing,
        copiedClaudeCode,
        'claude'
      )}
      {selectedProviders.includes('ollama') && renderInstructionCard(
        'Ollama',
        ollamaInstructions,
        ollamaMissing,
        copiedOllama,
        'ollama'
      )}
      {selectedProviders.includes('geminiCli') && renderInstructionCard(
        'Gemini CLI',
        geminiInstructions,
        geminiMissing,
        copiedGemini,
        'gemini'
      )}
      
      {/* OpenAI Authentication Card if not connected and selected */}
      {selectedProviders.includes('openAiCli') && !openAiAuthStatus?.connected && (
        <Card className="border-2 border-orange-200 dark:border-orange-800">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  OpenAI Authentication Required
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Connect your OpenAI account to use ChatGPT and Codex models.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                OpenAI authentication uses a secure device-flow login. Clicking the button below will open your browser to authorize productOS.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => onAuthenticate?.('OpenAI (ChatGPT Login)')} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Authenticate OpenAI
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Re-detect Button */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Installed the dependencies?
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click the button below to check if the dependencies are now available on your system.
              </p>
            </div>
            <Button
              onClick={onRedetect}
              disabled={isRedetecting}
              className="flex-shrink-0"
            >
              {isRedetecting ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Checking...
                </>
              ) : (
                'Re-detect Dependencies'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Configuration */}
      {ollamaMissing && (
        <Card className="border-2 border-dashed border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Manual Configuration</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              If you have Ollama installed in a custom location, or if auto-detection fails, you can specify the path to the executable here.
            </p>
            <ManualOllamaConfig onConfigured={onRedetect} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { Input } from '@/components/ui/input';
import { tauriApi } from '@/api/tauri';

function ManualOllamaConfig({ onConfigured }: { onConfigured: () => void }) {
  const [path, setPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!path) return;
    setIsSaving(true);
    try {
      await tauriApi.updateOllamaConfig(true, path);
      onConfigured();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="/usr/local/bin/ollama"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        className="font-mono text-sm"
      />
      <Button onClick={handleSave} disabled={!path || isSaving}>
        {isSaving ? 'Saving...' : 'Set Path'}
      </Button>
    </div>
  );
}
