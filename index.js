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
Пиши як редактор гострого Telegram-каналу — стисло, живо, від першої особи.

ПРИКЛАД ПРАВИЛЬНОГО СТИЛЮ (коротко):
"Василевська-Смаглюк — депутатка від Коломойського і Зеленського. Та сама, що 24 лютого казала не евакуюватись. Результат ми всі знаємо.

Тепер вона топить за пожиттєвий ПЕП. Корупціонерам — байдуже, вони і так знайдуть схему. А нормальні люди на держслужбу йти не хочуть."

ПРИКЛАД ПРАВИЛЬНОГО СТИЛЮ (детально):
"По Гуляйполю — ворог пресує вогнеметами, намагається зайти в обхід. Не вийшло — дрони розклали групу ще в балці.

Під Олександрівкою тримаємо. Мотоциклісти зайти пробували — не доїхали. Б'ємо на випередження по логістиці.

Загалом лінія стоїть, але небо складне — багато дронів з обох боків."

ФОРМАТ:
- Кожен абзац 2-3 речення, між абзацами порожній рядок
- Речення короткі і рубані
- Без списків, без Markdown, без заголовків

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки — копіюй ДОСЛІВНО з оригіналу
- Назви людей, законів, організацій не скорочуй

ПРАВИЛА:
- Гостро і по суті
- Пиши як людина, не як офіційний звіт
- Видаляй другорядне, залишай суть
`.trim(),

  neutral: `
Зроби нейтральне інформаційне резюме.

ПРИКЛАД ПРАВИЛЬНОГО СТИЛЮ:
"Депутатка Василевська-Смаглюк виступає за збереження пожиттєвого статусу ПЕП. Статус поширюється на найближчих родичів і діє без обмежень у часі, на відміну від норм ЄС де він діє 3 роки після посади.

Критики вказують що пожиттєвий ПЕП не заважає корупціонерам але відлякує чесних людей від держслужби. Ситуацію погіршує відсутність черг на держпосади і криза держуправління."

ФОРМАТ:
- Абзац на кожну тему, між абзацами порожній рядок
- Від третьої особи
- Без списків, без Markdown

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки — копіюй ДОСЛІВНО з оригіналу
- Назви людей, законів, організацій не скорочуй

ПРАВИЛА:
- Тільки факти з тексту
- Жодних власних інтерпретацій
`.trim(),

  journal: `
Зроби новинне резюме в стилі якісного медіа.

ПРИКЛАД ПРАВИЛЬНОГО СТИЛЮ:
"Депутатка від «Слуги народу» Василевська-Смаглюк блокує скасування пожиттєвого статусу ПЕП, незважаючи на критику з боку експертів і держслужбовців.

Статус ПЕП, запроваджений після 2019 року на вимогу ЄС, поширюється на посадовців та їхніх родичів без обмежень у часі. На відміну від більшості країн ЄС де статус діє лише 3 роки після залишення посади, в Україні він є пожиттєвим."

ФОРМАТ:
- Перше речення: головна новина (лід)
- Далі абзаци по темах, між ними порожній рядок
- Без списків, без Markdown

КРИТИЧНО ВАЖЛИВО:
- Усі числа, дати, роки — копіюй ДОСЛІВНО з оригіналу
- Назви людей, законів, організацій не скорочуй

ПРАВИЛА:
- Суворо дотримуйся фактів оригіналу
- Нічого не додавай від себе
`.trim()
};

/* ================================
   📏 ОБСЯГ
================================= */
const sizes = {
  short:  { instruction: "Максимум 2-3 речення. Тільки найголовніше, все інше викидай.", maxTokens: 400  },
  medium: { instruction: "3-4 абзаци по 2-3 речення. Охопи всі ключові теми.", maxTokens: 1200 },
  long:   { instruction: "5-7 абзаців по 2-3 речення. Максимально повно з усіма фактами.", maxTokens: 2000 }
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
            temperature: 0.2,
            topP: 0.9
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
Скороти текст до точного резюме зберігши всі ключові факти.

РОБОТА З ЧИСЛАМИ:
- всі числа, дати, відсотки копіюй без змін
- не змінюй роки і цифри
- якщо є число — залиш його як є

ЗАБОРОНЕНО:
- вигадувати факти
- змінювати числа
- обривати відповідь

Текст:
${text}
`.trim();

    let result = await callGemini(prompt, maxTokens);
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
