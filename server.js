// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Kolla API-nyckeln ---
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Ingen OpenAI API-nyckel i .env-filen!");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Huvudroute för OBD-diagnos ---
app.post("/api/obd/diagnose", async (req, res) => {
  const { errorCode, carBrand, carYear, engineCode } = req.body;

  // Validera input
  if (!errorCode || !carBrand || !carYear) {
    return res.status(400).json({ error: "Alla obligatoriska fält måste fyllas i (felkod, bilmärke, årsmodell)." });
  }

  // Bygg AI-prompten
  const prompt = `
Du är en professionell bilmekaniker och diagnostekniker med expertkunskap i OBD2-felkoder och moderna fordonssystem.
Du ska agera som en teknisk rådgivare för en verkstad som felsöker en bil.

Analysera följande data och skriv ett **verkstadsanpassat felsökningsprotokoll**:

- Felkod: ${errorCode}
- Bilmärke: ${carBrand}
- Årsmodell: ${carYear}
${engineCode ? `- Motorkod: ${engineCode}` : ""}

### Viktigt:
1. Identifiera vilken **systemkategori** felkoden tillhör utifrån dess prefix:
   - **P0xxx / P1xxx:** Motor / Drivlina / Avgassystem
   - **C0xxx / C1xxx:** Chassi (ABS, styrning, bromsar)
   - **B0xxx / B1xxx:** Kaross (airbag, dörrar, klimatsystem)
   - **U0xxx / U1xxx:** Kommunikationsnätverk (CAN, ECU, sensorer)
2. Skriv svaret på **tydlig, teknisk svenska**, anpassad för yrkespersoner.
3. Undvik prisuppgifter eller uppskattningar.

---

### Format för svaret:

1. **System & kodbeskrivning**
   Identifiera vilket system felkoden hör till (ex. “Motorstyrsystem - syresensor bank 1”)  
   och ge en kort, teknisk förklaring av felet.

2. **Trolig grundorsak**
   Beskriv vilka komponenter, signaler eller system som oftast orsakar denna kod  
   för just ${carBrand} ${carYear}${engineCode ? ` (${engineCode})` : ""}.  
   Prioritera verkliga scenarier som förekommer i verkstäder.

3. **Diagnossteg**
   Ge en konkret felsökningsplan i numrerad ordning (1., 2., 3. …).  
   Inkludera mätningar, tester eller visuella kontroller som en mekaniker bör göra.
   Exempel:  
   - Kontrollera signalspänning med multimeter.  
   - Läs livedata i OBD-verktyg.  
   - Kontrollera kablage och kontaktstycken.  
   - Utför testkörning efter radering av felkod.

4. **Rekommenderad åtgärd**
   Ge en kort professionell slutsats — t.ex. “Byt lambdasensor efter katalysatorn om spänningsavvikelse kvarstår.”
`;


  try {
    console.log(`🔎 Diagnosförfrågan: ${errorCode} (${carBrand} ${carYear}${engineCode ? ` / ${engineCode}` : ""})`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const result = completion.choices[0].message.content;
    res.json({ result });
  } catch (error) {
    console.error("❌ Fel vid API-anrop:", error);
    res.status(500).json({
      error: "Ett fel uppstod vid API-anropet. Kontrollera din OpenAI-nyckel eller serveranslutning.",
    });
  }
});

// --- Testroute ---
app.get("/", (req, res) => {
  res.send("🚗 Lovgrens Diagnostik API är igång!");
});

// --- Starta servern ---
app.listen(PORT, () => {
  console.log("──────────────────────────────────────────────");
  console.log(`🚀 Servern körs på port ${PORT}`);
  console.log("📡 Endpoint: POST /api/obd/diagnose");
  console.log("🔑 API-key laddad:", process.env.OPENAI_API_KEY ? "✅" : "❌");
  console.log("──────────────────────────────────────────────");
});

