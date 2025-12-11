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

// WebSocket for Realtime API
wss.on("connection", async (ws) => {
  const openai = await client.realtime.sessions.create({
    model: "gpt-4o-realtime-preview-2024-12-17",
    instructions: SYSTEM_PROMPT,
    voice: "alloy",
  });

  const ai_ws = client.realtime.connect(openai.id);

  ai_ws.on("message", (msg) => ws.send(msg));
  ws.on("message", (msg) => ai_ws.send(msg));

  ws.on("close", () => ai_ws.close());
});

server.listen(3000, () => {
  console.log("AI receptionist demo running at http://localhost:3000");
});
