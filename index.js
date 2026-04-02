<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>РИБА 🐟</title>

<style>
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Inter, Arial;
  background: #f7f8fc;
  color: #222;
}

.container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 12px;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.05);
  margin-bottom: 20px;
}

h1 {
  text-align: center;
  font-size: 28px;
  margin-bottom: 5px;
}

.subtitle {
  text-align: center;
  color: #777;
  margin-bottom: 20px;
}

textarea {
  width: 100%;
  display: block;
  min-height: 120px;
  border-radius: 10px;
  border: 1px solid #ddd;
  padding: 12px;
  font-size: 14px;
  resize: none;
}

#output { overflow: hidden; }

textarea:focus {
  outline: none;
  border-color: #ff9f43;
  box-shadow: 0 0 0 2px rgba(255,159,67,0.2);
}

.counter {
  font-weight: bold;
  font-size: 12px;
  text-align: right;
  color: #777;
  margin-bottom: 6px;
}

.counter.green  { color: #26de81; }
.counter.yellow { color: #f7b731; }
.counter.red    { color: #ff4d4d; }

.time-badge {
  font-size: 12px;
  color: #aaa;
  text-align: right;
  margin-top: 6px;
  min-height: 18px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

button {
  border-radius: 10px;
  border: 1px solid #ddd;
  padding: 8px 14px;
  cursor: pointer;
  background: white;
  font-size: 14px;
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}

.primary {
  background: #ff9f43;
  color: white;
  border: none;
}

.stop {
  background: #ff4d4d;
  color: white;
  border: none;
}

.active {
  background: #ff9f43 !important;
  color: white !important;
  border: none;
}

.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}
</style>
</head>

<body>
<div class="container">

  <h1>РИБА 🐟</h1>
  <div class="subtitle">AI генератор текстів</div>

  <div class="card">
    <div class="counter" id="counterInput">0 символів</div>
    <textarea id="input" placeholder="Встав текст..."></textarea>
    <div class="actions">
      <button onclick="clearInput()">Очистити</button>
    </div>
  </div>

  <div class="card">
    <div class="row modes">
      <button onclick="setMode('telegram')" id="telegram">Telegram</button>
      <button onclick="setMode('neutral')" id="neutral">Нейтрально</button>
      <button onclick="setMode('journal')" id="journal">Журналіст</button>
      <button onclick="setMode('auto')" id="auto">⚡ Auto</button>
    </div>

    <div class="row sizes" style="margin-top:10px">
      <button onclick="setSize('short')" id="short">Стисло</button>
      <button onclick="setSize('medium')" id="medium">Середнє</button>
      <button onclick="setSize('long')" id="long">Детально</button>
    </div>
  </div>

  <div class="card">
    <div class="row">
      <button id="btn" class="primary" onclick="send()">ЗРОБИТИ РИБУ</button>
      <button id="stopBtn" class="stop" onclick="stopGen()" disabled>СТОП</button>
    </div>
  </div>

  <div class="card">
    <div class="counter" id="counterOutput">0 символів</div>
    <textarea id="output" placeholder="Тут буде результат..."></textarea>
    <div class="time-badge" id="timeBadge"></div>
  </div>

</div>

<script>
let mode = "neutral";
let size = "medium";

function setMode(m) {
  mode = m;
  document.querySelectorAll(".modes button").forEach(b => b.classList.remove("active"));
  document.getElementById(m).classList.add("active");
}

function setSize(s) {
  size = s;
  document.querySelectorAll(".sizes button").forEach(b => b.classList.remove("active"));
  document.getElementById(s).classList.add("active");
}

async function send() {
  const input = document.getElementById("input");
  const output = document.getElementById("output");
  const timeBadge = document.getElementById("timeBadge");

  if (!input.value.trim()) {
    output.value = "⚠️ Встав текст";
    return;
  }

  const start = Date.now();
  output.value = "⏳ Генеруємо...";

  try {
    const res = await fetch("/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: input.value,
        mode,
        size
      })
    });

    const data = await res.json();
    output.value = data.result;

    const t = ((Date.now() - start) / 1000).toFixed(1);
    timeBadge.innerText = "⏱ " + t + "с";

  } catch {
    output.value = "❌ Помилка";
  }
}

function clearInput() {
  document.getElementById("input").value = "";
}

function stopGen() {}

setMode("neutral");
setSize("medium");
</script>

</body>
</html>
