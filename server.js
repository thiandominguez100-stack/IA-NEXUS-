import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_ROUNDS = Math.min(5, Math.max(1, Number(process.env.MAX_ROUNDS || 3)));
const MAX_OUTPUT_TOKENS = Math.min(1500, Math.max(100, Number(process.env.MAX_OUTPUT_TOKENS || 700)));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(express.static("public"));

const providers = {
  openai: { label: "ChatGPT", key: "OPENAI_API_KEY", model: "OPENAI_MODEL" },
  anthropic: { label: "Claude", key: "ANTHROPIC_API_KEY", model: "ANTHROPIC_MODEL" },
  gemini: { label: "Gemini", key: "GEMINI_API_KEY", model: "GEMINI_MODEL" },
  xai: { label: "Grok", key: "XAI_API_KEY", model: "XAI_MODEL" },
  deepseek: { label: "DeepSeek", key: "DEEPSEEK_API_KEY", model: "DEEPSEEK_MODEL" }
};

const activeRuns = new Map();
const lastRequestByIp = new Map();

function configured(id) {
  const p = providers[id];
  return Boolean(p && process.env[p.key] && process.env[p.model]);
}

function publicProviders() {
  return Object.entries(providers).map(([id, p]) => ({
    id, name: p.label, configured: configured(id),
    model: process.env[p.model] || null
  }));
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function authRequired(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next();
  if (req.get("x-admin-token") !== token) {
    return res.status(401).json({ error: "Se requiere el token de administrador configurado en el servidor." });
  }
  next();
}

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "NEXUS AI", version: "0.1.0" }));
app.get("/api/providers", (_req, res) => res.json({ providers: publicProviders(), maxRounds: MAX_ROUNDS }));

app.post("/api/debate", authRequired, async (req, res) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  if (now - (lastRequestByIp.get(ip) || 0) < 2500) {
    return res.status(429).json({ error: "Espera unos segundos antes de iniciar otra conversación." });
  }
  lastRequestByIp.set(ip, now);

  const topic = cleanText(req.body?.topic, 1200);
  const instruction = cleanText(req.body?.instruction, 1200);
  const ids = Array.isArray(req.body?.providers) ? [...new Set(req.body.providers)] : [];
  const rounds = Math.min(MAX_ROUNDS, Math.max(1, Number(req.body?.rounds || 1)));

  if (!topic) return res.status(400).json({ error: "Escribe un tema para iniciar." });
  if (ids.length < 2 || ids.length > 5 || ids.some(id => !providers[id])) {
    return res.status(400).json({ error: "Selecciona entre 2 y 5 proveedores válidos." });
  }
  const missing = ids.filter(id => !configured(id));
  if (missing.length) {
    return res.status(400).json({ error: "Falta configurar la clave API o el identificador de modelo de: " + missing.map(id => providers[id].label).join(", ") });
  }

  const runId = randomUUID();
  const controller = new AbortController();
  activeRuns.set(runId, controller);
  req.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  const transcript = [];
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const send = (event) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + "\n");
  };

  try {
    send({ type: "started", runId, rounds, participants: ids.map(id => providers[id].label) });
    for (let round = 1; round <= rounds; round++) {
      for (const id of ids) {
        if (controller.signal.aborted) throw new Error("Conversación detenida por el usuario.");
        const answer = await askProvider(id, { topic, instruction, transcript, round }, controller.signal);
        const item = { id: randomUUID(), provider: id, name: providers[id].label, round, text: answer };
        transcript.push(item);
        send({ type: "message", message: item });
      }
    }
    send({ type: "done" });
  } catch (error) {
    send({ type: controller.signal.aborted ? "stopped" : "error", error: safeError(error) });
  } finally {
    activeRuns.delete(runId);
    res.end();
  }
});

async function askProvider(id, context, signal) {
  const p = providers[id];
  const apiKey = process.env[p.key];
  const model = process.env[p.model];
  const history = context.transcript.map(m => `${m.name} (ronda ${m.round}): ${m.text}`).join("\n\n");
  const prompt = [
    "Eres un participante de una mesa de debate multiagente llamada NEXUS AI.",
    "Responde en español. Analiza el tema con rigor, distingue hechos de opiniones y no inventes fuentes.",
    "No afirmes ser otro proveedor ni otro modelo.",
    context.instruction ? "Instrucción del moderador: " + context.instruction : "",
    "Tema: " + context.topic,
    "Ronda actual: " + context.round,
    history ? "Conversación previa:\n" + history : "Todavía no hay intervenciones previas.",
    "Aporta una intervención útil y concreta. Puedes discrepar respetuosamente."
  ].filter(Boolean).join("\n\n");

  const timeout = AbortSignal.timeout(90000);
  const combined = AbortSignal.any([signal, timeout]);
  let response;

  if (id === "openai") {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal: combined,
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: prompt, max_output_tokens: MAX_OUTPUT_TOKENS })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error de OpenAI.");
    return data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || "").join("\n").trim() || "El proveedor no devolvió texto.";
  }

  if (id === "anthropic") {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: combined,
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: MAX_OUTPUT_TOKENS, messages: [{ role: "user", content: prompt }] })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error de Anthropic.");
    return (data.content || []).filter(x => x.type === "text").map(x => x.text).join("\n").trim();
  }

  if (id === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    response = await fetch(url, {
      method: "POST", signal: combined,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error de Gemini.");
    return (data.candidates?.[0]?.content?.parts || []).map(x => x.text || "").join("\n").trim();
  }

  const base = id === "xai" ? "https://api.x.ai/v1" : "https://api.deepseek.com";
  response = await fetch(base + "/chat/completions", {
    method: "POST", signal: combined,
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: MAX_OUTPUT_TOKENS, stream: false })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Error de ${p.label}.`);
  return data.choices?.[0]?.message?.content?.trim() || "El proveedor no devolvió texto.";
}

function safeError(error) {
  if (error?.name === "TimeoutError") return "El proveedor tardó demasiado en responder.";
  return cleanText(error?.message || "Error inesperado.", 500);
}

app.post("/api/stop/:runId", authRequired, (req, res) => {
  const controller = activeRuns.get(req.params.runId);
  if (!controller) return res.status(404).json({ error: "No hay una conversación activa con ese identificador." });
  controller.abort();
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`NEXUS AI escuchando en http://localhost:${PORT}`));
