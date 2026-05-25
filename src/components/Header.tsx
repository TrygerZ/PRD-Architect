import { Settings, Download, Copy, Printer } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onExportMd: () => void;
  onCopy: () => void;
  onPrint: () => void;
  hasData: boolean;
}

export function Header({ onOpenSettings, onExportMd, onCopy, onPrint, hasData }: HeaderProps) {
  return (
    <header className="fixed top-0 inset-x-0 h-16 glass-panel border-b-cyber-border z-50 flex items-center justify-between px-6 no-print">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-cyber-accent/20 border border-cyber-accent flex items-center justify-center">
          <div className="w-4 h-4 bg-cyber-accent rounded-sm animate-pulse" />
        </div>
        <h1 className="text-xl font-mono tracking-widest text-cyber-text uppercase">
          PRD <span className="text-cyber-accent">Architect</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {hasData && (
          <div className="flex items-center gap-2 mr-4 border-r border-cyber-border pr-6">
            <button onClick={onCopy} className="cyber-button text-xs py-1.5 px-3" title="Copy as Text">
              <Copy size={14} /> Copy
            </button>
            <button onClick={onExportMd} className="cyber-button text-xs py-1.5 px-3" title="Download Markdown">
              <Download size={14} /> .MD
            </button>
            <button onClick={onPrint} className="cyber-button text-xs py-1.5 px-3" title="Print to PDF">
              <Printer size={14} /> PDF
            </button>
          </div>
        )}
        <button onClick={onOpenSettings} className="p-2 text-cyber-text-dim hover:text-cyber-accent transition-colors" title="Settings">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
