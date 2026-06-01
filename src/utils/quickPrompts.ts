import { ShoppingCart, Smartphone, BarChart3, HeartPulse } from "lucide-react";

export const getQuickPrompts = (language: "en" | "id") => [
  { id: 1, label: "E-Commerce", icon: ShoppingCart,
    text: language === "en"
      ? "Create a PRD for an e-commerce app selling local fashion products"
      : "Buat PRD untuk aplikasi e-commerce yang menjual produk fashion lokal" },
  { id: 2, label: "Mobile POS", icon: Smartphone,
    text: language === "en"
      ? "Create a PRD for a mobile POS app for micro-businesses"
      : "Buat PRD untuk aplikasi POS mobile untuk UMKM" },
  { id: 3, label: "SaaS", icon: BarChart3,
    text: language === "en"
      ? "Create a PRD for a B2B SaaS analytics dashboard"
      : "Buat PRD untuk dashboard analytics SaaS B2B" },
  { id: 4, label: "HealthTech", icon: HeartPulse,
    text: language === "en"
      ? "Create a PRD for a telemedicine application"
      : "Buat PRD untuk aplikasi telemedicine" },
];
