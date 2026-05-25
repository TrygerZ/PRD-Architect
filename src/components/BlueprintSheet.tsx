import { useState, useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, GitCommit, GitBranch, RefreshCw, Send, Check } from 'lucide-react';
import { PRDVersion } from '../types';

interface BlueprintSheetProps {
  content: string; // active version content
  comments?: Record<string, string>;
  onCommentChange?: (sectionId: string, comment: string) => void;
  versions?: PRDVersion[];
  activeVersionId?: string | null;
  onSwitchVersion?: (versionId: string) => void;
  onRevise?: () => void;
  isGenerating?: boolean;
}

const getSections = (content: string) => {
  if (!content) return [];
  // Split by headings Level 1 or 2
  const chunks = content.split(/(?=^#{1,2}\s)/gm);
  return chunks.filter(c => c.trim().length > 0);
};

export function BlueprintSheet({ 
  content, 
  comments = {}, 
  onCommentChange, 
  versions = [], 
  activeVersionId, 
  onSwitchVersion,
  onRevise,
  isGenerating
}: BlueprintSheetProps) {
  
  const sections = getSections(content);
  const totalComments = Object.values(comments).filter(c => c.trim().length > 0).length;

  return (
    <div className="w-full max-w-5xl mx-auto relative z-10 print:block print:w-full print:max-w-full print:bg-white print:text-black mt-8">
      
      {/* Version Control & Revision Panel */}
      {versions.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 bg-cyber-surface/60 border border-cyber-border/40 p-4 rounded-xl no-print">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-cyber-accent" />
            <div className="flex items-center gap-2">
              <span className="text-cyber-text-dim text-sm font-medium">Version:</span>
              <select 
                value={activeVersionId || ''}
                onChange={(e) => onSwitchVersion?.(e.target.value)}
                disabled={isGenerating}
                className="bg-black/50 border border-cyber-border/60 rounded px-2 py-1 text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-accent max-w-48"
              >
                {versions.map((v, i) => (
                  <option key={v.id} value={v.id}>
                    v{i + 1} - {new Date(v.timestamp).toLocaleTimeString()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-cyber-text-dim flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>{totalComments} Comments</span>
            </div>
            
            <button
              onClick={onRevise}
              disabled={isGenerating || totalComments === 0}
              className="px-4 py-2 bg-cyber-accent/10 hover:bg-cyber-accent/20 border border-cyber-accent/50 text-cyber-accent rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Regenerate PRD
            </button>
          </div>
        </div>
      )}

      {!content && isGenerating ? (
        <div className="text-center text-cyber-text-dim font-mono py-10 no-print flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-cyber-accent" />
          AWAITING_PRD_GENERATION
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section, index) => {
             // Create a deterministic quasi-ID for the section to store comments
             // For safety, we use the index as string because headings might change slightly between versions
             const sectionId = `sec_${index}`; 
             const currentComment = comments[sectionId] || '';

             return (
               <SheetSection 
                 key={sectionId} 
                 section={section} 
                 comment={currentComment}
                 onCommentChange={(text) => onCommentChange?.(sectionId, text)}
                 isGenerating={isGenerating}
               />
             );
          })}
        </div>
      )}
    </div>
  );
}

function SheetSection({ 
  section, 
  comment, 
  onCommentChange,
  isGenerating
}: { 
  section: string; 
  comment: string; 
  onCommentChange: (text: string) => void;
  isGenerating?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempComment, setTempComment] = useState(comment);

  useEffect(() => {
    setTempComment(comment);
  }, [comment]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel overflow-hidden relative group print:break-inside-avoid print:bg-transparent print:border-none print:shadow-none print:p-0 flex flex-col lg:flex-row"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-accent/5 blur-3xl -z-10 group-hover:bg-cyber-accent/10 transition-colors" />
      
      {/* Markdown Content Area */}
      <div className="flex-grow min-w-0 p-4 sm:p-6 lg:border-r border-cyber-border/40 prose prose-invert prose-cyber max-w-none 
          prose-headings:font-sans prose-headings:font-bold prose-headings:text-cyber-text
          prose-h1:text-xl sm:prose-h1:text-2xl prose-h1:border-b prose-h1:border-cyber-border prose-h1:pb-2 prose-h1:mb-4
          prose-h2:text-lg sm:prose-h2:text-xl prose-h2:border-b prose-h2:border-cyber-border prose-h2:pb-2 prose-h2:mb-4 prose-h2:mt-4
          prose-h3:text-base sm:prose-h3:text-lg prose-h3:text-cyber-accent prose-h3:mt-6
          prose-p:text-cyber-text-dim prose-p:text-[13px] sm:prose-p:text-sm prose-p:leading-relaxed
          prose-li:text-cyber-text-dim prose-li:text-[13px] sm:prose-li:text-sm
          prose-strong:text-cyber-text
          print:prose-p:text-black print:prose-li:text-black print:prose-headings:text-black print:prose-strong:text-black
        ">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({node, ...props}) => (
              <div className="w-full overflow-x-auto my-8 rounded-lg border border-cyber-border/80 bg-black/40 shadow-xl print:border-gray-300 print:bg-transparent print:shadow-none">
                <table className="w-full text-sm text-left border-collapse" {...props} />
              </div>
            ),
            thead: ({node, ...props}) => (
              <thead className="bg-cyber-surface/90 text-cyber-accent font-mono border-b border-cyber-border print:bg-gray-100 print:text-black print:border-gray-300" {...props} />
            ),
            th: ({node, ...props}) => (
              <th className="px-5 py-3.5 font-semibold tracking-wide whitespace-nowrap" {...props} />
            ),
            tbody: ({node, ...props}) => (
              <tbody className="divide-y divide-cyber-border/40 print:divide-gray-200" {...props} />
            ),
            tr: ({node, ...props}) => (
              <tr className="hover:bg-cyber-accent/5 transition-colors duration-200" {...props} />
            ),
            td: ({node, ...props}) => (
              <td className="px-5 py-4 align-top leading-relaxed text-cyber-text-dim print:text-black max-w-xs break-words" {...props} />
            ),
            pre: ({node, children, ...props}) => (
              <div className="relative my-6 rounded-lg border border-cyber-border/40 bg-black overflow-hidden print:bg-gray-50 print:border-gray-300">
                <div className="absolute top-0 left-0 w-full h-8 bg-cyber-surface/50 border-b border-cyber-border/40 flex items-center px-4 print:bg-gray-200 print:border-gray-300">
                  <div className="flex gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 print:bg-gray-400" />
                     <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 print:bg-gray-400" />
                     <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 print:bg-gray-400" />
                  </div>
                </div>
                <pre className="p-4 pt-12 overflow-x-auto m-0 bg-transparent text-sm font-mono text-cyber-text-dim print:text-black" {...props}>
                  {children}
                </pre>
              </div>
            ),
            code: ({node, className, children, ...props}: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match && !String(children).includes('\n');
              if (isInline) {
                return (
                  <code className="px-1.5 py-0.5 mx-0.5 rounded bg-cyber-surface/80 text-cyber-accent font-mono text-[0.85em] border border-cyber-border/50 print:bg-gray-100 print:text-black print:border-gray-200" {...props}>
                    {children}
                  </code>
                );
              }
              return <code className={className} {...props}>{children}</code>;
            }
          }}
        >
          {section}
        </ReactMarkdown>
      </div>

      {/* Side Feedback Panel */}
      <div className="w-full lg:w-72 lg:shrink-0 bg-black/20 p-4 relative no-print flex flex-col group/feedback">
        <label className="text-xs font-mono text-cyber-text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" /> Revisi / Feedback
        </label>
        
        {isEditing ? (
          <div className="flex flex-col gap-2 relative z-20">
            <textarea
              autoFocus
              disabled={isGenerating}
              value={tempComment}
              onChange={(e) => setTempComment(e.target.value)}
              className="flex-grow min-h-[100px] w-full bg-black/50 border border-cyber-accent text-cyber-text text-sm p-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyber-accent resize-y"
              placeholder="Berikan feedback atau revisi untuk bagian ini..."
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => { setIsEditing(false); setTempComment(comment); }}
                className="px-3 py-1.5 text-xs text-cyber-text-dim hover:text-cyber-text"
              >
                Cancel
              </button>
              <button 
                onClick={() => { setIsEditing(false); onCommentChange(tempComment); }}
                className="px-3 py-1.5 text-xs bg-cyber-accent text-black font-semibold rounded hover:bg-cyber-accent/90 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Save
              </button>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => !isGenerating && setIsEditing(true)}
            className={`group-hover/feedback:border-cyber-border
              transition-colors duration-200 flex-grow rounded-lg border border-transparent 
              cursor-text flex flex-col relative z-20 ${comment ? 'bg-cyber-accent/5 border-cyber-accent/20' : ''}`}
          >
            {comment ? (
              <div className="p-3 text-sm text-cyber-accent flex-grow whitespace-pre-wrap">
                {comment}
              </div>
            ) : (
              <div className="p-3 text-sm text-cyber-text-dim/50 flex-grow border border-dashed border-cyber-border/30 rounded-lg hover:border-cyber-border/70 hover:text-cyber-text-dim transition-all">
                Klik untuk menambahkan catatan revisi pada bagian ini...
              </div>
            )}
            {comment && !isGenerating && (
              <div className="absolute top-2 right-2 opacity-0 group-hover/feedback:opacity-100 transition-opacity">
                <button className="text-xs bg-black/80 px-2 py-1 rounded text-cyber-text border border-cyber-border hover:border-cyber-accent">Edit</button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
