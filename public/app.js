const $ = s => document.querySelector(s);
const conversation = $("#conversation"), input = $("#message-input");
let agents = [], history = [], running = false, busy = false, loopTimer = null, turn = 0;
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function addMessage(name, text, color, isUser=false) {
  $("#welcome")?.remove();
  const el = document.createElement("div");
  el.className = "message" + (isUser ? " user" : "");
  const initial = isUser ? "S" : name[0];
  el.innerHTML = `<div class="avatar" style="background:${isUser ? "#343b56" : color}22;color:${isUser ? "#d7dcf2" : color}">${initial}</div><div class="bubble-wrap"><div class="sender" style="color:${isUser ? "#c4baff" : color}">${escapeHtml(name)}</div><div class="bubble">${escapeHtml(text)}</div><div class="timestamp">${new Date().toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"})}</div></div>`;
  conversation.appendChild(el); conversation.scrollTop = conversation.scrollHeight;
  history.push({role:isUser ? "user" : "assistant", content:`${name}: ${text}`});
  if (history.length > 40) history = history.slice(-40);
}
function setTyping(show, text="AI'lar suhbatlashmoqda...") { $("#typing").hidden = !show; $("#typing-text").textContent = text; }
function updateState() {
  $("#status-pill").textContent = running ? "JONLI" : "TO‘XTATILGAN";
  $("#status-pill").style.color = running ? "#61e0ae" : "#aaa0ff";
  $("#start-btn").disabled = running; $("#stop-btn").disabled = !running;
  input.disabled = !running; $("#send-btn").disabled = !running;
}
async function askAgent(agent, userText="") {
  const response = await fetch("/api/reply", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({agentId:agent.id,history:history.slice(-16),userText})});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "AI javob bermadi");
  return data.text;
}
const wait = ms => new Promise(r => setTimeout(r,ms));
async function groupResponse(userText) {
  if (busy || !running) return;
  busy = true; setTyping(true, "Barcha AI ishtirokchilar fikr bildirmoqda...");
  try {
    // Every AI gets the same conversation context and can respond to the human.
    for (const agent of agents) {
      if (!running) break;
      setTyping(true, `${agent.name} javob yozmoqda...`);
      const reply = await askAgent(agent, userText);
      if (!running) break;
      addMessage(agent.name, reply, agent.color);
      await wait(500);
    }
  } catch (e) {
    addMessage("Tizim", e.message, "#f87171");
    if (e.message.includes("API kalit")) stopConversation();
  } finally { busy = false; setTyping(false); }
}
async function spontaneousTurn() {
  if (!running || busy) return;
  busy = true;
  const agent = agents[turn++ % agents.length];
  setTyping(true, `${agent.name} suhbatni davom ettirmoqda...`);
  try {
    const reply = await askAgent(agent);
    if (running) addMessage(agent.name, reply, agent.color);
  } catch(e) { addMessage("Tizim",e.message,"#f87171"); stopConversation(); }
  finally { busy = false; setTyping(false); }
  if (running) loopTimer = setTimeout(spontaneousTurn, 1700);
}
function stopConversation() {
  running = false; clearTimeout(loopTimer); updateState(); setTyping(false);
}
$("#start-btn").addEventListener("click", async () => {
  if (running) return;
  running = true; updateState();
  addMessage("AI Social World","Suhbat boshlandi. Endi erkin muloqot qilamiz!","#a78bfa");
  await groupResponse("");
  if (running) loopTimer = setTimeout(spontaneousTurn, 900);
});
$("#stop-btn").addEventListener("click", stopConversation);
$("#composer").addEventListener("submit", async e => {
  e.preventDefault(); const text = input.value.trim();
  if (!text || !running) return;
  input.value = ""; input.style.height = "auto";
  addMessage("Siz",text,"#c4baff",true);
  clearTimeout(loopTimer);
  await groupResponse(text);
  if (running) loopTimer = setTimeout(spontaneousTurn, 900);
});
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#composer").requestSubmit(); }
});
input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,120)+"px";});
async function init() {
  try {
    const cfg = await (await fetch("/api/config")).json(); agents = cfg.agents;
    $("#agent-list").innerHTML = agents.map(a=>`<div class="agent"><div class="avatar" style="background:${a.color}22;color:${a.color}">${a.name[0]}</div><div>${a.name}<small>AI ishtirokchi</small></div></div>`).join("");
    $("#participant-count").textContent = `${agents.length} AI + siz`;
    if (!cfg.ready) {
      addMessage("Xush kelibsiz","Loyihani ishga tushirish uchun .env fayliga OpenAI API kalitingizni kiriting. Ko‘rsatma README faylida.","#a78bfa");
    }
  } catch(e) { addMessage("Tizim","Server bilan bog‘lanib bo‘lmadi. README faylidagi ko‘rsatmalarni tekshiring.","#f87171"); }
  updateState();
}
init();
