const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const LAN_MATCH_TYPES = new Set(["lan", "lan-coop"]);

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Private-Network-Access");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function sendJson(res, status, payload) {
  setCorsHeaders(res);
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error("payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function createRoom() {
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();
  const room = {
    code,
    createdAt: Date.now(),
    touchedAt: Date.now(),
    hostClientId: crypto.randomUUID(),
    guestClientId: null,
    matchType: "lan",
    startedAt: 0,
    startRequestedBy: null,
    snapshot: null,
    snapshotRevision: 0,
    nextCommandIndex: 1,
    commands: [],
  };
  rooms.set(code, room);
  return room;
}

function touchRoom(room) {
  room.touchedAt = Date.now();
}

function cleanupRooms() {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of rooms.entries()) {
    if (room.touchedAt < cutoff) {
      console.log(`[${new Date().toISOString()}] Room ${code} expired and was cleaned up`);
      rooms.delete(code);
    }
  }
}

function getRoomByClient(clientId) {
  for (const room of rooms.values()) {
    if (room.hostClientId === clientId || room.guestClientId === clientId) return room;
  }
  return null;
}

function getLanAddresses() {
  const net = os.networkInterfaces();
  const urls = [];
  for (const [name, entries] of Object.entries(net)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (!entry || entry.internal || entry.family !== "IPv4") continue;
      urls.push({
        url: `http://${entry.address}:${port}`,
        address: entry.address,
        name,
        score: scoreLanAddress(entry.address),
      });
    }
  }
  urls.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name) || a.address.localeCompare(b.address));
  return [...new Map(urls.map((entry) => [entry.url, entry])).values()].map((entry) => entry.url);
}

function scoreLanAddress(address) {
  if (/^192\.168\./.test(address)) return 0;
  if (/^10\./.test(address)) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return 2;
  if (/^25\./.test(address)) return 3;
  if (/^169\.254\./.test(address)) return 8;
  return 4;
}

function normalizeLanMatchType(value) {
  const matchType = String(value || "").trim();
  return LAN_MATCH_TYPES.has(matchType) ? matchType : "lan";
}

function getShareBase(req) {
  const hostHeader = String(req.headers.host || "").trim();
  if (hostHeader) {
    const lower = hostHeader.toLowerCase();
    if (!lower.startsWith("127.0.0.1") && !lower.startsWith("localhost") && !lower.startsWith("0.0.0.0")) {
      return `http://${hostHeader}`;
    }
  }
  const lanUrls = getLanAddresses();
  if (lanUrls.length) return lanUrls[0];
  return `http://127.0.0.1:${port}`;
}

function getClientIp(req) {
  return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}

setInterval(cleanupRooms, 60_000).unref();

