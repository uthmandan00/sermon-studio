import { createSafetySnapshot, exportBackup, listSafetySnapshots, loadData, resetToSampleData, restoreSafetySnapshot, updateData } from "./storage.js";
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

document.addEventListener("DOMContentLoaded", () => {
  const data = loadData();
  setValues(data.meta.profile || defaults);
  renderStorageHealth(data);
  renderSafetySnapshots();
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
