import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// --- AI CONFIG ---
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

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Serve frontend
app.use(express.static("public"));

// --- REALTIME WEBSOCKET BRIDGE ---
wss.on("connection", async (clientSocket) => {
  try {
    // 1) Create Realtime session with audio + text
    const session = await client.sessions.createRealtimeSession({
      model: "gpt-4o-realtime-preview-2024-12-17",
      instructions: SYSTEM_PROMPT,
      voice: "alloy",               // valid voice
      modalities: ["text", "audio"] // must include audio
    });

    console.log("Realtime session created:", session.websocket_url);

    // 2) Connect to OpenAI Realtime WS
    const aiSocket = new WebSocket(session.websocket_url, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });

    // 3) Browser → OpenAI
    clientSocket.on("message", (msg) => {
      aiSocket.send(msg);

      // Whenever browser sends audio, also request AI response
      const parsed = JSON.parse(msg);
      if (parsed.type === "input_audio_buffer.commit") {
        aiSocket.send(JSON.stringify({
          type: "response.create",
          response: { modalities: ["audio", "text"] }
        }));
      }
    });

    // 4) OpenAI → Browser
    aiSocket.on("message", (msg) => {
      clientSocket.send(msg);
    });

    // 5) Cleanup on disconnect
    clientSocket.on("close", () => aiSocket.close());
    aiSocket.on("close", () => clientSocket.close());

  } catch (err) {
    console.error("Realtime session error:", err);
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log(
    `AI receptionist demo running at http://localhost:${process.env.PORT || 3000}`
  );
});
