import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  GitBranch,
  RefreshCw,
  ChevronDown,
  MessageSquareText,
  X
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
    const match = line.match(/^(#{1,2})\s+(.*)/);

    if (match) {
      if (currentContent.length > 0) {
        sections.push({
          index: sections.length,
          level: currentLevel,
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
      }
      currentLevel = match[1].length;
      currentHeading = match[2];
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      index: sections.length,
      level: currentLevel,
      heading: currentHeading,
      content: currentContent.join("\n"),
    });
  }

  return sections.filter((s) => s.content.trim().length > 0);
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
      const headings = Array.from(document.querySelectorAll("h2"));
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

  const progressPercentage = sections.length > 0 ? Math.round(((activeSectionIdx + 1) / sections.length) * 100) : 0;

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
          <h3 className="text-[13px] font-semibold text-[#f5f5f5] mb-4 font-body opacity-60 uppercase tracking-widest hidden">
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
        className="fixed left-0 top-14 w-4 h-full z-19 cursor-pointer hidden lg:block" 
        onMouseEnter={() => setIsToCOpen && setIsToCOpen(true)} 
      />

      {/* FAB button */}
      <button
        onClick={() => setIsFeedbackDrawerOpen(!isFeedbackDrawerOpen)}
        className={`fixed bottom-6 right-[24px] z-40 w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all duration-200 ease shadow-lg no-print ${
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

      {/* Section Progress */}
      {sections.length > 0 && !isGenerating && (
        <div className="fixed bottom-20 right-[24px] z-35 flex flex-col items-end gap-1.5 no-print font-mono text-[13px] text-[#555555]">
          <span>{String(activeSectionIdx + 1).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}</span>
          <div className="w-[48px] h-[2px] bg-[#2a2a2a] rounded overflow-hidden">
            <div 
              className="h-full bg-[#555555] transition-all duration-300 ease"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

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

      {/* Version Control Panel */}
      {versions.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 bg-transparent border-b border-[#2a2a2a] pb-4 no-print relative">
          <div className="flex items-center gap-3">
            <GitBranch className="w-4 h-4 text-[#555555]" strokeWidth={1.5} />
            <div className="relative border-r border-[#2a2a2a] pr-4">
              <select
                value={activeVersionId || ""}
                onChange={(e) => onSwitchVersion?.(e.target.value)}
                disabled={isGenerating}
                className="appearance-none bg-transparent rounded-[6px] pr-8 py-1.5 text-[13px] font-medium text-[#999999] hover:text-[#f5f5f5] focus:text-[#f5f5f5] transition-colors focus:outline-none cursor-pointer min-w-32 max-w-48 font-body"
              >
                {versions.map((v, i) => (
                  <option key={v.id} value={v.id} className="bg-[#111111] text-[#f5f5f5]">
                    Version {i + 1} - {new Date(v.timestamp).toLocaleTimeString()}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#555555] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
            </div>
            {versions.find((v) => v.id === activeVersionId)
              ?.referencedFilesCount ? (
              <div className="text-[13px] text-[#555555] font-mono">
                {versions.find((v) => v.id === activeVersionId)?.referencedFilesCount} {language === "en" ? "file(s)" : "file"}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!content && isGenerating ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => {
            const sectionId = `sec_${index}`;
            return (
              <SheetSection
                key={sectionId}
                section={section}
                sectionId={sectionId}
                index={index}
                total={sections.length}
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
  isGenerating,
  language,
  onOpenFeedback,
}: {
  section: Section;
  sectionId: string;
  index: number;
  total: number;
  isGenerating?: boolean;
  language: "id" | "en";
  onOpenFeedback: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative group/section pb-6 print:break-inside-avoid print:bg-transparent print:border-none print:shadow-none print:p-0"
    >
      <div
        id={sectionId}
        className="w-full prose prose-invert max-w-none 
          prose-headings:font-body prose-headings:font-normal prose-headings:text-[#f5f5f5]
          prose-h1:font-display prose-h1:text-[36px] sm:prose-h1:text-[48px] prose-h1:mt-8 prose-h1:mb-4 prose-h1:leading-[1.15]
          prose-h2:text-[24px] prose-h2:mt-4 prose-h2:mb-6 prose-h2:leading-[1.4]
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
            h1: ({node, ...props}) => <h1 className="" {...props} />,
            h2: ({node, children, ...props}) => (
              <h2 className="relative group/h2" {...props}>
                <a href={`#${sectionId}`} className="anchor-link">#</a>
                {children}
                <button 
                  onClick={onOpenFeedback}
                  className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover/h2:opacity-100 transition-opacity text-[#555555] hover:text-[#999999] p-1.5"
                  title={language === "en" ? "Add comment" : "Tambah Komentar"}
                >
                  <MessageSquareText size={16} strokeWidth={1.5} />
                </button>
              </h2>
            ),
            h3: ({node, children, ...props}) => (
              <h3 className="relative group/h3" {...props}>
                {children}
                <button 
                  onClick={onOpenFeedback}
                  className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover/h3:opacity-100 transition-opacity text-[#555555] hover:text-[#999999] p-1.5"
                  title={language === "en" ? "Add comment" : "Tambah Komentar"}
                >
                  <MessageSquareText size={14} strokeWidth={1.5} />
                </button>
              </h3>
            ),
            p: ({node, children, ...props}: any) => {
              return <p {...props}>{children}</p>;
            },
            table: ({ node, ...props }) => (
              <div className="w-full overflow-x-auto my-6 rounded-[8px] border border-[#2a2a2a] bg-[#1a1a1a] print:border-gray-300 print:bg-transparent print:shadow-none">
                <table
                  className="w-full text-sm text-left border-collapse"
                  {...props}
                />
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead
                className="bg-[#222222] text-[#f5f5f5] border-b border-[#2a2a2a] print:bg-gray-100 print:text-black print:border-gray-300"
                {...props}
              />
            ),
            th: ({ node, ...props }) => (
              <th
                className="px-4 py-3 font-semibold whitespace-nowrap text-[13px] font-body"
                {...props}
              />
            ),
            tbody: ({ node, ...props }) => (
              <tbody
                className="divide-y divide-[#2a2a2a] print:divide-gray-200"
                {...props}
              />
            ),
            tr: ({ node, ...props }) => (
              <tr {...props} />
            ),
            td: ({ node, ...props }) => (
              <td
                className="px-4 py-3 align-top leading-relaxed text-[#999999] print:text-black max-w-xs break-words text-[13px]"
                {...props}
              />
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
                <pre
                  className="p-4 overflow-x-auto m-0 bg-transparent text-[13px] font-mono text-[#f5f5f5] print:text-black"
                  {...props}
                >
                  {children}
                </pre>
              </div>
            ),
            code: ({ node, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !match && !String(children).includes("\n");
              if (isInline) {
                return (
                  <code
                    className="px-1.5 py-0.5 mx-0.5 rounded-[4px] bg-[#222222] border border-[#2a2a2a] text-[13px] font-mono text-[#cccccc] print:bg-gray-100 print:text-black"
                    {...props}
                  >
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

      {index < total - 1 && (
        <div className="relative mt-[32px] mb-[32px] h-[1px] bg-[#2a2a2a] no-print">
        </div>
      )}
    </motion.div>
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
    <div className="space-y-16 no-print w-full mt-8">
      {/* Skeleton for Title / Intro */}
      <div className="flex flex-col gap-6 w-full">
        <div className="h-[48px] bg-[#1a1a1a] rounded-[8px] w-3/4 animate-pulse"></div>
        <div className="space-y-4">
          <div className="h-4 bg-[#1a1a1a] rounded-[4px] w-full animate-pulse"></div>
          <div className="h-4 bg-[#1a1a1a] rounded-[4px] w-[95%] animate-pulse"></div>
          <div className="h-4 bg-[#1a1a1a] rounded-[4px] w-[90%] animate-pulse"></div>
        </div>
      </div>

      <div className="w-full h-[1px] bg-[#2a2a2a] my-12" />

      {/* Skeleton for Content sections */}
      {[1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-6 w-full"
        >
          <div className="h-[32px] bg-[#1a1a1a] rounded-[6px] w-1/3 animate-pulse"></div>
          <div className="space-y-4">
             <div className="h-4 bg-[#1a1a1a] rounded-[4px] w-full animate-pulse"></div>
             <div className="h-4 bg-[#1a1a1a] rounded-[4px] w-[90%] animate-pulse"></div>
             <div className="h-4 bg-[#1a1a1a] rounded-[4px] w-[85%] animate-pulse"></div>
             <div className="h-4 bg-[#1a1a1a] rounded-[4px] w-[60%] animate-pulse"></div>
          </div>
          
          <div className="w-full h-[150px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] animate-pulse mt-4" />
        </div>
      ))}
    </div>
  );
}

