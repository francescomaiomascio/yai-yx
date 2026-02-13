import { runCommand } from "./commands.js";
import { setActiveProvider, setProviders, setProvidersError } from "./store.js";

function unwrap(response) {
  if (!response || typeof response !== "object") return {};
  if (response.payload && typeof response.payload === "object") return response.payload;
  return response;
}

function safeStr(v) {
  if (v == null) return "";
  const s = String(v);
  return s.trim();
}

// arming: solo comandi “dangerous”
function requiresArming(name) {
  return (
    name === "providers.pair" ||
    name === "providers.attach" ||
    name === "providers.revoke" ||
    name === "providers.detach"
  );
}

async function run(name, args = {}) {
  const res = await runCommand(name, args, { arming: requiresArming(name) });
  return unwrap(res);
}

export async function providersList() {
  try {
    const payload = await run("providers.list", {});
    setProviders(payload.items || []);
    return payload;
  } catch (err) {
    setProvidersError(String(err));
    throw err;
  }
}

export async function providersDiscover(endpoint = "", model = "") {
  try {
    // IMPORTANT: mai null → sempre stringhe
    const args = {
      endpoint: safeStr(endpoint),
      model: safeStr(model),
    };

    const payload = await run("providers.discover", args);
    setProviders(payload.items || []);

    // refresh active provider (se discover/pair/attach hanno effetti)
    await providersStatus().catch(() => {});

    return payload;
  } catch (err) {
    setProvidersError(String(err));
    throw err;
  }
}

export async function providersStatus() {
  try {
    const payload = await run("providers.status", {});
    setActiveProvider(payload.active || null);
    return payload;
  } catch (err) {
    setProvidersError(String(err));
    throw err;
  }
}

export async function providersPair(id, endpoint, model) {
  try {
    await run("providers.pair", {
      id: safeStr(id),
      endpoint: safeStr(endpoint),
      model: safeStr(model),
    });
    await providersList().catch(() => {});
    await providersStatus().catch(() => {});
  } catch (err) {
    setProvidersError(String(err));
    throw err;
  }
}

export async function providersAttach(id, model = "") {
  try {
    await run("providers.attach", { id: safeStr(id), model: safeStr(model) });
    await providersStatus().catch(() => {});
  } catch (err) {
    setProvidersError(String(err));
    throw err;
  }
}

export async function providersDetach() {
  try {
    await run("providers.detach", {});
    setActiveProvider(null);
    await providersStatus().catch(() => {});
  } catch (err) {
    setProvidersError(String(err));
    throw err;
  }
}

export async function providersRevoke(id) {
  try {
    await run("providers.revoke", { id: safeStr(id) });
    await providersList().catch(() => {});
    await providersStatus().catch(() => {});
  } catch (err) {
    setProvidersError(String(err));
    throw err;
  }
}
