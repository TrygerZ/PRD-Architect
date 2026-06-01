import { motion } from "motion/react";
import { ShoppingCart, Smartphone, BarChart3, HeartPulse } from "lucide-react";

interface WelcomeScreenProps {
  language: "en" | "id";
  onQuickPrompt: (text: string) => void;
}

const getQuickPrompts = (language: "en" | "id") => [
  { 
    id: 1, label: "E-Commerce", icon: ShoppingCart,
    text: language === "en" 
      ? "Create a PRD for an e-commerce app selling local fashion products" 
      : "Buat PRD untuk aplikasi e-commerce yang menjual produk fashion lokal"
  },
  { 
    id: 2, label: "Mobile POS", icon: Smartphone,
    text: language === "en"
      ? "Create a PRD for a mobile POS app for micro-businesses"
      : "Buat PRD untuk aplikasi POS mobile untuk UMKM"
  },
  { 
    id: 3, label: "SaaS", icon: BarChart3,
    text: language === "en"
      ? "Create a PRD for a B2B SaaS analytics dashboard"
      : "Buat PRD untuk dashboard analytics SaaS B2B"
  },
  { 
    id: 4, label: "HealthTech", icon: HeartPulse,
    text: language === "en"
      ? "Create a PRD for a telemedicine application"
      : "Buat PRD untuk aplikasi telemedicine"
  },
];

export function WelcomeScreen({ language, onQuickPrompt }: WelcomeScreenProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center flex-1 h-full pt-[10vh]">
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
