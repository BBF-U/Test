const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ================================
   🧹 БАЗОВА ОЧИСТКА
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
   🎯 СТИЛІ
================================= */
const styles = {
  summary: `
Зроби щільне резюме тексту.

ВИМОГИ:
- це НЕ переказ і НЕ спрощення
- це короткий виклад змісту
- збережи всі ключові факти, цифри, тренди та висновки
- нічого важливого не викидай

ФОРМАТ:
- список пунктів
- кожен пункт = 1 ключова ідея
- 8–12 пунктів максимум
- без вступу і без висновку

СТИЛЬ:
- сухо, чітко, по суті
- як аналітичний конспект

ЗАБОРОНЕНО:
- узагальнення ("багато", "часто")
- переписування як історії

РЕЗУЛЬТАТ:
- має замінити читання статті
`.trim(),

  telegram: `
Пиши живо, по-людськи, від першої особи.
2–3 абзаци, природна мова.
`.trim(),

  neutral: `
Коротко і просто поясни суть.
2 абзаци, без складних формулювань.
`.trim()
};

/* ================================
   📏 ОБСЯГ (для summary — більше токенів)
================================= */
const sizes = {
  short:  { maxTokens: 400 },
  medium: { maxTokens: 800 },
  long:   { maxTokens: 1200 }
};

/* ================================
   🤖 GEMINI
================================= */
async function callGemini(prompt, maxTokens = 800, retries = 3) {
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
            topP: 0.85
          }
        })
      }
    );

    const data = await response.json();

    if (response.status === 429 || response.status === 503) {
      if (i < retries) {
        await new Promise(r => setTimeout(r, (i + 1) * 4000));
        continue;
      }
      throw new Error("RATE_LIMIT");
    }

    if (!response.ok) {
      const msg = data?.error?.message || "";
      throw new Error(msg || JSON.stringify(data));
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }
}

/* ================================
   🔗 URL → ТЕКСТ
================================= */
async function fetchTextFromUrl(url) {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      "Accept": "text/plain",
      "X-Return-Format": "text"
    }
  });

  if (!response.ok) throw new Error("Не вдалося завантажити сторінку");

  const text = await response.text();

  if (!text || text.length < 100) throw new Error("Стаття порожня");

  return text.slice(0, 10000);
}

/* ================================
   🔗 API: URL → TEXT
================================= */
app.post("/api/fetch-url", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith("http")) {
    return res.json({ error: "⚠️ Невалідний URL" });
  }

  try {
    const text = await fetchTextFromUrl(url);
    res.json({ text });
  } catch (err) {
    res.json({ error: "❌ " + err.message });
  }
});

/* ================================
   🔥 API: SUMMARY
================================= */
app.post("/api/test", async (req, res) => {
  let { text, mode, size } = req.body;

  if (!text || text.trim().length < 50) {
    return res.json({ result: "⚠️ Текст занадто короткий." });
  }

  text = cleanText(text);

  const style = styles[mode] || styles.summary;
  const { maxTokens } = sizes[size] || sizes.medium;

  try {
    const prompt = `
${style}

ЗАВДАННЯ:
Зроби щільне інформативне резюме тексту.

ПРАВИЛА:
- збережи всі ключові факти, цифри та висновки
- не спрощуй зміст
- не викидай важливе

ІГНОРУЙ:
- рекламу
- "читайте також"
- джерела і посилання

РЕЗУЛЬТАТ:
- список ключових фактів
- читається за 30 секунд

Текст:
${text}
`.trim();

    const result = await callGemini(prompt, maxTokens);

    if (!result) {
      return res.json({ result: "⚠️ Немає результату" });
    }

    res.json({ result });

  } catch (err) {
    if (err.message === "RATE_LIMIT") {
      return res.json({ result: "⚠️ Ліміт. Спробуй пізніше." });
    }
    console.error(err.message);
    res.json({ result: "❌ " + err.message });
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
