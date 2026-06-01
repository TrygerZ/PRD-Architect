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
  return (
    <div className="w-full max-w-4xl mx-auto mb-10 opacity-70 no-print isolate pointer-events-none">
      <svg viewBox="0 0 800 200" className="w-full">
        {/* Base Grid */}
        <path
          d="M0,100 L800,100"
          stroke="#333333"
          fill="none"
          strokeWidth="0.5"
          strokeDasharray="4 4"
          opacity="0.3"
        />
        <path
          d="M400,0 L400,200"
          stroke="#333333"
          fill="none"
          strokeWidth="0.5"
          strokeDasharray="4 4"
          opacity="0.3"
        />

        {/* Animated Data Line */}
        <motion.path
          d="M 50,100 C 150,100 200,50 300,50 S 450,150 550,150 S 650,100 750,100"
          fill="none"
          stroke="#555555"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: isGenerating ? [0, 1, 0] : 1,
            opacity: isGenerating ? [0.2, 0.8, 0.2] : 0.8,
            pathOffset: isGenerating ? [0, 1] : 0,
          }}
          transition={{
            duration: isGenerating ? 3 : 1,
            repeat: isGenerating ? Infinity : 0,
            ease: "easeInOut",
          }}
        />

        {/* Nodes */}
        <circle
          cx="300"
          cy="50"
          r="4"
          fill="#555555"
          opacity="0.8"
        />
        <circle
          cx="550"
          cy="150"
          r="4"
          fill="#555555"
          opacity="0.8"
        />

        {/* Dynamic Label */}
        <text
          x="310"
          y="45"
          fill="#999999"
          fontSize="11"
          fontFamily="'JetBrains Mono', monospace"
          opacity="0.8"
        >
          {isGenerating
            ? "Processing"
            : productType}
        </text>
        <text
          x="560"
          y="145"
          fill="#999999"
          fontSize="11"
          fontFamily="'JetBrains Mono', monospace"
          opacity="0.8"
        >
          Architect node ok
        </text>
      </svg>
    </div>
  );
}
