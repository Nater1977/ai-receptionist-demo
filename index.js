import express from "express";
import path from "path";
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

// Serve static test page
app.use(express.static("public"));

// --- REALTIME WEBSOCKET BRIDGE ---
wss.on("connection", async (clientSocket) => {
  try {
    // 1. Create a realtime session
    const session = await client.sessions.createRealtimeSession({
      model: "gpt-4o-realtime-preview-2024-12-17",
      instructions: SYSTEM_PROMPT,
      voice: "alloy",
      modalities: ["text", "audio"],
    });

    // 2. Connect to OpenAI's WebSocket using the returned URL
    const aiSocket = new WebSocket(session.websocket_url, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    // 3. Relay OpenAI → Browser
    aiSocket.on("message", (msg) => {
      clientSocket.send(msg);
    });

    // 4. Relay Browser → OpenAI
    clientSocket.on("message", (msg) => {
      aiSocket.send(msg);
    });

    // 5. Clean up on disconnect
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
