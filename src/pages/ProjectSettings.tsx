import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { 
    FolderOpen, Sparkles, Trash2, PenTool, Settings, ChevronDown, RotateCcw, FileText,
    ClipboardList, Compass, Eye, Users, Lightbulb, LayoutTemplate, MonitorPlay, Rocket, Swords
} from 'lucide-react';
import { tauriApi, Skill, ArtifactType } from '../api/tauri';
import { DEFAULT_TEMPLATES } from '@/lib/artifact-templates';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProjectSettingsPageProps {
  activeProject: { id: string; name: string; description?: string } | null;
  onProjectCreated?: (project: any) => void;
  onProjectUpdated?: (project: any) => void;
}

type Section = 'general' | 'features' | 'skills' | 'personalization' | 'templates';

const ARTIFACT_TYPES_CONFIG = [
    { id: 'prd', label: 'PRD (Product Requirements)', icon: ClipboardList, color: 'text-blue-600 bg-blue-50/50' },
    { id: 'roadmap', label: 'Roadmap', icon: Compass, color: 'text-violet-600 bg-violet-50/50' },
    { id: 'product_vision', label: 'Product Vision', icon: Eye, color: 'text-indigo-600 bg-indigo-50/50' },
    { id: 'user_story', label: 'User Story', icon: Users, color: 'text-emerald-600 bg-emerald-50/50' },
    { id: 'insight', label: 'Product Insight', icon: Lightbulb, color: 'text-amber-600 bg-amber-50/50' },
    { id: 'one_pager', label: 'One Pager', icon: LayoutTemplate, color: 'text-cyan-600 bg-cyan-50/50' },
    { id: 'presentation', label: 'Presentation Outline', icon: MonitorPlay, color: 'text-rose-600 bg-rose-50/50' },
    { id: 'initiative', label: 'Initiative', icon: Rocket, color: 'text-orange-600 bg-orange-50/50' },
    { id: 'competitive_research', label: 'Competitive Research', icon: Swords, color: 'text-teal-600 bg-teal-50/50' },
    { id: 'pr_faq', label: 'PR-FAQ (Amazon Style)', icon: ClipboardList, color: 'text-orange-600 bg-orange-50/50' },
];

