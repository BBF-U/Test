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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
Пиши короткий живий Telegram-пост від першої особи.

ПРИКЛАД ПРАВИЛЬНОГО СТИЛЮ:
"По Гуляйполю — ворог пресує вогнеметами, намагається зайти в обхід. Не вийшло — дрони розклали групу ще в балці.

Під Олександрівкою тримаємо. Мотоциклісти зайти пробували — не доїхали. Б'ємо на випередження.

Загалом лінія стоїть, але небо складне."

ФОРМАТ:
- Речення короткі, рубані
- Абзац = один напрямок або одна думка
- Порожній рядок між абзацами
- Без списків, без Markdown

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки — копіюй ДОСЛІВНО з оригіналу
- Назви підрозділів і систем не скорочуй

ПРАВИЛА:
- Видаляй другорядне
- Пиши як людина, не як офіційний звіт
`.trim(),

  neutral: `
Зроби нейтральне інформаційне резюме.

ПРИКЛАД ПРАВИЛЬНОГО СТИЛЮ:
"На Гуляйпільському напрямку противник застосовує важкі вогнеметні системи по Мирному. Спроба обходу через балку провалилась — групу знищено дронами. Біля Залізничного та Варварівки БпЛА методично вибивають ворога на підходах.

На Олександрівському напрямку ситуація під контролем. Спроба заходу на мототехніці південно-східніше Привілля була зупинена. Українські сили працюють на випередження по логістиці і точках збору."

ФОРМАТ:
- Абзац на кожен напрямок або тему
- Порожній рядок між абзацами
- Без списків, без Markdown
- Від третьої особи

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки — копіюй ДОСЛІВНО з оригіналу
- Назви підрозділів і систем не скорочуй

ПРАВИЛА:
- Тільки факти з тексту
- Жодних власних інтерпретацій
`.trim(),

  journal: `
Зроби новинне резюме в стилі якісного медіа.

ПРИКЛАД ПРАВИЛЬНОГО СТИЛЮ:
"Українські сили утримують позиції на кількох напрямках, знищуючи ворога на підходах за допомогою дронів.

На Гуляйпільському напрямку противник застосовує важкі вогнеметні системи та намагається діяти в обхід, однак групи знищуються БпЛА. На Олександрівському напрямку спроби заходу на мототехніці зупинені, втрати противника серйозні."

ФОРМАТ:
- Перше речення: головна думка (лід)
- Далі абзаци по темах або напрямках
- Порожній рядок між абзацами
- Без списків, без Markdown

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки — копіюй ДОСЛІВНО з оригіналу
- Назви підрозділів і систем не скорочуй

ПРАВИЛА:
- Суворо дотримуйся фактів оригіналу
- Нічого не додавай від себе
`.trim()
};

/* ================================
   📏 ОБСЯГ
================================= */
const sizes = {
  short:  { instruction: "Максимум 2-3 речення. Тільки найголовніше, все інше викидай.", maxTokens: 300  },
  medium: { instruction: "Охопи всі ключові теми. Кожна думка — одне коротке речення.", maxTokens: 1200 },
  long:   { instruction: "Максимально повно з усіма фактами і деталями.", maxTokens: 2000 }
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
4. Розбий текст на 2-4 абзаци через подвійний перенос рядка. Кожен абзац — окрема думка. Без списків, без Markdown.
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
