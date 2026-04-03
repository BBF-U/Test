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
Скороти текст до резюме.

Стиль: Telegram, від першої особи.

ФОРМАТ:
- 2–3 абзаци

ПРАВИЛА:
- прибирай зайве
- зберігай формулювання максимально близько до оригіналу
- не переписуй факти
- не змінюй числа
- не використовуй списки
`.trim(),

  neutral: `
Скороти текст до резюме.

ФОРМАТ:
- 5–8 речень одним блоком

ПРАВИЛА:
- залиш тільки ключові факти
- використовуй фрази з оригіналу
- не переписуй цифри і роки
- не вигадуй
- без списків
`.trim(),
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
          temperature: 0.20
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
Зроби резюме тексту, максимально зберігаючи оригінальні формулювання.

КРИТИЧНО:
- НЕ переписуй числа, роки, дати
- НЕ змінюй формулювання з цифрами
- копіюй частини тексту, де є цифри, БЕЗ змін

ПРАВИЛА:
- скорочуй текст, видаляючи зайве
- але НЕ перефразовуй факти
- використовуй оригінальні речення або їх частини

ДУЖЕ ВАЖЛИВО:
- якщо є речення з цифрами → залиш його максимально близьким до оригіналу
- НЕ замінюй 2030 → 2025

ФОРМАТ:
- звичайний текст
- без списків
- без markdown

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
   🔥 KEEP-ALIVE ENDPOINT
================================= */
app.get("/ping", (req, res) => {
  res.send("ok");
});

/* ================================
   🚀 START
================================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER WORKS on port " + PORT);
});
