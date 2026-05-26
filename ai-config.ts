export const AI_CONFIG = {
  // API Endpoint that supports the chat/completions format
  // Example OpenAI: "https://api.openai.com/v1/chat/completions"
  // Example DeepSeek: "https://api.deepseek.com/chat/completions"
  // Example Groq: "https://api.groq.com/openai/v1/chat/completions"
  // Example Gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
  ENDPOINT_URL: "https://api.deepseek.com/chat/completions",
  
  // Model name required by the API
  // Example: "gpt-4o", "deepseek-chat", "llama3-70b-8192", "gemini-2.5-flash"
  MODEL_NAME: "deepseek-v4-flash",
  
  // Environment Variable name that stores the API key (e.g., "DEEPSEEK_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY")
  // Make sure this API Key is added to the .env file or inserted in the App Settings menu
  API_KEY_ENV_NAME: "DEEPSEEK_API_KEY", 

  // --- Generation Parameters Configuration ---
  
  // Maximum output token limit (16000 is very large for a PRD document)
  MAX_OUTPUT_TOKENS: 16000,
  
  // Temperature (response creativity)
  TEMPERATURE: 0.5,
  
  // Additional specific instructions for the system prompt
  SYSTEM_PROMPT_ADDITIONS: ""
};

