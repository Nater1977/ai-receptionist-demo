import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const SYSTEM_PROMPT = `
You are the AI receptionist for Checkered Flag Auto Center.

Business: Checkered Flag Auto Center
Hours: Mon–Fri 8am–6pm, Sat 9am–1pm, Sun closed.

Services: General repair, diagnostics, brakes, oil change, engines, electrical, tires, state inspection, light diesel.

Your job:
- Answer calls professionally.
- Ask for year/make/model.
- Ask what the issue is.
- Ask when they’d like to come in.
- Ask for name and phone number.
- Summarize the lead.

Tone: friendly, professional, clear.
`;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Serve frontend
app.use(express.static("public"));

// --- Realtime WS bridge ---
wss.on("connection", async (clientSocket) => {
  try {
    // 1. Create a Realtime session using latest SDK
    const session = await client.realtime.sessions.create({
      model: "gpt-4o-realtime-preview-2024-12-17",
      instructions: SYSTEM_PROMPT,
      voice: "alloy",
      modalities: ["audio", "text"],
    });

    // 2. Connect to OpenAI WS
    const aiSocket = new WebSocket(session.websocket_url, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });

    // 3. Forward OpenAI → Browser
    aiSocket.on("message", (msg) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(msg);
      }
    });

    // 4. Forward Browser → OpenAI
    clientSocket.on("message", (msg) => {
      if (aiSocket.readyState === WebSocket.OPEN) {
        aiSocket.send(msg);
      }
    });

    // 5. Cleanup
    const closeAll = () => {
      if (clientSocket.readyState === WebSocket.OPEN) clientSocket.close();
      if (aiSocket.readyState === WebSocket.OPEN) aiSocket.close();
    };
    clientSocket.on("close", closeAll);
    aiSocket.on("close", closeAll);

  } catch (err) {
    console.error("Realtime session error:", err);
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`AI receptionist demo running at http://localhost:${process.env.PORT || 3000}`);
});