async function handleApi(req, res, pathname) {
  const clientIp = getClientIp(req);
  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} from ${clientIp}`);
  if (req.method === "POST" && pathname === "/api/lan/host") {
    const body = await readJson(req);
    const room = createRoom();
    room.matchType = normalizeLanMatchType(body.matchType);
    const apiBase = getShareBase(req);
    const joinUrl = `${apiBase}/?room=${encodeURIComponent(room.code)}&match=${encodeURIComponent(room.matchType)}&server=${encodeURIComponent(apiBase)}`;
    console.log(`[${new Date().toISOString()}] Room created: ${room.code} by host ${room.hostClientId} from ${clientIp}`);
    sendJson(res, 200, {
      ok: true,
      role: "host",
      roomCode: room.code,
      clientId: room.hostClientId,
      matchType: room.matchType,
      apiBase,
      joinUrl,
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/lan/join") {
    const body = await readJson(req);
    const roomCode = String(body.roomCode || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) {
      console.log(`[${new Date().toISOString()}] Join failed: Room ${roomCode} not found from ${clientIp}`);
      sendJson(res, 404, { ok: false, error: "Room not found." });
      return true;
    }
    if (room.guestClientId) {
      console.log(`[${new Date().toISOString()}] Join failed: Room ${roomCode} already has a guest from ${clientIp}`);
      sendJson(res, 409, { ok: false, error: "Room already has a guest." });
      return true;
    }
    room.guestClientId = crypto.randomUUID();
    touchRoom(room);
    const apiBase = getShareBase(req);
    const joinUrl = `${apiBase}/?room=${encodeURIComponent(room.code)}&match=${encodeURIComponent(room.matchType)}&server=${encodeURIComponent(apiBase)}`;
    console.log(`[${new Date().toISOString()}] Guest joined room ${room.code}: ${room.guestClientId} from ${clientIp}`);
    sendJson(res, 200, {
      ok: true,
      role: "guest",
      roomCode: room.code,
      clientId: room.guestClientId,
      matchType: room.matchType,
      apiBase,
      joinUrl,
      started: Boolean(room.startedAt),
      startedAt: room.startedAt,
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/lan/poll") {
    const body = await readJson(req);
    const clientId = String(body.clientId || "");
    const room = getRoomByClient(clientId);
    if (!room) {
      console.log(`[${new Date().toISOString()}] Poll failed: LAN room not found for client ${clientId} from ${clientIp}`);
      sendJson(res, 404, { ok: false, error: "LAN room not found." });
      return true;
    }
    touchRoom(room);
    const role = clientId === room.hostClientId ? "host" : "guest";
    const snapshotRevision = Number(body.snapshotRevision || 0);
    const commandIndex = Number(body.commandIndex || 0);
    const payload = {
      ok: true,
      role,
      roomCode: room.code,
      matchType: room.matchType,
      started: Boolean(room.startedAt),
      startedAt: room.startedAt,
      guestJoined: Boolean(room.guestClientId),
      hostReady: Boolean(room.snapshot),
      snapshotRevision: room.snapshotRevision,
      commandIndex: room.nextCommandIndex - 1,
    };
    if (role === "host") {
      payload.commands = room.commands.filter((entry) => entry.index > commandIndex);
    } else if (room.snapshotRevision > snapshotRevision) {
      payload.snapshot = room.snapshot;
    }
    sendJson(res, 200, payload);
    return true;
  }

  if (req.method === "POST" && pathname === "/api/lan/start") {
    const body = await readJson(req);
    const clientId = String(body.clientId || "");
    const room = getRoomByClient(clientId);
    if (!room) {
      sendJson(res, 404, { ok: false, error: "LAN room not found." });
      return true;
    }
    room.startedAt = room.startedAt || Date.now();
    room.startRequestedBy = clientId === room.hostClientId ? "host" : "guest";
    touchRoom(room);
    console.log(`[${new Date().toISOString()}] Game started in room ${room.code} by ${room.startRequestedBy} from ${clientIp}`);
    sendJson(res, 200, {
      ok: true,
      roomCode: room.code,
      matchType: room.matchType,
      started: true,
      startedAt: room.startedAt,
      guestJoined: Boolean(room.guestClientId),
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/lan/state") {
    const body = await readJson(req);
    const clientId = String(body.clientId || "");
    const room = getRoomByClient(clientId);
    if (!room || room.hostClientId !== clientId) {
      sendJson(res, 403, { ok: false, error: "Only the room host can publish state." });
      return true;
    }
    room.snapshot = body.snapshot || null;
    room.snapshotRevision += 1;
    touchRoom(room);
    console.log(`[${new Date().toISOString()}] State published in room ${room.code} by host from ${clientIp}: revision ${room.snapshotRevision}`);
    sendJson(res, 200, { ok: true, snapshotRevision: room.snapshotRevision, guestJoined: Boolean(room.guestClientId) });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/lan/input") {
    const body = await readJson(req);
    const clientId = String(body.clientId || "");
    const room = getRoomByClient(clientId);
    if (!room || room.guestClientId !== clientId) {
      sendJson(res, 403, { ok: false, error: "Only the joined guest can send commands." });
      return true;
    }
    room.commands.push({
      index: room.nextCommandIndex,
      command: body.command || null,
    });
    room.nextCommandIndex += 1;
    touchRoom(room);
    if (room.commands.length > 400) room.commands.splice(0, room.commands.length - 400);
    console.log(`[${new Date().toISOString()}] Command sent in room ${room.code} by guest from ${clientIp}: index ${room.nextCommandIndex - 1}`);
    sendJson(res, 200, { ok: true, commandIndex: room.nextCommandIndex - 1 });
    return true;
  }

  return false;
}

function serveStatic(req, res, pathname) {
  const requestPathRaw = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let requestPath;
  try {
    requestPath = decodeURIComponent(requestPathRaw);
  } catch {
    requestPath = requestPathRaw;
  }

  const normalized = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(root, normalized);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      setCorsHeaders(res);
      res.writeHead(404);
      res.end("not found");
      return;
    }
    setCorsHeaders(res);
    res.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mime[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
      }
      const url = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${port}`}`);
      const handled = await handleApi(req, res, url.pathname);
      if (handled) return;
      serveStatic(req, res, url.pathname);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message || "Server error." });
    }
  });

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
    console.error("Stop the old Top Knights server process, then run `node server.js` again.");
    console.error("PowerShell: `Stop-Process -Id <PID>`");
    process.exit(1);
  }
  throw error;
});

server.listen(port, host, () => {
  const localUrl = `http://127.0.0.1:${port}`;
  console.log(`Top Knights server listening on ${localUrl}`);
  const lanUrls = getLanAddresses();
  if (lanUrls.length) {
    console.log("LAN URLs:");
    lanUrls.forEach((url) => console.log(`  ${url}`));
  }
});
