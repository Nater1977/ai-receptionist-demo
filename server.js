// server.js
import express from "express";
import http from "http";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("Set OPENAI_API_KEY in your environment (e.g. .env).");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static("public")); // optional: serve your html from /public

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/**
 * For each browser client WebSocket:
 *  - open a dedicated WebSocket to OpenAI Realtime
 *  - forward messages from browser -> openai
 *  - forward messages from openai -> browser
 *
 * This is a straightforward proxy so client can use the same message
 * format you already use in the browser HTML.
 *
 * NOTE: Replace `gpt-4o-realtime-preview` with your realtime-enabled model name if necessary.
 */
wss.on("connection", async (clientWs, req) => {
  console.log("Browser client connected:", req.socket.remoteAddress);

  // Build OpenAI Realtime ws URL (model param may vary)
  const model = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview";
  const openaiUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;

  // Create OpenAI WS
  const openaiWs = new WebSocket(openaiUrl, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      // Optionally you can set `OpenAI-Beta: realtime=v1` or other headers if required
    },
  });

  openaiWs.on("open", () => {
    console.log("Connected to OpenAI realtime for this client.");
  });

  openaiWs.on("message", (data) => {
    // openai sends JSON messages; forward them straight to the browser
    // Some implementations may send binary for audio — we handle arraybuffer below too.
    try {
      // if buffer -> forward raw
      clientWs.send(data);
    } catch (err) {
      console.error("Error forwarding openai -> client:", err);
    }
  });

  openaiWs.on("close", (code, reason) => {
    console.log("OpenAI WS closed:", code, reason?.toString());
    try { clientWs.close(); } catch (_) {}
  });

  openaiWs.on("error", (err) => {
    console.error("OpenAI WS error:", err);
    try { clientWs.send(JSON.stringify({ type: "error", message: "OpenAI connection error" })); } catch (_) {}
  });

  clientWs.on("message", (msg) => {
    // messages from browser will be JSON strings. We just forward them to OpenAI.
    // If you plan to do validation or conversion, do it here.
    try {
      // If the browser ever sends binary, forward as-is
      if (typeof msg !== "string" && msg instanceof Buffer) {
        openaiWs.send(msg);
        return;
      }

      // If it's a text message, forward
      // Optionally, you can inspect or transform the message here
      openaiWs.send(msg);
    } catch (err) {
      console.error("Error forwarding client -> openai:", err);
    }
  });

  clientWs.on("close", () => {
    console.log("Browser client disconnected. Closing OpenAI WS.");
    try { openaiWs.close(); } catch (_) {}
  });

  clientWs.on("error", (err) => {
    console.error("Client WS error:", err);
    try { openaiWs.close(); } catch (_) {}
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log("Make sure your browser client connects to this host (ws endpoint).");
});
