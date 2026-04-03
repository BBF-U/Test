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
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
}

/* ================================
   🧹 ОЧИСТКА ВИХІДНОГО ТЕКСТУ
================================= */
function cleanResult(t) {
  return t
    .replace(/^[\-\*\•]\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ================================
   🎯 СТИЛІ
================================= */
const styles = {
  telegram: `
Зроби стисле резюме тексту в стилі Telegram-поста від першої особи.

ФОРМАТ:
- 2–3 короткі абзаци
- Суцільний текст без списків та без Markdown

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки, відсотки — копіюй ДОСЛІВНО з оригіналу
- Якщо в тексті 2030 → пиши 2030, НЕ 2025
- Якщо закон 4670-IX → пиши 4670-IX, НЕ скорочуй
- Краще залиш число ніж перефразуй

ПРАВИЛА:
- Пиши від першої особи
- Видаляй другорядне, залишай суть і факти
`.trim(),

  neutral: `
Зроби нейтральне резюме тексту одним блоком.

ФОРМАТ:
- 5–8 речень суцільним текстом
- Без списків, без крапок, без Markdown

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки, відсотки — копіюй ДОСЛІВНО з оригіналу
- Якщо в тексті 2030 → пиши 2030, НЕ 2025
- Якщо закон 4670-IX → пиши 4670-IX, НЕ скорочуй
- Краще залиш число ніж перефразуй

ПРАВИЛА:
- Тільки факти з тексту
- Жодних власних інтерпретацій
`.trim(),

  journal: `
Зроби стисле новинне резюме тексту.

ФОРМАТ:
- Перше речення: головна новина (лід)
- Далі: 1–2 абзаци з деталями
- Тільки суцільний текст, без списків, без Markdown

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки, відсотки — копіюй ДОСЛІВНО з оригіналу
- Якщо в тексті 2030 → пиши 2030, НЕ 2025
- Якщо закон 4670-IX → пиши 4670-IX, НЕ скорочуй
- Краще залиш число ніж перефразуй

ПРАВИЛА:
- Суворо дотримуйся фактів оригіналу
- Нічого не додавай від себе
`.trim()
};

/* ================================
   📏 ОБСЯГ
================================= */
const sizes = {
  short:  { instruction: "Коротке, але завершене резюме.", maxTokens: 500  },
  medium: { instruction: "Повне резюме без втрати важливих фактів.", maxTokens: 1000 },
  long:   { instruction: "Максимально повне резюме з усіма фактами.", maxTokens: 1500 }
};

/* ================================
   🤖 GEMINI
================================= */
async function callGemini(prompt, maxTokens = 1000, retries = 3) {
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
            temperature: 0.15,
            topP: 0.75
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
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

  if (!text || text.length < 30) {
    return res.json({ result: "⚠️ Текст занадто короткий" });
  }

  text = cleanText(text);

  const style = styles[mode] || styles.neutral;
  const { instruction, maxTokens } = sizes[size] || sizes.medium;

  try {
    const prompt = `
${style}

ОБСЯГ: ${instruction}

ЗАВДАННЯ:
Зроби стисле резюме наданого тексту. Скороти обсяг, зберігши всі фактичні дані.

ЖОРСТКІ ПРАВИЛА:
1. Числа, роки, дати, відсотки, суми — переноси ДОСЛІВНО як у тексті.
2. Якщо в тексті "2030" — пиши "2030". Якщо "4670-IX" — пиши "4670-IX".
3. Не перефразовуй числові показники — просто копіюй їх як є.
4. Звичайний текст абзацами, без списків, без Markdown.
5. Якщо факт містить число — копіюй ціле речення. Краще перевищити ліміт, ніж втратити число.

ПРИКЛАД:
Вхід: Ціна зросла на 5% і становить $1200 за кв.м.
Резюме: Ціна зросла на 5% і становить $1200 за кв.м.

Текст:
${text}
`.trim();

    let result = await callGemini(prompt, maxTokens);
    console.log("=== GEMINI RESULT ===");
    console.log(result.substring(0, 500));
    result = cleanResult(result);

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
   🔥 KEEP-ALIVE
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
