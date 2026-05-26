import { nowIso } from "./utils.js";

const CLOUD_CONFIG_KEY = "sermon-manager-cloud-config-v1";
const CLOUD_STATUS_KEY = "sermon-manager-cloud-status-v1";
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
let clientPromise = null;
let syncTimer = null;

export function getCloudConfig() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveCloudConfig(config) {
  const nextConfig = {
    url: (config.url || "").trim().replace(/\/$/, ""),
    anonKey: (config.anonKey || "").trim(),
    enabled: Boolean(config.enabled)
  };
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(nextConfig));
  clientPromise = null;
  return nextConfig;
}

export function getCloudStatus() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_STATUS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCloudStatus(status) {
  const nextStatus = { ...getCloudStatus(), ...status, checkedAt: nowIso() };
  localStorage.setItem(CLOUD_STATUS_KEY, JSON.stringify(nextStatus));
  window.dispatchEvent(new CustomEvent("sermon-cloud-status", { detail: nextStatus }));
  return nextStatus;
}

export function isCloudConfigured() {
  const config = getCloudConfig();
  return Boolean(config.enabled && config.url && config.anonKey);
}

export async function getCloudClient() {
  const config = getCloudConfig();
  if (!config.url || !config.anonKey) throw new Error("Add your Supabase URL and anon key first.");
  if (!clientPromise) {
    clientPromise = import(SUPABASE_CDN).then(({ createClient }) => createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }));
  }
  return clientPromise;
}

export async function getCloudUser() {
  if (!isCloudConfigured()) return null;
  const client = await getCloudClient();
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user || null;
}

export async function signInToCloud(email, password) {
  const client = await getCloudClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  saveCloudStatus({ signedIn: true, email: data.user?.email || email });
  return data.user;
}

export async function signUpForCloud(email, password) {
  const client = await getCloudClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  saveCloudStatus({ signedIn: Boolean(data.user), email });
  return data.user;
}

export async function signOutOfCloud() {
  const client = await getCloudClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
  saveCloudStatus({ signedIn: false, email: "", lastMessage: "Signed out." });
}

export async function pushWorkspaceToCloud(data) {
  if (!isCloudConfigured()) return null;
  const client = await getCloudClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in before syncing.");
  const payload = {
    user_id: userData.user.id,
    slug: "primary",
    data,
    pushed_at: nowIso(),
    updated_at: nowIso()
  };
  const { data: row, error } = await client
    .from("sermon_workspaces")
    .upsert(payload, { onConflict: "user_id,slug" })
    .select("pushed_at, updated_at")
    .single();
  if (error) throw error;
  saveCloudStatus({ signedIn: true, email: userData.user.email, lastPush: row?.pushed_at || nowIso(), lastMessage: "Cloud sync complete." });
  return row;
}

export async function pullWorkspaceFromCloud() {
  if (!isCloudConfigured()) throw new Error("Cloud sync is not configured.");
  const client = await getCloudClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in before pulling cloud data.");
  const { data: row, error } = await client
    .from("sermon_workspaces")
    .select("data,pushed_at,updated_at")
    .eq("slug", "primary")
    .maybeSingle();
  if (error) throw error;
  saveCloudStatus({ signedIn: true, email: userData.user.email, lastPull: nowIso(), lastMessage: row ? "Cloud workspace pulled." : "No cloud workspace found yet." });
  return row;
}

export function queueCloudSync(data) {
  if (!isCloudConfigured()) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    pushWorkspaceToCloud(data).catch((error) => {
      saveCloudStatus({ lastError: error.message || "Cloud sync failed.", lastMessage: "Cloud sync needs attention." });
    });
  }, 1200);
}
