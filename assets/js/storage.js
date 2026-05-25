import { sampleData } from "../data/sample-data.js";
import { createId, nowIso, sermonPlainText } from "./utils.js";

const STORAGE_KEY = "sermon-manager-data-v1";
const SNAPSHOT_KEY = "sermon-manager-safety-snapshots-v1";
const MAX_SNAPSHOTS = 8;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureSeeded() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
  }
}

export function loadData() {
  ensureSeeded();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const data = {
      meta: { ...clone(sampleData.meta), ...(parsed.meta || {}) },
      series: Array.isArray(parsed.series) ? parsed.series : [],
      sermons: Array.isArray(parsed.sermons) ? parsed.sermons : []
    };
    if ((data.meta.version || 1) < 2) {
      data.series = data.series.map((series) => series.id === "series-save-me" && series.bannerColor === "#7f1d2d"
        ? { ...series, bannerColor: "#0f6b35" }
        : series);
      data.meta.version = 2;
      saveData(data);
    }
    if ((data.meta.version || 1) < 3) {
      data.meta.profile = {
        ...clone(sampleData.meta.profile),
        ...(data.meta.profile || {})
      };
      data.meta.version = 3;
      saveData(data);
    }
    if ((data.meta.version || 1) < 4) {
      data.sermons = data.sermons.map((sermon) => ({
        ...sermon,
        outputNotes: sermon.outputNotes || { handout: "", slides: "", discussion: "" }
      }));
      data.meta.version = 4;
      saveData(data);
    }
    if ((data.meta.version || 1) < 5) {
      data.sermons = data.sermons.map((sermon) => ({
        ...sermon,
        prepChecklist: {
          manuscript: false,
          slides: false,
          handout: false,
          discussion: false,
          prayer: false,
          print: false,
          preachReady: false,
          ...(sermon.prepChecklist || {})
        }
      }));
      data.meta.version = 5;
      saveData(data);
    }
    if ((data.meta.version || 1) < 6) {
      data.sermons = data.sermons.map((sermon) => ({
        ...sermon,
        manuscriptDraft: sermon.manuscriptDraft || sermonPlainText(sermon)
      }));
      data.meta.version = 6;
      saveData(data);
    }
    return data;
  } catch (error) {
    console.error("Unable to load sermon data.", error);
    return clone(sampleData);
  }
}

export function saveData(data) {
  const nextData = {
    meta: data.meta || {},
    series: Array.isArray(data.series) ? data.series : [],
    sermons: Array.isArray(data.sermons) ? data.sermons : []
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
  return nextData;
}

export function updateData(mutator) {
  const data = loadData();
  const result = mutator(data) || data;
  saveData(result);
  return result;
}

export function deleteData(collection, id) {
  createSafetySnapshot(`Before deleting ${collection.slice(0, -1)}`);
  return updateData((data) => {
    data[collection] = (data[collection] || []).filter((item) => item.id !== id);
    if (collection === "series") {
      data.sermons = data.sermons.map((sermon) => sermon.seriesId === id ? { ...sermon, seriesId: "" } : sermon);
    }
    addActivity(data, `Deleted ${collection.slice(0, -1)}.`);
    return data;
  });
}

export function addActivity(data, message, type = "update") {
  const latest = (data.meta.activity || [])[0];
  const latestDate = latest?.date ? new Date(latest.date).getTime() : 0;
  const isRecentDuplicate = latest?.message === message && latest?.type === type && Date.now() - latestDate < 10 * 60 * 1000;
  if (isRecentDuplicate) {
    latest.date = nowIso();
    return;
  }
  data.meta.activity = [
    { id: createId("act"), type, message, date: nowIso() },
    ...(data.meta.activity || [])
  ].slice(0, 30);
}

export function getSermon(id) {
  return loadData().sermons.find((sermon) => sermon.id === id);
}

export function getSeries(id) {
  return loadData().series.find((item) => item.id === id);
}

export function upsertSermon(sermon) {
  return updateData((data) => {
    const exists = data.sermons.some((item) => item.id === sermon.id);
    const saved = { ...sermon, updatedAt: nowIso(), createdAt: sermon.createdAt || nowIso() };
    data.sermons = exists
      ? data.sermons.map((item) => item.id === sermon.id ? saved : item)
      : [saved, ...data.sermons];
    data.series = data.series.map((series) => {
      const sermonIds = new Set(series.sermonIds || []);
      if (saved.seriesId === series.id) sermonIds.add(saved.id);
      if (saved.seriesId !== series.id) sermonIds.delete(saved.id);
      return { ...series, sermonIds: Array.from(sermonIds), updatedAt: nowIso() };
    });
    addActivity(data, `${exists ? "Updated" : "Created"} sermon: ${saved.title || "Untitled sermon"}.`, "sermon");
    return data;
  });
}

export function upsertSeries(series) {
  return updateData((data) => {
    const exists = data.series.some((item) => item.id === series.id);
    const saved = { ...series, updatedAt: nowIso(), createdAt: series.createdAt || nowIso() };
    data.series = exists
      ? data.series.map((item) => item.id === series.id ? saved : item)
      : [saved, ...data.series];
    addActivity(data, `${exists ? "Updated" : "Created"} series: ${saved.title || "Untitled series"}.`, "series");
    return data;
  });
}

export function duplicateSermon(id) {
  const source = getSermon(id);
  if (!source) return null;
  const copy = {
    ...clone(source),
    id: createId("sermon"),
    title: `${source.title} Copy`,
    status: "Planning",
    datePreached: "",
    pinned: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  upsertSermon(copy);
  return copy;
}

export function duplicateSeries(id) {
  const source = getSeries(id);
  if (!source) return null;
  const copy = {
    ...clone(source),
    id: createId("series"),
    title: `${source.title} Copy`,
    status: "Planning",
    sermonIds: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  upsertSeries(copy);
  return copy;
}

export function exportBackup() {
  return JSON.stringify(loadData(), null, 2);
}

export function importBackup(json) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed.sermons) || !Array.isArray(parsed.series)) {
    throw new Error("Backup file is missing sermons or series.");
  }
  createSafetySnapshot("Before importing backup");
  saveData(parsed);
  return parsed;
}

export function resetToSampleData() {
  createSafetySnapshot("Before resetting sample data");
  saveData(clone(sampleData));
}

export function listSafetySnapshots() {
  try {
    const snapshots = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "[]");
    return Array.isArray(snapshots) ? snapshots : [];
  } catch {
    return [];
  }
}

export function createSafetySnapshot(reason = "Safety backup") {
  const current = localStorage.getItem(STORAGE_KEY);
  if (!current) return null;
  const snapshot = {
    id: createId("snapshot"),
    reason,
    date: nowIso(),
    data: current
  };
  const snapshots = [snapshot, ...listSafetySnapshots()].slice(0, MAX_SNAPSHOTS);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  return snapshot;
}

export function restoreSafetySnapshot(id) {
  const snapshot = listSafetySnapshots().find((item) => item.id === id);
  if (!snapshot) throw new Error("Safety snapshot not found.");
  createSafetySnapshot("Before restoring safety snapshot");
  localStorage.setItem(STORAGE_KEY, snapshot.data);
  return JSON.parse(snapshot.data);
}
