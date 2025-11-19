// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Set OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Server-side Supabase client (service role)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const app = express();
app.use(cors());
app.use(express.json());

// Helper: get user from bearer token sent by client
async function getUserFromAuthHeader(req) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return { error: "No token provided", user: null };

    // supabase.auth.getUser requires the token
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      return { error: error.message || "Could not fetch user", user: null };
    }
    return { user: data.user, error: null };
  } catch (err) {
    return { error: err.message || String(err), user: null };
  }
}

// Simple parser for multiple codes
function parseCodes(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  return String(input).split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
}

// Basic OpenAI call with fallback list and logging
async function callOpenAI(promptMessages, models = ["gpt-4o", "gpt-4o-mini"]) {
  for (const model of models) {
    try {
      console.log("⚙️ Försöker med modell:", model);
      const completion = await openai.chat.completions.create({
        model,
        messages: promptMessages,
      });

      let text = "";
      if (completion?.choices?.[0]?.message?.content) text = completion.choices[0].message.content;
      else if (completion?.output_text) text = completion.output_text;

      const usage = completion?.usage ?? null;
      return { success: true, model, text, usage, raw: completion };
    } catch (err) {
      console.warn("Model failed:", model, err?.message || err);
      continue;
    }
  }
  return { success: false, error: "No model available" };
}

// ---------------- Endpoint: POST /api/obd/diagnose ----------------
app.post("/api/obd/diagnose", async (req, res) => {
  try {
    // Authenticate request
    const { user, error: userErr } = await getUserFromAuthHeader(req);
    if (userErr || !user) {
      console.warn("Auth failed:", userErr);
      return res.status(401).json({ error: "Ej inloggad eller ogiltig token." });
    }

    const { errorCode, carBrand, carYear, engineCode } = req.body;
    if (!errorCode || !carBrand || !carYear) {
      return res.status(400).json({ error: "Fält errorCode, carBrand, carYear krävs." });
    }

    const codes = parseCodes(errorCode);

    const prompt = [
      {
        role: "system",
        content:
          "Du är en erfaren bilmekaniker med expertkunskap om OBD2-felkoder. Ge korta, konkreta och handlingsbara svar anpassade för verkstad.",
      },
      {
        role: "user",
        content: `Analysera följande:
Felkod(er): ${codes.join(", ")}
Bilmärke: ${carBrand}
Årsmodell: ${carYear}
Motorkod: ${engineCode || "Okänd"}

Svara i detta format:
1. Förklaring:
2. Vanliga orsaker:
3. Föreslagna åtgärder:
4. Obs/Notera:`,
      },
    ];

    const aiResp = await callOpenAI(prompt, ["gpt-4o", "gpt-4o-mini"]);
    if (!aiResp.success) {
      console.error("AI error:", aiResp.error);
      return res.status(500).json({ error: "AI-svar kunde inte genereras." });
    }

    const aiText = aiResp.text || "(Inget textresultat)";
    const modelUsed = aiResp.model || "unknown";
    const usage = aiResp.usage || null;

    // Insert diagnosis row
    const insertObj = {
      user_id: user.id,
      error_codes: codes,
      car_brand: carBrand,
      car_year: Number(carYear),
      engine_code: engineCode || null,
      result: aiText,
      model_used: modelUsed,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("diagnoses")
      .insert(insertObj)
      .select()
      .single();

    if (insertErr) {
      console.error("Supabase insert error:", insertErr);
      // Return DB error details to frontend (for debugging)
      return res.status(500).json({
        error: "Kunde inte spara diagnos i databasen.",
        db_error: insertErr,
      });
    }

    const diagnosisId = inserted.id;

    // Save metadata (no need to block response)
    try {
      await supabase.from("diagnosis_metadata").insert({
        diagnosis_id: diagnosisId,
        user_id: user.id,
        model: modelUsed,
        tokens_prompt: usage?.prompt_tokens ?? null,
        tokens_completion: usage?.completion_tokens ?? usage?.total_tokens ?? null,
        response_time_ms: null,
        device_info: req.headers["user-agent"] || null,
        created_at: new Date().toISOString(),
      });
    } catch (metaErr) {
      console.warn("Metadata insert failed:", metaErr);
    }

    // Return the diagnosis row + ai text
    return res.json({
      diagnosis: inserted,
      result: aiText,
      model_used: modelUsed,
      usage,
    });
  } catch (err) {
    console.error("Unexpected server error (diagnose):", err);
    return res.status(500).json({ error: "Internt serverfel", detail: err.message || String(err) });
  }
});

// ---------------- Endpoint: POST /api/chat ----------------
app.post("/api/chat", async (req, res) => {
  try {
    const { user, error: userErr } = await getUserFromAuthHeader(req);
    if (userErr || !user) return res.status(401).json({ error: "Ej inloggad." });

    const { messages, diagnosisId } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "messages array krävs" });

    // send to AI
    const aiResp = await callOpenAI(messages, ["gpt-4o", "gpt-4o-mini"]);
    if (!aiResp.success) return res.status(500).json({ error: "AI-svar saknas." });

    const reply = aiResp.text || "";

    // persist all messages + assistant reply
    const inserts = messages.map((m) => ({
      diagnosis_id: diagnosisId || null,
      user_id: user.id,
      role: m.role || "user",
      content: m.content || "",
      created_at: new Date().toISOString(),
    }));
    inserts.push({
      diagnosis_id: diagnosisId || null,
      user_id: user.id,
      role: "assistant",
      content: reply,
      created_at: new Date().toISOString(),
    });

    const { error: chatErr } = await supabase.from("chats").insert(inserts);
    if (chatErr) console.warn("Could not save chats:", chatErr);

    return res.json({ reply, model_used: aiResp.model, usage: aiResp.usage });
  } catch (err) {
    console.error("Unexpected server error (chat):", err);
    return res.status(500).json({ error: "Internt serverfel chat", detail: err.message || String(err) });
  }
});

app.get("/", (_req, res) => res.send("AutonomeX API OK"));

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
