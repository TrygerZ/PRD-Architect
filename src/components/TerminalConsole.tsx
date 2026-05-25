import { useState, FormEvent, useEffect } from 'react';
import { Terminal, Send, Activity, Loader2 } from 'lucide-react';
import { ProductType } from '../types';

interface TerminalConsoleProps {
  onGenerate: (prompt: string, type: ProductType) => void;
  isGenerating: boolean;
}

export function TerminalConsole({ onGenerate, isGenerating }: TerminalConsoleProps) {
  const [prompt, setPrompt] = useState('');
  const [detectedType, setDetectedType] = useState<ProductType>('Unknown');

  // Simple heuristic for product type detection
  useEffect(() => {
    const text = prompt.toLowerCase();
    if (text.includes('m-commerce') || text.includes('e-commerce') || text.includes('toko') || text.includes('shop') || text.includes('beli') || text.includes('jual') || text.includes('marketplace') || text.includes('commerce') || text.includes('store') || text.includes('kasir') || text.includes('pos')) {
      setDetectedType('e-commerce');
    } else if (text.includes('saas') || text.includes('subscription') || text.includes('langganan') || text.includes('dashboard') || text.includes('platform') || text.includes('b2b') || text.includes('layanan') || text.includes('service')) {
      setDetectedType('SaaS');
    } else if (text.includes('iot') || text.includes('sensor') || text.includes('device') || text.includes('hardware') || text.includes('alat') || text.includes('mesin') || text.includes('perangkat berat') || text.includes('mikrokontroler') || text.includes('arduino') || text.includes('raspberry pt')) {
      setDetectedType('IoT');
    } else if (text.includes('mobile') || text.includes('app') || text.includes('android') || text.includes('ios') || text.includes('aplikasi hw') || text.includes('smartphone') || text.includes('hp')) {
      setDetectedType('Mobile App');
    } else if (text.includes('internal') || text.includes('admin') || text.includes('cms') || text.includes('manajemen') || text.includes('erp') || text.includes('sistem informasi') || text.includes('portal') || text.includes('karyawan')) {
      setDetectedType('Internal Tool');
    } else {
      setDetectedType('Unknown');
    }
  }, [prompt]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt, detectedType);
  };

  return (
    <div className="w-full max-w-4xl mx-auto glass-panel p-1 rounded-sm no-print mb-8 relative z-10 before:absolute before:-inset-px before:-z-10 before:bg-gradient-to-r before:from-cyber-accent/50 before:to-transparent before:opacity-20 before:rounded-sm">
      <div className="bg-cyber-bg p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between text-cyber-text-dim text-xs font-mono border-b border-cyber-border pb-2">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-cyber-accent" />
            <span>SYS.PROMPT_INPUT</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-cyber-accent/70">
               <Activity size={12} />
               <span>DETECTED_MODULE: {detectedType.toUpperCase()}</span>
            </div>
            <span>CHAR_COUNT: {prompt.length}</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Jelaskan produk yang ingin kamu bangun... (Cth: Sebuah aplikasi E-Commerce untuk menjual biji kopi Nusantara dengan fitur subscription bulanan)"
            className="w-full bg-transparent text-cyber-text placeholder:text-cyber-border outline-none resize-none min-h-[120px] font-sans text-sm focus:ring-0 p-2"
            disabled={isGenerating}
          />
          <div className="absolute bottom-2 right-2">
            <button 
              type="submit" 
              disabled={!prompt.trim() || isGenerating}
              className="cyber-button"
            >
              {isGenerating ? (
                <>PROCESSING <Loader2 size={16} className="animate-spin" /></>
              ) : (
                <>INITIALIZE <Send size={16} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
