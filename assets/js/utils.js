export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

export function createId(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDate(value, fallback = "Unscheduled") {
  if (!value) return fallback;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listToString(value) {
  return Array.isArray(value) ? value.join(", ") : value || "";
}

export function wordCount(text = "") {
  const matches = String(text).trim().match(/\b[\w'-]+\b/g);
  return matches ? matches.length : 0;
}

export function sermonPlainText(sermon = {}) {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const outline = (sermon.outline || [])
    .map((block, index) => {
      if (block.type === "Main Point") return `${roman[index] || index + 1}. ${block.title}\n${block.body}`;
      return `${block.type}: ${block.title}\n${block.body}`;
    })
    .join("\n\n");
  const scriptures = (sermon.scriptureBlocks || [])
    .map((block) => `${block.reference}\n${block.text}`)
    .join("\n\n");
  return [
    String(sermon.title || "").toUpperCase(),
    sermon.mainScripture || sermon.subtitle,
    sermon.introduction ? `INTRODUCTION\n\n${sermon.introduction}` : "",
    sermon.bigIdea,
    outline,
    scriptures,
    sermon.applications ? `LIFE APPLICATIONS\n\n${sermon.applications}` : "",
    sermon.conclusion ? `CONCLUSION\n\n${sermon.conclusion}` : "",
    sermon.invitation ? `INVITATION\n\n${sermon.invitation}` : "",
    sermon.personalNotes,
    sermon.researchNotes,
    sermon.prayerNotes
  ].filter(Boolean).join("\n\n");
}

export function calculateSermonMetrics(sermon = {}) {
  const text = sermonPlainText(sermon);
  const words = wordCount(text);
  return {
    words,
    characters: text.length,
    speakingMinutes: Math.max(1, Math.round(words / 135))
  };
}

export function prepProgress(sermon = {}) {
  const checklist = sermon.prepChecklist || {};
  const keys = ["manuscript", "slides", "handout", "discussion", "prayer", "print", "preachReady"];
  const done = keys.filter((key) => Boolean(checklist[key])).length;
  return {
    done,
    total: keys.length,
    percent: Math.round((done / keys.length) * 100)
  };
}

export function readinessReview(sermon = {}) {
  const checklist = sermon.prepChecklist || {};
  const missing = [];
  if (!sermon.title) missing.push("Add a sermon title.");
  if (!sermon.mainScripture) missing.push("Assign the main scripture.");
  if (!sermon.bigIdea) missing.push("Write the big idea.");
  if (!sermon.introduction) missing.push("Draft the introduction.");
  if (!(sermon.outline || []).length) missing.push("Add at least one outline block.");
  if (!sermon.conclusion) missing.push("Draft the conclusion.");
  if (!checklist.manuscript) missing.push("Mark manuscript drafted.");
  if (!checklist.prayer) missing.push("Review prayer/preaching notes.");
  if (!checklist.preachReady) missing.push("Mark ready to preach.");
  return {
    isReady: missing.length === 0,
    missing
  };
}

export function parseScriptureBook(reference = "") {
  const match = String(reference).trim().match(/^(\d?\s?[A-Za-z]+)/);
  return match ? match[1].trim() : "";
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("sermon-manager-theme", theme);
}

export function getTheme() {
  return localStorage.getItem("sermon-manager-theme") || "light";
}

export function toast(message, type = "success") {
  let region = $("#toast-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "toast-region";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.textContent = message;
  region.append(item);
  window.setTimeout(() => item.remove(), 3600);
}

export function confirmAction(message) {
  return window.confirm(message);
}
