import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@/components/ui/menubar';
import {
  FileText,
  FolderPlus,
  X,
  Edit3,
  Search,
  Info,
  Settings,
  Sparkles
} from 'lucide-react';

interface MenuBarProps {
  onNewProject: () => void;
  onNewFile: () => void;
  onCloseFile: () => void;
  onCloseProject: () => void;
  onOpenWelcome: () => void;
  onOpenGlobalSettings: () => void;
  onFind: () => void;
  onReplace: () => void;
  onExit: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onFindInFiles?: () => void;
  onReplaceInFiles?: () => void;
  onSelectAll?: () => void;
  onExpandSelection?: () => void;
  onCopyAsMarkdown?: () => void;
  onReleaseNotes?: () => void;
  onDocumentation?: () => void;
  onCheckForUpdates?: () => void;
}

export default function MenuBar({
  onNewProject,
  onNewFile,
  onCloseFile,
  onCloseProject,
  onOpenWelcome,
  onOpenGlobalSettings,
  onFind,
  onReplace,
  onExit,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFindInFiles,
  onReplaceInFiles,
  onSelectAll,
  onExpandSelection,
  onCopyAsMarkdown,
  onReleaseNotes,
  onDocumentation,
  onCheckForUpdates
}: MenuBarProps) {
  return (
    <div className="relative z-[100] h-9 bg-gray-900 dark:bg-gray-950 border-b border-gray-700 flex items-center px-1">
      <Menubar className="border-none bg-transparent shadow-none h-auto p-0">
        <MenubarMenu>
          <MenubarTrigger className="data-[state=open]:bg-gray-800 data-[state=open]:text-gray-100 hover:bg-gray-800 rounded text-gray-300 hover:text-gray-100 px-3 py-1 cursor-default">
            File
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onNewProject}>
              <FolderPlus className="w-4 h-4 mr-2" />
              New Project...
              <MenubarShortcut>⌘N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onNewFile}>
              <FileText className="w-4 h-4 mr-2" />
              New File...
              <MenubarShortcut>⌘⇧N</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onCloseFile}>
              <X className="w-4 h-4 mr-2" />
              Close File
              <MenubarShortcut>⌘W</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onCloseProject}>
              <X className="w-4 h-4 mr-2" />
              Close Project
              <MenubarShortcut>⌘⇧W</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onExit}>
              <X className="w-4 h-4 mr-2" />
              Exit
              <MenubarShortcut>⌘Q</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="data-[state=open]:bg-gray-800 data-[state=open]:text-gray-100 hover:bg-gray-800 rounded text-gray-300 hover:text-gray-100 px-3 py-1 cursor-default">
            Edit
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onUndo}>
              <Edit3 className="w-4 h-4 mr-2" />
              Undo
              <MenubarShortcut>⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onRedo}>
              <Edit3 className="w-4 h-4 mr-2" />
              Redo
              <MenubarShortcut>⌘⇧Z</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onCut}>
              Cut
              <MenubarShortcut>⌘X</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onCopy}>
              Copy
              <MenubarShortcut>⌘C</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onPaste}>
              Paste
              <MenubarShortcut>⌘V</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onFind}>
              <Search className="w-4 h-4 mr-2" />
              Find
              <MenubarShortcut>⌘F</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onReplace}>
              <Search className="w-4 h-4 mr-2" />
              Replace
              <MenubarShortcut>⌘H</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onFindInFiles}>
              Find in Files
              <MenubarShortcut>⌘⇧F</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onReplaceInFiles}>
              Replace in Files
              <MenubarShortcut>⌘⇧H</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="data-[state=open]:bg-gray-800 data-[state=open]:text-gray-100 hover:bg-gray-800 rounded text-gray-300 hover:text-gray-100 px-3 py-1 cursor-default">
            Selection
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onSelectAll}>
              Select All
              <MenubarShortcut>⌘A</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onExpandSelection}>
              Expand Selection
              <MenubarShortcut>⌥⇧→</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onCopyAsMarkdown}>
              <FileText className="w-4 h-4 mr-2" />
              Copy as Markdown
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="data-[state=open]:bg-gray-800 data-[state=open]:text-gray-100 hover:bg-gray-800 rounded text-gray-300 hover:text-gray-100 px-3 py-1 cursor-default">
            Help
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onOpenWelcome}>
              <Sparkles className="w-4 h-4 mr-2" />
              Welcome
            </MenubarItem>
            <MenubarItem onClick={onReleaseNotes}>
              <Info className="w-4 h-4 mr-2" />
              Release Notes
            </MenubarItem>
            <MenubarItem onClick={onDocumentation}>
              <Info className="w-4 h-4 mr-2" />
              Documentation
            </MenubarItem>
            <MenubarItem onClick={onCheckForUpdates}>
              <Info className="w-4 h-4 mr-2" />
              Check for Updates
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onOpenGlobalSettings}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
              <MenubarShortcut>⌘,</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}