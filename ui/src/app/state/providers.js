import { runCommand } from "./commands.js";
import { setActiveProvider, setProviders, setProvidersError } from "./store.js";

function unwrap(response) {
  if (!response || typeof response !== "object") return {};
  if (response.payload && typeof response.payload === "object") return response.payload;
  return response;
}

export async function providersList() {
  try {
    const res = await runCommand("providers.list", {});
    const payload = unwrap(res);
    setProviders(payload.items || []);
    return payload;
  } catch (err) {
    setProvidersError(String(err));
    throw err;
  }
}

export async function providersDiscover(endpoint = null, model = null) {
  const args = {};
  if (endpoint) args.endpoint = endpoint;
  if (model) args.model = model;
  const res = await runCommand("providers.discover", args);
  const payload = unwrap(res);
  setProviders(payload.items || []);
  return payload;
}

export async function providersStatus() {
  const res = await runCommand("providers.status", {});
  const payload = unwrap(res);
  if (payload.active) setActiveProvider(payload.active);
  return payload;
}

export async function providersPair(id, endpoint, model) {
  await runCommand("providers.pair", { id, endpoint, model });
  await providersList().catch(() => {});
}

export async function providersAttach(id, model = null) {
  const args = { id };
  if (model) args.model = model;
  await runCommand("providers.attach", args);
  await providersStatus().catch(() => {});
}

export async function providersDetach() {
  await runCommand("providers.detach", {});
  setActiveProvider(null);
}

export async function providersRevoke(id) {
  await runCommand("providers.revoke", { id });
  await providersList().catch(() => {});
}
