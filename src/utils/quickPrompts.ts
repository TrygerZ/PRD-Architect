import { ShoppingCart, Smartphone, BarChart3, HeartPulse, ClipboardList, MapPin, Package, Users } from "lucide-react";

export const getQuickPrompts = (language: "en" | "id", prdMode: string = "business") => {
  if (prdMode === "simple") {
    return [
      { id: 1, label: language === "en" ? "Freelance App" : "Aplikasi Freelance", icon: ClipboardList,
        text: language === "en"
          ? "Create a simple PRD for a task management app for freelancers"
          : "Buat PRD sederhana untuk aplikasi manajemen tugas freelancer" },
      { id: 2, label: language === "en" ? "Local Discovery" : "Discovery Lokal", icon: MapPin,
        text: language === "en"
          ? "Create a simple PRD for a local food and services discovery app"
          : "Buat PRD sederhana untuk aplikasi pencarian kuliner dan jasa lokal" },
      { id: 3, label: language === "en" ? "Inventory App" : "Aplikasi Inventaris", icon: Package,
        text: language === "en"
          ? "Create a simple PRD for a small business inventory management tool"
          : "Buat PRD sederhana untuk tools manajemen inventaris UMKM" },
      { id: 4, label: language === "en" ? "Community Platform" : "Platform Komunitas", icon: Users,
        text: language === "en"
          ? "Create a simple PRD for a community or marketplace platform"
          : "Buat PRD sederhana untuk platform komunitas atau marketplace" },
    ];
  }
  // Default: existing prompts for Business/Technical
  return [
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
};
