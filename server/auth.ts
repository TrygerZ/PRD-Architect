// Route auth: set/clear API key via httpOnly cookie.
// Dipisah dari server.ts sebagai factory agar state (express app) di-pass
// sebagai argumen — pure move, zero logic change.
import express from "express";

export function registerAuthRoutes(app: express.Express) {
  app.post("/api/auth/set-key", (req, res) => {
    const { apiKey } = req.body;
    const language = (req.body?.language === 'en' || req.body?.language === 'id') ? req.body.language : 'en';
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({ 
        error: language === 'en' 
          ? "API key is required" 
          : "API key diperlukan" 
      });
    }

    // Simpan di httpOnly cookie — tidak bisa diakses JavaScript (mitigasi XSS)
    // secure hanya di production: browser menolak `Secure` cookie via HTTP (localhost dev)
    res.cookie('prd_session', apiKey.trim(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari (BUG 4.10)
      path: '/',
    });

    res.json({ success: true });
  });

  app.post("/api/auth/clear-key", (_req, res) => {
    res.clearCookie('prd_session', { 
      httpOnly: true, 
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/' 
    });
    res.json({ success: true });
  });
}