import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, User, Loader2, Terminal, Star, Sparkles, PanelRightClose, PlusCircle, Play, Wrench, Zap, Plug, Cpu, Square } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { tauriApi, ProviderType, ChatMessage } from '../../api/tauri';
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
}

export const MessageItem = React.memo(({ message, renderContent }: { message: any, renderContent: (content: string, isUser: boolean) => any }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
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
          {renderContent(message.content, message.role === 'user')}
        </div>
      </div>
      <span className={`text-[9px] mt-1 opacity-40 font-bold uppercase tracking-tighter ${message.role === 'user' ? 'text-primary/60 pr-1' : 'text-muted-foreground pl-1'
        }`}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  </motion.div>
));

export default function ChatPanel({ activeProject, skills = [], onToggleChat, workflows = [] }: ChatPanelProps) {
  const [messages, setMessages] = useState<Array<{
    id: number;
    role: string;
    content: string;
    timestamp: Date;
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
    'geminiCli': 'Gemini CLI',
    'openAiCli': 'OpenAI API',
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

        if (settings.activeProvider) {
          setActiveProvider(settings.activeProvider);
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
          const fullWorkflow = {
            id: workflowId,
            project_id: activeProject.id,
            name: action.payload.name,
            description: action.payload.description || `Generated from chat`,
            steps: action.payload.steps,
            version: '1.0.0',
            created: now,
            updated: now,
          };
          await tauriApi.saveWorkflow(fullWorkflow);
          // FIX(F4): Refresh workflow list so newly created workflows show in sidebar immediately
          const updatedWorkflows = await tauriApi.getProjectWorkflows(activeProject.id);
          setProjectWorkflows(updatedWorkflows);
          toast({ title: '✅ Workflow Created', description: action.payload.name });
          break;
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
      }
    } catch (err: any) {
      toast({ title: 'Configuration Failed', description: err.message || 'Unknown error', variant: 'destructive' });
      throw err;
    }
  }, [activeProject, toast]);

  // ... (renderMessageContent logic)
  const renderMessageContent = useCallback((content: string, isUser: boolean = false) => {
    // Split by thinking tags, workflow suggestions, and config proposals
    const parts = content.split(/(\<thinking\>[\s\S]*?\<\/thinking\>|\<SUGGEST_WORKFLOW\>[\s\S]*?\<\/SUGGEST_WORKFLOW\>|\<PROPOSE_CONFIG\>[\s\S]*?\<\/PROPOSE_CONFIG\>)/g);

    return parts.map((part, index) => {
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

                    tauriApi.executeWorkflow(data.project_id, data.workflow_id, safeParams)
                      .then(() => toast({ title: "Workflow Started", description: "Workflow execution has begun." }))
                      .catch(err => toast({ title: "Execution Failed", description: err.message || "Failed to start workflow", variant: "destructive" }));
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

    try {
      const lowerInput = textToSend.toLowerCase().trim();

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

      // Final update to ensure content is fully synchronized and has metadata if any
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId ? { ...m, content: response.content } : m
      ));
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message to AI',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
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
            <SelectTrigger className="w-[110px] h-8 text-[10px] bg-secondary/50 border-border/50 hover:bg-secondary/80 dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10 transition-colors focus:ring-0 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                <SelectValue>
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
            <SelectContent className="bg-background/80 backdrop-blur-xl border-white/10">
              <SelectGroup>
                <SelectLabel className="text-[10px] text-muted-foreground font-bold px-2 py-1.5 uppercase tracking-wider">Cloud Engine</SelectLabel>
                <SelectItem value="hostedApi" className="text-xs">Claude API</SelectItem>
                <SelectItem value="claudeCode" className="text-xs">Claude CLI</SelectItem>
                <SelectItem value="geminiCli" className="text-xs">Gemini CLI</SelectItem>
                <SelectItem value="openAiCli" className="text-xs">OpenAI API</SelectItem>
              </SelectGroup>

              {availableProviders.includes('ollama') && (
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-muted-foreground font-bold px-2 py-1.5 border-t mt-1 uppercase tracking-wider">Local Engine</SelectLabel>
                  <SelectItem value="ollama" className="text-xs">Ollama</SelectItem>
                </SelectGroup>
              )}

              {globalSettings?.customClis?.some((cli: any) => availableProviders.includes(`custom-${cli.id}`)) && (
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-muted-foreground font-bold px-2 py-1.5 border-t mt-1 uppercase tracking-wider">Custom</SelectLabel>
                  {globalSettings.customClis.map((cli: any) => {
                    const val = `custom-${cli.id}`;
                    if (availableProviders.includes(val)) {
                      return <SelectItem key={cli.id} value={val} className="text-xs">{cli.name}</SelectItem>;
                    }
                    return null;
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
                    return <MessageItem key={message.id} message={message} renderContent={renderMessageContent} />;
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