export default function ProjectSettingsPage({ activeProject, onProjectCreated, onProjectUpdated }: ProjectSettingsPageProps) {
  const [projectSettings, setProjectSettings] = useState({
    name: activeProject?.name || '',
    goal: activeProject?.description || '',
    autoSave: true,
    encryptData: true,
    skills: [] as string[],
    personalizationRules: '',
    brandSettings: ''
  });
  const [loading, setLoading] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>('roadmap');
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState<Section>('general');

  // Load project settings when activeProject changes
  useEffect(() => {
    const loadProjectSettings = async () => {
      if (!activeProject?.id) return;

      try {
        const [settings, allSkills] = await Promise.all([
          tauriApi.getProjectSettings(activeProject.id),
          tauriApi.getAllSkills()
        ]);

        setAvailableSkills(allSkills);
        setProjectSettings({
          name: settings.name || activeProject.name,
          goal: settings.goal || activeProject.description || '',
          autoSave: settings.auto_save ?? true,
          encryptData: settings.encryption_enabled ?? true,
          skills: settings.preferred_skills || [],
          personalizationRules: settings.personalization_rules || '',
          brandSettings: settings.brand_settings || ''
        });

        // Load project templates
        const types: ArtifactType[] = ['roadmap', 'product_vision', 'one_pager', 'prd', 'initiative', 'competitive_research', 'user_story', 'insight', 'presentation', 'pr_faq'];
        const loadedTemplates: Record<string, string> = {};
        for (const t of types) {
          try {
            const content = await tauriApi.readMarkdownFile(activeProject.id, `.templates/${t}.md`);
            loadedTemplates[t] = content;
          } catch (err) {
            // template might not exist — use global default as placeholder
          }
        }
        setTemplates(loadedTemplates);

      } catch (error) {
        console.error('Failed to load project settings:', error);
      }
    };

    loadProjectSettings();
  }, [activeProject]);

  const handleAddSkill = (skillName: string) => {
    if (!projectSettings.skills.includes(skillName)) {
      setProjectSettings(prev => ({
        ...prev,
        skills: [...prev.skills, skillName]
      }));
    }
  };

  const handleRemoveSkill = (skillName: string) => {
    setProjectSettings(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skillName)
    }));
  };

  const handleSaveProject = async () => {
    if (!activeProject) return;

    // Validation
    const trimmedName = projectSettings.name.trim();
    const trimmedGoal = projectSettings.goal.trim();

    if (!trimmedName) {
      toast({
        title: 'Validation Error',
        description: 'Product name is required',
        variant: 'destructive'
      });
      return;
    }

    if (!trimmedGoal) {
      toast({
        title: 'Validation Error',
        description: 'Product goal is required',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      if (activeProject.id === 'new-project' || activeProject.id.startsWith('draft-')) {
        console.log('Creating new project:', trimmedName);
        const newProj = await tauriApi.createProject(
          trimmedName,
          trimmedGoal,
          projectSettings.skills
        );
        console.log('Project created successfully:', newProj);
        toast({
          title: 'Success',
          description: `Product "${newProj.name}" created successfully`
        });
        
        // Call the creation callback
        onProjectCreated?.(newProj);

        // Update global settings last project ID
        const globalSettings = await tauriApi.getGlobalSettings();
        await tauriApi.saveGlobalSettings({
          ...globalSettings,
          lastProjectId: newProj.id
        });
      } else {
        console.log('Saving existing project:', activeProject.id);
        
        // If name changed, we should also rename the project in metadata
        if (trimmedName !== activeProject.name) {
          console.log('Project name changed, updating metadata...');
          await tauriApi.renameProject(activeProject.id, trimmedName);
        }

        // Save existing project settings
        await tauriApi.saveProjectSettings(activeProject.id, {
          name: trimmedName,
          goal: trimmedGoal,
          preferred_skills: projectSettings.skills,
          auto_save: projectSettings.autoSave,
          encryption_enabled: projectSettings.encryptData,
          personalization_rules: projectSettings.personalizationRules,
          brand_settings: projectSettings.brandSettings
        });

        // Save custom templates
        for (const [type, content] of Object.entries(templates)) {
          if (content !== undefined) {
            try {
              await tauriApi.writeMarkdownFile(activeProject.id, `.templates/${type}.md`, content);
            } catch (err) {
              console.error(`Failed to save template ${type}`, err);
            }
          }
        }

        toast({
          title: 'Success',
          description: 'Product settings saved successfully'
        });

        onProjectUpdated?.({
          ...activeProject,
          id: activeProject.id,
          name: trimmedName,
          description: trimmedGoal
        });
      }
    } catch (error: any) {
      console.error('Failed to save product settings:', error);
      const errMsg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
      toast({
        title: 'Error',
        description: `Failed to save product settings: ${errMsg}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No project selected
      </div>
    );
  }

  const sections: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'general', label: 'General', icon: FolderOpen },
    { id: 'features', label: 'Features', icon: Settings },
    { id: 'skills', label: 'Skills', icon: Sparkles },
    { id: 'personalization', label: 'Personalization', icon: PenTool },
    { id: 'templates', label: 'Templates', icon: FileText },
  ];

  return (
    <div data-testid="project-settings-page" className="h-full flex overflow-hidden">
      {/* Settings Navigation Sidebar — styled like GlobalSettings */}
      <aside className="w-64 border-r border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/10 flex flex-col shrink-0">
        <div className="p-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xs uppercase font-bold tracking-widest text-gray-500 dark:text-gray-400">Project Settings</h2>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1 truncate">{activeProject.name}</p>
        </div>
        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                  activeSection === section.id
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(var(--primary),0.1)]"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <section.icon className={cn("w-4 h-4 shrink-0", activeSection === section.id ? "text-primary" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300")} />
                {section.label}
              </button>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Settings Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-950">
        <ScrollArea className="flex-1">
          <div className="max-w-3xl p-8 pb-24 space-y-8">
            
            {activeSection === 'general' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">General</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Basic project information and metadata</p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="project-name" className="text-sm font-medium">Project Name</Label>
                    <Input
                      data-testid="project-name-input"
                      id="project-name"
                      value={projectSettings.name}
                      onChange={(e) => setProjectSettings({ ...projectSettings, name: e.target.value })}
                      className="max-w-md bg-gray-50/50 dark:bg-gray-900/50"
                    />
                    <p className="text-xs text-gray-400">Visible name of your project folder</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project-desc" className="text-sm font-medium">Description / Goal</Label>
                    <Textarea
                      data-testid="project-goal-input"
                      id="project-desc"
                      value={projectSettings.goal}
                      onChange={(e) => setProjectSettings({ ...projectSettings, goal: e.target.value })}
                      className="max-w-md bg-gray-50/50 dark:bg-gray-900/50 min-h-[100px] resize-y"
                      placeholder="Enter project goal or description"
                    />
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'features' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Features</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure project behavior and security</p>
                </div>

                <div className="space-y-3 max-w-md">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Auto-save Documents</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mr-8">
                        Automatically save changes as you type.
                      </p>
                    </div>
                    <Switch
                      checked={projectSettings.autoSave}
                      onCheckedChange={(checked) => setProjectSettings({ ...projectSettings, autoSave: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Encrypt Project Data</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mr-8">
                        Use AES-256 encryption for documents.
                      </p>
                    </div>
                    <Switch
                      checked={projectSettings.encryptData}
                      onCheckedChange={(checked) => setProjectSettings({ ...projectSettings, encryptData: checked })}
                    />
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'skills' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Project Skills</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage skills enabled for this project</p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {availableSkills.map((skill) => {
                      const isSelected = projectSettings.skills.includes(skill.name);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => !isSelected && handleAddSkill(skill.name)}
                          disabled={isSelected}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isSelected
                            ? 'bg-primary/10 text-primary border-primary/20 opacity-60 cursor-default'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-primary/30 hover:text-primary dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800 dark:hover:border-primary/50'
                            }`}
                        >
                          {isSelected && <span className="mr-1">✓</span>}
                          {skill.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border rounded-xl border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 min-h-[100px] p-4">
                    {projectSettings.skills.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                          <Sparkles className="w-5 h-5 text-gray-400" />
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">No skills selected</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Select skills from above to add them to this project</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {projectSettings.skills.map(skillName => {
                          const skillDetails = availableSkills.find(s => s.name === skillName);
                          return (
                            <div key={skillName} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-md bg-primary/10 text-primary">
                                  <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{skillName}</div>
                                  {skillDetails && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[300px]">{skillDetails.description}</div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() => handleRemoveSkill(skillName)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'personalization' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Personalization</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure AI writing rules and guidelines specific to this project.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="personalization-rules" className="text-sm font-medium">Writing Rules & Tone of Voice</Label>
                    <Textarea
                      id="personalization-rules"
                      value={projectSettings.personalizationRules}
                      onChange={(e) => setProjectSettings({ ...projectSettings, personalizationRules: e.target.value })}
                      className="max-w-prose bg-gray-50/50 dark:bg-gray-900/50 min-h-[200px] font-mono text-sm resize-y"
                      placeholder="e.g. Always use standard US English spelling. Keep sentences as short and simple as possible..."
                    />
                    <p className="text-xs text-gray-500 max-w-prose">These rules will be injected as context directly to the AI, ensuring its output precisely follows your project preferences.</p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <Label htmlFor="brand-settings" className="text-sm font-medium">Brand Design Rules</Label>
                    <p className="text-xs text-gray-500 max-w-prose">Define your brand's colors, typography, tone, and assets for presentation skills.</p>
                    <Textarea
                      id="brand-settings"
                      value={projectSettings.brandSettings}
                      onChange={(e) => setProjectSettings({ ...projectSettings, brandSettings: e.target.value })}
                      className="max-w-prose bg-gray-50/50 dark:bg-gray-900/50 min-h-[160px] font-mono text-sm resize-y"
                      placeholder={'{\n  "colors": { "primary": "#003366", "secondary": "#FF5733" },\n  "typography": { "heading_font": "Montserrat" },\n  "tone": { "voice": "Authoritative yet accessible" }\n}'}
                    />
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'templates' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Artifact Templates</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Override global artifact templates for this project. Leave empty to use the global defaults.
                  </p>
                </div>
                    <Select
                      value={selectedTemplateType}
                      onValueChange={(val: string) => {
                        setSelectedTemplateType(val);
                        setExpandedTemplate(val);
                      }}
                    >
                      <SelectTrigger className="w-[200px] bg-white dark:bg-gray-900">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="roadmap">Roadmap</SelectItem>
                        <SelectItem value="product_vision">Product Vision</SelectItem>
                        <SelectItem value="one_pager">One Pager</SelectItem>
                        <SelectItem value="prd">PRD (Product Requirements)</SelectItem>
                        <SelectItem value="initiative">Initiative</SelectItem>
                        <SelectItem value="competitive_research">Competitive Research</SelectItem>
                        <SelectItem value="user_story">User Story</SelectItem>
                        <SelectItem value="insight">Product Insight</SelectItem>
                        <SelectItem value="presentation">Presentation Outline</SelectItem>
                        <SelectItem value="pr_faq">PR-FAQ (Amazon Style)</SelectItem>
                      </SelectContent>
                    </Select>

                <div className="grid gap-2">
                  {ARTIFACT_TYPES_CONFIG.map((artifactType) => {
                    const isExpanded = expandedTemplate === artifactType.id;
                    const hasOverride = templates[artifactType.id] !== undefined && templates[artifactType.id] !== '';
                    const currentValue = templates[artifactType.id] ?? '';
                    const defaultTemplate = DEFAULT_TEMPLATES[artifactType.id] ?? '';

                    return (
                      <div
                        key={artifactType.id}
                        className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                          isExpanded
                            ? 'border-primary/30 dark:border-primary/20'
                            : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                        } bg-white dark:bg-gray-900`}
                      >
                        <button
                          onClick={() => setExpandedTemplate(isExpanded ? null : artifactType.id)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors text-left"
                        >
                          <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-current", artifactType.color)}>
                            <artifactType.icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="flex-1 font-medium text-sm text-gray-900 dark:text-gray-100">{artifactType.label}</span>
                          {hasOverride && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full font-bold uppercase border border-amber-100 dark:border-amber-800">
                              Project Override
                            </span>
                          )}
                          <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between px-4 py-2 bg-gray-50/70 dark:bg-gray-900/70 border-b border-gray-100 dark:border-gray-800">
                              <span className="text-xs font-medium text-gray-500 font-mono">Project Template Override</span>
                              {hasOverride && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1.5 text-gray-500 hover:text-red-600"
                                  onClick={() => setTemplates({ ...templates, [artifactType.id]: '' })}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Clear Override
                                </Button>
                              )}
                            </div>
                            <textarea
                              key={artifactType.id}
                              value={currentValue}
                              onChange={(e) => setTemplates({ ...templates, [artifactType.id]: e.target.value })}
                              className="w-full min-h-[280px] p-5 text-sm font-mono bg-gray-950/[0.02] dark:bg-black/20 border-none outline-none resize-y leading-relaxed text-gray-800 dark:text-gray-200"
                              placeholder={`Leave empty to use Global Default.\n\nGlobal Default:\n${defaultTemplate}`}
                              spellCheck={false}
                            />
                            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                              <p className="text-[11px] text-gray-400 italic">
                                Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-primary font-mono">{'{{title}}'}</code> as a placeholder. Clear the field to fall back to the global default template.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
              <Button data-testid="save-project-settings" onClick={handleSaveProject} className="min-w-[120px]" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}