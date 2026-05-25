import { $, $$, getTheme, setTheme, toast } from "./utils.js";
import { exportBackup, importBackup, loadData } from "./storage.js";

function setActiveNavigation() {
  const currentUrl = new URL(window.location.href);
  const path = currentUrl.pathname.replace(/\\/g, "/");
  const currentFocus = currentUrl.searchParams.get("focus");
  $$(".nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const linkUrl = new URL(href, window.location.href);
    const normalized = linkUrl.pathname.replace(/\\/g, "/");
    const samePath = normalized === path || (path.endsWith("/") && normalized.endsWith("/index.html"));
    const linkFocus = linkUrl.searchParams.get("focus");
    const sectionIndex = normalized.match(/\/(sermons|series|calendar|settings)\/index\.html$/);
    const isMainNav = link.closest(".nav-section")?.querySelector(".nav-title")?.textContent.trim() === "Main";
    const sameSection = isMainNav && sectionIndex && path.includes(`/${sectionIndex[1]}/`);
    link.classList.toggle("active", (samePath || sameSection) && (linkFocus ? linkFocus === currentFocus : !currentFocus));
  });
}

function setupTheme() {
  setTheme(getTheme());
  $$(".theme-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      setTheme(next);
      toast(`${next === "dark" ? "Dark" : "Light"} mode enabled.`);
    });
  });
}

function setupMobileNav() {
  const button = $(".menu-toggle");
  const shell = $(".app-shell");
  const sidebar = $(".sidebar");
  if (!button || !shell) return;
  const closeNav = () => {
    shell.classList.remove("nav-open");
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", () => {
    const isOpen = shell.classList.toggle("nav-open");
    button.setAttribute("aria-expanded", String(isOpen));
  });
  sidebar?.addEventListener("click", (event) => {
    if (event.target.closest(".nav-link")) closeNav();
  });
  document.addEventListener("click", (event) => {
    if (!shell.classList.contains("nav-open")) return;
    if (sidebar?.contains(event.target) || button.contains(event.target)) return;
    closeNav();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNav();
  });
}

function setupBackupControls() {
  const exportButtons = [$("#backup-export"), ...$$(".backup-export-trigger")].filter(Boolean);
  const importInput = $("#backup-import");
  if (exportButtons.length) {
    exportButtons.forEach((exportButton) => exportButton.addEventListener("click", () => {
      const blob = new Blob([exportBackup()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sermon-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast("Backup exported.");
    }));
  }
  if (importInput) {
    importInput.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const confirmed = window.confirm("Importing a backup will replace the current local workspace. Export a backup first if you want to keep this data. Continue?");
      if (!confirmed) {
        importInput.value = "";
        return;
      }
      try {
        importBackup(await file.text());
        toast("Backup restored. Reloading workspace.");
        window.setTimeout(() => window.location.reload(), 700);
      } catch (error) {
        toast(error.message || "Could not import backup.", "error");
      }
    });
  }
}

function appRootPrefix() {
  const path = window.location.pathname;
  return path.includes("/sermons/") || path.includes("/series/") || path.includes("/calendar/") || path.includes("/settings/") ? "../" : "";
}

function setupInstallMetadata() {
  const rootPrefix = appRootPrefix();
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = `${rootPrefix}manifest.webmanifest`;
    document.head.appendChild(manifest);
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    themeColor.content = "#0f6b35";
    document.head.appendChild(themeColor);
  }
  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    navigator.serviceWorker.register(`${rootPrefix}service-worker.js`).catch(() => {
      // The app still works without offline caching.
    });
  }
}

function initialsFromName(name = "") {
  const parts = name.replace(/^pastor\s+/i, "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "P") + (parts[1]?.[0] || "");
}

function applyProfile() {
  const profile = loadData().meta.profile || {};
  const appName = profile.appName || "Sermon Studio";
  const pastorName = profile.pastorName || "Pastor";
  const churchName = profile.churchName || "Church";
  document.title = document.title.replace(/^.*? - /, `${appName} - `);
  $$(".app-name").forEach((item) => item.textContent = appName);
  $$(".app-subtitle").forEach((item) => item.textContent = profile.appSubtitle || "Sermon Manager");
  $$(".pastor-name").forEach((item) => item.textContent = pastorName);
  $$(".church-name").forEach((item) => item.textContent = churchName);
  $$(".avatar").forEach((item) => item.textContent = initialsFromName(pastorName).toUpperCase());
}

document.addEventListener("DOMContentLoaded", () => {
  setActiveNavigation();
  setupTheme();
  setupMobileNav();
  setupBackupControls();
  setupInstallMetadata();
  applyProfile();
  document.addEventListener("keydown", (event) => {
    const search = document.querySelector("#global-search, #search-query");
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && search) {
      event.preventDefault();
      search.focus();
    }
  });
  const globalSearch = $("#global-search");
  if (globalSearch) {
    globalSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && globalSearch.value.trim()) {
        const path = window.location.pathname;
        const rootPrefix = appRootPrefix();
        window.location.href = `${rootPrefix}sermons/index.html?q=${encodeURIComponent(globalSearch.value.trim())}`;
      }
    });
  }
});
