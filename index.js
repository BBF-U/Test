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
Зроби стисле резюме тексту в стилі Telegram-поста від першої особи.

ФОРМАТ:
- 2–3 короткі абзаци
- Суцільний текст без списків та без Markdown

ПРАВИЛА:
- Використовуй оригінальні фрази та формулювання
- Усі числа, дати та ціни копіюй з оригіналу без жодних змін
- Видаляй другорядну інформацію, залишаючи головну суть
- Пиши від першої особи (наприклад: "Я проаналізував...", "Помітив, що...")
`.trim(),

  neutral: `
Зроби нейтральне резюме тексту одним блоком.

ФОРМАТ:
- 5–8 речень суцільним текстом
- Без списків, без крапок на початку рядків, без Markdown

ПРАВИЛА:
- Залиш тільки ключові факти та статистику
- Усі цифри, відсотки та роки перенось у резюме в їх оригінальному вигляді
- Використовуй речення або частини речень з початкового тексту
- Уникай будь-яких власних інтерпретацій чи вигадок
`.trim(),

journal: `
Зроби стисле новинне резюме тексту.

ФОРМАТ:
- Перше речення: головна новина (лід)
- Далі: 1–2 абзаци з деталями
- Тільки суцільний текст, без списків, без Markdown та без заголовків

ПРАВИЛА:
- Використовуй оригінальні формулювання та факти з тексту
- Усі числа, відсотки, суми та дати копіюй БЕЗ змін
- Видаляй зайві епітети, залишаючи лише конкретну інформацію
- Суворо дотримуйся фактології оригіналу: нічого не додавай від себе
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
Зроби стисле резюме наданого тексту. Твоя мета — скоротити обсяг, зберігши всі фактичні дані.

ПРАВИЛА:
1. Зберігай усі цифри, дати, назви міст та відсотки в їх оригінальному вигляді.
2. Використовуй прямі цитати або фрагменти речень з оригіналу.
3. Не перефразовуй числових показників — просто копіюй їх як є.
4. Результат має бути у формі звичайного тексту (абзаци), без списків та без використання символів Markdown (без зірочок, решіток тощо).

ПРИКЛАД (як треба робити):
Вхід: Ціна квадратного метра в Одесі зросла на 5% і тепер становить $1200 за кв.м.
Резюме: Ціна в Одесі зросла на 5% і становить $1200 за кв.м.

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
