import { motion } from "motion/react";
import { ProductType } from "../types";

interface SystemSchematicProps {
  productType: ProductType;
  isGenerating: boolean;
}

export function SystemSchematic({
  productType,
  isGenerating,
}: SystemSchematicProps) {
  // A dynamic SVG that pulses and looks cyber-like
  return (
    <div className="w-full max-w-4xl mx-auto mb-10 opacity-70 no-print isolate mix-blend-screen pointer-events-none">
      <svg viewBox="0 0 800 200" className="w-full text-cyber-accent">
        <defs>
          <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop
              offset="0%"
              stopColor="var(--color-cyber-accent)"
              stopOpacity="0.1"
            />
            <stop
              offset="50%"
              stopColor="var(--color-cyber-accent)"
              stopOpacity="0.8"
            />
            <stop
              offset="100%"
              stopColor="var(--color-cyber-accent)"
              stopOpacity="0.1"
            />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base Grid */}
        <path
          d="M0,100 L800,100"
          stroke="currentColor"
          fill="none"
          strokeWidth="0.5"
          strokeDasharray="4 4"
          opacity="0.5"
        />
        <path
          d="M400,0 L400,200"
          stroke="currentColor"
          fill="none"
          strokeWidth="0.5"
          strokeDasharray="4 4"
          opacity="0.5"
        />

        {/* Animated Data Line */}
        <motion.path
          d="M 50,100 C 150,100 200,50 300,50 S 450,150 550,150 S 650,100 750,100"
          fill="none"
          stroke="url(#cyberGrad)"
          strokeWidth="3"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: isGenerating ? [0, 1, 0] : 1,
            opacity: 1,
            pathOffset: isGenerating ? [0, 1] : 0,
          }}
          transition={{
            duration: isGenerating ? 2 : 1,
            repeat: isGenerating ? Infinity : 0,
            ease: "easeInOut",
          }}
        />

        {/* Nodes */}
        <circle
          cx="300"
          cy="50"
          r="4"
          fill="currentColor"
          opacity="0.8"
          filter="url(#glow)"
        />
        <circle
          cx="550"
          cy="150"
          r="4"
          fill="currentColor"
          opacity="0.8"
          filter="url(#glow)"
        />

        {/* Dynamic Label */}
        <text
          x="310"
          y="45"
          fill="currentColor"
          fontSize="10"
          fontFamily="monospace"
          opacity="0.8"
        >
          {isGenerating
            ? "PROCESSING_DATA_NODE"
            : `SYS_${productType.replace(" ", "_").toUpperCase()}`}
        </text>
        <text
          x="560"
          y="145"
          fill="currentColor"
          fontSize="10"
          fontFamily="monospace"
          opacity="0.8"
        >
          ARCHITECT_NODE_OK
        </text>
      </svg>
    </div>
  );
}
