export const AI_CONFIG = {
  // Endpoint API yang mendukung format chat/completions
  // Contoh OpenAI: "https://api.openai.com/v1/chat/completions"
  // Contoh DeepSeek: "https://api.deepseek.com/chat/completions"
  // Contoh Groq: "https://api.groq.com/openai/v1/chat/completions"
  ENDPOINT_URL: "https://api.deepseek.com/chat/completions",
  
  // Nama model yang diperlukan oleh API
  // Contoh: "gpt-4o", "deepseek-chat", "llama3-70b-8192"
  MODEL_NAME: "deepseek-v4-flash",
  
  // Nama Environment Variable yang menyimpan API key (misal: "DEEPSEEK_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY")
  // Pastikan API Key ini ditambahkan di file .env atau dimasukkan di menu App Settings
  API_KEY_ENV_NAME: "DEEPSEEK_API_KEY", 

  // --- Konfigurasi Parameter Generasi ---
  
  // Batas maksimal token output (16000 sangat besar untuk dokumen PRD)
  MAX_OUTPUT_TOKENS: 16000,
  
  // Temperature (kreativitas respons)
  TEMPERATURE: 0.7,
  
  // Tambahan instruksi khusus untuk system prompt 
  SYSTEM_PROMPT_ADDITIONS: ""
};
