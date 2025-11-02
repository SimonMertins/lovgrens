// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai'); // officiella SDK

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// initiera OpenAI-klienten med din nyckel
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Enkel endpoint som tar en felkod och returnerar en förklaring
app.post('/api/diagnose', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Skicka med "code" i request body.' });
    }

    // Prompt / meddelande till modellen — justera efter behov
    const systemPrompt = `Du är en hjälpsam bilmekaniker. Ge en kort förklaring av OBD-felkoden, vanliga orsaker och 3 felsökningstips.`;
    const userPrompt = `Felkod: ${code}. Förklara vad det betyder och ge möjliga orsaker och åtgärder.`

    // Anropa Chat Completions (chat-format)
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 500
    });

    const text = completion.choices?.[0]?.message?.content || "Ingen text mottagen från modellen.";
    res.json({ code, explanation: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fel vid kontakt med OpenAI', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server körs på http://localhost:${port}`);
});
