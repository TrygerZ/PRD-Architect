import { FileText, MessageSquareText } from "lucide-react";
import { PRDVersion } from "../types";

interface SidebarProps {
  versions: PRDVersion[];
  activeVersionId: string | null;
  onSwitchVersion: (id: string) => void;
  onNewPRD: () => void;
  language: "id" | "en";
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  versions,
  activeVersionId,
  onSwitchVersion,
  onNewPRD,
  language,
  isOpen,
  onClose,
}: SidebarProps) {
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(language === "en" ? "en-US" : "id-ID", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div 
      className={`${isOpen ? "w-[280px] sm:w-[320px]" : "w-[280px] sm:w-[320px]"} h-full bg-[#1a1a1a] border-r border-[#2a2a2a] overflow-y-auto shrink-0 transition-transform duration-200 ease-in-out flex flex-col ${isOpen ? "absolute z-40 lg:relative translate-x-0" : "-translate-x-full fixed lg:relative lg:translate-x-0 lg:block hidden"}`}
    >
      <button 
        onClick={onNewPRD}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-[#2a2a2a] text-[#f5f5f5] hover:bg-[#222222] transition-all duration-200 text-[14px] font-medium"
      >
        <FileText size={16} strokeWidth={1.5} />
        {language === "en" ? "+ New PRD" : "+ PRD Baru"}
      </button>

      <div className="px-4 py-2 mt-2 text-[11px] font-mono text-[#555555] uppercase tracking-wider">
        {language === "en" ? "History" : "Riwayat"}
      </div>

      {versions.length === 0 ? (
        <div className="p-6 text-center">
          <MessageSquareText size={24} strokeWidth={1.5} className="text-[#555555] mx-auto mb-3" />
          <p className="text-[13px] text-[#555555]">
            {language === "en" ? "No PRD generated yet" : "Belum ada PRD yang di-generate"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col mt-2">
          {[...versions].reverse().map((v, i) => (
            <div
              key={v.id}
              className="px-4 py-3 border-b border-[#2a2a2a] cursor-pointer hover:bg-[#222222] transition-all duration-200"
              onClick={() => onSwitchVersion(v.id)}
              style={{
                background: v.id === activeVersionId ? '#222222' : 'transparent',
                borderLeft: v.id === activeVersionId ? '2px solid #6666ff' : '2px solid transparent'
              }}
            >
              <div className="text-[13px] font-medium text-[#f5f5f5]">
                {language === "en" ? `Version ${versions.length - i}` : `Versi ${versions.length - i}`}
              </div>
              <div className="text-[11px] text-[#555555] font-mono mt-1">
                {formatDate(v.timestamp)}
              </div>
              <div className="text-[11px] text-[#555555] mt-0.5 truncate">
                {v.prompt ? (v.prompt.length > 60 ? v.prompt.slice(0, 60) + '...' : v.prompt) : (v.productType !== "Unknown" ? v.productType : "Draft")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
