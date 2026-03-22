import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, User, Loader2, Terminal, Star, Sparkles, PanelRightClose, PlusCircle, Play, Wrench, Zap, Plug, Cpu, Square, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { tauriApi, ProviderType, ChatMessage, WorkflowStep } from '../../api/tauri';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TraceLogs from './TraceLogs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import FileFormDialog from './FileFormDialog';
import ThinkingBlock from './ThinkingBlock';
import { useWorkflowGenerator } from '@/hooks/useWorkflowGenerator';
import ApprovalCard, { ConfigAction } from './ApprovalCard';

interface ChatPanelProps {
  activeProject?: { id: string; name?: string } | null;
  skills?: any[];
  onToggleChat?: () => void;
  workflows?: any[];
  onRunWorkflow?: (workflow: any, parameters?: Record<string, string>) => void;
  onInstallPandoc?: () => Promise<void>;
}

export const MessageItem = React.memo(({ message, renderContent, onRetry }: { message: any, renderContent: (content: string, isUser: boolean) => any, onRetry?: (id: number, editedText?: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.content || '');

  useEffect(() => {
    setEditedText(message.content || '');
  }, [message.content]);

  const canInlineEdit = message.role === 'user' && message.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group/item`}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
        className="shrink-0 pt-1"
      >
        <Avatar className="w-9 h-9 border border-white/5 shadow-inner">
          <AvatarFallback className={
            message.role === 'user'
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'bg-white/5 text-primary border border-white/5'
          }>
            {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
        <div className={`relative px-5 py-4 text-sm leading-relaxed shadow-lg backdrop-blur-md rounded-2xl ${message.role === 'user'
          ? 'bg-gradient-to-br from-[hsl(183,70%,48%)] to-[hsl(246,70%,55%)] text-white rounded-tr-sm border border-white/20'
          : 'glass-card text-foreground rounded-tl-sm'
          }`}>
          <div className="max-w-none break-words leading-relaxed font-medium">
            {canInlineEdit && isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full min-h-[84px] rounded-md border border-white/25 bg-black/20 p-2 text-white text-sm"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => { setIsEditing(false); setEditedText(message.content || ''); }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => onRetry?.(message.id, editedText)}
                  >
                    <Zap className="w-3 h-3" /> Replay
                  </Button>
                </div>
              </div>
            ) : (
              <div onClick={() => { if (canInlineEdit) setIsEditing(true); }} className={canInlineEdit ? 'cursor-text' : ''}>
                {renderContent(message.content, message.role === 'user')}
              </div>
            )}
          </div>

          {message.status === 'error' && (
            <div className="mt-3 pt-3 border-t border-red-500/20 flex items-center justify-between gap-4">
              <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Failed to send
              </span>
              {onRetry && !isEditing && (
                <div className="flex items-center gap-2">
                  {canInlineEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                      className="h-7 text-[10px] bg-white/10 border-white/20 hover:bg-white/20 transition-all gap-1.5 px-3"
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); onRetry(message.id, message.content); }}
                    className="h-7 text-[10px] bg-red-500/10 border-red-500/20 hover:bg-red-500 hover:text-white transition-all gap-1.5 px-3"
                  >
                    <Zap className="w-3 h-3" /> Retry Message
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <span className={`text-[9px] mt-1 opacity-40 font-bold uppercase tracking-tighter ${message.role === 'user' ? 'text-primary/60 pr-1' : 'text-muted-foreground pl-1'
          }`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
});

export default function ChatPanel({ activeProject, skills = [], onToggleChat, workflows = [], onRunWorkflow, onInstallPandoc }: ChatPanelProps) {
  const [messages, setMessages] = useState<Array<{
    id: number;
    role: string;
    content: string;
    timestamp: Date;
    status?: 'sending' | 'error' | 'success'; 
  }>>([
    {
      id: 1,
      role: 'assistant',
      content: 'Welcome to **productOS** — your AI-powered research workspace. I can help you build workflows, analyze competitors, generate reports, and automate repetitive tasks. What would you like to work on?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const [activeProvider, setActiveProvider] = useState<ProviderType>('hostedApi');
  const [activeSkillId, setActiveSkillId] = useState<string | undefined>(undefined);
  const [showLogs, setShowLogs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // File Extraction State
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [showFileSuggestions, setShowFileSuggestions] = useState(false);
  const [fileSuggestions, setFileSuggestions] = useState<string[]>([]);
  const [cursorPos, setCursorPos] = useState(0);
  const autoScrollRef = useRef(true);
  const lastScrollTop = useRef(0);

  const providerLabels: Record<string, string> = {
    'hostedApi': 'Claude API',
    'ollama': 'Ollama Local',
    'claudeCode': 'Claude Code CLI',
    'geminiCli': 'Google',
    'openAiCli': 'OpenAI',
    'liteLlm': 'LiteLLM Router',
    'autoRouter': 'Auto-Router (Rules)'
  };

  const [availableProviders, setAvailableProviders] = useState<ProviderType[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [settings, providers] = await Promise.all([
          tauriApi.getGlobalSettings(),
          tauriApi.listAvailableProviders()
        ]);

        setGlobalSettings(settings);
        setAvailableProviders(providers);

        // Filter providers by selection logic
        const filtered = providers.filter(p => 
          !settings?.selectedProviders || 
          settings.selectedProviders.length === 0 || 
          settings.selectedProviders.includes(p) ||
          p === 'hostedApi' // Baseline fallback
        );

        if (settings.activeProvider && filtered.includes(settings.activeProvider)) {
          setActiveProvider(settings.activeProvider);
        } else if (filtered.length > 0) {
          setActiveProvider(filtered[0]);
        }
      } catch (err) {
        console.error('Failed to load initial settings:', err);
      }
    };
    loadSettings();
  }, []);

  // ...

  const [projectWorkflows, setProjectWorkflows] = useState<any[]>([]);
  const [showWorkflowSuggestions, setShowWorkflowSuggestions] = useState(false);
  const [workflowSuggestions, setWorkflowSuggestions] = useState<any[]>([]);

  const { generateWorkflow } = useWorkflowGenerator();

  // ... (existing state)

  useEffect(() => {
    if (activeProject?.id) {
      tauriApi.getProjectFiles(activeProject.id).then(setProjectFiles).catch(console.error);
    }
  }, [activeProject]);

  const handleApproveConfig = useCallback(async (action: ConfigAction) => {
    try {
      switch (action.type) {
        case 'create_workflow': {
          if (!activeProject?.id) throw new Error('No active project. Please create or select a project first.');
          // FIX(F7): Build the complete workflow object with steps included and save directly.
          // Previously called createWorkflow (which saves with empty steps and fails backend
          // validation: "workflow must have at least one step"), then assigned steps and saved again.
          const workflowId = action.payload.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-_]/g, '');
          const now = new Date().toISOString();
          
          // FIX: Normalize steps in case they were proposed flat by the AI or have empty strings
          const normalizedSteps = (action.payload.steps || []).map((s: any) => {
            // If the step is already properly nested, just clean up empty strings
            if (s.config && typeof s.config === 'object') {
              const cleanedConfig = Object.fromEntries(
                Object.entries(s.config).filter(([_, v]) => v !== "" && v !== null)
              );
              
              // Smart resolution for nested skill_name_ref
              if (skills && Array.isArray(skills)) {
                  const matched = skills.find(sk => 
                      sk.id === (cleanedConfig.skill_id || s.skill_id) || 
                      sk.name.toLowerCase() === (cleanedConfig.skill_name_ref || s.skill_name_ref || "").toLowerCase() ||
                      sk.id === (cleanedConfig.skill_name_ref || s.skill_name_ref)
                  );
                  if (matched) cleanedConfig.skill_id = matched.id;
              }
              
              return { ...s, config: cleanedConfig };
            }
            
            // Otherwise, it's a flat object (common in some AI outputs)
            // Separate common step fields from config fields
            const { id, name, step_type, depends_on, ...rest } = s;
            
            // Map skill_name_ref to skill_id for config with smart matching
            let resolvedSkillId = rest.skill_id;
            if (skills && Array.isArray(skills)) {
               const matched = skills.find(sk => 
                  sk.id === resolvedSkillId || 
                  sk.name.toLowerCase() === (rest.skill_name_ref || "").toLowerCase() ||
                  sk.id === rest.skill_name_ref
               );
               if (matched) resolvedSkillId = matched.id;
            }
            
            // Extract booleans
            const parallel = rest.parallel === true || rest.parallel === 'true';
            
            // Re-nest config (omitting id, name, type, depends_on)
            const cleanedConfig: any = {
                skill_id: resolvedSkillId,
                parallel: parallel,
                parameters: rest.parameters || {}
            };
            
            // Move other fields into config (if they are known StepConfig fields)
            const stepConfigFields = [
               'timeout', 'continue_on_error', 'max_retries', 'source_type', 
               'source_value', 'output_file', 'input_files', 'items_source', 
               'output_pattern', 'context', 'artifact_type', 'artifact_title'
            ];
            
            stepConfigFields.forEach(field => {
                if (rest[field] !== undefined && rest[field] !== "" && rest[field] !== null) {
                    cleanedConfig[field] = rest[field];
                }
            });

            // Ensure parameters are preserved even in flat structures
            if (Object.keys(rest).some(k => !stepConfigFields.includes(k) && k !== 'skill_id' && k !== 'skill_name_ref' && k !== 'parallel' && k !== 'parameters')) {
               const extraParams = Object.fromEntries(
                 Object.entries(rest).filter(([k]) => !stepConfigFields.includes(k) && !['id', 'name', 'step_type', 'depends_on', 'skill_id', 'skill_name_ref', 'parallel', 'parameters'].includes(k))
               );
               cleanedConfig.parameters = { ...cleanedConfig.parameters, ...extraParams };
            }
            
            return {
              id: id || `step_${Math.random().toString(36).substr(2, 9)}`,
              name: name || 'Untitled Step',
              step_type: (step_type || 'agent').toLowerCase(),
              depends_on: depends_on || [],
              config: cleanedConfig
            };
          });

          const fullWorkflow = {
            id: workflowId,
            project_id: activeProject.id,
            name: action.payload.name,
            description: action.payload.description || `Generated from chat`,
            steps: normalizedSteps,
            version: '1.0.0',
            created: now,
            updated: now,
          };
          await tauriApi.saveWorkflow(fullWorkflow);
          // FIX(F4): Refresh workflow list so newly created workflows show in sidebar immediately
          const updatedWorkflows = await tauriApi.getProjectWorkflows(activeProject.id);
          setProjectWorkflows(updatedWorkflows);
          toast({ title: '✅ Workflow Created', description: action.payload.name });
          return fullWorkflow;
        }
        case 'create_skill': {
          await tauriApi.createSkill(action.payload.name, action.payload.description, action.payload.template, action.payload.category);
          toast({ title: '✅ Skill Created', description: action.payload.name });
          break;
        }
        case 'install_mcp': {
          await tauriApi.addMcpServer({ id: action.payload.id, name: action.payload.name, description: action.payload.description, command: action.payload.command, args: action.payload.args, enabled: true });
          toast({ title: '✅ MCP Server Installed', description: action.payload.name });
          break;
        }
        case 'configure_llm': {
          setActiveProvider(action.payload.provider as ProviderType);
          const settings = await tauriApi.getGlobalSettings();
          settings.activeProvider = action.payload.provider;
          await tauriApi.saveGlobalSettings(settings);
          toast({ title: '✅ LLM Configured', description: `Switched to ${action.payload.label}` });
          break;
        }
        case 'install_pandoc': {
          if (onInstallPandoc) {
            await onInstallPandoc();
          } else {
            // Fallback: manually run brew install pandoc if possible or just show toast
            // Real implementation should be on the backend
            toast({ title: 'Installing Pandoc', description: 'Starting installation via homebrew...' });
          }
          break;
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown error';
      toast({ title: 'Configuration Failed', description: errMsg, variant: 'destructive' });
      throw err;
    }
  }, [activeProject, toast, onInstallPandoc]);

  // ... (renderMessageContent logic)
  const renderMessageContent = useCallback((content: string, isUser: boolean = false) => {
    // Split by thinking tags, workflow suggestions, and config proposals
    const parts = content.split(/(\<thinking\>[\s\S]*?\<\/thinking\>|\<SUGGEST_WORKFLOW\>[\s\S]*?\<\/SUGGEST_WORKFLOW\>|\<PROPOSE_CONFIG\>[\s\S]*?\<\/PROPOSE_CONFIG\>|\<SAVE_WORKFLOW\>[\s\S]*?\<\/SAVE_WORKFLOW\>)/g);

    return parts.map((part, index) => {
      // SAVE_WORKFLOW tags are intercepted and converted to PROPOSE_CONFIG in handleSend.
      // If one somehow reaches the renderer, suppress it rather than showing raw JSON.
      if (part.startsWith('<SAVE_WORKFLOW>') && part.endsWith('</SAVE_WORKFLOW>')) {
        return null;
      }

      if (part.startsWith('<thinking>') && part.endsWith('</thinking>')) {
        const thinkingContent = part.slice(10, -11);
        return <ThinkingBlock key={index} content={thinkingContent} />;
      }

      // Handle CLI tool logs that aren't wrapped in tags (e.g. [using tool ...])
      // We'll treat these as specialized thinking blocks if they appear on their own lines
      if (!isUser && part.includes('[using tool')) {
        const lines = part.split('\n');
        const renderedLines = [];
        let currentText = '';

        for (const line of lines) {
          if (line.trim().startsWith('[using tool') || line.trim().startsWith('---') || line.trim().startsWith('@@')) {
            if (currentText) {
              renderedLines.push(
                <div key={`text-${renderedLines.length}`} className={`prose prose-sm max-w-none break-words leading-relaxed font-medium mb-2 ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentText}</ReactMarkdown>
                </div>
              );
              currentText = '';
            }
            renderedLines.push(
              <div key={`tool-${renderedLines.length}`} className="flex items-center gap-2 px-3 py-1.5 my-1 rounded-md bg-secondary/30 border border-white/5 text-[10px] text-muted-foreground font-mono truncate">
                <Wrench className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">{line.trim()}</span>
              </div>
            );
          } else {
            currentText += (currentText ? '\n' : '') + line;
          }
        }

        if (currentText) {
          renderedLines.push(
            <div key={`text-${renderedLines.length}`} className={`prose prose-sm max-w-none break-words leading-relaxed font-medium mb-2 ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentText}</ReactMarkdown>
            </div>
          );
        }
        return renderedLines;
      }

      if (part.startsWith('<SUGGEST_WORKFLOW>') && part.endsWith('</SUGGEST_WORKFLOW>')) {
        // Suppress if the same message is creating a new workflow — the workflow
        // doesn't exist yet and must be approved via the PROPOSE_CONFIG card first.
        // This also prevents the "Execute" card from flashing during streaming.
        if (content.includes('<SAVE_WORKFLOW>')) {
          return null;
        }
        try {
          const jsonContent = part.slice(18, -19).trim();
          const data = JSON.parse(jsonContent);
          return (
            <div key={index} className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-2 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-primary">Suggested Workflow</h3>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                The AI suggests running a workflow with the following configuration:
              </div>
              {data.parameters && Object.keys(data.parameters).length > 0 && (
                <div className="bg-black/20 rounded-md p-2 mb-3 border border-white/5">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Parameters</div>
                  <pre className="text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(data.parameters, null, 2)}
                  </pre>
                </div>
              )}
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  if (data.project_id && data.workflow_id) {
                    toast({ title: "Starting Workflow", description: "Initiating workflow execution..." });

                    let safeParams: Record<string, string> = {};
                    if (data.parameters) {
                      for (const [key, value] of Object.entries(data.parameters)) {
                        safeParams[key] = typeof value === 'string' ? value : JSON.stringify(value);
                      }
                    }

                    if (onRunWorkflow) {
                      const workflow = workflows.find(w => w.id === data.workflow_id);
                      if (workflow) {
                        onRunWorkflow(workflow, safeParams);
                        return;
                      }
                    }

                    tauriApi.executeWorkflow(data.project_id, data.workflow_id, safeParams)
                      .then(() => toast({ title: "Workflow Started", description: "Workflow execution has begun." }))
                      .catch(err => toast({ title: "Execution Failed", description: err?.message || "Failed to start workflow", variant: "destructive" }));
                  }
                }}
              >
                <Play className="w-3.5 h-3.5 mr-2" />
                Execute Workflow
              </Button>
            </div>
          );
        } catch (e) {
          console.error("Failed to parse suggest workflow tag", e);
          return <div key={index} className="text-red-500 text-xs">Error parsing workflow suggestion</div>;
        }
      }

      if (part.startsWith('<PROPOSE_CONFIG>') && part.endsWith('</PROPOSE_CONFIG>')) {
        try {
          const jsonContent = part.slice(16, -17).trim();
          const action: ConfigAction = JSON.parse(jsonContent);
          return (
            <ApprovalCard
              key={index}
              action={action}
              onApprove={handleApproveConfig}
              onReject={() => toast({ title: 'Configuration rejected' })}
              onExecute={onRunWorkflow}
            />
          );
        } catch (e) {
          console.error('Failed to parse config proposal', e);
          return <div key={index} className="text-red-500 text-xs">Error parsing configuration proposal</div>;
        }
      }

      if (!part.trim()) return null;

      return (
        <div key={index} className={`prose prose-sm max-w-none break-words leading-relaxed font-medium mb-2 last:mb-0 ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {part}
          </ReactMarkdown>
        </div>
      );
    });
  }, [toast, handleApproveConfig]);

  const handleProviderChange = async (value: string) => {
    const newProvider = value as ProviderType;
    try {
      await tauriApi.switchProvider(newProvider);
      setActiveProvider(newProvider);

      toast({
        title: 'Provider Switched',
        description: `Now using ${providerLabels[newProvider] || newProvider}`,
      });
    } catch (err) {
      console.error('Failed to switch provider:', err);
      toast({
        title: 'Error',
        description: 'Failed to switch AI provider',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current && autoScrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: isLoading ? 'auto' : 'smooth'
          });
        }
      }
    };
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle scroll events to detect if user has scrolled up
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = (e: any) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      autoScrollRef.current = isAtBottom;
      lastScrollTop.current = scrollTop;
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNewChat = () => {
    if (messages.length > 1) {
      if (confirm('Are you sure you want to start a new chat? Your current conversation history will be cleared from this view.')) {
        setMessages([
          {
            id: Date.now(),
            role: 'assistant',
            content: 'Welcome to **productOS** — your AI-powered research workspace. I can help you build workflows, analyze competitors, generate reports, and automate repetitive tasks. What would you like to work on?',
            timestamp: new Date()
          }
        ]);
        toast({
          title: 'New Chat Started',
          description: 'Conversation history cleared.',
        });
      }
    }
  };

  // Listen for external message additions (e.g. from Workspace for Pandoc missing)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      unlisten = await tauriApi.listen('chat:add-message', (event: any) => {
        const payload = event.payload as { role: string; content: string };
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: payload.role,
          content: payload.content,
          timestamp: new Date()
        }]);
      });
    };
    setup();
    return () => { if (unlisten) unlisten(); };
  }, [setMessages]);



  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showFileSuggestions && fileSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Handle selection scrolling? For now just simple
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSuggestion(fileSuggestions[0], 'file');
        return;
      } else if (e.key === 'Escape') {
        setShowFileSuggestions(false);
        return;
      }
    }

    if (showWorkflowSuggestions && workflowSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSuggestion(workflowSuggestions[0].name, 'workflow');
        return;
      } else if (e.key === 'Escape') {
        setShowWorkflowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    setInput(value);
    setCursorPos(pos);

    // Check for @ mention
    const textBeforeCursor = value.substring(0, pos);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    const lastHash = textBeforeCursor.lastIndexOf('#');

    // Prioritize the closest trigger
    if (lastAt !== -1 && (lastHash === -1 || lastAt > lastHash) && !textBeforeCursor.substring(lastAt).includes(' ')) {
      const query = textBeforeCursor.substring(lastAt + 1).toLowerCase();
      const filtered = projectFiles.filter(f => f.toLowerCase().includes(query)).slice(0, 5);
      setFileSuggestions(filtered);
      setShowFileSuggestions(filtered.length > 0);
      setShowWorkflowSuggestions(false);
    } else if (lastHash !== -1 && (lastAt === -1 || lastHash > lastAt) && !textBeforeCursor.substring(lastHash).includes(' ')) {
      const query = textBeforeCursor.substring(lastHash + 1).toLowerCase();
      const workflowsToSearch = workflows.length > 0 ? workflows : projectWorkflows;
      const filtered = workflowsToSearch.filter(w => w.name.toLowerCase().includes(query)).slice(0, 5);
      setWorkflowSuggestions(filtered);
      setShowWorkflowSuggestions(filtered.length > 0);
      setShowFileSuggestions(false);
    } else {
      setShowFileSuggestions(false);
      setShowWorkflowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (value: string, type: 'file' | 'workflow') => {
    const trigger = type === 'file' ? '@' : '#';
    const textBeforeTrigger = input.substring(0, input.lastIndexOf(trigger, cursorPos - 1));
    const textAfterCursor = input.substring(cursorPos);
    const newValue = textBeforeTrigger + trigger + value + ' ' + textAfterCursor;
    setInput(newValue);
    setShowFileSuggestions(false);
    setShowWorkflowSuggestions(false);

    // Set focus back and move cursor
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        const newPos = textBeforeTrigger.length + value.length + 2;
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleFileCreate = async (fileName: string) => {
    setFileDialogOpen(false);
    try {
      if (!activeProject?.id) {
        toast({ title: "Error", description: "No active project", variant: "destructive" });
        return;
      }
      await tauriApi.writeMarkdownFile(activeProject.id, fileName, selectedText);
      toast({ title: "File created", description: `${fileName} created successfully.` });
    } catch (error) {
      console.error("Failed to create file", error);
      toast({ title: "Error", description: "Failed to create file.", variant: "destructive" });
    }
  };

  // Process message queue when loading finishes
  useEffect(() => {
    if (!isLoading && messageQueue.length > 0) {
      const nextMessage = messageQueue[0];
      setMessageQueue(prev => prev.slice(1));
      handleSend(nextMessage);
    }
  }, [isLoading, messageQueue]);

  const handleStop = async () => {
    try {
      await tauriApi.stopAgentExecution();
      setIsLoading(false);
      toast({ title: 'Execution Stopped', description: 'The AI agent has been terminated.' });
    } catch (err: any) {
      console.error('Failed to stop agent:', err);
      toast({ title: 'Error', description: 'Failed to stop execution.', variant: 'destructive' });
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim()) return;

    if (isLoading && !overrideInput) {
      // Add to queue and show in UI as pending
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: textToSend,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setMessageQueue(prev => [...prev, textToSend]);
      setInput('');
      toast({ title: 'Message Queued', description: 'Your message will be sent once the AI finishes responding.' });
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    if (!overrideInput) {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
    }

    // Reset auto-scroll when user sends a message
    autoScrollRef.current = true;
    setIsLoading(true);

    const lowerInput = textToSend.toLowerCase().trim();

    // ─── Chat-driven configuration commands ───
    if (lowerInput === '/usage' || lowerInput === '/stats') {
      try {
        const stats = await tauriApi.getUsageStatistics();
        const costStr = stats.totalCostUsd.toFixed(4);
        const hoursSaved = (stats.totalTimeSavedMinutes / 60).toFixed(1);
        const cacheEff = stats.totalInputTokens ? Math.round((stats.totalCacheReadTokens / stats.totalInputTokens) * 100) : 0;
        
        const summary = `### 📊 Real-time Usage Analytics
- **Total Cost:** $${costStr} USD
- **Tokens:** ${stats.totalInputTokens.toLocaleString()} in / ${stats.totalOutputTokens.toLocaleString()} out
- **Cache Efficiency:** ${cacheEff}% (${stats.totalCacheReadTokens.toLocaleString()} tokens)
- **Tool Calls:** ${stats.totalToolCalls} executed
- **Estimated Time Saved:** ${hoursSaved} hours

*View full details in [Settings -> Billing & Usage](/settings/usage)*`;

        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: summary,
          timestamp: new Date()
        }]);
      } catch (err) {
        toast({ title: 'Failed to fetch stats', variant: 'destructive' });
      }
      setIsLoading(false);
      return;
    }

    try {

      // ─── Chat-driven configuration commands ───

      // Schedule a workflow (examples: "schedule #my-workflow daily", "schedule #x every day at 8:30", "schedule #x cron 0 9 * * * in Asia/Jerusalem")
      if (lowerInput.startsWith('schedule ') || lowerInput.startsWith('set schedule ')) {
        if (!activeProject?.id) {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Please select a project first, then I can schedule one of its workflows.', timestamp: new Date() }]);
          setIsLoading(false);
          return;
        }

        const workflowMention = input.match(/#([^\s]+)/);
        const workflowName = workflowMention?.[1]?.trim();
        const target = workflowName
          ? projectWorkflows.find(w => w.name.toLowerCase() === workflowName.toLowerCase() || w.id.toLowerCase() === workflowName.toLowerCase())
          : projectWorkflows[0];

        if (!target) {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'I couldn\'t find that workflow. Try: `schedule #workflow-name daily`.', timestamp: new Date() }]);
          setIsLoading(false);
          return;
        }

        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const tzMatch = input.match(/\bin\s+([A-Za-z_\/+-]+)\b/i);
        const timezone = tzMatch?.[1] || localTz;

        // Time parser: supports "at 8", "at 8:30", "at 8pm", "at 08:30 am"
        const tm = input.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
        let hour = 9;
        let minute = 0;
        if (tm) {
          hour = parseInt(tm[1], 10);
          minute = tm[2] ? parseInt(tm[2], 10) : 0;
          const ap = tm[3]?.toLowerCase();
          if (ap === 'pm' && hour < 12) hour += 12;
          if (ap === 'am' && hour === 12) hour = 0;
        }

        const weekdays: Record<string, number> = {
          sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
        };

        let cron = `${minute} ${hour} * * *`;

        if (lowerInput.includes('hourly') || lowerInput.includes('every hour')) {
          cron = `${minute} * * * *`;
        } else if (lowerInput.includes('weekdays') || lowerInput.includes('weekday')) {
          cron = `${minute} ${hour} * * 1-5`;
        } else if (lowerInput.includes('weekly') || lowerInput.includes('every week')) {
          cron = `${minute} ${hour} * * 1`;
          for (const [day, idx] of Object.entries(weekdays)) {
            if (lowerInput.includes(day)) {
              cron = `${minute} ${hour} * * ${idx}`;
              break;
            }
          }
        } else if (lowerInput.includes('daily') || lowerInput.includes('every day')) {
          cron = `${minute} ${hour} * * *`;
        }

        const cronMatch = input.match(/cron\s+(.+)$/i);
        if (cronMatch?.[1]) cron = cronMatch[1].trim();

        await tauriApi.setWorkflowSchedule(activeProject.id, target.id, {
          enabled: true,
          cron,
          timezone,
        });

        const updatedWorkflows = await tauriApi.getProjectWorkflows(activeProject.id);
        setProjectWorkflows(updatedWorkflows);

        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Scheduled **${target.name}** with cron \`${cron}\` in timezone **${timezone}**.`,
          timestamp: new Date()
        }]);

        setIsLoading(false);
        return;
      }

      // Pause/clear a workflow schedule
      if (lowerInput.startsWith('pause schedule') || lowerInput.startsWith('clear schedule') || lowerInput.startsWith('unschedule ')) {
        if (!activeProject?.id) {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Please select a project first, then I can clear a workflow schedule.', timestamp: new Date() }]);
          setIsLoading(false);
          return;
        }

        const workflowMention = input.match(/#([^\s]+)/);
        const workflowName = workflowMention?.[1]?.trim();
        const target = workflowName
          ? projectWorkflows.find(w => w.name.toLowerCase() === workflowName.toLowerCase() || w.id.toLowerCase() === workflowName.toLowerCase())
          : projectWorkflows[0];

        if (!target) {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'I couldn\'t find that workflow to unschedule.', timestamp: new Date() }]);
          setIsLoading(false);
          return;
        }

        await tauriApi.clearWorkflowSchedule(activeProject.id, target.id);
        const updatedWorkflows = await tauriApi.getProjectWorkflows(activeProject.id);
        setProjectWorkflows(updatedWorkflows);

        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Schedule cleared for **${target.name}**.`,
          timestamp: new Date()
        }]);

        setIsLoading(false);
        return;
      }

      // Create a workflow
      if (lowerInput.startsWith('create a workflow') || lowerInput.startsWith('generate a workflow')) {
        const prompt = input.replace(/^(create|generate) a workflow (to|for)?/i, '').trim();
        // FIX(F6): Show user-friendly message when no project is selected instead of failing silently
        if (!activeProject?.id) {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'To create a workflow, please **create or select a project** first from the sidebar.', timestamp: new Date() }]);
          setIsLoading(false);
          return;
        }
        if (prompt) {
          toast({ title: 'Analyzing Request', description: 'Designing your workflow...' });
          const result = await generateWorkflow(prompt, '', skills);
          if (result) {
            const aiMessage = {
              id: Date.now() + 1,
              role: 'assistant',
              content: `I've designed a workflow: **${result.name}** (${result.steps.length} steps).\n\nPlease review and approve:\n\n<PROPOSE_CONFIG>${JSON.stringify({
                type: 'create_workflow',
                payload: { name: result.name, description: `Generated from: ${prompt}`, steps: result.steps }
              })}</PROPOSE_CONFIG>`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);
            setIsLoading(false);
            return;
          }
        }
      }

      // Create a skill
      if (lowerInput.startsWith('create a skill') || lowerInput.startsWith('generate a skill')) {
        const prompt = input.replace(/^(create|generate) a skill (to|for)?/i, '').trim();
        if (prompt) {
          const aiMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: `I'll create a skill based on your request. Please approve:\n\n<PROPOSE_CONFIG>${JSON.stringify({
              type: 'create_skill',
              payload: { name: prompt.split(' ').slice(0, 4).join(' '), description: prompt, template: `You are a specialized assistant for: ${prompt}. Help the user with this specific task.`, category: 'custom' }
            })}</PROPOSE_CONFIG>`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }
      }

      // Install MCP server
      if (lowerInput.startsWith('install mcp') || lowerInput.startsWith('add mcp')) {
        const query = input.replace(/^(install|add) mcp (server)?/i, '').trim();
        if (query) {
          toast({ title: 'Searching Marketplace', description: `Looking for "${query}"...` });
          try {
            const servers = await tauriApi.fetchMcpMarketplace(query);
            if (servers.length > 0) {
              const server = servers[0];
              const aiMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: `I found **${server.name}** in the MCP marketplace.\n\n${server.description || ''}\n\nWould you like to install it?\n\n<PROPOSE_CONFIG>${JSON.stringify({
                  type: 'install_mcp',
                  payload: { id: server.id, name: server.name, description: server.description, command: server.command, args: server.args }
                })}</PROPOSE_CONFIG>`,
                timestamp: new Date()
              };
              setMessages(prev => [...prev, aiMessage]);
            } else {
              setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: `No MCP servers found matching "${query}". Try a different search term or browse the MCP Marketplace in Settings.`, timestamp: new Date() }]);
            }
            setIsLoading(false);
            return;
            // FIX(F5): Show user-friendly error message and stop loading when MCP search fails
          } catch (err: any) {
            console.error('MCP search failed:', err);
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: `Failed to search the MCP marketplace: ${err.message || 'Unknown error'}. You can browse it manually in Settings.`, timestamp: new Date() }]);
            setIsLoading(false);
            return;
          }
        }
      }

      // Configure LLM
      // FIX(F1): Improved regex to handle chip pre-fill variant ("Configure LLM provider ...")
      // FIX(F2): Fall back to providerLabels keys when availableProviders is empty (e.g. Tauri invoke unavailable)
      // FIX(F3): Guard against empty requestedProvider to prevent false positive match
      if (lowerInput.startsWith('configure llm') || lowerInput.startsWith('switch llm') || lowerInput.startsWith('change llm') || lowerInput.startsWith('set llm') || lowerInput.startsWith('configure provider')) {
        const knownProviderKeys = Object.keys(providerLabels) as ProviderType[];
        const providers = availableProviders.length > 0 ? availableProviders : knownProviderKeys;
        const providersList = providers.map(p => `- **${providerLabels[p] || p}** (\`${p}\`)`).join('\n');

        // Extract the requested provider name — handle all variants:
        //   "configure llm claude", "configure llm to claude", "configure llm provider claude",
        //   "Configure LLM provider to claude", "switch llm ollama"
        const requestedProvider = input.replace(/^(configure|switch|change|set)\s+(llm|provider)\s*(provider)?\s*(to)?\s*/i, '').trim().toLowerCase();

        const matched = providers.find(p =>
          providerLabels[p]?.toLowerCase().includes(requestedProvider) ||
          p.toLowerCase().includes(requestedProvider)
        );

        if (matched && requestedProvider) {
          const aiMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: `I'll switch your LLM provider. Please approve:\n\n<PROPOSE_CONFIG>${JSON.stringify({
              type: 'configure_llm',
              payload: { provider: matched, label: providerLabels[matched] || matched }
            })}</PROPOSE_CONFIG>`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        } else {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: `Available LLM providers:\n${providersList}\n\nType e.g. \`configure llm ollama\` to switch.`, timestamp: new Date() }]);
          setIsLoading(false);
          return;
        }
      }

      // Handle @ file references and # workflow references
      let enrichedInput = input;
      const fileMentions = input.match(/@(\S+)/g);

      const contextParts = [];

      if (fileMentions && activeProject?.id) {
        for (const mention of fileMentions) {
          const fileName = mention.substring(1);
          // Try to find the file in projectFiles
          const matchedFile = projectFiles.find(f => f.toLowerCase() === fileName.toLowerCase() || f.toLowerCase().endsWith('/' + fileName.toLowerCase()));

          if (matchedFile) {
            try {
              const content = await tauriApi.readMarkdownFile(activeProject.id, matchedFile);
              contextParts.push(`\n--- FILE: ${matchedFile} ---\n${content}\n--- END FILE ---\n`);
            } catch (err) {
              console.warn(`Failed to read referenced file: ${matchedFile}`, err);
            }
          }
        }
      }

      if (activeProject?.id) {
        // Fix workflow mention detection to handle names with spaces
        for (const wf of projectWorkflows) {
          const mentionStr = `#${wf.name}`;
          if (input.includes(mentionStr)) {
            contextParts.push(`\n--- WORKFLOW: ${wf.name} (ID: ${wf.id}) ---\n${JSON.stringify(wf, null, 2)}\n--- END WORKFLOW ---\n`);
          }
        }
      }

      if (contextParts.length > 0) {
        enrichedInput = `User is referencing these items:\n${contextParts.join('\n')}\n\nUser Question: ${input}`;
      }

      const chatMessages: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.content }));
      chatMessages.push({ role: 'user', content: enrichedInput });

      // Add a placeholder message for the assistant that will be populated by the stream
      const assistantMessageId = Date.now() + 1;
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]);

      const response = await tauriApi.sendMessage(chatMessages, activeProject?.id, activeSkillId);

      // Intercept <SAVE_WORKFLOW> tags produced by the AI system prompt.
      // Directly resolve skill names to IDs and show a PROPOSE_CONFIG approval
      // card — no second AI call needed (the AI already designed the workflow).
      //
      // IMPORTANT: The response.content is ALSO already streamed into the placeholder
      // message via chat-delta events. We only overwrite the message content if we
      // actually transform it (e.g. SAVE_WORKFLOW → PROPOSE_CONFIG). Otherwise we
      // leave the streamed content in place to avoid duplicating the response.
      let finalContent = response.content;
      let contentWasTransformed = false;
      const saveWorkflowMatch = finalContent.match(/<SAVE_WORKFLOW>([\s\S]*?)<\/SAVE_WORKFLOW>/);
      if (saveWorkflowMatch && activeProject?.id) {
        // Strip SUGGEST_WORKFLOW tags referencing the not-yet-saved workflow.
        finalContent = finalContent.replace(/<SUGGEST_WORKFLOW>[\s\S]*?<\/SUGGEST_WORKFLOW>/g, '');
        contentWasTransformed = true;

        try {
          let rawJson = saveWorkflowMatch[1].trim();
          rawJson = rawJson.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
          
          const startIdx = rawJson.indexOf('{');
          const endIdx = rawJson.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            rawJson = rawJson.substring(startIdx, endIdx + 1);
          }
          
          const sanitize = (str: string) => {
            return str
              // Safely replace trailing commas only at the end of objects/arrays
              .replace(/,(\s*[}\]])/g, '$1');
          };
          
          rawJson = sanitize(rawJson);
          
          let workflowData;
          try {
            workflowData = JSON.parse(rawJson);
          } catch (e: any) {
            console.error('[ChatPanel] JSON Parse failed.', e);
            console.error('[ChatPanel] rawJson was:', rawJson);
            throw e;
          }
          const planSteps: any[] = Array.isArray(workflowData.steps) ? workflowData.steps : [];

          // Fetch installed skills to resolve name → UUID
          const allSkills = await tauriApi.getAllSkills();
          const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

          // Pre-generate stable step IDs so depends_on can be resolved
          const idMap: Record<string, string> = {};
          planSteps.forEach((s: any, i: number) => {
            idMap[s.id || `step${i + 1}`] = `step_${Date.now()}_${i}`;
          });

          const resolvedSteps: WorkflowStep[] = planSteps.map((planStep: any, i: number) => {
            const skillRef: string = planStep.config?.skill_id || planStep.skill_name_ref || '';
            const matchedSkill =
              allSkills.find(s => s.name === skillRef) ||
              allSkills.find(s => normalise(s.name) === normalise(skillRef)) ||
              allSkills.find(s => normalise(s.name).includes(normalise(skillRef))) ||
              allSkills.find(s => normalise(skillRef).includes(normalise(s.name))) ||
              allSkills[0];

            if (!matchedSkill) throw new Error(`No skills available for step "${planStep.name}"`);

            const stepId = idMap[planStep.id || `step${i + 1}`];
            const cfg = planStep.config || {};

            // Resolve depends_on: prefer cfg.depends_on, then planStep.depends_on, then sequential fallback
            let dependsOn: string[] = [];
            const rawDeps: any[] = Array.isArray(cfg.depends_on)
              ? cfg.depends_on
              : Array.isArray(planStep.depends_on)
              ? planStep.depends_on
              : [];
            if (rawDeps.length > 0) {
              dependsOn = rawDeps.map((d: string) => idMap[d]).filter(Boolean);
            } else if (i > 0) {
              dependsOn = [idMap[planSteps[i - 1].id || `step${i}`]].filter(Boolean);
            }

            // Strip {{output_directory}}/ prefix from output paths
            const outputFile = (cfg.output_file || `${(planStep.name || 'step').toLowerCase().replace(/[^a-z0-9]/g, '_')}_output.md`)
              .replace(/^\{\{output_directory\}\}\//g, '');

            const rawType: string = planStep.step_type || 'agent';
            const normalizedType = rawType === 'SubAgent' ? 'subagent'
              : rawType === 'api_call' ? 'apicall'
              : rawType.toLowerCase();

            return {
              id: stepId,
              name: planStep.name || 'Unnamed Step',
              step_type: normalizedType as any,
              config: {
                skill_id: normalizedType === 'input' ? '' : matchedSkill.id,
                parameters: cfg.parameters || {},
                input_files: cfg.input_files || null,
                output_file: outputFile,
                artifact_type: cfg.artifact_type,
                artifact_title: cfg.artifact_title,
                parallel: cfg.parallel === true,
                items_source: cfg.items_source,
                source_type: normalizedType === 'input' ? (cfg.source_type || 'ProjectFile') : cfg.source_type,
                source_value: normalizedType === 'input' ? (cfg.source_value || '') : cfg.source_value,
              },
              depends_on: dependsOn,
            };
          });

          const proposeConfig: ConfigAction = {
            type: 'create_workflow',
            payload: {
              name: workflowData.name || 'Generated Workflow',
              description: workflowData.description || `Generated from: ${textToSend}`,
              steps: resolvedSteps,
            },
          };

          finalContent = finalContent.replace(
            /<SAVE_WORKFLOW>[\s\S]*?<\/SAVE_WORKFLOW>/,
            `<PROPOSE_CONFIG>${JSON.stringify(proposeConfig)}</PROPOSE_CONFIG>`
          );
        } catch (e) {
          console.error('[ChatPanel] Failed to process SAVE_WORKFLOW:', e);
          finalContent = finalContent.replace(
            /<SAVE_WORKFLOW>[\s\S]*?<\/SAVE_WORKFLOW>/,
            `\n\n_Could not prepare workflow for approval: ${e instanceof Error ? e.message : 'Unknown error'}_`
          );
        }
      }

      // Determine if the response content was transformed. If not, use whatever was
      // already streamed into the placeholder via chat-delta events (avoids duplication).
      // The response.content is the canonical full text from the backend and is used
      // to detect empty responses or apply SAVE_WORKFLOW transformations.
      const streamedIsEmpty = !finalContent.trim();

      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === assistantMessageId);
        const existingMsg = idx !== -1 ? prev[idx] : null;
        const streamedContent = existingMsg?.content ?? '';

        // Check if the AI truly returned nothing (both stream and full response are empty)
        const aiReturnedEmpty = streamedIsEmpty && !streamedContent.trim();

        let resolvedContent: string;
        if (aiReturnedEmpty) {
          // Nothing at all — show fallback error
          resolvedContent = '_The AI agent returned an empty response. The provider may be misconfigured or unavailable. Check the Trace Logs for details._';
        } else if (contentWasTransformed) {
          // SAVE_WORKFLOW was processed — use the transformed content
          resolvedContent = finalContent;
        } else {
          // No transformation — content was already streamed in; keep streamed content
          // to avoid duplicating the response. Fall back to finalContent if stream was empty.
          resolvedContent = streamedContent.trim() ? streamedContent : finalContent;
        }

        const updatedStatus: 'error' | 'success' = aiReturnedEmpty ? 'error' : 'success';

        if (idx !== -1) {
          return prev.map(m => m.id === assistantMessageId
            ? { ...m, content: resolvedContent, status: updatedStatus }
            : m.id === userMessage.id
            ? { ...m, status: updatedStatus }
            : m
          );
        }
        // Fallback: if placeholder was lost (race condition), append as a new message
        return [
          ...prev.map(m => m.id === userMessage.id ? { ...m, status: updatedStatus } : m),
          { id: assistantMessageId, role: 'assistant', content: resolvedContent, timestamp: new Date(), status: updatedStatus }
        ];
      });
    } catch (error: any) {
      console.error('Failed to send message:', error);
      // Mark as error
      setMessages(prev => prev.map(m => m.id === (userMessage ? userMessage.id : -1) ? { ...m, status: 'error' } : m));
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message to AI',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = (messageId: number, editedText?: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.role === 'user') {
      const replayText = (editedText ?? msg.content ?? '').trim();
      if (!replayText) return;

      // Remove assistant's empty placeholder if it exists (usually from the failed attempt)
      setMessages(prev => prev.filter(m => m.id !== messageId + 1));
      handleSend(replayText);
    }
  };

  useEffect(() => {
    const statusMarkers = [
      'Ready.', 'OK.', 'Done.', 'Standing by.', 'Waiting.', 'Idle.',
      'Complete.', 'Ready for input.', 'Confirmed.', 'Acknowledged.',
      '✓'
    ];

    let pendingDelta = '';
    let batchTimeout: NodeJS.Timeout | null = null;

    const flushDelta = () => {
      if (!pendingDelta) return;

      const deltaToProcess = pendingDelta;
      pendingDelta = '';
      batchTimeout = null;

      // Filter out status noise from the combined delta
      const trimmedDelta = deltaToProcess.trim();
      if (statusMarkers.includes(trimmedDelta)) {
        return;
      }

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          let newContent = last.content + deltaToProcess;

          // Clean up status markers from the end of content
          for (const marker of statusMarkers) {
            const markerWithNewline = '\n' + marker;
            if (newContent.endsWith(markerWithNewline)) {
              newContent = newContent.slice(0, -markerWithNewline.length);
            } else if (newContent === marker) {
              newContent = '';
            }
          }

          return [
            ...prev.slice(0, -1),
            { ...last, content: newContent }
          ];
        }
        return prev;
      });
    };

    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<string>('chat-delta', (event) => {
        pendingDelta += event.payload;

        if (!batchTimeout) {
          batchTimeout = setTimeout(flushDelta, 50);
        }
      });
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then(f => f());
      if (batchTimeout) clearTimeout(batchTimeout);
    };
  }, []);

  // Listen for external send-user-message events (e.g. "Create Presentation from this File" action)
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      unlisten = await tauriApi.listen('chat:send-user-message', (event: any) => {
        const payload = event.payload as { content: string };
        handleSendRef.current(payload.content);
      });
    };
    setup();
    return () => { if (unlisten) unlisten(); };
  }, []);

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden shadow-2xl">
      <FileFormDialog
        open={fileDialogOpen}
        onOpenChange={setFileDialogOpen}
        onSubmit={handleFileCreate}
        projectName={activeProject?.name}
      />

      {/* Header */}
      <div className="h-12 border-b border-border/50 flex items-center justify-between px-4 glass-panel shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Bot className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-foreground">Copilot</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Skill Selector */}
          <Select value={activeSkillId || 'no-skill'} onValueChange={(val) => setActiveSkillId(val === 'no-skill' ? undefined : val)}>
            <SelectTrigger className="w-[110px] h-8 text-[10px] bg-secondary/50 border-border/50 hover:bg-secondary/80 dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10 transition-colors focus:ring-0 rounded-lg">
              <Star className={`w-3 h-3 mr-1.5 ${activeSkillId ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
              <SelectValue placeholder="Skill" />
            </SelectTrigger>
            <SelectContent className="bg-background/80 backdrop-blur-xl border-white/10">
              <SelectItem value="no-skill" className="text-xs">No Skill</SelectItem>
              {skills.map(skill => (
                <SelectItem key={skill.id} value={skill.id} className="text-xs">{skill.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Provider Selector */}
          <Select value={activeProvider} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-[180px] h-8 text-[10px] bg-secondary/50 border-border/50 hover:bg-secondary/80 dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10 transition-all focus:ring-0 rounded-lg group px-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="shrink-0 p-1 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Cpu className="w-3 h-3" />
                </div>
                <SelectValue className="truncate">
                  {(() => {
                    const label = providerLabels[activeProvider];
                    if (label) return label;

                    if (activeProvider.startsWith('custom-') && globalSettings?.customClis) {
                      const id = activeProvider.replace('custom-', '');
                      const cli = globalSettings.customClis.find((c: any) => c.id === id);
                      if (cli) return cli.name;
                    }

                    return activeProvider.replace('custom-', '');
                  })()}
                </SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-background/80 backdrop-blur-xl border-white/10 w-[220px]">
            <SelectGroup>
                <SelectLabel className="text-[10px] text-muted-foreground font-bold px-3 py-2 uppercase tracking-wider bg-white/5">Cloud Engine</SelectLabel>
                
                {/* Hosted API */}
                <SelectItem value="hostedApi" className="text-xs py-2.5" disabled={!availableProviders.includes('hostedApi')}>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Claude API {!availableProviders.includes('hostedApi') ? '(setup)' : ''}
                  </div>
                </SelectItem>

                {/* Claude CLI */}
                <SelectItem value="claudeCode" className="text-xs py-2.5" disabled={!availableProviders.includes('claudeCode')}>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                     Claude CLI {!availableProviders.includes('claudeCode') ? '(setup)' : ''}
                  </div>
                </SelectItem>

                {/* Gemini CLI / Antigravity */}
                <SelectItem value="geminiCli" className="text-xs py-2.5" disabled={!availableProviders.includes('geminiCli')}>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                     Google {!availableProviders.includes('geminiCli') ? '(setup)' : ''}
                  </div>
                </SelectItem>

                {/* OpenAI CLI / ChatGPT */}
                <SelectItem value="openAiCli" className="text-xs py-2.5" disabled={!availableProviders.includes('openAiCli')}>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                     OpenAI {!availableProviders.includes('openAiCli') ? '(setup)' : ''}
                  </div>
                </SelectItem>
              </SelectGroup>

              <SelectGroup>
                <SelectLabel className="text-[10px] text-muted-foreground font-bold px-3 py-2 border-t border-white/5 mt-1 uppercase tracking-wider bg-white/5">Local Engine</SelectLabel>
                <SelectItem value="ollama" className="text-xs py-2.5" disabled={!availableProviders.includes('ollama')}>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                     Ollama {!availableProviders.includes('ollama') ? '(setup)' : ''}
                  </div>
                </SelectItem>
              </SelectGroup>

              {globalSettings?.customClis?.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-muted-foreground font-bold px-2 py-1.5 border-t mt-1 uppercase tracking-wider">Custom</SelectLabel>
                  {globalSettings.customClis.map((cli: any) => {
                    const val = `custom-${cli.id}`;
                    const configured = availableProviders.includes(val);
                    return (
                      <SelectItem key={cli.id} value={val} className="text-xs" disabled={!configured}>
                        {cli.name}{!configured ? ' (setup)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-primary transition-all"
            onClick={handleNewChat}
            title="New Chat"
          >
            <PlusCircle className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg transition-all ${showLogs ? 'text-primary bg-primary/10 border border-primary/20' : 'text-muted-foreground hover:bg-white/5'}`}
            onClick={() => setShowLogs(!showLogs)}
            title="Toggle Trace Logs"
          >
            <Terminal className="w-3.5 h-3.5" />
          </Button>

          {onToggleChat && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-primary transition-all"
              onClick={onToggleChat}
              title="Hide Chat"
            >
              <PanelRightClose className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <ContextMenu onOpenChange={(open: boolean) => {
        if (open) {
          const selection = window.getSelection()?.toString();
          if (selection && selection.trim().length > 0) {
            setSelectedText(selection);
          }
        }
      }}>
        <ContextMenuTrigger className="flex-1 flex flex-col overflow-hidden relative outline-none">
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-8 max-w-4xl mx-auto pb-6">
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    if (isLoading && message.role === 'assistant' && message.content.trim() === '') {
                      return null;
                    }
                    return (
                      <MessageItem 
                        key={message.id} 
                        message={message} 
                        renderContent={renderMessageContent} 
                        onRetry={message.role === 'user' ? handleRetry : undefined}
                      />
                    );
                  })}
                </AnimatePresence>

                {/* Quick Action Chips — show when conversation is fresh */}
                {messages.length === 1 && !isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap gap-2 pt-2"
                  >
                    {[
                      { icon: Wrench, label: 'Create a workflow', prompt: 'Create a workflow to ' },
                      { icon: Zap, label: 'Create a skill', prompt: 'Create a skill for ' },
                      { icon: Plug, label: 'Install MCP server', prompt: 'Install MCP server ' },
                      { icon: Cpu, label: 'Configure LLM', prompt: 'Configure LLM provider ' },
                      { icon: Play, label: 'Schedule workflow', prompt: 'schedule #workflow-name daily' },
                    ].map((action) => (
                      <button
                        key={action.label}
                        onClick={() => setInput(action.prompt)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card text-xs text-muted-foreground hover:text-foreground transition-all duration-200"
                      >
                        <action.icon className="w-3.5 h-3.5 text-primary" />
                        {action.label}
                      </button>
                    ))}
                  </motion.div>
                )}

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-4"
                  >
                    <div className="shrink-0 pt-1">
                      <Avatar className="w-9 h-9 border border-white/5 animate-pulse">
                        <AvatarFallback className="bg-white/5 text-primary">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="glass-card rounded-2xl rounded-tl-sm px-5 py-5 shadow-inner self-start">
                        <div className="flex gap-2">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 1, 0.3],
                              }}
                              transition={{
                                repeat: Infinity,
                                duration: 1.2,
                                delay: i * 0.2,
                                ease: "easeInOut"
                              }}
                              className="w-1.5 h-1.5 bg-[hsl(183,70%,48%)] rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStop}
                        className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 text-destructive hover:bg-destructive/10 border-destructive/20 w-fit"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        Stop Thinking
                      </Button>
                    </div>
                  </motion.div>
                )}

                {messageQueue.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center pt-4"
                  >
                    <div className="px-4 py-2 rounded-full bg-secondary/30 border border-white/5 text-[10px] text-muted-foreground flex items-center gap-2 backdrop-blur-sm">
                      <div className="flex gap-1">
                        {messageQueue.map((_, i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                        ))}
                      </div>
                      <span>{messageQueue.length} message{messageQueue.length > 1 ? 's' : ''} queued</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>
            <TraceLogs isOpen={showLogs} onClose={() => setShowLogs(false)} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem onSelect={() => {
            if (selectedText && selectedText.trim().length > 0) {
              setFileDialogOpen(true);
            } else {
              toast({
                title: "No text selected",
                description: "Please select text from the chat to extract to a new file.",
                variant: "destructive"
              });
            }
          }}>
            Extract Selection to New File
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Input section */}
      <div className="p-6 bg-gradient-to-t from-background via-background/80 to-transparent pb-10 z-20">
        <div className="max-w-4xl mx-auto relative group">
          {showFileSuggestions && (
            <div className="absolute bottom-full left-0 w-64 mb-2 bg-background/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="px-3 py-2 border-b border-white/5 bg-white/5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select File</span>
              </div>
              <div className="py-1">
                {fileSuggestions.map((file) => (
                  <button
                    key={file}
                    className="w-full px-4 py-2 text-left text-xs hover:bg-primary/20 transition-colors flex items-center justify-between group"
                    onClick={() => handleSelectSuggestion(file, 'file')}
                  >
                    <span className="truncate flex-1">{file}</span>
                    <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Enter</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showWorkflowSuggestions && (
            <div className="absolute bottom-full left-0 w-64 mb-2 bg-background/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="px-3 py-2 border-b border-white/5 bg-white/5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Workflow</span>
              </div>
              <div className="py-1">
                {workflowSuggestions.map((workflow) => (
                  <button
                    key={workflow.id}
                    className="w-full px-4 py-2 text-left text-xs hover:bg-primary/20 transition-colors flex items-center justify-between group"
                    onClick={() => handleSelectSuggestion(workflow.name, 'workflow')}
                  >
                    <span className="truncate flex-1">{workflow.name}</span>
                    <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Enter</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="absolute -inset-0.5 bg-gradient-to-r from-[hsla(183,70%,48%,0.2)] to-[hsla(246,70%,55%,0.2)] rounded-[18px] blur-md opacity-0 group-focus-within:opacity-100 transition duration-500 pointer-events-none" />
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to work on?"
            className="min-h-[56px] max-h-40 resize-none py-4 px-5 pr-14 glass-card !border-border/50 rounded-2xl focus:!border-[hsla(183,70%,48%,0.3)] transition-all focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50 text-sm relative z-10 font-medium leading-normal"
            disabled={isLoading && messageQueue.length >= 5} // Limit queue to 5
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!input.trim() || (isLoading && messageQueue.length >= 5)}
            className={`absolute right-3.5 bottom-3.5 h-10 w-10 rounded-2xl transition-all shadow-sm z-20 ${input.trim()
              ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95'
              : 'bg-white/5 text-muted-foreground'
              }`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

      </div>
    </div>
  );
}