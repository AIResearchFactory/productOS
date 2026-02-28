import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, ChevronDown, Sparkles, FolderPlus } from 'lucide-react';
import CreateSkillDialog from './CreateSkillDialog';
import { tauriApi, Skill } from '@/api/tauri';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; goal: string; skills: string[] }) => void;
  availableSkills?: Skill[];
}

export default function ProjectFormDialog({
  open,
  onOpenChange,
  onSubmit,
  availableSkills: externalSkills,
}: ProjectFormDialogProps) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (externalSkills) {
      setAvailableSkills(externalSkills);
    } else if (open) {
      loadSkills();
    }
  }, [open, externalSkills]);

  const loadSkills = async () => {
    try {
      const loadedSkills = await tauriApi.getAllSkills();
      setAvailableSkills(loadedSkills);
    } catch (error) {
      console.error('Failed to load skills:', error);
    }
  };

  const handleAddSkill = () => {
    if (skillsInput.trim() && !skills.includes(skillsInput.trim())) {
      setSkills([...skills, skillsInput.trim()]);
      setSkillsInput('');
    }
  };

  const handleSelectSkill = (skillName: string) => {
    if (!skills.includes(skillName)) {
      setSkills([...skills, skillName]);
    }
  };

  const handleCreateSkill = async (newSkill: { name: string; description: string; promptTemplate: string }) => {
    try {
      const category = "general";

      await tauriApi.createSkill(
        newSkill.name,
        newSkill.description,
        newSkill.promptTemplate,
        category
      );

      if (!skills.includes(newSkill.name)) {
        setSkills([...skills, newSkill.name]);
      }

      toast({
        title: "Skill Created",
        description: `Skill "${newSkill.name}" has been created and saved.`
      });

      loadSkills();
    } catch (error) {
      console.error('Failed to create skill:', error);
      toast({
        title: "Error",
        description: "Failed to save the new skill.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !goal.trim()) return;

    onSubmit({
      name: name.trim(),
      goal: goal.trim(),
      skills,
    });

    setName('');
    setGoal('');
    setSkills([]);
    setSkillsInput('');
  };

  const handleCancel = () => {
    setName('');
    setGoal('');
    setSkills([]);
    setSkillsInput('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-border bg-background shadow-2xl rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-primary/5 to-cyan-500/10 pointer-events-none" />

        <DialogHeader className="p-6 pb-4 relative z-10 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <FolderPlus className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Create Project</DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">
                Establish a new workspace for your research.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 relative z-10">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Project Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Quantum Computing Analysis"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 bg-background border-input focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal" className="text-sm font-medium text-foreground">
                Project Goal
              </Label>
              <Textarea
                id="goal"
                placeholder="Synthesize the primary goal of this research project..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={4}
                className="bg-background border-input resize-none focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Skill Integration
              </Label>
              <div className="flex gap-2">
                <Input
                  id="skills"
                  placeholder="Add custom capability..."
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="bg-background border-input focus:ring-2 focus:ring-blue-500/20"
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" type="button" className="px-3 gap-2">
                      Registry
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    {availableSkills.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground font-medium italic">Empty Registry</div>
                    ) : (
                      availableSkills.map((skill) => {
                        const isSelected = skills.includes(skill.name);
                        return (
                          <DropdownMenuItem
                            key={skill.id}
                            onSelect={(e?: any) => {
                              e.preventDefault();
                              if (!isSelected) handleSelectSkill(skill.name);
                            }}
                            className={isSelected ? "opacity-50" : ""}
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-2 text-primary" />
                            {skill.name}
                          </DropdownMenuItem>
                        );
                      })
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCreateSkill(true)}
                  title="Forge New Skill"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <AnimatePresence>
                {skills.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap gap-2 pt-1"
                  >
                    {skills.map((skill) => (
                      <motion.div
                        key={skill}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/10 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:bg-primary/20"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:text-primary/70 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-white/5 flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="rounded-xl font-bold text-muted-foreground hover:bg-white/5"
            >
              Discard
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !goal.trim()}
              className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 px-8 font-bold"
            >
              Initialize Node
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <CreateSkillDialog
        open={showCreateSkill}
        onOpenChange={setShowCreateSkill}
        onSubmit={handleCreateSkill}
      />
    </Dialog>
  );
}
