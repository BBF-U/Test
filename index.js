const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ================================
   🧹 ОЧИСТКА ВХІДНОГО ТЕКСТУ
================================= */
function cleanText(t) {
  return t
    .replace(/\(https?:\/\/[^\s]+\)/g, "")
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/[\p{Emoji}]/gu, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/* ================================
   🧹 ОЧИСТКА ВИХІДНОГО ТЕКСТУ
================================= */
function cleanResult(t) {
  return t
    .replace(/^[\-\*\•]\s+/gm, "")     // прибрати списки
    .replace(/\*\*/g, "")              // прибрати markdown **
    .replace(/\n{3,}/g, "\n\n")        // норм абзаци
    .trim();
}

/* ================================
   🎯 СТИЛІ = РЕЗЮМЕ
================================= */
const styles = {
  telegram: `
Зроби щільне резюме тексту.

Стиль: особистий Telegram.

ФОРМАТ:
- 2–3 абзаци
- від першої особи

ПРАВИЛА:
- тільки суть
- без води
- без списків
- без символів "-", "*"
`.trim(),

  neutral: `
Зроби щільне резюме тексту.

ФОРМАТ:
- 5–8 коротких речень
- одним блоком

ПРАВИЛА:
- тільки факти
- без списків
- без "-", "*"
- без вступів
`.trim(),

  journal: `
Зроби резюме у стилі новини.

ФОРМАТ:
- 1 короткий лід
- 1–2 абзаци

ПРАВИЛА:
- чітко і по фактах
- без списків
- без "-", "*"
`.trim()
};

/* ================================
   📏 ОБСЯГ
================================= */
const sizes = {
  short:  { instruction: "2–4 речення.", maxTokens: 200 },
  medium: { instruction: "5–8 речень.", maxTokens: 400 },
  long:   { instruction: "8–12 речень.", maxTokens: 700 }
};

/* ================================
   🤖 GEMINI
================================= */
async function callGemini(prompt, maxTokens = 400) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.35
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "API error");
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

/* ================================
   🔥 API
================================= */
app.post("/api/test", async (req, res) => {
  let { text, mode, size } = req.body;

  if (!text || text.length < 30) {
    return res.json({ result: "⚠️ Текст занадто короткий" });
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
Зроби коротке, але повне резюме.

ВАЖЛИВО:
- не використовуй списки
- не використовуй "-", "*", "•"
- не використовуй markdown
- пиши як звичайний текст

ІГНОРУЙ:
- рекламу
- заклики підписатися
- технічний шум

Текст:
${text}
`.trim();

    let result = await callGemini(prompt, maxTokens);

    result = cleanResult(result); // 🔥 ось це ключ

    res.json({ result });

  } catch (err) {
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
