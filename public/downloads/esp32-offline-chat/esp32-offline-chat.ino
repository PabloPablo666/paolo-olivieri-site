#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "ESP32 Offline Chat";
const char* password = "local-access";

WebServer server(80);
String chatLog = "";

#define LED_PIN 4  // External LED on GPIO4

const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>// CAMPERS ANONYMOUS //</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body {
    margin: 0;
    font-family: monospace;
    background: black;
    color: #0f0;
    padding: 20px;
    overflow: hidden;
  }

  canvas {
    position: fixed;
    top: 0; left: 0;
    z-index: -1;
  }

  h3 {
    font-size: 1.5em;
    font-weight: bold;
    color: #00ff00;
    text-shadow: 0 0 5px #00ff00, 0 0 10px #00ff00;
    letter-spacing: 2px;
    border-bottom: 1px solid #0f0;
    padding-bottom: 5px;
    margin-top: 20px;
    font-family: 'Courier New', Courier, monospace;
  }

  form { margin-top: 10px; }

  input[type=text] {
    width: 48%;
    padding: 10px;
    background: rgba(0,0,0,0.6);
    color: #0f0;
    border: 1px solid #0f0;
    margin-bottom: 6px;
  }

  input[type=submit] {
    width: 100%;
    padding: 10px;
    background: #0f0;
    color: #000;
    border: none;
    font-weight: bold;
    cursor: pointer;
  }

  #chatbox {
    width: 100%;
    height: 220px;
    background: rgba(0,0,0,0.75);
    border: 1px solid #0f0;
    padding: 10px;
    overflow-y: auto;
    white-space: pre-wrap;
    box-sizing: border-box;
  }

  .line { margin: 0 0 4px 0; }
  .user { font-weight: bold; }
  .msg  { color: #0f0; }

  .hint {
    opacity: .8;
    font-size: 12px;
    margin-top: 10px;
  }
</style>
</head><body>

<canvas id="matrix"></canvas>

<h3>// CAMPERS ANONYMOUS //</h3>

<form onsubmit="sendMessage(event)">
  <input type="text" name="user" id="user" placeholder="Username" required maxlength="24">
  <input type="text" name="msg" id="msg" placeholder="Type a message..." required maxlength="160">
  <input type="submit" value="Send">
</form>

<div class="hint">
  Easter egg: type <b>NEO</b> to trigger MORPHEUS.
</div>

<h3>Messages:</h3>
<div id="chatbox">%CHATLOG%</div>

<script>
/* ---------------- MATRIX RAIN ---------------- */
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%";
let fontSize = 14;
let columns = 0;
let drops = [];

function setupMatrix() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  columns = Math.floor(canvas.width / fontSize);
  drops = Array(columns).fill(1);
}

function drawMatrix() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f0";
  ctx.font = fontSize + "px monospace";

  for (let i = 0; i < drops.length; i++) {
    const text = letters.charAt(Math.floor(Math.random() * letters.length));
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);

    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975)
      drops[i] = 0;
    drops[i]++;
  }
}

setupMatrix();
setInterval(drawMatrix, 33);
window.addEventListener("resize", setupMatrix);

/* ---------------- CHAT ---------------- */
function escapeHtml(s) {
  return s.replaceAll("&","&amp;")
          .replaceAll("<","&lt;")
          .replaceAll(">","&gt;")
          .replaceAll('"',"&quot;")
          .replaceAll("'","&#39;");
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 100%, 60%)`;
}

function renderChat(text) {
  const box = document.getElementById("chatbox");
  const stick = (box.scrollTop + box.clientHeight) >= (box.scrollHeight - 10);

  const lines = text.split('\n').filter(l => l.trim().length);
  const html = lines.map(line => {
    const m = line.match(/^(.*?):\s(.*)$/);
    if (!m) return `<div class="line msg">${escapeHtml(line)}</div>`;
    const user = m[1];
    const msg  = m[2];
    const c = stringToColor(user);
    return `<div class="line"><span class="user" style="color:${c}">${escapeHtml(user)}</span>: <span class="msg">${escapeHtml(msg)}</span></div>`;
  }).join("");

  box.innerHTML = html || `<div class="line msg">(no messages)</div>`;
  if (stick) box.scrollTop = box.scrollHeight;
}

function fetchChat() {
  fetch('/chatlog').then(r => r.text()).then(renderChat);
}

function pad(n) { return n < 10 ? '0' + n : n; }

function sendMessage(event) {
  event.preventDefault();

  const user = document.getElementById('user').value.trim();
  const msg  = document.getElementById('msg').value.trim();
  if (!user || !msg) return;

  const now = new Date();
  const timestamp =
    '[' + pad(now.getHours()) + ':' +
    pad(now.getMinutes()) + ':' +
    pad(now.getSeconds()) + ']';

  const fullMsg = msg + ' ' + timestamp;

  if (msg.toUpperCase() === 'NEO') {
    const sequence = [
      "Wake up, Neo...",
      "The Matrix has you...",
      "Follow the white rabbit.",
      "Knock, knock, Neo."
    ];

    sequence.forEach((text, i) => {
      setTimeout(() => {
        fetch('/send', {
          method: 'POST',
          body: new URLSearchParams({ user: 'MORPHEUS', msg: text })
        });
      }, 2000 * (i + 1));
    });
  }

  fetch('/send', {
    method: 'POST',
    body: new URLSearchParams({ user, msg: fullMsg })
  }).then(() => {
    document.getElementById('msg').value = '';
    setTimeout(fetchChat, 150);
  });
}

window.onload = () => {
  fetchChat();
};
setInterval(fetchChat, 1000);
</script>
</body></html>
)rawliteral";

void handleRoot() {
  String html = index_html;
  html.replace("%CHATLOG%", "");
  server.send(200, "text/html", html);
}

void handleSend() {
  if (server.hasArg("user") && server.hasArg("msg")) {
    String user = server.arg("user");
    String msg  = server.arg("msg");
    user.trim();
    msg.trim();

    if (user.length() && msg.length()) {
      chatLog += user + ": " + msg + "\n";
      if (chatLog.length() > 3000)
        chatLog = chatLog.substring(chatLog.length() - 3000);
    }
  }
  server.sendHeader("Location", "/");
  server.send(303);
}

int blinkCount = 0;
bool blinking = true;
unsigned long lastBlink = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  WiFi.softAP(ssid, password);

  server.on("/", handleRoot);
  server.on("/send", HTTP_POST, handleSend);
  server.on("/chatlog", []() {
    server.send(200, "text/plain; charset=utf-8", chatLog);
  });

  server.begin();
}

void loop() {
  server.handleClient();

  if (blinking && millis() - lastBlink > 500) {
    lastBlink = millis();
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    if (digitalRead(LED_PIN) == LOW) {
      blinkCount++;
      if (blinkCount >= 2) {
        blinking = false;
        digitalWrite(LED_PIN, LOW);
      }
    }
  }
}
