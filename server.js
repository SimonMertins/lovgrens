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

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Ingen OpenAI API-nyckel i .env!");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Skapa loggmapp
const logDir = path.resolve("logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

// 🔧 Route
app.post("/api/obd/diagnose", async (req, res) => {
  const { errorCode, carBrand, carYear, engineCode } = req.body;

  if (!errorCode || !carBrand || !carYear) {
    return res.status(400).json({ error: "Fyll i felkod, bilmärke och årsmodell." });
  }

  // 🧠 Förbättrad prompt
  const prompt = `
Du är en erfaren bilmekaniker med expertkunskap inom OBD2-diagnostik, elektronik och felsökning.
Analysera informationen nedan och ge ett tekniskt korrekt, strukturerat och tydligt svar.

Felkod: ${errorCode}
Bilmärke: ${carBrand}
Årsmodell: ${carYear}
${engineCode ? `Motorkod: ${engineCode}` : ""}

Svara alltid i detta format:

1. **Förklaring:** Vad betyder felkoden?
2. **Vanliga orsaker:** Lista realistiska orsaker för ${carBrand} ${carYear}${engineCode ? ` (${engineCode})` : ""}.
3. **Föreslagna åtgärder:** Steg-för-steg felsökning och reparation (både för nybörjare och mekaniker).
4. **Ungefärlig kostnad:** Rimligt prisintervall i SEK.
  `;

  async function runModel(modelName) {
    console.log(`⚙️ Försöker med ${modelName} ...`);
    const params = {
      model: modelName,
      messages: [{ role: "user", content: prompt }],
    };

    if (modelName === "gpt-5") {
      params.max_completion_tokens = 900;
      params.temperature = 1;
    } else {
      params.max_tokens = 900;
      params.temperature = 0.6;
    }

    return await openai.chat.completions.create(params);
  }

  try {
    let modelUsed = "gpt-5";
    let completion;

    // Först försök GPT-5
    try {
      completion = await runModel("gpt-5");
      const text = completion?.choices?.[0]?.message?.content?.trim();

      if (!text) {
        console.warn("⚠️ GPT-5 returnerade tomt svar. Faller tillbaka till GPT-4o-mini...");
        throw new Error("Empty GPT-5 response");
      }
    } catch (err) {
      console.warn("⚠️ GPT-5 misslyckades eller svarade tomt. Byter till GPT-4o-mini...");
      modelUsed = "gpt-4o-mini";
      completion = await runModel("gpt-4o-mini");
    }

    const result = completion?.choices?.[0]?.message?.content?.trim();
    if (!result) {
      console.error("⚠️ Tomt resultat även från GPT-4o-mini.");
      return res.status(500).json({ error: "AI kunde inte generera något svar." });
    }

    // Tokenloggning
    const usage = completion.usage;
    const totalTokens = usage?.total_tokens || 0;
    const costPer1k = modelUsed === "gpt-5" ? 0.60 : 0.10;
    const estimatedCost = ((totalTokens / 1000) * costPer1k).toFixed(3);

    console.log("──────────────────────────────────────────────");
    console.log(`🤖 Modell som användes: ${modelUsed}`);
    console.log(`🔎 Förfrågan: ${errorCode} (${carBrand} ${carYear}${engineCode ? " / " + engineCode : ""})`);
    console.log(`📊 Tokens: ${totalTokens}`);
    console.log(`💰 Intern kostnad: ${estimatedCost} SEK`);
    console.log("──────────────────────────────────────────────");

    // Logga till fil
    const logEntry = `[${new Date().toISOString()}] ${carBrand} ${carYear} ${errorCode} ${
      engineCode ? "(" + engineCode + ")" : ""
    } - Modell: ${modelUsed} - ${totalTokens} tokens ≈ ${estimatedCost} SEK\n`;
    fs.appendFileSync(path.join(logDir, "usage.log"), logEntry);

    // Skicka svaret
    res.json({ result });
  } catch (error) {
    console.error("❌ Allvarligt fel vid AI-anrop:", error);
    res.status(500).json({ error: "Ett oväntat fel uppstod vid AI-anropet." });
  }
});

// Testroute
app.get("/", (req, res) => {
  res.send("🚗 Lovgrens Diagnostik API är igång!");
});

// Starta server
app.listen(PORT, () => {
  console.log("──────────────────────────────────────────────");
  console.log(`🚀 Servern körs på port ${PORT}`);
  console.log("📡 Endpoint: POST /api/obd/diagnose");
  console.log("🔑 API-key laddad:", process.env.OPENAI_API_KEY ? "✅" : "❌");
  console.log("──────────────────────────────────────────────");
});
