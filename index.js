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
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/* ================================
   🎯 СТИЛІ
================================= */
const styles = {
  telegram: `
Зроби щільне резюме тексту.

Пиши від першої особи, як для Telegram.

ФОРМАТ:
- 2–3 абзаци
- тільки суть

ПРАВИЛА:
- без води
- збережи всі ключові факти
`.trim(),

  neutral: `
Зроби щільне резюме тексту.

ФОРМАТ:
- список пунктів
- 6–10 пунктів

ПРАВИЛА:
- тільки факти
- без вступів
- без пояснень
`.trim(),

  journal: `
Зроби щільне резюме тексту у стилі новини.

ФОРМАТ:
- 1 речення лід
- далі короткі абзаци

ПРАВИЛА:
- чітко і по фактах
- без води
`.trim()
};

/* ================================
   🤖 GEMINI
================================= */
async function callGemini(prompt, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4
          }
        })
      }
    );

    const data = await response.json();

    if (response.status === 429 && i < retries) {
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    if (!response.ok) {
      throw new Error(data?.error?.message || "API error");
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }
}

/* ================================
   🔥 API
================================= */
app.post("/api/test", async (req, res) => {
  let { text, mode } = req.body;

  if (!text || text.length < 30) {
    return res.json({ result: "⚠️ Текст занадто короткий" });
  }

  text = cleanText(text);

  let style;

  /* 🔥 AUTO MODE */
  if (mode === "auto") {
    style = `
Зроби щільне резюме тексту.

СПОЧАТКУ:
визнач найкращий формат:
- список → якщо багато фактів
- журналістський → якщо новина
- Telegram стиль → якщо це думка або аналітика

ПОТІМ:
напиши результат у цьому стилі.

ПРАВИЛА:
- коротко
- без води
- збережи всі ключові факти
- не втрачай сенс
`;
  } else {
    style = styles[mode] || styles.neutral;
  }

  try {
    const prompt = `
${style}

ЗАВДАННЯ:
Зроби коротке, але повне резюме тексту.

ОБОВ’ЯЗКОВО:
- збережи факти, цифри, висновки
- не спрощуй зміст
- не вигадуй

ІГНОРУЙ:
- рекламу
- "читайте також"
- технічне сміття

Текст:
${text}
`.trim();

    const result = await callGemini(prompt);

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
