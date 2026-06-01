import { useState, useEffect } from "react";
import { motion } from "motion/react";
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

interface BlueprintSheetProps {
  content: string; // active version content
  comments?: Record<string, string>;
  isToCOpen?: boolean;
  setIsToCOpen?: (open: boolean) => void;
  onCommentChange?: (sectionId: string, comment: string) => void;
  versions?: PRDVersion[];
  activeVersionId?: string | null;
  onSwitchVersion?: (versionId: string) => void;
  onRevise?: () => void;
  isGenerating?: boolean;
  language: "id" | "en";
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
  let currentLevel = 0;
  let currentHeading = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{2})\s+(.*)/);

    if (match) {
      if (currentContent.length > 0) {
        sections.push({
          index: sections.length,
          level: 2,
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
      }
      currentHeading = match[2];
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      index: sections.length,
      level: 2,
      heading: currentHeading,
      content: currentContent.join("\n"),
    });
  }

  return sections.filter((s) => s.heading.trim().length > 0);
};

export function BlueprintSheet({
  content,
  comments = {},
  isToCOpen,
  setIsToCOpen,
  onCommentChange,
  versions = [],
  activeVersionId,
  onSwitchVersion,
  onRevise,
  isGenerating,
  language,
}: BlueprintSheetProps) {
  const sections = getSections(content);
  const totalComments = Object.values(comments).filter(
    (c) => c.trim().length > 0,
  ).length;

  const [isFeedbackDrawerOpen, setIsFeedbackDrawerOpen] = useState(false);
  const [collapsedStates, setCollapsedStates] = useState<Record<string, boolean>>({});

  // Close drawers on click outside or escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isToCOpen && setIsToCOpen) setIsToCOpen(false);
        if (isFeedbackDrawerOpen) setIsFeedbackDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isToCOpen, isFeedbackDrawerOpen, setIsToCOpen]);

  // Track progress
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const headings = Array.from(document.querySelectorAll("[data-prd-content] h2"));
      let currentIdx = 0;
      for (let i = 0; i < headings.length; i++) {
        const rect = headings[i].getBoundingClientRect();
        if (rect.top <= 100) {
          currentIdx = i;
        }
      }
      setActiveSectionIdx(currentIdx);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  const activeVersion = versions.find(v => v.id === activeVersionId) || versions[versions.length - 1];
  const activeVersionIndex = activeVersion ? versions.findIndex(v => v.id === activeVersion.id) : 0;
  
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(language === "en" ? "en-US" : "id-ID", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const expandedCount = sections.filter((_, i) => !collapsedStates[`sec_${i}`]).length;
  const totalSections = sections.length;
  const progress = totalSections > 0 ? (expandedCount / totalSections) * 100 : 0;

  const toggleSection = (sectionId: string) => {
    setCollapsedStates(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  return (
    <div className="w-full mx-auto relative z-10 print:block print:w-full print:max-w-full print:bg-white print:text-black">
      {/* Hidden container for full PRD print export */}
      <div id="prd-print-only" style={{ display: "none" }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>

      {/* Floating TOC Pane */}
      <div
        className={`fixed top-14 left-0 bottom-0 w-[240px] bg-[#1a1a1a] border-r border-[#2a2a2a] z-20 overflow-y-auto transform transition-transform duration-200 ease no-print ${
          isToCOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 pt-6">
          <h3 className="text-[13px] font-semibold text-[#f5f5f5] mb-4 font-body opacity-60 uppercase tracking-widest">
            {language === "en" ? "Contents" : "Daftar Isi"}
          </h3>
          <nav className="flex flex-col gap-1.5">
            {sections.map((sec, idx) => (
              <a
                key={idx}
                href={`#sec_${idx}`}
                onClick={() => {
                  if (setIsToCOpen && window.innerWidth < 1024) setIsToCOpen(false);
                }}
                className={`py-1.5 px-3 rounded-[6px] text-[13px] transition-all duration-200 ease font-body whitespace-nowrap overflow-hidden text-ellipsis ${
                  activeSectionIdx === idx
                    ? "text-[#f5f5f5] bg-[#2a2a2a] font-medium"
                    : "text-[#999999] hover:text-[#f5f5f5] hover:bg-[#222222]"
                }`}
              >
                {sec.heading}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Invisible Hover zone for ToC toggle */}
      <div 
        className="fixed left-0 top-14 w-4 h-full z-[19] cursor-pointer hidden lg:block" 
        onMouseEnter={() => setIsToCOpen && setIsToCOpen(true)} 
      />

      {/* FAB button */}
      <button
        onClick={() => setIsFeedbackDrawerOpen(!isFeedbackDrawerOpen)}
        className={`fixed bottom-[100px] right-[40px] z-[40] w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all duration-200 ease shadow-lg no-print ${
          isFeedbackDrawerOpen 
            ? "bg-[#2a2a2a] text-[#f5f5f5]" 
            : "bg-[#f5f5f5] hover:bg-[#e5e5e5] text-[#111111]"
        }`}
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
        className={`fixed top-14 right-0 bottom-0 w-[400px] max-w-[100vw] bg-[#1a1a1a] border-l border-[#2a2a2a] z-30 transition-transform duration-200 ease overflow-y-auto no-print ${
          isFeedbackDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#2a2a2a]">
            <h2 className="text-[18px] font-semibold text-[#f5f5f5] font-body flex items-center gap-2">
              <MessageSquareText size={16} strokeWidth={1.5} className="text-[#999999]" />
              {language === "en" ? "Feedback" : "Umpan Balik"}
            </h2>
            <button
              onClick={onRevise}
              disabled={isGenerating || totalComments === 0}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-all duration-200 ease flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                totalComments > 0 
                  ? "bg-[#f5f5f5] text-[#111111] hover:bg-[#e5e5e5]" 
                  : "bg-transparent text-[#555555]"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} strokeWidth={1.5} />
              <span className="hidden sm:inline font-body">
                {language === "en" ? "Regenerate" : "Buat Ulang"}
              </span>
            </button>
          </div>

          <div className="space-y-4">
            {sections.map((section, index) => {
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
              <GitBranch size={14} strokeWidth={1.5} className="text-[#555555]" />
              <span className="text-[13px] text-[#999999]">Version {activeVersionIndex + 1}</span>
              <span className="text-[11px] font-mono text-[#555555]">{formatDate(activeVersion.timestamp)}</span>
            </div>
            <div className="flex items-center gap-2">
              <select 
                className="bg-transparent text-[13px] text-[#999999] border border-[#2a2a2a] rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#6666ff]"
                value={activeVersionId || ""}
                onChange={(e) => onSwitchVersion?.(e.target.value)}
              >
                {versions.map((v, i) => (
                  <option key={v.id} value={v.id} className="bg-[#111111] text-[#f5f5f5]">Version {i + 1}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Progress Bar Header */}
          {sections.length > 0 && (
            <div className="flex items-center gap-4 px-1 mb-6">
              <div className="flex-1 h-[2px] bg-[#2a2a2a] rounded overflow-hidden">
                <div className="h-full bg-[#6666ff] transition-all duration-300" style={{width: `${progress}%`}} />
              </div>
              <span className="text-[11px] font-mono text-[#555555] whitespace-nowrap">
                {expandedCount} / {totalSections} sections
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
            const sectionId = `sec_${index}`;
            return (
              <SheetSection
                key={sectionId}
                section={section}
                sectionId={sectionId}
                index={index}
                total={sections.length}
                isCollapsed={collapsedStates[sectionId] || false}
                onToggleCollapse={() => toggleSection(sectionId)}
                isGenerating={isGenerating}
                language={language}
                onOpenFeedback={() => setIsFeedbackDrawerOpen(true)}
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
  onToggleCollapse: () => void;
  isGenerating?: boolean;
  language: "id" | "en";
  onOpenFeedback: () => void;
}) {
  
  const copySection = () => {
    navigator.clipboard.writeText(section.heading + "\n\n" + section.content);
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] overflow-hidden mb-4 print:bg-transparent print:border-none print:shadow-none print:p-0">
      {/* Header — click to collapse */}
      <div 
        className={`flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] cursor-pointer select-none transition-colors no-print ${isCollapsed ? 'bg-[#1a1a1a] hover:bg-[#222222]' : 'bg-[#222222] hover:bg-[#2a2a2a]'}`}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={`w-4 h-4 text-[#555555] transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} strokeWidth={1.5} />
          <h2 className="text-[#f5f5f5] text-[14px] font-semibold">{section.heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#555555]">{index + 1}/{total}</span>
        </div>
      </div>

      {/* Content — collapsible */}
      <div className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-[8000px]'} print:max-h-none`}>
        <div className="px-5 py-4">
          <div
            id={sectionId}
            className="w-full prose prose-invert max-w-none 
              prose-headings:font-body prose-headings:font-normal prose-headings:text-[#f5f5f5]
              prose-h1:font-display prose-h1:text-[36px] sm:prose-h1:text-[48px] prose-h1:mt-8 prose-h1:mb-4 prose-h1:leading-[1.15]
              prose-h2:hidden
              prose-h3:text-[18px] prose-h3:mt-8 prose-h3:font-semibold
              prose-p:text-[#999999] prose-p:text-[15px] prose-p:leading-[1.6] prose-p:mb-4
              prose-a:text-[#6666ff] hover:prose-a:text-[#8888ff] prose-a:no-underline transition-colors
              prose-li:text-[#999999] prose-li:text-[15px] prose-li:my-1
              prose-strong:text-[#f5f5f5] prose-strong:font-medium
              prose-ul:pl-6 prose-ul:mb-6 prose-ol:pl-6 prose-ol:mb-6
              prose-hr:border-[#2a2a2a] prose-hr:my-8
              prose-blockquote:border-l-2 prose-blockquote:border-[#555555] prose-blockquote:pl-4 prose-blockquote:text-[#555555]
              print:prose-p:text-black print:prose-li:text-black print:prose-headings:text-black print:prose-strong:text-black
            "
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: () => null, // h2 is already displayed in the card header
                h3: ({node, children, ...props}) => (
                  <h3 className="relative group/h3" {...props}>
                    {children}
                  </h3>
                ),
                table: ({ node, ...props }) => (
                  <div className="w-full overflow-x-auto my-6 rounded-[8px] border border-[#2a2a2a] bg-[#1a1a1a] print:border-gray-300 print:bg-transparent print:shadow-none">
                    <table className="w-full text-sm text-left border-collapse" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-[#222222] text-[#f5f5f5] border-b border-[#2a2a2a] print:bg-gray-100 print:text-black print:border-gray-300" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="px-4 py-3 font-semibold whitespace-nowrap text-[13px] font-body" {...props} />
                ),
                tbody: ({ node, ...props }) => (
                  <tbody className="divide-y divide-[#2a2a2a] print:divide-gray-200" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="px-4 py-3 align-top leading-relaxed text-[#999999] print:text-black min-w-[120px] text-[13px]" {...props} />
                ),
                pre: ({ node, children, ...props }) => (
                  <div className="relative my-6 rounded-[8px] border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden print:bg-gray-50 print:border-gray-300">
                    <div className="px-4 py-2 border-b border-[#2a2a2a] bg-[#222222] flex items-center justify-between">
                       <div className="flex gap-1.5">
                         <div className="w-3 h-3 rounded-full bg-[#333333]"></div>
                         <div className="w-3 h-3 rounded-full bg-[#333333]"></div>
                         <div className="w-3 h-3 rounded-full bg-[#333333]"></div>
                       </div>
                    </div>
                    <pre className="p-4 overflow-x-auto m-0 bg-transparent text-[13px] font-mono text-[#f5f5f5] print:text-black" {...props}>
                      {children}
                    </pre>
                  </div>
                ),
                code: ({ node, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match && !String(children).includes("\n");
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 mx-0.5 rounded-[4px] bg-[#222222] border border-[#2a2a2a] text-[13px] font-mono text-[#cccccc] print:bg-gray-100 print:text-black" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={`font-mono text-[13px] text-[#f5f5f5] ${className || ""}`} {...props}>
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
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#2a2a2a] no-print">
          <button 
            className="text-[12px] text-[#555555] hover:text-[#999999] transition-colors flex items-center gap-1.5" 
            onClick={copySection}
          >
            <ClipboardCopy size={14} strokeWidth={1.5} /> {language === "en" ? "Copy" : "Salin"}
          </button>
          <button 
            className="text-[12px] text-[#555555] hover:text-[#999999] transition-colors flex items-center gap-1.5"
            onClick={onOpenFeedback}
          >
            <MessageSquareText size={14} strokeWidth={1.5} /> Feedback
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] p-4 text-left">
      <div className="font-medium text-[13px] text-[#f5f5f5] mb-2 truncate font-body" title={section.heading}>
        {section.heading}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2 mt-2">
          <textarea
            autoFocus
            value={tempComment}
            onChange={(e) => setTempComment(e.target.value)}
            className="flex-grow w-full bg-[#111111] border border-[#2a2a2a] text-[#f5f5f5] text-[13px] p-3 rounded-[6px] focus:outline-none focus:border-[#6666ff] transition-all duration-200 ease min-h-[100px] resize-y font-body"
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
              className="px-3 py-1.5 text-[13px] text-[#999999] hover:text-[#f5f5f5] hover:bg-[#2a2a2a] transition-all duration-200 ease rounded-[6px] font-medium"
            >
              {language === "en" ? "Cancel" : "Batal"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                onCommentChange(tempComment);
              }}
              className="px-3 py-1.5 text-[13px] bg-[#f5f5f5] text-[#111111] font-medium rounded-[6px] hover:bg-[#e5e5e5] transition-all duration-200 ease"
            >
              {language === "en" ? "Save" : "Simpan"}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className={`text-[13px] rounded-[6px] transition-all duration-200 ease cursor-pointer border mt-2 font-body ${
            comment 
              ? "text-[#cccccc] p-3 bg-[#111111] border-[#2a2a2a] hover:border-[#555555]" 
              : "text-[#555555] p-3 border-dashed border-[#2a2a2a] bg-transparent hover:border-[#555555] hover:text-[#999999]"
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
        <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] overflow-hidden mb-4 animate-pulse">
          <div className="h-[48px] bg-[#222222] border-b border-[#2a2a2a] flex items-center px-5">
            <div className="w-4 h-4 rounded bg-[#333333] mr-3" />
            <div className="h-4 bg-[#333333] rounded w-1/3" />
          </div>
          <div className="p-5 space-y-3">
            <div className="h-3 bg-[#222222] rounded w-full" />
            <div className="h-3 bg-[#222222] rounded w-3/4" />
            <div className="h-3 bg-[#222222] rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}


