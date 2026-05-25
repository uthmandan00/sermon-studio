import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

const root = resolve(".");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png"
};

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxUploadBytes) {
        rejectBody(new Error("File is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolveBody(Buffer.concat(chunks)));
    request.on("error", rejectBody);
  });
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (readUInt32(buffer, index) === 0x06054b50) return index;
  }
  throw new Error("Invalid DOCX archive.");
}

function extractZipEntry(buffer, entryName) {
  const eocd = findEndOfCentralDirectory(buffer);
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = readUInt32(buffer, eocd + 16);
  for (let index = 0; index < entries; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) throw new Error("Invalid DOCX directory.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = readUInt32(buffer, offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === entryName) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.slice(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      throw new Error("Unsupported DOCX compression.");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("DOCX does not contain word/document.xml.");
}

function decodeXml(value = "") {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function docxXmlToText(xml) {
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  return paragraphs.map((paragraph) => {
    const withBreaks = paragraph
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n");
    const text = [...withBreaks.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("");
    return text.replace(/[ \t]+\n/g, "\n").trim();
  }).filter(Boolean).join("\n\n");
}

async function handleDocxImport(request, response) {
  try {
    const contentType = request.headers["content-type"] || "";
    if (!contentType.includes("wordprocessingml.document") && !contentType.includes("octet-stream")) {
      response.writeHead(415, securityHeaders({ "Content-Type": "application/json; charset=utf-8" }));
      response.end(JSON.stringify({ error: "Upload a .docx Word document." }));
      return;
    }
    const body = await readBody(request);
    const xml = extractZipEntry(body, "word/document.xml").toString("utf8");
    const text = docxXmlToText(xml);
    response.writeHead(200, securityHeaders({ "Content-Type": "application/json; charset=utf-8" }));
    response.end(JSON.stringify({ text }));
  } catch (error) {
    response.writeHead(error.message === "File is too large." ? 413 : 400, securityHeaders({ "Content-Type": "application/json; charset=utf-8" }));
    response.end(JSON.stringify({ error: error.message || "Could not import DOCX." }));
  }
}

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    ...extra
  };
}

function isInsideRoot(filePath) {
  const pathFromRoot = relative(root, filePath);
  return pathFromRoot && !pathFromRoot.startsWith("..") && !normalize(pathFromRoot).startsWith("..");
}

function cacheHeader(filePath) {
  if (filePath.endsWith(".html") || filePath.endsWith("service-worker.js")) return "no-cache";
  return "public, max-age=3600";
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      response.writeHead(200, securityHeaders({ "Content-Type": "application/json; charset=utf-8" }));
      response.end(JSON.stringify({ ok: true, app: "Sermon Studio" }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/import-docx") {
      await handleDocxImport(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, securityHeaders({ Allow: "GET, HEAD, POST" }));
      response.end("Method not allowed");
      return;
    }
    const pathname = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const filePath = normalize(join(root, decodeURIComponent(pathname)));
    if (!isInsideRoot(filePath)) {
      response.writeHead(403, securityHeaders());
      response.end("Forbidden");
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, securityHeaders({
      "Content-Type": types[extname(filePath)] || "text/plain; charset=utf-8",
      "Cache-Control": cacheHeader(filePath)
    }));
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    response.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`Sermon Manager running at http://${host}:${port}`);
});
