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
  telegram: `
Ти ведеш особистий Telegram-канал.

Пиши живо, по-людськи, від першої особи.
Текст має виглядати як думка або розповідь, а не новина.

Структура:
- 2–3 абзаци
- перший — головна думка
- далі — деталі
- в кінці — короткий висновок або реакція

Пиши природно: чергуй короткі і довші речення.

Уникай сухого або канцелярського стилю.
Не пиши кожне речення з нового рядка.
`.trim(),

  neutral: `
Перекажи суть простою людською мовою.

Структура:
- 2 абзаци
- перший — головне
- другий — деталі

Пиши від третьої особи.
Без складних формулювань і канцеляриту.
Текст має читатися легко, як пояснення знайомому.
`.trim(),

  journal: `
Напиши як у якісному онлайн-медіа.

Структура:
- лід (1 речення)
- факти
- короткий контекст або висновок

Кожен блок — окремий абзац.
Пиши чітко, без зайвих повторів.
Використовуй нейтральний тон і третю особу.
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
   🤖 GEMINI ЗАПИТ
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
            temperature: 0.55,
            topP: 0.85
          }
        })
      }
    );

    const data = await response.json();

    if (response.status === 429 || response.status === 503) {
      if (i < retries) {
        await new Promise(r => setTimeout(r, (i + 1) * 5000));
        continue;
      }
      throw new Error("RATE_LIMIT");
    }

    if (!response.ok) {
      const msg = data?.error?.message || "";
      if (msg.includes("high demand") && i < retries) {
        await new Promise(r => setTimeout(r, (i + 1) * 5000));
        continue;
      }
      throw new Error(msg || JSON.stringify(data));
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }
}

/* ================================
   🔗 URL → ТЕКСТ (Jina Reader)
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

  if (!text || text.length < 100) throw new Error("Стаття порожня або недоступна");

  return text.slice(0, 8000);
}

/* ================================
   🔗 API: URL → ТЕКСТ
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
   🔥 API: ГЕНЕРАЦІЯ
================================= */
app.post("/api/test", async (req, res) => {
  let { text, mode, size } = req.body;

  if (!text || text.trim().length < 30) {
    return res.json({ result: "⚠️ Текст занадто короткий." });
  }

  text = cleanText(text);

  const style = styles[mode] || styles.neutral;
  const { label, maxTokens } = sizes[size] || sizes.medium;

  try {
    const prompt = `
${style}

ОБСЯГ: напиши СТРОГО ${label} символів. Завершуй думку повністю.
ФОРМАТ: розбий текст на 2-3 абзаци через подвійний перенос рядка. Не пиши суцільним блоком.

Спочатку очисти вхідний текст — видали:
- рекламу, банери, заклики підписатися або поширити
- фрази: "раніше писали", "як повідомляє", "за даними", "джерело", "читайте також"
- посилання, згадки сайтів, технічне сміття

Потім напиши фінальний текст.
ТІЛЬКИ результат. Жодних пояснень, коментарів, заголовків.

Текст:
${text}
`.trim();

    const result = await callGemini(prompt, maxTokens);

    if (!result) {
      return res.json({ result: "⚠️ Модель не повернула результат." });
    }

    res.json({ result });

  } catch (err) {
    if (err.message === "RATE_LIMIT") {
      return res.json({ result: "⚠️ Ліміт Gemini вичерпано. Спробуй через 20–30 секунд." });
    }
    console.error("Error:", err.message);
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
