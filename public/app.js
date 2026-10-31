const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const feed = document.getElementById("feed");
const form = document.getElementById("form");
const input = document.getElementById("message");
const send = document.getElementById("send");
const debate = document.getElementById("debate");
const statusEl = document.getElementById("status");
const hint = document.getElementById("hint");
let lastCount = 0, busy = false;

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function cssName(m){return m.role==="human"?"human":m.role==="system"?"system":({Gemini:"gemini",Qwen:"qwen",Inkling:"mistral"}[m.name]||"system");}
function render(messages){
  if(!messages.length)return;
  if(messages.length===lastCount)return;
  feed.innerHTML=messages.map(m=>`<article class="msg ${cssName(m)}"><div class="name">${esc(m.name)}</div><div class="content">${esc(m.content)}</div><div class="time">${new Date(m.time).toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"})}</div></article>`).join("");
  lastCount=messages.length;feed.scrollTop=feed.scrollHeight;
  debate.disabled=busy||!messages.some(m=>m.role==="human");
}
async function refresh(){
  try{
    const [r,c]=await Promise.all([fetch("/api/messages"),fetch("/api/config")]);
    const d=await r.json(), cfg=await c.json();
    render(d.messages||[]);setBusy(Boolean(d.busy));
    const ready=cfg.ready||{};
    statusEl.textContent=`API: ${Object.values(ready).filter(Boolean).length}/3`;
    statusEl.title=`Gemini ${ready.gemini?"tayyor":"kalit yo‘q"} · Llama ${ready.llama?"tayyor":"kalit yo‘q"} · Inkling ${ready.openrouter?"tayyor":"kalit yo‘q"}`;
  }catch(e){statusEl.textContent="Ulanishda xato";}
}
function setBusy(v){busy=v;send.disabled=v;debate.disabled=v||lastCount===0;hint.textContent=v?"AI'lar javob bermoqda…":"Xabar yozishingiz mumkin";}
form.addEventListener("submit",async e=>{
  e.preventDefault();const text=input.value.trim();if(!text||busy)return;
  input.value="";setBusy(true);
  try{const r=await fetch("/api/message",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});if(!r.ok){const d=await r.json();alert(d.error||"Xabar yuborilmadi");}}
  catch(e){alert("Server bilan aloqa yo‘q.");}
  await refresh();
});
debate.addEventListener("click",async()=>{
  if(busy)return;setBusy(true);
  try{const r=await fetch("/api/debate/start",{method:"POST"});if(!r.ok){const d=await r.json();alert(d.error||"Munozara boshlanmadi");}}
  catch(e){alert("Server bilan aloqa yo‘q.");}
  await refresh();
});
input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
refresh();setInterval(refresh,1800);
