import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// --- Optional fetch polyfill for Node < 18 (Render should use >=18, but this is safer)
if (typeof fetch === "undefined") {
  global.fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
}

dotenv.config();
const app = express();
const COACH_MODEL = "gpt-6-astra";
const UPSTREAM_TIMEOUT_MS = 55_000;
app.use(express.json({ limit: "1mb" }));

// --- CORS: use origins (no paths). Add your GitHub Pages origin(s) here.
app.use(cors({
  origin: [
    "https://jiaruilei.github.io",          // whole user site
    // "https://jiaruilei.github.io/jet-flow" // not needed; paths aren't origins
  ],
}));

// Open the learning interface when visitors follow the Render service link.
app.get("/", (req, res) => res.redirect(302, "https://jiaruilei.github.io/jet-flow/"));

// --- Health check (make sure Render's Health Check Path is set to this)
app.get("/api/health", (req, res) => res.json({
  ok: true,
  model: COACH_MODEL,
  revision: process.env.RENDER_GIT_COMMIT || null
}));

// --- ChatGPT proxy
app.post("/api/chat", async (req, res) => {
  const controller = new AbortController();
  let timeout;
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { system = "", messages = [] } = req.body || {};

    const chatMessages = [];
    if (system) chatMessages.push({ role: "system", content: system });
    for (const m of messages) {
      if (m?.role && m?.content) chatMessages.push({ role: m.role, content: m.content });
    }

    timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: COACH_MODEL,
        reasoning_effort: "low",
        messages: chatMessages
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: txt });
    }

    const data = await r.json();
    res.json({
      reply: data?.choices?.[0]?.message?.content ?? "",
      ...(data?.model ? { model: data.model } : {})
    });
  } catch (err) {
    if (controller.signal.aborted) {
      return res.status(504).json({ error: "The AI coach took too long to respond. Please try again." });
    }
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy error" });
  } finally {
    clearTimeout(timeout);
  }
});

// --- Start
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`AI coach proxy listening on :${port}`);
  console.log(`Health check at: http://localhost:${port}/api/health`);
});
