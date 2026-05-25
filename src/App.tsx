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
  const [language, setLanguage] = useState<'id' | 'en'>('id');
  
  const [versions, setVersions] = useState<PRDVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load API key from local storage on init
    const stored = localStorage.getItem('PRD_CUSTOM_API_KEY');
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
      await generatePRD(prompt, customApiKey, language, productType, (chunk) => {
        setVersions(prev => prev.map(v => 
          v.id === newVersionId ? { ...v, content: v.content + chunk } : v
        ));
      });
    } catch (err: any) {
      setError(err.message || (language === 'en' ? 'An unexpected error occurred during PRD generation.' : 'Terjadi kesalahan tidak terduga saat membuat PRD.'));
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
    let revisionPrompt = language === 'en' 
      ? `I want to revise the current PRD based on specific feedback for certain sections.\n\n### Current PRD:\n${activeVersion.content}\n\n### Revisions requested per section:\n`
      : `Saya ingin merevisi PRD saat ini berdasarkan feedback spesifik untuk beberapa bagian.\n\n### PRD Saat Ini:\n${activeVersion.content}\n\n### Permintaan revisi per bagian:\n`;
    
    Object.entries(comments).forEach(([sectionId, comment]) => {
      let sectionHeading = sectionId;
      const secIdx = parseInt(sectionId.split('_')[1], 10);
      if (!isNaN(secIdx)) {
        const chunks = activeVersion.content.split(/(?=^#{1,2}\s)/gm).filter(c => c.trim().length > 0);
        if (chunks[secIdx]) {
          sectionHeading = chunks[secIdx].split('\n')[0].replace(/^#+\s/, '').substring(0, 60).trim();
        }
      }
      revisionPrompt += `- **${language === 'en' ? 'Section' : 'Bagian'} "${sectionHeading}"**: ${comment}\n`;
    });
    revisionPrompt += language === 'en'
      ? `\nPlease generate a completely revised standard 12-chapter PRD reflecting these changes. Keep unchanged sections intact.`
      : `\nTolong buat ulang PRD 12 bab standar secara utuh dengan menerapkan perubahan tersebut. Biarkan bagian yang tidak direvisi tetap seperti semula.`;

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
      await generatePRD(revisionPrompt, customApiKey, language, productType, (chunk) => {
        setVersions(prev => prev.map(v => 
          v.id === newVersionId ? { ...v, content: v.content + chunk } : v
        ));
      });
      // Clear comments after successful revision
      setComments({});
    } catch (err: any) {
      setError(err.message || (language === 'en' ? 'An unexpected error occurred during PRD revision.' : 'Terjadi kesalahan tidak terduga saat merevisi PRD.'));
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
    alert(language === 'en' ? 'PRD copied to clipboard!' : 'PRD disalin ke clipboard!'); // Could replace with custom toast
  };

  const handlePrint = () => {
    const element = document.getElementById('prd-print-only');
    if (element) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const html = `
          <html>
            <head>
              <title>${productType} - PRD</title>
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                  line-height: 1.6; 
                  color: #333;
                  padding: 40px;
                  max-width: 800px;
                  margin: 0 auto;
                }
                h1, h2, h3, h4 { color: #111; margin-top: 24px; margin-bottom: 16px; }
                p { margin-bottom: 16px; }
                ul, ol { margin-bottom: 16px; padding-left: 24px; }
                li { margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f9f9f9; font-weight: 600; }
                code { 
                  background-color: #f4f4f5; 
                  padding: 2px 6px; 
                  border-radius: 4px; 
                  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                  font-size: 0.9em;
                }
                blockquote {
                  border-left: 4px solid #ddd;
                  padding-left: 16px;
                  color: #666;
                  margin-left: 0;
                  margin-right: 0;
                }
                @media print {
                  body { padding: 0; }
                  @page { margin: 2cm; }
                }
              </style>
            </head>
            <body>
              ${element.innerHTML}
            </body>
          </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for styles to apply before printing
        setTimeout(() => {
          printWindow.print();
          // Optional: close after print, but some browsers block the thread so closing right away might cancel print
          // printWindow.close(); 
        }, 500);
      } else {
        alert(language === 'en' ? 'Pop-up blocked. Please allow pop-ups to print, or open this app in a new tab.' : 'Pop-up diblokir. Izinkan pop-up untuk mencetak, atau buka aplikasi ini di tab baru.');
      }
    }
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 px-2 sm:px-4 relative flex flex-col items-center">
      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onExportMd={handleExportMd}
        onCopy={handleCopy}
        onPrint={handlePrint}
        hasData={prdContent.length > 0}
        language={language}
        onToggleLanguage={() => setLanguage(lang => lang === 'id' ? 'en' : 'id')}
      />
      
      <div className="w-full relative z-10 flex flex-col items-center flex-grow">
        {(!activeVersionId || versions.length === 0) && (
          <TerminalConsole 
            onGenerate={handleGenerate} 
            isGenerating={isGenerating}
            language={language}
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
            onSwitchVersion={(vid) => {
              setActiveVersionId(vid);
              setComments({});
            }}
            onRevise={handleRevise}
            isGenerating={isGenerating}
            language={language}
          />
        )}
      </div>

      <ApiKeyModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={(key) => setCustomApiKey(key)}
        language={language}
      />
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 no-print flex flex-col items-center justify-center blur-3xl opacity-20">
        <div className="w-full max-w-2xl h-[500px] bg-cyber-accent rounded-full mb-10" />
      </div>
    </div>
  );
}
