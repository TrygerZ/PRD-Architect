import { useState, useEffect, memo, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  GitBranch,
  RefreshCw,
  ChevronDown,
  MessageSquareText,
  X,
  ClipboardCopy
} from "lucide-react";
import { PRDVersion } from "../types";
import { formatDate } from "../utils/format";

interface BlueprintSheetProps {
  content: string; // active version content
  comments?: Record<string, string>;
  onCommentChange?: (sectionId: string, comment: string) => void;
  versions?: PRDVersion[];
  activeVersionId?: string | null;
  onSwitchVersion?: (versionId: string) => void;
  onRevise?: () => void;
  isGenerating?: boolean;
  language: "id" | "en";
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

type Section = {
  index: number;
  level: number;
  heading: string;
  content: string;
};

export const getSections = (content: string): Section[] => {
  if (!content) return [];
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentContent: string[] = [];
  let currentLevel = 2; // Default level
  let currentHeading = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Regex diperketat agar HANYA membaca Heading 2 (## )
    const match = line.match(/^##\s+(.*)/);
    if (match) {
      if (currentContent.length > 0) {
        sections.push({
          index: sections.length,
          level: currentLevel,
          heading: currentHeading || "Overview", // Cegah hilangnya teks awal
          content: currentContent.join("\n"),
        });
      }
      currentLevel = 2;
      currentHeading = match[1];
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    sections.push({
      index: sections.length,
      level: currentLevel,
      heading: currentHeading || "Overview",
      content: currentContent.join("\n"),
    });
  }
  // JANGAN PERNAH menghapus section jika ada isinya, meskipun tanpa judul
  return sections.filter((s) => s.content.trim().length > 0);
};

export const BlueprintSheet = memo(function BlueprintSheet({
  content,
  comments = {},
  onCommentChange,
  versions = [],
  activeVersionId,
  onSwitchVersion,
  onRevise,
  isGenerating,
  language,
  scrollContainerRef,
}: BlueprintSheetProps) {
  const sections = useMemo(() => getSections(content), [content]);
  const totalComments = Object.values(comments).filter(
    (c) => c.trim().length > 0,
  ).length;

  const [isFeedbackDrawerOpen, setIsFeedbackDrawerOpen] = useState(false);
  const [collapsedStates, setCollapsedStates] = useState<Record<string, boolean>>({});

  // Close drawers on click outside or escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFeedbackDrawerOpen) setIsFeedbackDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFeedbackDrawerOpen]);

  // Progress UI tracking removed to enhance scrolling performance.

  const activeVersion = versions.find(v => v.id === activeVersionId) || versions[versions.length - 1];
  const activeVersionIndex = activeVersion ? versions.findIndex(v => v.id === activeVersion.id) : 0;
  
  const totalSections = sections.length;
  // Show content completeness: 100% when done, indeterminate while generating
  const isComplete = content.length > 0 && !isGenerating;
  const showProgress = content.length > 0;
  const progress = isComplete ? 100 : (isGenerating && content.length > 0 ? 75 : 0);

  const handleToggleCollapse = useCallback((sectionId: string) => {
    setCollapsedStates(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  }, []);

  const handleOpenFeedback = useCallback(() => {
    setIsFeedbackDrawerOpen(true);
  }, []);

  return (
    <div className="w-full mx-auto relative z-10 print:block print:w-full print:max-w-full print:bg-white print:text-black">
      {/* Hidden container for full PRD print export */}
      <div id="prd-print-only" style={{ display: "none" }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>

      {/* FAB button */}
      <button
        onClick={() => setIsFeedbackDrawerOpen(!isFeedbackDrawerOpen)}
        className={`fixed bottom-[100px] sm:bottom-[100px] right-[40px] z-[50] w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all duration-200 ease shadow-lg no-print will-change-transform focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none ${
          isFeedbackDrawerOpen 
            ? "bg-[var(--color-border)] text-[var(--color-text-primary)]" 
            : "bg-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)] text-[var(--color-bg)]"
        }`}
        aria-label={language === "en" ? (isFeedbackDrawerOpen ? "Close feedback" : "Open feedback") : (isFeedbackDrawerOpen ? "Tutup umpan balik" : "Buka umpan balik")}
        style={!isFeedbackDrawerOpen ? { boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)" } : {}}
      >
        {isFeedbackDrawerOpen ? (
          <X size={20} strokeWidth={1.5} />
        ) : (
          <MessageSquareText size={20} strokeWidth={1.5} />
        )}
      </button>

      {/* Slide-in Feedback Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-[400px] max-w-[100vw] bg-[var(--color-surface)] border-l border-[var(--color-border)] z-[40] transition-transform duration-200 ease overflow-y-auto no-print ${
          isFeedbackDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-[var(--color-border)]">
            <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <MessageSquareText size={16} strokeWidth={1.5} className="text-[var(--color-text-secondary)]" />
              {language === "en" ? "Feedback" : "Umpan Balik"}
            </h2>
            <button
              onClick={onRevise}
              disabled={isGenerating || totalComments === 0}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-all duration-200 ease flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                totalComments > 0 
                  ? "bg-[var(--color-text-primary)] text-[var(--color-bg)] hover:bg-[var(--color-text-primary)]" 
                  : "bg-transparent text-[var(--color-text-muted)]"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} strokeWidth={1.5} />
              <span className="hidden sm:inline">
                {language === "en" ? "Regenerate" : "Buat Ulang"}
              </span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Hanya render feedback cards jika drawer terbuka (lazy rendering untuk hemat render cycle) */}
            {isFeedbackDrawerOpen && sections.map((section, index) => {
              const sectionId = `sec_${index}`;
              const currentComment = comments[sectionId] || "";

              return (
                <FeedbackCard 
                  key={sectionId}
                  section={section}
                  comment={currentComment}
                  onCommentChange={(text) => onCommentChange?.(sectionId, text)}
                  language={language}
                />
              );
            })}
          </div>
        </div>
      </div>

      {activeVersion && (
        <>
          {/* Version Info Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GitBranch size={14} strokeWidth={1.5} className="text-[var(--color-text-muted)]" />
              <span className="text-[13px] text-[var(--color-text-secondary)]">Version {activeVersionIndex + 1}</span>
              <time dateTime={new Date(activeVersion.timestamp).toISOString()} className="text-[11px] font-mono text-[var(--color-text-muted)]">{formatDate(activeVersion.timestamp, language)}</time>
            </div>
            <div className="flex items-center gap-2">
              <select 
                className="bg-transparent text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-[6px] px-2 py-1 focus:outline-none focus:border-[var(--color-interactive)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)]"
                value={activeVersionId || ""}
                onChange={(e) => onSwitchVersion?.(e.target.value)}
              >
                {versions.map((v, i) => (
                  <option key={v.id} value={v.id} className="bg-[var(--color-bg)] text-[var(--color-text-primary)]">Version {i + 1}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Progress Bar Header */}
          {showProgress && totalSections > 0 && (
            <div className="flex items-center gap-4 px-1 mb-6">
              <div
                className="flex-1 h-[2px] bg-[var(--color-border)] rounded overflow-hidden"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={isGenerating ? (language === "en" ? "Generating PRD..." : "Membuat PRD...") : (language === "en" ? "PRD Complete" : "PRD Selesai")}
              >
                <div className={`h-full bg-[var(--color-interactive)] transition-all duration-300 ${isGenerating ? 'animate-pulse' : ''}`} style={{width: `${progress}%`}} />
              </div>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                {isComplete ? (language === "en" ? "Complete" : "Selesai") : (language === "en" ? "Generating..." : "Menghasilkan...")}
              </span>
            </div>
          )}
        </>
      )}

      {/* Main Content Area */}
      {!content && isGenerating ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-0" data-prd-content="true">
          {sections.map((section, index) => {
            const sectionId = `sec_${section.heading.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}_${index}`;
            return (
              <SheetSection
                key={sectionId}
                section={section}
                sectionId={sectionId}
                index={index}
                total={sections.length}
                isCollapsed={collapsedStates[sectionId] || false}
                onToggleCollapse={handleToggleCollapse}
                isGenerating={isGenerating}
                language={language}
                onOpenFeedback={handleOpenFeedback}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

const SheetSection = memo(function SheetSection({
  section,
  sectionId,
  index,
  total,
  isCollapsed,
  onToggleCollapse,
  isGenerating,
  language,
  onOpenFeedback,
}: {
  section: Section;
  sectionId: string;
  index: number;
  total: number;
  isCollapsed: boolean;
  onToggleCollapse: (sectionId: string) => void;
  isGenerating?: boolean;
  language: "id" | "en";
  onOpenFeedback: () => void;
}) {
  
  const copySection = async () => {
    try {
      await navigator.clipboard.writeText(section.heading + "\n\n" + section.content);
    } catch {
      // Clipboard write failed — silently ignore in section context
    }
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[8px] overflow-hidden mb-4 print:bg-transparent print:border-none print:shadow-none print:p-0">
      {/* Header — click to collapse */}
      <div 
        className={`flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] cursor-pointer select-none transition-colors no-print ${isCollapsed ? 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)]' : 'bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-elevated)]'}`}
        onClick={() => onToggleCollapse(sectionId)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(sectionId); } }}
        aria-expanded={!isCollapsed}
        aria-controls={`section-content-${sectionId}`}
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-[var(--color-text-primary)] text-[14px] font-semibold" id={sectionId}>{section.heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{index + 1}/{total}</span>
        </div>
      </div>

      {/* Content — collapsible */}
      <div id={`section-content-${sectionId}`} className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-[8000px]'} print:max-h-none`} role="region">
        <div className="px-5 py-4">
          <div
            id={sectionId}
            className="w-full prose prose-invert max-w-none 
              prose-headings:font-normal prose-headings:text-[var(--color-text-primary)]
              prose-h1:text-[36px] sm:prose-h1:text-[48px] prose-h1:mt-8 prose-h1:mb-4 prose-h1:leading-[1.15]
              prose-h2:hidden
              prose-h3:text-[18px] prose-h3:mt-8 prose-h3:font-semibold
              prose-p:text-[var(--color-text-secondary)] prose-p:text-[15px] prose-p:leading-[1.6] prose-p:mb-4
              prose-a:text-[#6666ff] hover:prose-a:text-[#8888ff] prose-a:no-underline transition-colors
              prose-li:text-[var(--color-text-secondary)] prose-li:text-[15px] prose-li:my-1
              prose-strong:text-[var(--color-text-primary)] prose-strong:font-medium
              prose-ul:pl-6 prose-ul:mb-6 prose-ol:pl-6 prose-ol:mb-6
              prose-hr:border-[var(--color-border)] prose-hr:my-8
              prose-blockquote:border-l-2 prose-blockquote:border-[var(--color-text-muted)] prose-blockquote:pl-4 prose-blockquote:text-[var(--color-text-muted)]
              print:prose-p:text-black print:prose-li:text-black print:prose-headings:text-black print:prose-strong:text-black
            "
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }: any) => (
                  <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
                    {children}
                  </a>
                ),
                h2: () => null, // h2 is already displayed in the card header
                h3: ({node, children, ...props}) => (
                  <h3 className="relative group/h3" {...props}>
                    {children}
                  </h3>
                ),
                table: ({ node, ...props }) => (
                  <div className="w-full overflow-x-auto my-6 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] print:border-gray-300 print:bg-transparent print:shadow-none">
                    <table className="w-full text-sm text-left border-collapse" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] border-b border-[var(--color-border)] print:bg-gray-100 print:text-black print:border-gray-300" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="px-4 py-3 font-semibold whitespace-nowrap text-[13px]" {...props} />
                ),
                tbody: ({ node, ...props }) => (
                  <tbody className="divide-y divide-[var(--color-border)] print:divide-gray-200" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="px-4 py-3 align-top leading-relaxed text-[var(--color-text-secondary)] print:text-black min-w-[120px] text-[13px]" {...props} />
                ),
                pre: ({ node, children, ...props }) => (
                  <div className="relative my-6 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden print:bg-gray-50 print:border-gray-300">
                    <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)] flex items-center justify-between">
                       <div className="flex gap-1.5">
                         <div className="w-3 h-3 rounded-full bg-[var(--color-border-subtle)]"></div>
                         <div className="w-3 h-3 rounded-full bg-[var(--color-border-subtle)]"></div>
                         <div className="w-3 h-3 rounded-full bg-[var(--color-border-subtle)]"></div>
                       </div>
                    </div>
                    <pre className="p-4 overflow-x-auto m-0 bg-transparent text-[13px] font-mono text-[var(--color-text-primary)] print:text-black" {...props}>
                      {children}
                    </pre>
                  </div>
                ),
                code: ({ node, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match && !String(children).includes("\n");
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 mx-0.5 rounded-[4px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[13px] font-mono text-[var(--color-text-secondary)] print:bg-gray-100 print:text-black" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={`font-mono text-[13px] text-[var(--color-text-primary)] ${className || ""}`} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {section.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer — actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[var(--color-border)] no-print">
          <button 
            className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none" 
            onClick={copySection}
            aria-label={language === "en" ? "Copy section" : "Salin bagian"}
          >
            <ClipboardCopy size={14} strokeWidth={1.5} /> {language === "en" ? "Copy" : "Salin"}
          </button>
          <button 
            className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
            onClick={onOpenFeedback}
            aria-label={language === "en" ? "Open feedback" : "Buka umpan balik"}
          >
            <MessageSquareText size={14} strokeWidth={1.5} /> {language === "en" ? "Feedback" : "Umpan Balik"}
          </button>
        </div>
      </div>
    </div>
  );
});

function FeedbackCard({
  section,
  comment,
  onCommentChange,
  language,
}: {
  section: Section;
  comment: string;
  onCommentChange: (text: string) => void;
  language: "id" | "en";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempComment, setTempComment] = useState(comment);

  useEffect(() => {
    setTempComment(comment);
  }, [comment]);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[8px] p-4 text-left">
      <div className="font-medium text-[13px] text-[var(--color-text-primary)] mb-2 truncate" title={section.heading}>
        {section.heading}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2 mt-2">
          <textarea
            autoFocus
            value={tempComment}
            onChange={(e) => setTempComment(e.target.value)}
            className="flex-grow w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] p-3 rounded-[6px] focus:outline-none focus:border-[var(--color-interactive)] transition-all duration-200 ease min-h-[100px] resize-y"
            aria-label={language === "en" ? "Feedback for section" : "Umpan balik untuk bagian"}
            placeholder={
              language === "en"
                ? "Add your feedback here..."
                : "Tuliskan revisi kamu di sini..."
            }
          />
          <div className="flex gap-2 justify-end mt-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setTempComment(comment);
              }}
              className="px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-all duration-200 ease rounded-[6px] font-medium"
            >
              {language === "en" ? "Cancel" : "Batal"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                onCommentChange(tempComment);
              }}
              className="px-3 py-1.5 text-[13px] bg-[var(--color-text-primary)] text-[var(--color-bg)] font-medium rounded-[6px] hover:bg-[var(--color-text-primary)] transition-all duration-200 ease"
            >
              {language === "en" ? "Save" : "Simpan"}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className={`text-[13px] rounded-[6px] transition-all duration-200 ease cursor-pointer border mt-2 ${
            comment 
              ? "text-[#cccccc] p-3 bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-text-muted)]" 
              : "text-[var(--color-text-muted)] p-3 border-dashed border-[var(--color-border)] bg-transparent hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          {comment ? (
            <div className="whitespace-pre-wrap leading-[1.6]">{comment}</div>
          ) : (
             language === "en"
                ? "Click to add revision notes..."
                : "Klik untuk tambah revisi..."
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 no-print w-full">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[8px] overflow-hidden mb-4 animate-pulse">
          <div className="h-[48px] bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)] flex items-center px-5">
            <div className="w-4 h-4 rounded bg-[var(--color-border-subtle)] mr-3" />
            <div className="h-4 bg-[var(--color-border-subtle)] rounded w-1/3" />
          </div>
          <div className="p-5 space-y-3">
            <div className="h-3 bg-[var(--color-surface-elevated)] rounded w-full" />
            <div className="h-3 bg-[var(--color-surface-elevated)] rounded w-3/4" />
            <div className="h-3 bg-[var(--color-surface-elevated)] rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}


