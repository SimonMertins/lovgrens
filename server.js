import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

// Ladda miljövariabler (.env)
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Bekräfta att API-nyckeln laddats
console.log("🔑 OpenAI API key laddad:", process.env.OPENAI_API_KEY ? "✅" : "❌");

// Initiera OpenAI-klienten
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY?.trim(),
});

// Logga alla inkommande requests (bra för felsökning)
app.use((req, res, next) => {
  console.log("👉 Incoming:", req.method, req.url);
  next();
});

// Test-route (går att nå via http://localhost:3000)
app.get("/", (req, res) => {
  res.send("✅ OBD-servern är igång och redo att ta emot anrop!");
});

// API-route för OBD-diagnos
app.post("/api/obd/diagnose", async (req, res) => {
  const { errorCode, carBrand, carYear } = req.body;

  console.log("📩 Data mottagen:", { errorCode, carBrand, carYear });

  if (!errorCode || !carBrand || !carYear) {
    return res.status(400).json({ error: "Alla fält måste fyllas i." });
  }

  const prompt = `
Du är en erfaren bilmekaniker med expertkunskap i OBD2-felkoder.
Analysera följande information och ge ett tydligt, konkret och korrekt svar:

Felkod: ${errorCode}
Bilmärke: ${carBrand}
Årsmodell: ${carYear}

Svara i följande format:
1. **Förklaring:** (vad betyder felet?)
2. **Vanliga orsaker:** (3–5 typiska orsaker för ${carBrand} ${carYear})
3. **Föreslagna åtgärder:** (steg-för-steg för felsökning och reparation)
4. **Ungefärlig kostnad:** (prisintervall i SEK)
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const result = completion.choices?.[0]?.message?.content?.trim();
    console.log("✅ OpenAI-svar mottaget!");
    res.json({ result });
  } catch (error) {
    console.error("❌ Fel vid OpenAI-anrop:", error);
    res.status(500).json({ error: "Ett fel uppstod vid API-anropet." });
  }
});

// Starta servern
const PORT = process.env.PORT || 3000;
// Testa att servern svarar på GET /
app.get("/", (req, res) => {
    res.send("✅ OBD-servern är igång och redo att ta emot anrop!");
  });  
app.listen(PORT, () => console.log(`🚗 Servern körs på port ${PORT}`));
