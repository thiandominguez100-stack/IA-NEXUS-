const $ = (id) => document.getElementById(id);
const selected = new Set();
let activeRunId = null;
let currentController = null;
let maxRounds = 3;

async function loadProviders() {
  try {
    const response = await fetch("/api/providers");
    const data = await response.json();
    maxRounds = data.maxRounds || 3;
    $("rounds").querySelectorAll("option").forEach(option => {
      option.disabled = Number(option.value) > maxRounds;
    });
    $("providers").innerHTML = data.providers.map(p => `
      <label class="provider ${p.configured ? "" : "disabled"}">
        <input type="checkbox" value="${p.id}" ${p.configured ? "" : "disabled"}>
        <span><strong>${p.name}</strong><small>${p.configured ? (p.model || "Configurado") : "API no configurada"}</small></span>
      </label>`).join("");
    $("system-status").innerHTML = "<i></i> Sistema disponible";
    $("providers").querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener("change", () => input.checked ? selected.add(input.value) : selected.delete(input.value));
    });
    const ready = data.providers.filter(p => p.configured).length;
    if (ready < 2) $("setup-error").textContent = "Configura al menos dos modelos locales en Ollama o añade un proveedor cloud con acceso gratuito.";
  } catch {
    $("providers").textContent = "No se pudo conectar con el servidor.";
    $("system-status").textContent = "Servidor desconectado";
  }
}

function addMessage(message) {
  const empty = $("transcript").querySelector(".empty");
  if (empty) empty.remove();
  const article = document.createElement("article");
  article.className = "message";
  const head = document.createElement("div");
  head.className = "message-head";
  const name = document.createElement("strong");
  name.textContent = message.name;
  const round = document.createElement("span");
  round.textContent = "RONDA " + message.round;
  const body = document.createElement("p");
  body.textContent = message.text;
  head.append(name, round);
  article.append(head, body);
  $("transcript").append(article);
}

function setRunning(running) {
  $("start").disabled = running;
  $("stop").disabled = !running;
  $("room-status").textContent = running ? "EN DIRECTO" : "EN ESPERA";
  $("room-status").classList.toggle("active", running);
}

async function startDebate() {
  $("setup-error").textContent = "";
  const topic = $("topic").value.trim();
  if (!topic) { $("setup-error").textContent = "Escribe un tema antes de iniciar."; return; }
  if (selected.size < 1) { $("setup-error").textContent = "Selecciona al menos un modelo configurado."; return; }
  $("transcript").innerHTML = "";
  setRunning(true);
  currentController = new AbortController();
  try {
    const response = await fetch("/api/debate", {
      method: "POST", signal: currentController.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, instruction: $("instruction").value, providers: [...selected], rounds: Number($("rounds").value) })
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "No se pudo iniciar el debate.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "started") activeRunId = event.runId;
        if (event.type === "message") addMessage(event.message);
        if (event.type === "error" || event.type === "stopped") {
          const notice = document.createElement("div");
          notice.className = "notice-line";
          notice.textContent = event.error;
          $("transcript").append(notice);
        }
      }
    }
  } catch (error) {
    const notice = document.createElement("div");
    notice.className = "notice-line";
    notice.textContent = error.name === "AbortError" ? "Solicitud detenida." : error.message;
    $("transcript").append(notice);
  } finally {
    activeRunId = null;
    currentController = null;
    setRunning(false);
  }
}

async function stopDebate() {
  if (currentController) currentController.abort();
  if (activeRunId) {
    try { await fetch("/api/stop/" + encodeURIComponent(activeRunId), { method: "POST" }); } catch {}
  }
}

$("start").addEventListener("click", startDebate);
$("stop").addEventListener("click", stopDebate);
loadProviders();
