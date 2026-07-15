// ../node_modules/.pnpm/@gcore+fastedge-wizard-sdk@https+++codeload.github.com+godronus+fastedge-wizard-sdk+tar_bdd9f2425d7a0beaa781e2ce202b89fa/node_modules/@gcore/fastedge-wizard-sdk/dist/protocol.js
var WIZARD_PROTOCOL_VERSION = 1;
var MAX_MESSAGE_BYTES = 64 * 1024;
var HANDSHAKE_TIMEOUT_MS = 1e4;
var INTENT_TIMEOUT_MS = 6e4;

// ../node_modules/.pnpm/@gcore+fastedge-wizard-sdk@https+++codeload.github.com+godronus+fastedge-wizard-sdk+tar_bdd9f2425d7a0beaa781e2ce202b89fa/node_modules/@gcore/fastedge-wizard-sdk/dist/errors.js
var WizardError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WizardError";
    this.code = code;
  }
};

// ../node_modules/.pnpm/@gcore+fastedge-wizard-sdk@https+++codeload.github.com+godronus+fastedge-wizard-sdk+tar_bdd9f2425d7a0beaa781e2ce202b89fa/node_modules/@gcore/fastedge-wizard-sdk/dist/sdk.js
var SDK_VERSION = "0.1.0";
function applyTheme(theme) {
  if (typeof document === "undefined")
    return;
  document.body.classList.remove("gc-theme-light", "gc-theme-dark");
  document.body.classList.add(`gc-theme-${theme}`);
}
var CLIENT_INTENT_TIMEOUT_MS = INTENT_TIMEOUT_MS + 3e4;
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
var WizardSessionImpl = class {
  constructor(port) {
    this.pending = /* @__PURE__ */ new Map();
    this.eventHandlers = /* @__PURE__ */ new Map();
    this.nextId = 0;
    this.disposed = false;
    this.port = port;
    this.context = { get: () => this.invoke("context.get", {}) };
    this.fastedge = {
      templates: {
        list: (params) => this.invoke("fastedge.templates.list", params ?? {}),
        read: (params) => this.invoke("fastedge.templates.read", params)
      },
      apps: {
        list: () => this.invoke("fastedge.apps.list", {}),
        get: (params) => this.invoke("fastedge.apps.get", params),
        create: (params) => this.invoke("fastedge.apps.create", params),
        update: (params) => this.invoke("fastedge.apps.update", params),
        link: (params) => this.invoke("fastedge.apps.link", params)
      },
      secrets: {
        list: () => this.invoke("fastedge.secrets.list", {}),
        create: (params) => this.invoke("fastedge.secrets.create", params),
        pick: () => this.invoke("fastedge.secrets.pick", {})
      }
    };
    this.deployment = {
      plan: (params) => this.invoke("deployment.plan", params),
      apply: (params) => this.invoke("deployment.apply", params)
    };
    this.port.onmessage = (event) => this.handlePortMessage(event);
    this.on("theme.changed", (p) => {
      const payload = p;
      applyTheme(payload.theme);
    });
  }
  handlePortMessage(event) {
    const data = event.data;
    console.log("Farq: -> WizardSessionImpl -> handlePortMessage -> data:", data);
    if (!isRecord(data) || data["v"] !== WIZARD_PROTOCOL_VERSION)
      return;
    if (data["type"] === "result") {
      this.handleResult(data);
    } else if (data["type"] === "event") {
      this.handleEvent(data);
    }
  }
  handleResult(msg) {
    const pending = this.pending.get(msg.id);
    if (!pending)
      return;
    this.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.ok) {
      pending.resolve(msg.data);
    } else {
      const err = msg.error ?? { code: "upstream_error", message: "Unknown error" };
      pending.reject(new WizardError(err.code, err.message));
    }
  }
  handleEvent(msg) {
    const handlers = this.eventHandlers.get(msg.event);
    if (!handlers)
      return;
    for (const handler of handlers)
      handler(msg.payload);
  }
  invoke(intent, params) {
    if (this.disposed) {
      return Promise.reject(new WizardError("protocol_error", "Session is disposed"));
    }
    const id = `req-${this.nextId++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new WizardError("timeout", `Intent "${intent}" timed out`));
      }, CLIENT_INTENT_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      const message = { v: WIZARD_PROTOCOL_VERSION, type: "intent", id, intent, params };
      this.port.postMessage(message);
    });
  }
  on(event, handler) {
    let handlers = this.eventHandlers.get(event);
    if (!handlers) {
      handlers = /* @__PURE__ */ new Set();
      this.eventHandlers.set(event, handlers);
    }
    handlers.add(handler);
    return () => handlers?.delete(handler);
  }
  dispose() {
    if (this.disposed)
      return;
    this.disposed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new WizardError("protocol_error", "Session disposed"));
    }
    this.pending.clear();
    this.eventHandlers.clear();
    this.port.onmessage = null;
    this.port.close();
  }
};
function connect(options) {
  const { expectedHostOrigin, handshakeTimeoutMs = HANDSHAKE_TIMEOUT_MS } = options;
  return new Promise((resolve, reject) => {
    let settled = false;
    let port;
    const timeoutTimer = setTimeout(() => {
      finish(() => reject(new WizardError("timeout", "Handshake did not complete in time")));
    }, handshakeTimeoutMs);
    function finish(fn) {
      if (settled)
        return;
      settled = true;
      clearTimeout(timeoutTimer);
      window.removeEventListener("message", onWindowMessage);
      fn();
    }
    function onWindowMessage(event) {
      if (settled)
        return;
      if (event.source !== window.parent)
        return;
      if (event.origin !== expectedHostOrigin)
        return;
      const data = event.data;
      if (!isRecord(data) || data["type"] !== "init")
        return;
      if (data["v"] !== WIZARD_PROTOCOL_VERSION) {
        finish(() => reject(new WizardError("protocol_error", `Protocol version mismatch: host=${String(data["v"])}, sdk=${WIZARD_PROTOCOL_VERSION}`)));
        return;
      }
      const capturedPort = event.ports.length === 1 ? event.ports[0] : void 0;
      if (!capturedPort)
        return;
      port = capturedPort;
      capturedPort.onmessage = onPortMessage;
      capturedPort.start();
    }
    function onPortMessage(event) {
      if (settled)
        return;
      const data = event.data;
      if (!isRecord(data) || data["type"] !== "hello")
        return;
      if (data["v"] !== WIZARD_PROTOCOL_VERSION) {
        finish(() => reject(new WizardError("protocol_error", `Protocol version mismatch: host=${String(data["v"])}, sdk=${WIZARD_PROTOCOL_VERSION}`)));
        return;
      }
      const hello = data;
      applyTheme(hello.hostContext.theme ?? "light");
      if (typeof document !== "undefined") {
        document.documentElement.lang = hello.hostContext.locale ?? "en";
      }
      const ready = { v: WIZARD_PROTOCOL_VERSION, type: "ready", sdkVersion: SDK_VERSION };
      port.postMessage(ready);
      finish(() => resolve(new WizardSessionImpl(port)));
    }
    window.addEventListener("message", onWindowMessage);
  });
}

// src/main.js
var hostOrigin = new URLSearchParams(location.search).get("hostOrigin") || "https://portal.gcore.com";
var session = null;
var createdAppId = null;
var currentPlanId = null;
function icon(n, v) {
  document.getElementById(`i${n}`).textContent = v;
}
function result(n, text, cls) {
  const el = document.getElementById(`r${n}`);
  el.textContent = text;
  el.className = cls ?? "";
}
function enable(id) {
  document.getElementById(id).disabled = false;
}
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  if (loading) btn.dataset.orig = btn.textContent;
  btn.textContent = loading ? `${label ?? btn.dataset.orig} \u2026` : btn.dataset.orig;
}
function addOption(selectId, value, label) {
  const sel = document.getElementById(selectId);
  const opt = document.createElement("option");
  opt.value = String(value);
  opt.textContent = label;
  sel.appendChild(opt);
}
function resetSelect(selectId, placeholder) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  sel.appendChild(ph);
}
async function main() {
  try {
    session = await connect({ expectedHostOrigin: hostOrigin });
    icon(1, "\u2705");
    result(1, "connected", "pass");
  } catch (err) {
    icon(1, "\u274C");
    result(1, `${err.code}: ${err.message}`, "fail");
    return;
  }
  await Promise.all([runSecretsListAuto(), runTemplatesListAuto()]);
  enable("btn-create-secret");
  enable("btn-create-app");
  enable("btn-plan");
}
async function runSecretsListAuto() {
  icon(2, "\u23F3");
  try {
    const secrets = await session.fastedge.secrets.list();
    icon(2, "\u2705");
    result(2, JSON.stringify(secrets, null, 2), "pass");
    resetSelect("secret-id-select", "\u2014 none \u2014");
    for (const s of secrets) {
      addOption("secret-id-select", s.id, `${s.id}: ${s.name}${s.app_count != null ? ` (${s.app_count} apps)` : ""}`);
    }
  } catch (err) {
    icon(2, "\u274C");
    result(2, `${err.code}: ${err.message}`, "fail");
  }
}
function updatePlanTextarea(templateId) {
  if (!templateId) return;
  const ta = document.getElementById("plan-apps-json");
  ta.value = JSON.stringify(
    [
      {
        ref: "app-1",
        name: `smoke-plan-${templateId}`,
        source: { fromTemplateId: Number(templateId) },
        env: { PLAN_KEY: "plan_value" }
      }
    ],
    null,
    2
  );
}
async function runTemplatesListAuto() {
  icon(4, "\u23F3");
  try {
    const templates = await session.fastedge.templates.list();
    icon(4, "\u2705");
    result(
      4,
      templates.map((t) => `${t.id}: ${t.name} (${t.api_type})`).join("\n") || "(none)",
      "pass"
    );
    resetSelect("template-select", templates.length ? "\u2014 pick a template \u2014" : "\u2014 none available \u2014");
    for (const t of templates) {
      addOption("template-select", t.id, `${t.id}: ${t.name} (${t.api_type})`);
    }
    if (templates.length) {
      document.getElementById("template-select").value = String(templates[0].id);
      updatePlanTextarea(templates[0].id);
    }
  } catch (err) {
    icon(4, "\u274C");
    result(4, `${err.code}: ${err.message}`, "fail");
  }
}
document.getElementById("btn-create-secret").addEventListener("click", async () => {
  const nameHint = document.getElementById("secret-name-hint").value.trim() || "smoke-test-secret";
  setLoading("btn-create-secret", true, "Waiting for modal");
  icon(3, "\u23F3");
  try {
    const ref = await session.fastedge.secrets.create({ name: nameHint, comment: "smoke-test write-intents" });
    icon(3, "\u2705");
    result(3, JSON.stringify(ref, null, 2), "pass");
    addOption("secret-id-select", ref.id, `${ref.id}: ${ref.name} \u2190 just created`);
    document.getElementById("secret-id-select").value = String(ref.id);
  } catch (err) {
    icon(3, err.code === "user_cancelled" ? "\u{1F6AB}" : "\u274C");
    result(3, `${err.code}: ${err.message}`, err.code === "user_cancelled" ? "cancelled" : "fail");
  } finally {
    setLoading("btn-create-secret", false);
  }
});
document.getElementById("btn-create-app").addEventListener("click", async () => {
  const name = document.getElementById("app-name").value.trim() || `smoke-test-${Date.now()}`;
  const templateId = parseInt(document.getElementById("template-select").value);
  const secretKey = document.getElementById("secret-env-key").value.trim();
  const secretId = parseInt(document.getElementById("secret-id-select").value);
  if (!templateId) {
    result(5, "Pick a template first (Step 4).", "fail");
    return;
  }
  const params = {
    name,
    api_type: "wasi-http",
    source: { fromTemplateId: templateId }
  };
  if (secretKey && secretId) {
    params.secretRefs = { [secretKey]: secretId };
  }
  setLoading("btn-create-app", true, "Waiting for consent");
  icon(5, "\u23F3");
  result(5, `Waiting for host consent\u2026

${JSON.stringify(params, null, 2)}`);
  try {
    const created = await session.fastedge.apps.create(params);
    createdAppId = created.id;
    icon(5, "\u2705");
    result(5, JSON.stringify(created, null, 2), "pass");
    enable("btn-apps-list");
    enable("btn-apps-get");
    enable("btn-apps-update");
  } catch (err) {
    icon(5, err.code === "user_cancelled" ? "\u{1F6AB}" : "\u274C");
    result(5, `${err.code}: ${err.message}`, err.code === "user_cancelled" ? "cancelled" : "fail");
  } finally {
    setLoading("btn-create-app", false);
  }
});
document.getElementById("btn-apps-list").addEventListener("click", async () => {
  setLoading("btn-apps-list", true);
  icon(6, "\u23F3");
  try {
    const apps = await session.fastedge.apps.list();
    icon(6, "\u2705");
    result(6, JSON.stringify(apps, null, 2), "pass");
  } catch (err) {
    icon(6, "\u274C");
    result(6, `${err.code}: ${err.message}`, "fail");
  } finally {
    setLoading("btn-apps-list", false);
  }
});
document.getElementById("btn-apps-get").addEventListener("click", async () => {
  if (!createdAppId) {
    result(7, "No created app id \u2014 run Step 5 first.", "fail");
    return;
  }
  setLoading("btn-apps-get", true);
  icon(7, "\u23F3");
  try {
    const detail = await session.fastedge.apps.get({ id: createdAppId });
    icon(7, "\u2705");
    result(7, JSON.stringify(detail, null, 2), "pass");
  } catch (err) {
    icon(7, "\u274C");
    result(7, `${err.code}: ${err.message}`, "fail");
  } finally {
    setLoading("btn-apps-get", false);
  }
});
document.getElementById("btn-apps-update").addEventListener("click", async () => {
  if (!createdAppId) {
    result(8, "No created app id \u2014 run Step 5 first.", "fail");
    return;
  }
  let envPatch;
  try {
    const raw = document.getElementById("update-env").value.trim();
    envPatch = raw ? JSON.parse(raw) : void 0;
  } catch {
    result(8, "Invalid JSON in env patch field.", "fail");
    return;
  }
  const newName = document.getElementById("update-name").value.trim() || void 0;
  const params = { id: createdAppId };
  if (newName) params.name = newName;
  if (envPatch && Object.keys(envPatch).length) params.env = envPatch;
  setLoading("btn-apps-update", true, "Waiting for consent");
  icon(8, "\u23F3");
  result(8, `Waiting for host consent\u2026

${JSON.stringify(params, null, 2)}`);
  try {
    const updated = await session.fastedge.apps.update(params);
    icon(8, "\u2705");
    result(8, JSON.stringify(updated, null, 2), "pass");
  } catch (err) {
    icon(8, err.code === "user_cancelled" ? "\u{1F6AB}" : "\u274C");
    result(8, `${err.code}: ${err.message}`, err.code === "user_cancelled" ? "cancelled" : "fail");
  } finally {
    setLoading("btn-apps-update", false);
  }
});
document.getElementById("template-select").addEventListener("change", (e) => {
  updatePlanTextarea(e.target.value);
});
document.getElementById("btn-plan").addEventListener("click", async () => {
  let apps;
  try {
    apps = JSON.parse(document.getElementById("plan-apps-json").value);
  } catch {
    result(9, "Invalid JSON in apps field.", "fail");
    return;
  }
  let sharedEnv;
  const sharedEnvRaw = document.getElementById("plan-shared-env").value.trim();
  if (sharedEnvRaw) {
    try {
      sharedEnv = JSON.parse(sharedEnvRaw);
    } catch {
      result(9, "Invalid JSON in sharedEnv field.", "fail");
      return;
    }
  }
  setLoading("btn-plan", true, "Planning");
  icon(9, "\u23F3");
  result(9, "Validating plan\u2026");
  try {
    const params = { apps, ...sharedEnv ? { sharedEnv } : {} };
    const plan = await session.deployment.plan(params);
    currentPlanId = plan.planId;
    icon(9, "\u2705");
    result(9, JSON.stringify(plan, null, 2), "pass");
    enable("btn-apply");
  } catch (err) {
    icon(9, "\u274C");
    result(9, `${err.code}: ${err.message}`, "fail");
  } finally {
    setLoading("btn-plan", false);
  }
});
document.getElementById("btn-apply").addEventListener("click", async () => {
  if (!currentPlanId) {
    result(10, "No plan id \u2014 run Step 9 first.", "fail");
    return;
  }
  const progressLog = document.getElementById("progress-log");
  progressLog.textContent = "";
  const unsubscribe = session.on("deployment.progress", (payload) => {
    const { step, total, describe } = payload;
    progressLog.textContent += `[${step}/${total}] ${describe}
`;
  });
  setLoading("btn-apply", true, "Waiting for consent");
  icon(10, "\u23F3");
  result(10, "Waiting for host consent\u2026");
  try {
    const applied = await session.deployment.apply({ planId: currentPlanId });
    icon(10, applied.status === "complete" ? "\u2705" : "\u26A0\uFE0F");
    result(10, JSON.stringify(applied, null, 2), applied.status === "complete" ? "pass" : "fail");
    currentPlanId = null;
    document.getElementById("btn-apply").disabled = true;
  } catch (err) {
    icon(10, err.code === "user_cancelled" ? "\u{1F6AB}" : "\u274C");
    result(10, `${err.code}: ${err.message}`, err.code === "user_cancelled" ? "cancelled" : "fail");
  } finally {
    unsubscribe();
    setLoading("btn-apply", false);
  }
});
main();
