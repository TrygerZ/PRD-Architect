import { motion } from "motion/react";
import { getQuickPrompts } from "../utils/quickPrompts";
import { PRDMode } from "../types";
import { Briefcase, Code } from "lucide-react";

interface WelcomeScreenProps {
  language: "en" | "id";
  onQuickPrompt: (text: string) => void;
  prdMode: PRDMode;
  onChangeMode: (mode: PRDMode) => void;
}

export function WelcomeScreen({ language, onQuickPrompt, prdMode, onChangeMode }: WelcomeScreenProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center flex-1 h-full pt-[5vh] sm:pt-[10vh]">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center w-full max-w-[640px]"
      >
        <h1 className="text-[36px] sm:text-[48px] font-[700] text-[#f5f5f5] mb-2 tracking-tight">
          PRD Architect
        </h1>
        <p className="text-[15px] text-[#999999]">
          {language === "en" 
            ? "Describe your product. Get a comprehensive, enterprise-grade PRD."
            : "Jelaskan produk Anda. Dapatkan PRD komprehensif tingkat enterprise."}
        </p>
        <div className="w-12 h-[2px] bg-[#333333] mx-auto my-6"></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left w-full px-4 sm:px-0 mx-auto">
          <button 
            type="button"
            onClick={() => onChangeMode("business")}
            className={`p-4 rounded-xl border flex flex-col gap-1 transition-all duration-300 ${
              prdMode === "business" 
                ? "bg-[#112233]/40 border-[#4466ff] shadow-[0_0_15px_rgba(68,102,255,0.15)]" 
                : "bg-[#1a1a1a] border-[#333333] hover:bg-[#222222] opacity-80"
            }`}
          >
            <span className={`text-[15px] font-semibold flex items-center justify-center gap-2 ${prdMode === "business" ? "text-white" : "text-[#aaaaaa]"}`}>
              <Briefcase className="w-4 h-4" />
              Business & Investor Mode
            </span>
            <span className="text-[13px] text-[#888888]">
              {language === "en" ? "Focus on business metrics, ROI, and GTM roadmap" : "Fokus pada metrik bisnis, ROI, dan GTM roadmap"}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => onChangeMode("technical")}
            className={`p-4 rounded-xl border flex flex-col gap-1 transition-all duration-300 ${
              prdMode === "technical" 
                ? "bg-[#221133]/40 border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
                : "bg-[#1a1a1a] border-[#333333] hover:bg-[#222222] opacity-80"
            }`}
          >
            <span className={`text-[15px] font-semibold flex items-center justify-center gap-2 ${prdMode === "technical" ? "text-white" : "text-[#aaaaaa]"}`}>
              <Code className="w-4 h-4" />
              AI Agent & Developer Mode
            </span>
            <span className="text-[13px] text-[#888888]">
              {language === "en" ? "Focus on database schemas, API payloads, and architecture" : "Fokus pada skema database, payload API, dan arsitektur"}
            </span>
          </button>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.05 } }
        }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-[640px] px-4 sm:px-0 mt-2"
      >
        {getQuickPrompts(language).map((qp) => {
          const Icon = qp.icon;
          return (
            <motion.button
              key={qp.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
              }}
              type="button"
              onClick={() => onQuickPrompt(qp.text)}
              className="flex flex-col items-center justify-center text-center p-3 sm:p-4 border border-[#2a2a2a] rounded-[8px] bg-transparent text-[#999999] hover:bg-[#222222] hover:border-[#555555] hover:text-[#f5f5f5] transition-all duration-200"
            >
              <Icon size={16} strokeWidth={1.5} className="mb-2 text-[#555555] group-hover:text-[#999999]" />
              <span className="text-[13px] leading-[1.3]">{qp.label}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
