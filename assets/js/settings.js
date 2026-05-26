import { getCloudConfig, getCloudStatus, getCloudUser, pullWorkspaceFromCloud, pushWorkspaceToCloud, saveCloudConfig, signInToCloud, signOutOfCloud, signUpForCloud } from "./cloud.js";
import { createSafetySnapshot, exportBackup, listSafetySnapshots, loadData, resetToSampleData, restoreSafetySnapshot, saveData, updateData } from "./storage.js";
import { $, escapeHtml, formatDateTime, toast } from "./utils.js";

const defaults = {
  appName: "Sermon Studio",
  appSubtitle: "Sermon Manager",
  pastorName: "Pastor Jonathan",
  churchName: "Grace City Church",
  weeklyFocus: "Faithful preparation leads to powerful proclamation."
};

function initials(name = "") {
  const parts = name.replace(/^pastor\s+/i, "").trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "P"}${parts[1]?.[0] || ""}`.toUpperCase();
}

function setValues(profile) {
  $("#profile-app-name").value = profile.appName || defaults.appName;
  $("#profile-app-subtitle").value = profile.appSubtitle || defaults.appSubtitle;
  $("#profile-pastor-name").value = profile.pastorName || defaults.pastorName;
  $("#profile-church-name").value = profile.churchName || defaults.churchName;
  $("#profile-weekly-focus").value = profile.weeklyFocus || defaults.weeklyFocus;
  updatePreview();
}

function readValues() {
  return {
    appName: $("#profile-app-name").value.trim() || defaults.appName,
    appSubtitle: $("#profile-app-subtitle").value.trim() || defaults.appSubtitle,
    pastorName: $("#profile-pastor-name").value.trim() || defaults.pastorName,
    churchName: $("#profile-church-name").value.trim() || defaults.churchName,
    weeklyFocus: $("#profile-weekly-focus").value.trim() || defaults.weeklyFocus
  };
}

function updatePreview() {
  const profile = readValues();
  $("#preview-avatar").textContent = initials(profile.pastorName);
  $("#preview-pastor").textContent = profile.pastorName;
  $("#preview-church").textContent = profile.churchName;
  $("#preview-app").textContent = profile.appName;
  $("#preview-subtitle").textContent = profile.appSubtitle;
  $("#preview-focus").textContent = profile.weeklyFocus;
}

function storageBytes() {
  return new Blob([exportBackup()]).size;
}

function renderStorageHealth(data) {
  const bytes = storageBytes();
  const kb = Math.max(1, Math.round(bytes / 1024));
  const health = [
    ["S", "Sermons", data.sermons.length, "Local records"],
    ["R", "Series", data.series.length, "Planning groups"],
    ["B", "Backup Size", `${kb} KB`, "Current export"],
    ["V", "Data Version", data.meta.version || 1, "Schema"]
  ];
  $("#storage-health").innerHTML = health.map(([icon, label, value, note]) => `
    <article class="card panel stat">
      <span class="stat-icon">${icon}</span>
      <span><strong>${value}</strong><span class="muted">${label}</span><small>${note}</small></span>
    </article>
  `).join("");
}

function renderSafetySnapshots() {
  const target = $("#safety-snapshots");
  if (!target) return;
  const snapshots = listSafetySnapshots();
  target.innerHTML = snapshots.length ? snapshots.map((snapshot) => `
    <article class="safety-snapshot">
      <span>
        <strong>${escapeHtml(snapshot.reason)}</strong>
        <small>${formatDateTime(snapshot.date)}</small>
      </span>
      <button class="btn btn-small restore-snapshot" data-id="${snapshot.id}" type="button">Restore</button>
    </article>
  `).join("") : `<p class="muted">No safety snapshots yet. The app creates them before destructive changes.</p>`;
}

function setCloudMessage(message, type = "note") {
  const target = $("#cloud-message");
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("danger-text", type === "error");
}

function fillCloudSettings() {
  const config = getCloudConfig();
  const status = getCloudStatus();
  $("#cloud-url").value = config.url || "";
  $("#cloud-anon-key").value = config.anonKey || "";
  $("#cloud-enabled").checked = Boolean(config.enabled);
  $("#cloud-email").value = status.email || "";
  renderCloudState(status);
}

function readCloudSettings() {
  return {
    url: $("#cloud-url").value,
    anonKey: $("#cloud-anon-key").value,
    enabled: $("#cloud-enabled").checked
  };
}

function renderCloudState(status = getCloudStatus()) {
  const configured = Boolean(getCloudConfig().url && getCloudConfig().anonKey && getCloudConfig().enabled);
  const state = $("#cloud-state");
  if (!state) return;
  state.textContent = configured && status.signedIn ? "Cloud On" : configured ? "Cloud Ready" : "Local Only";
  state.className = `status ${configured && status.signedIn ? "status-ready" : configured ? "status-planning" : ""}`;
  if (status.lastMessage) setCloudMessage(status.lastMessage);
  if (status.lastError) setCloudMessage(status.lastError, "error");
}

async function refreshCloudUser() {
  try {
    const user = await getCloudUser();
    renderCloudState({ ...getCloudStatus(), signedIn: Boolean(user), email: user?.email || getCloudStatus().email || "" });
  } catch {
    renderCloudState();
  }
}

function cloudCredentials() {
  const email = $("#cloud-email").value.trim();
  const password = $("#cloud-password").value;
  if (!email || !password) throw new Error("Enter your email and password first.");
  return { email, password };
}

document.addEventListener("DOMContentLoaded", () => {
  const data = loadData();
  setValues(data.meta.profile || defaults);
  renderStorageHealth(data);
  renderSafetySnapshots();
  fillCloudSettings();
  refreshCloudUser();
  window.addEventListener("sermon-cloud-status", (event) => renderCloudState(event.detail));
  $("#profile-form").addEventListener("input", updatePreview);
  $("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const profile = readValues();
    updateData((data) => {
      data.meta.profile = profile;
      return data;
    });
    toast("Settings saved.");
    window.setTimeout(() => window.location.reload(), 350);
  });
  $("#restore-profile-defaults").addEventListener("click", () => setValues(defaults));
  $("#create-safety-snapshot").addEventListener("click", () => {
    createSafetySnapshot("Manual safety backup");
    renderSafetySnapshots();
    toast("Safety backup created.");
  });
  $("#cloud-config-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveCloudConfig(readCloudSettings());
    renderCloudState();
    toast("Cloud settings saved.");
    setCloudMessage("Cloud settings saved. Sign in, then push local data to cloud.");
  });
  $("#cloud-sign-in").addEventListener("click", async () => {
    try {
      saveCloudConfig(readCloudSettings());
      const { email, password } = cloudCredentials();
      await signInToCloud(email, password);
      $("#cloud-password").value = "";
      renderCloudState();
      toast("Signed in to cloud sync.");
    } catch (error) {
      setCloudMessage(error.message || "Could not sign in.", "error");
      toast("Could not sign in.", "error");
    }
  });
  $("#cloud-sign-up").addEventListener("click", async () => {
    try {
      saveCloudConfig(readCloudSettings());
      const { email, password } = cloudCredentials();
      await signUpForCloud(email, password);
      $("#cloud-password").value = "";
      renderCloudState();
      toast("Cloud account created. Check email if confirmation is required.");
      setCloudMessage("Account created. If Supabase requires confirmation, check your email before signing in.");
    } catch (error) {
      setCloudMessage(error.message || "Could not create account.", "error");
      toast("Could not create account.", "error");
    }
  });
  $("#cloud-sign-out").addEventListener("click", async () => {
    try {
      await signOutOfCloud();
      renderCloudState();
      toast("Signed out of cloud sync.");
    } catch (error) {
      setCloudMessage(error.message || "Could not sign out.", "error");
      toast("Could not sign out.", "error");
    }
  });
  $("#cloud-push").addEventListener("click", async () => {
    try {
      saveCloudConfig(readCloudSettings());
      await pushWorkspaceToCloud(loadData());
      renderCloudState();
      toast("Local workspace pushed to cloud.");
    } catch (error) {
      setCloudMessage(error.message || "Cloud push failed.", "error");
      toast("Cloud push failed.", "error");
    }
  });
  $("#cloud-pull").addEventListener("click", async () => {
    try {
      const confirmed = window.confirm("Pull cloud data into this browser? Your current local workspace will be saved as a safety backup first.");
      if (!confirmed) return;
      const row = await pullWorkspaceFromCloud();
      if (!row?.data) {
        setCloudMessage("No cloud workspace found yet. Push local data first.");
        return;
      }
      createSafetySnapshot("Before pulling cloud workspace");
      saveData(row.data);
      toast("Cloud workspace pulled. Reloading.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setCloudMessage(error.message || "Cloud pull failed.", "error");
      toast("Cloud pull failed.", "error");
    }
  });
  $("#safety-snapshots").addEventListener("click", (event) => {
    const restore = event.target.closest(".restore-snapshot");
    if (!restore) return;
    const confirmed = window.confirm("Restore this safety backup? Your current workspace will be saved as a new safety backup first.");
    if (!confirmed) return;
    restoreSafetySnapshot(restore.dataset.id);
    toast("Safety backup restored. Reloading workspace.");
    window.setTimeout(() => window.location.reload(), 500);
  });
  $("#reset-sample-data").addEventListener("click", () => {
    const confirmed = window.confirm("Reset this local workspace to starter sample data? Export a backup first if you want to keep the current data.");
    if (!confirmed) return;
    resetToSampleData();
    toast("Sample data restored. Reloading workspace.");
    window.setTimeout(() => window.location.reload(), 500);
  });
});
