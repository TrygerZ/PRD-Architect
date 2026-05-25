import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TerminalConsole } from './components/TerminalConsole';
import { SystemSchematic } from './components/SystemSchematic';
import { BlueprintSheet } from './components/BlueprintSheet';
import { ApiKeyModal } from './components/ApiKeyModal';
import { generatePRD } from './services/geminiService';
import { ProductType, PRDVersion, PRDComment } from './types';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [productType, setProductType] = useState<ProductType>('Unknown');
  
  const [versions, setVersions] = useState<PRDVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load API key from local storage on init
    const stored = localStorage.getItem('PRD_GEMINI_API_KEY');
    if (stored) {
      setCustomApiKey(stored);
    }
  }, []);

  const activeVersion = versions.find(v => v.id === activeVersionId);
  const prdContent = activeVersion?.content || '';

  const handleGenerate = async (prompt: string, type: ProductType) => {
    setIsGenerating(true);
    setProductType(type);
    setError(null);
    setComments({}); // reset comments on new base generation

    const newVersionId = Date.now().toString();
    const newVersion: PRDVersion = {
      id: newVersionId,
      timestamp: Date.now(),
      content: '',
      prompt: prompt,
      productType: type
    };
    
    setVersions(prev => [...prev, newVersion]);
    setActiveVersionId(newVersionId);

    try {
      await generatePRD(prompt, customApiKey, (chunk) => {
        setVersions(prev => prev.map(v => 
          v.id === newVersionId ? { ...v, content: v.content + chunk } : v
        ));
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during PRD generation.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevise = async () => {
    if (!activeVersion || Object.keys(comments).length === 0) return;
    
    setIsGenerating(true);
    setError(null);

    // Build revision prompt
    let revisionPrompt = `I want to revise the current PRD based on specific feedback for certain sections.\n\n`;
    revisionPrompt += `### Current PRD:\n${activeVersion.content}\n\n`;
    revisionPrompt += `### Revisions requested per section:\n`;
    Object.entries(comments).forEach(([sectionId, comment]) => {
      revisionPrompt += `- **Section ${sectionId.substring(0, 30)}...**: ${comment}\n`;
    });
    revisionPrompt += `\nPlease generate a completely revised standard 11-chapter PRD reflecting these changes. Keep unchanged sections intact.`;

    const newVersionId = Date.now().toString();
    const newVersion: PRDVersion = {
      id: newVersionId,
      timestamp: Date.now(),
      content: '',
      prompt: revisionPrompt,
      productType: activeVersion.productType
    };
    
    setVersions(prev => [...prev, newVersion]);
    setActiveVersionId(newVersionId);

    try {
      await generatePRD(revisionPrompt, customApiKey, (chunk) => {
        setVersions(prev => prev.map(v => 
          v.id === newVersionId ? { ...v, content: v.content + chunk } : v
        ));
      });
      // Clear comments after successful revision
      setComments({});
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during PRD revision.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportMd = () => {
    if (!prdContent) return;
    const blob = new Blob([prdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PRD_${productType.replace(' ', '_')}_${new Date().getTime()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!prdContent) return;
    navigator.clipboard.writeText(prdContent);
    alert('PRD copied to clipboard!'); // Could replace with custom toast
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 relative flex flex-col items-center">
      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onExportMd={handleExportMd}
        onCopy={handleCopy}
        onPrint={handlePrint}
        hasData={prdContent.length > 0}
      />
      
      <div className="w-full relative z-10 flex flex-col items-center flex-grow">
        {(!activeVersionId || versions.length === 0) && (
          <TerminalConsole 
            onGenerate={handleGenerate} 
            isGenerating={isGenerating} 
          />
        )}
        
        {error && (
          <div className="w-full max-w-4xl glass-panel p-4 mb-4 border-red-500/50 text-red-400 text-sm font-mono no-print">
            [SYS_ERR]: {error}
          </div>
        )}

        {/* Dynamic Schematic */}
        {(isGenerating || prdContent || error) && (
          <SystemSchematic productType={productType} isGenerating={isGenerating} />
        )}
        
        {/* Output */}
        {(activeVersionId || isGenerating) && (
          <BlueprintSheet 
            content={prdContent} 
            comments={comments}
            onCommentChange={(secId, comment) => {
              setComments(prev => {
                const newCom = { ...prev, [secId]: comment };
                if (!comment) delete newCom[secId];
                return newCom;
              });
            }}
            versions={versions}
            activeVersionId={activeVersionId}
            onSwitchVersion={setActiveVersionId}
            onRevise={handleRevise}
            isGenerating={isGenerating}
          />
        )}
      </div>

      <ApiKeyModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={(key) => setCustomApiKey(key)}
      />
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 no-print flex flex-col items-center justify-center blur-3xl opacity-20">
        <div className="w-full max-w-2xl h-[500px] bg-cyber-accent rounded-full mb-10" />
      </div>
    </div>
  );
}
