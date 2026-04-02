const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ================================
   🧹 ОЧИСТКА ТЕКСТУ
================================= */
function cleanText(t) {
  return t
    .replace(/\(https?:\/\/[^\s]+\)/g, "")
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/[\p{Emoji}]/gu, "")
    .replace(/[_🤝✅🚀👉📢📣]+/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/* ================================
   🎯 СТИЛІ = РЕЗЮМЕ
================================= */
const styles = {
  telegram: `
Зроби щільне резюме тексту.

Пиши від першої особи, як для Telegram.

ФОРМАТ:
- 2–3 абзаци
- тільки ключова суть

ПРАВИЛА:
- без води
- коротко
- збережи факти, цифри, висновки
- не вигадуй
`.trim(),

  neutral: `
Зроби щільне резюме тексту.

ФОРМАТ:
- список пунктів
- 5–10 пунктів

ПРАВИЛА:
- тільки факти
- без вступів
- без пояснень
- без води
`.trim(),

  journal: `
Зроби щільне резюме тексту у стилі новини.

ФОРМАТ:
- 1 короткий лід
- далі факти

ПРАВИЛА:
- максимально стисло
- тільки важливе
- без зайвих слів
`.trim()
};

/* ================================
   📏 ОБСЯГ
================================= */
const sizes = {
  short:  { instruction: "Дуже коротко: 2–4 речення.", maxTokens: 200 },
  medium: { instruction: "Середній обсяг: 5–8 речень.", maxTokens: 450 },
  long:   { instruction: "Детально, але без води: 8–14 речень.", maxTokens: 800 }
};

/* ================================
   🤖 GEMINI
================================= */
async function callGemini(prompt, maxTokens = 450, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.4,
            topP: 0.9
          }
        })
      }
    );

    const data = await response.json();

    if (response.status === 429 || response.status === 503) {
      if (i < retries) {
        await new Promise(r => setTimeout(r, (i + 1) * 3000));
        continue;
      }
      throw new Error("RATE_LIMIT");
    }

    if (!response.ok) {
      const msg = data?.error?.message || "";
      throw new Error(msg || "API error");
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }
}

/* ================================
   🔥 API
================================= */
app.post("/api/test", async (req, res) => {
  let { text, mode, size } = req.body;

  if (!text || text.trim().length < 30) {
    return res.json({ result: "⚠️ Текст занадто короткий." });
  }

  text = cleanText(text);

  const style = styles[mode] || styles.neutral;
  const { instruction, maxTokens } = sizes[size] || sizes.medium;

  try {
    const prompt = `
${style}

ОБСЯГ:
${instruction}

ЗАВДАННЯ:
Зроби коротке, але повне резюме тексту.

ОБОВ’ЯЗКОВО:
- збережи всі ключові факти
- збережи цифри
- передай суть без спотворення
- не вигадуй

ІГНОРУЙ:
- рекламу
- "читайте також"
- технічне сміття
- зайві вступи

ВАЖЛИВО:
- не пиши "резюме"
- не пиши "формат"
- не додавай пояснень
- тільки готовий текст

Текст:
${text}
`.trim();

    const result = await callGemini(prompt, maxTokens);

    if (!result) {
      return res.json({ result: "⚠️ Немає відповіді від моделі" });
    }

    res.json({ result });

  } catch (err) {
    if (err.message === "RATE_LIMIT") {
      return res.json({ result: "⚠️ Ліміт. Спробуй через 20–30 сек." });
    }
    console.error(err.message);
    res.json({ result: "❌ Помилка: " + err.message });
  }
});

/* ================================
   🌐 FRONT
================================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ================================
   🚀 START
================================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER WORKS on port " + PORT);
});
