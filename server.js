// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Kontrollera API-nyckel ---
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Ingen OpenAI API-nyckel i .env!");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Skapa loggmapp ---
const logDir = path.resolve("logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

// --------------------------------------------------------------------
// 🧠 DIAGNOS-ENDPOINT
// --------------------------------------------------------------------
app.post("/api/obd/diagnose", async (req, res) => {
  const { errorCode, carBrand, carYear, engineCode } = req.body;

  if (!errorCode || !carBrand || !carYear) {
    return res
      .status(400)
      .json({ error: "Fyll i felkod, bilmärke och årsmodell." });
  }

  const prompt = `
Du är en mycket erfaren bilmekaniker och diagnostechniker med expertkunskap inom OBD2-system,
motorelektronik, sensorer och bränslesystem.

Analysera följande uppgifter och ge ett tekniskt korrekt, tydligt och professionellt svar.

Felkoder: ${errorCode}
Bilmärke: ${carBrand}
Årsmodell: ${carYear}
${engineCode ? `Motorkod: ${engineCode}` : ""}

Om flera felkoder anges, analysera **varje kod separat** och beskriv deras individuella betydelse.
Identifiera därefter **möjliga samband** mellan dem och ge en gemensam teknisk bedömning.

Svara alltid i detta format:

1. **Förklaring per kod:** Förklara varje kods betydelse på ett tydligt men tekniskt sätt.
2. **Troliga orsaker:** Lista de vanligaste orsakerna för dessa felkoder på ${carBrand} ${carYear}.
3. **Rekommenderade åtgärder:** Ge en konkret steg-för-steg-plan för felsökning och åtgärd.
4. **Sammanfattning:** Kort slutsats om vad som mest sannolikt orsakar felen.

Var alltid konkret och pedagogisk. Undvik generella eller alltför breda förklaringar.
`;

  try {
    console.log(`⚙️ Kör GPT-4o för diagnos (${carBrand} ${carYear}) ...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
      temperature: 0.6,
    });

    const result = completion.choices?.[0]?.message?.content?.trim();
    if (!result) {
      console.error("⚠️ Tomt svar från modellen.");
      return res.status(500).json({ error: "Inget svar från AI-modellen." });
    }

    // Tokenloggning
    const usage = completion.usage;
    const tokens = usage?.total_tokens || 0;
    const estimatedCost = ((tokens / 1000) * 0.1).toFixed(3);

    console.log("──────────────────────────────────────────────");
    console.log(`🤖 Modell: gpt-4o`);
    console.log(`🔎 Förfrågan: ${errorCode} (${carBrand} ${carYear})`);
    console.log(`📊 Tokens: ${tokens}  💰 Intern kostnad: ${estimatedCost} SEK`);
    console.log("──────────────────────────────────────────────");

    const logEntry = `[${new Date().toISOString()}] ${carBrand} ${carYear} ${errorCode} - ${tokens} tokens ≈ ${estimatedCost} SEK\n`;
    fs.appendFileSync(path.join(logDir, "usage.log"), logEntry);

    res.json({ result });
  } catch (error) {
    console.error("❌ Fel vid diagnos:", error);
    res
      .status(500)
      .json({ error: "Ett fel uppstod vid AI-anropet. Försök igen senare." });
  }
});

// --------------------------------------------------------------------
// 💬 CHAT-ENDPOINT (för PRO-användare)
// --------------------------------------------------------------------
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res
      .status(400)
      .json({ error: "Ogiltig chat-förfrågan. Saknar 'messages'-array." });
  }

  try {
    console.log(`💬 Startar GPT-4o-chat med ${messages.length} meddelanden ...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Du är en erfaren bilmekaniker som hjälper användaren med avancerad felsökning och rådgivning. Skriv kortfattat, tekniskt och konkret.",
        },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "";

    const usage = completion.usage;
    const tokens = usage?.total_tokens || 0;
    const estimatedCost = ((tokens / 1000) * 0.1).toFixed(3);

    console.log(`💬 Chat-svar genererat (${tokens} tokens ≈ ${estimatedCost} SEK)`);

    res.json({ reply });
  } catch (error) {
    console.error("❌ Chat-fel:", error);
    res
      .status(500)
      .json({ error: "Ett fel uppstod vid AI-chatt-anropet." });
  }
});

// --------------------------------------------------------------------
// 🌐 TESTROUTE
// --------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send("🚗 Lovgrens Diagnostik API (GPT-4o) är igång!");
});

// --------------------------------------------------------------------
// 🚀 STARTA SERVER
// --------------------------------------------------------------------
app.listen(PORT, () => {
  console.log("──────────────────────────────────────────────");
  console.log(`🚀 Servern körs på port ${PORT}`);
  console.log("📡 Endpoints:");
  console.log("   POST /api/obd/diagnose  → Felsökning");
  console.log("   POST /api/chat           → AI-chat (Pro)");
  console.log("🔑 API-key laddad:", process.env.OPENAI_API_KEY ? "✅" : "❌");
  console.log("──────────────────────────────────────────────");
});
