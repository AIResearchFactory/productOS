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
import { FolderOpen, Sparkles, Trash2, PenTool } from 'lucide-react';
import { tauriApi, Skill } from '../api/tauri';
import { useToast } from '@/hooks/use-toast';

interface ProjectSettingsPageProps {
  activeProject: { id: string; name: string; description?: string } | null;
  onProjectCreated?: (project: any) => void;
  onProjectUpdated?: (project: any) => void;
}

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
  const [selectedTemplateType, setSelectedTemplateType] = useState('insight');
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const { toast } = useToast();

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
        const types = ['insight', 'evidence', 'decision', 'requirement', 'metric_definition', 'experiment', 'poc_brief'];
        const loadedTemplates: Record<string, string> = {};
        for (const t of types) {
          try {
            const content = await tauriApi.readMarkdownFile(activeProject.id, `.templates/${t}.md`);
            loadedTemplates[t] = content;
          } catch (err) {
            // template might not exist, ignore
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

    setLoading(true);
    try {
      if (activeProject.id === 'new-project' || activeProject.id.startsWith('draft-')) {
        const newProj = await tauriApi.createProject(
          projectSettings.name,
          projectSettings.goal,
          projectSettings.skills
        );
        toast({
          title: 'Success',
          description: `Product "${newProj.name}" created successfully`
        });
        onProjectCreated?.(newProj);
      } else {
        await tauriApi.saveProjectSettings(activeProject.id, {
          name: projectSettings.name,
          goal: projectSettings.goal,
          auto_save: projectSettings.autoSave,
          encryption_enabled: projectSettings.encryptData,
          preferred_skills: projectSettings.skills,
          personalization_rules: projectSettings.personalizationRules,
          brand_settings: projectSettings.brandSettings || undefined
        });

        toast({
          title: 'Success',
          description: 'Product settings saved successfully'
        });

        onProjectUpdated?.({
          ...activeProject,
          name: projectSettings.name,
          description: projectSettings.goal
        });

        // Save project templates
        for (const [t, content] of Object.entries(templates)) {
          if (content !== undefined && content.trim() !== '') {
            try {
              await tauriApi.writeMarkdownFile(activeProject.id, `.templates/${t}.md`, content);
            } catch (err) {
              console.error(`Failed to save template ${t}`, err);
            }
          } else if (content === '') {
            try {
              await tauriApi.deleteMarkdownFile(activeProject.id, `.templates/${t}.md`);
            } catch (err) {
              // Ignore delete error if it doesn't exist
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to save product settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save product settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const [activeSection, setActiveSection] = useState('general');

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No project selected
      </div>
    );
  }

  const sections = [
    { id: 'general', label: 'General', icon: FolderOpen },
    { id: 'features', label: 'Features', icon: Switch },
    { id: 'skills', label: 'Skills', icon: Sparkles },
    { id: 'personalization', label: 'Personalization', icon: PenTool }
  ];

  return (
    <div data-testid="project-settings-page" className="h-full flex overflow-hidden">
      {/* Settings Navigation Sidebar */}
      <div className="w-64 border-r border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-tight">Project Settings</h2>
          <p className="text-xs text-gray-500 mt-1 truncate">{activeProject.name}</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === section.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
              >
                <section.icon className="w-4 h-4" />
                {section.label}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-950">
        <ScrollArea className="flex-1">
          <div className="max-w-3xl p-8 space-y-10">
            {activeSection === 'general' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">General</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Basic project information and metadata</p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
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

                  <div className="grid gap-2">
                    <Label htmlFor="project-desc" className="text-sm font-medium">Description</Label>
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
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Features</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure project behavior and security</p>
                </div>

                <div className="space-y-6 max-w-md">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Auto-save Documents</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mr-8">
                        Automatically save changes as you type. Disabling this requires manual saving for each document.
                      </p>
                    </div>
                    <Switch
                      checked={projectSettings.autoSave}
                      onCheckedChange={(checked) => setProjectSettings({ ...projectSettings, autoSave: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Encrypt Project Data</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mr-8">
                        Use AES-256 encryption for documents. Recommended for sensitive research.
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
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Project Skills</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage skills enabled for this project</p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {availableSkills.map((skill) => {
                      const isSelected = projectSettings.skills.includes(skill.name);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => !isSelected && handleAddSkill(skill.name)}
                          disabled={isSelected}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isSelected
                            ? 'bg-primary/10 text-primary border-primary/20 opacity-50 cursor-default'
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
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Personalization Rules</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure AI writing rules and guidelines specific to this project.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="personalization-rules" className="text-sm font-medium">Writing Rules & Tone of Voice</Label>
                    <Textarea
                      id="personalization-rules"
                      value={projectSettings.personalizationRules}
                      onChange={(e) => setProjectSettings({ ...projectSettings, personalizationRules: e.target.value })}
                      className="max-w-prose bg-gray-50/50 dark:bg-gray-900/50 min-h-[200px] font-mono text-sm resize-y"
                      placeholder="e.g. Always use standard US English spelling. Keep sentences as short and simple as possible..."
                    />
                    <p className="text-xs text-gray-500 max-w-prose mt-2">These rules will be injected as context directly to the AI, ensuring its output precisely follows your project preferences. Use this to maintain consistent style, define specific terminologies, or establish unique formatting guidelines.</p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800 grid gap-2">
                    <Label htmlFor="brand-settings" className="text-sm font-medium">Brand Design Rules</Label>
                    <p className="text-xs text-gray-500 max-w-prose">Define your brand's colors, typography, tone, and assets. This will be used by the presentation skill to create on-brand slide decks. You can use JSON format or plain text guidelines.</p>
                    <Textarea
                      id="brand-settings"
                      value={projectSettings.brandSettings}
                      onChange={(e) => setProjectSettings({ ...projectSettings, brandSettings: e.target.value })}
                      className="max-w-prose bg-gray-50/50 dark:bg-gray-900/50 min-h-[160px] font-mono text-sm resize-y"
                      placeholder={'{\n  "colors": { "primary": "#003366", "secondary": "#FF5733", "accent": "#F1C40F" },\n  "typography": { "heading_font": "Montserrat", "body_font": "Open Sans" },\n  "tone": { "voice": "Authoritative yet accessible" }\n}'}
                    />
                  </div>

                  <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800 grid gap-4">
                    <Label className="text-sm font-medium">Project Artifact Templates</Label>
                    <p className="text-xs text-gray-500 max-w-prose">Settings here override the global artifact templates for this project only. Leave empty to use the global defaults.</p>
                    <Select
                      value={selectedTemplateType}
                      onValueChange={(val) => setSelectedTemplateType(val)}
                    >
                      <SelectTrigger className="w-[200px] bg-white dark:bg-gray-900">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="insight">Insight</SelectItem>
                        <SelectItem value="evidence">Evidence</SelectItem>
                        <SelectItem value="decision">Decision</SelectItem>
                        <SelectItem value="requirement">Requirement</SelectItem>
                        <SelectItem value="metric_definition">Metric Definition</SelectItem>
                        <SelectItem value="experiment">Experiment</SelectItem>
                        <SelectItem value="poc_brief">POC Brief</SelectItem>
                      </SelectContent>
                    </Select>

                    <Textarea
                      key={selectedTemplateType}
                      defaultValue={templates[selectedTemplateType] || ''}
                      onChange={(e) => {
                        setTemplates({
                          ...templates,
                          [selectedTemplateType]: e.target.value
                        });
                      }}
                      className="max-w-prose min-h-[300px] font-mono text-sm resize-y bg-gray-50/50 dark:bg-gray-900/50"
                      placeholder="Enter a custom markdown template for this project. Use {{title}} to insert the artifact's title. Leave blank to use the Global Setting default."
                    />
                  </div>
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