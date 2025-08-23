// SkillDash v3.2 — app-like skin, PWA, round breaks, wallet-first
const views = {
  home: document.getElementById('view-home'),
  game: document.getElementById('view-game'),
  result: document.getElementById('view-result'),
};

const playBtn = document.getElementById('playBtn');
const openRulesBtn = document.getElementById('openRules');
const rulesDialog = document.getElementById('rulesDialog');
const openWalletBtn = document.getElementById('openWallet');
const manageWalletBtn = document.getElementById('manageWallet');
const walletDialog = document.getElementById('walletDialog');
const walletForm = document.getElementById('walletForm');

const walletBalEls = [document.getElementById('walletBal'), document.getElementById('walletBalGame'), document.getElementById('walletBalD')];
const playsLeftEls = [document.getElementById('playsLeft'), document.getElementById('playsLeftGame'), document.getElementById('playsLeftD')];

const roundInfo = document.getElementById('roundInfo');
const timerEl = document.getElementById('timer');
const timerCircle = document.getElementById('timerCircle');
const questionText = document.getElementById('questionText');
const optionsEl = document.getElementById('options');
const progressBar = document.getElementById('progressBar');
const tierChip = document.getElementById('tierChip');
const quitBtn = document.getElementById('quitBtn');

const resultSummary = document.getElementById('resultSummary');
const playAgainBtn = document.getElementById('playAgainBtn');
const backHomeBtn = document.getElementById('backHomeBtn');

const roundBreakDialog = document.getElementById('roundBreak');
const rbTitle = document.getElementById('rbTitle');
const rbBody = document.getElementById('rbBody');

function getCents(key){ return Number(localStorage.getItem(key) || 0); }
function setCents(key,val){ localStorage.setItem(key, String(Math.max(0, Math.floor(val)))); }
function addCents(key,delta){ setCents(key, getCents(key)+Math.floor(delta)); }
function dollars(cents){ return '$'+(cents/100).toFixed(2); }
function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

let questions = [];
let currentIndex = 0; // 0..10 (10=final)
let timer = null;
let qTimeLeft = 5;
let answered = false;
let earlyMisses = 0;
let midMisses = 0;
let entriesTodayKey = 'entries-' + todayKey();

const CONFIG = {
  FREE_PER_DAY: 1,
  ENTRY_SCHEDULE: [0,100,500,1000,2000], // entry costs per game
  EARLY_REWARD: 100, // payout per correct in tier 1
  MID_REWARD: 500,   // payout per correct in tier 2
  FINAL_REWARD: 10000, // payout for final
  EARLY_CONT_COSTS: [100,200,500],
  MID_CONT_COSTS: [500,1000,1500],
  TIME_PER_Q: 5
};

// Wallet and plays
function wallet(){ return getCents('wallet'); }
function setWallet(c){ setCents('wallet', c); }
function addWallet(delta){ addCents('wallet', delta); }

function entriesToday(){ return Number(localStorage.getItem(entriesTodayKey) || 0); }
function incEntriesToday(){ localStorage.setItem(entriesTodayKey, String(entriesToday()+1)); }

function playsLeftToday(){
  const e = entriesToday();
  // One free + 4 paid slots baseline; we show remaining out of 5
  return Math.max(0, 5 - e);
}

function updateStatusBars(){
  walletBalEls.forEach(el=> el && (el.textContent = dollars(wallet())));
  playsLeftEls.forEach(el=> el && (el.textContent = String(playsLeftToday())));
}

openRulesBtn?.addEventListener('click', ()=> rulesDialog.showModal());
openWalletBtn?.addEventListener('click', ()=>{ updateStatusBars(); walletDialog.showModal(); });
manageWalletBtn?.addEventListener('click', ()=>{ updateStatusBars(); walletDialog.showModal(); });

walletForm?.addEventListener('click', (e)=>{
  const btn = e.target.closest('.topup');
  if (!btn) return;
  const amt = Number(btn.dataset.amt || 0);
  if (amt>0){ addWallet(amt*100); updateStatusBars(); alert(`Added $${amt.toFixed(2)} (demo).`); }
});

playBtn?.addEventListener('click', async (e)=>{
  e.preventDefault();
  const cost = entryCostForNextGame();
  if (cost>0){
    if (wallet()<cost){ walletDialog.showModal(); return; }
    addWallet(-cost);
  }
  incEntriesToday();
  await startGame();
});

function entryCostForNextGame(){
  const idx = Math.min(entriesToday(), CONFIG.ENTRY_SCHEDULE.length-1);
  return CONFIG.ENTRY_SCHEDULE[idx];
}

async function startGame(){
  questions = await loadQuestions(); // 11 questions (10 + final)
  currentIndex = 0;
  earlyMisses = 0;
  midMisses = 0;
  showView('game');
  renderQuestion();
  updateStatusBars();
}

function showView(which){
  Object.values(views).forEach(v=>{ v.hidden=true; v.classList.remove('active'); });
  views[which].hidden=false; views[which].classList.add('active');
}

async function loadQuestions(){
  const res = await fetch('questions.json?v=v3.2-appskin');
  const data = await res.json();
  // Pick a sequence that grows in difficulty: easy(1-30), mid(31-70), hard(71-100)
  const easy = data.filter(q=> q.difficulty==='easy').sort(()=>Math.random()-0.5).slice(0,5);
  const mid  = data.filter(q=> q.difficulty==='mid').sort(()=>Math.random()-0.5).slice(0,5);
  const final= data.filter(q=> q.difficulty==='hard').sort(()=>Math.random()-0.5).slice(0,1);
  return [...easy, ...mid, ...final];
}

function tierForIndex(i){
  if (i<5) return 1;
  if (i<10) return 2;
  return 3;
}

function renderHUD(){
  roundInfo.textContent = `Q ${Math.min(currentIndex+1,11)}/11`;
  qTimeLeft = CONFIG.TIME_PER_Q;
  timerEl.textContent = String(qTimeLeft);
  timerCircle.style.setProperty('--p', '100');
  progressBar.style.width = `${Math.min(currentIndex,10)/10*100}%`;
  const tier = tierForIndex(currentIndex);
  tierChip.textContent = tier===1 ? 'Tier 1 ($1/Q)' : (tier===2 ? 'Tier 2 ($5/Q)' : 'Final ($100)');
}

function renderQuestion(){
  clearTimer();
  answered=false;
  renderHUD();
  const q = questions[currentIndex];
  questionText.textContent = q.q;
  optionsEl.innerHTML='';
  q.choices.forEach((choice, idx)=>{
    const b=document.createElement('button');
    b.className='option-btn'; b.type='button'; b.setAttribute('aria-pressed','false'); b.textContent=choice;
    b.addEventListener('click', ()=> handleAnswer(idx, b), { passive:true });
    optionsEl.appendChild(b);
  });
  startQuestionTimer();
}

function startQuestionTimer(){
  clearTimer();
  const total = CONFIG.TIME_PER_Q;
  let elapsed = 0;
  timer = setInterval(()=>{
    elapsed++;
    qTimeLeft = Math.max(0, total - elapsed);
    timerEl.textContent = String(qTimeLeft);
    const pct = Math.round(100 * (qTimeLeft/total));
    timerCircle.style.setProperty('--p', String(pct));
    if (qTimeLeft<=0){ clearTimer(); resolveAnswer(-1); }
  },1000);
}
function clearTimer(){ if (timer){ clearInterval(timer); timer=null; } }

function handleAnswer(idx, btn){
  if (answered) return; answered=true; Array.from(optionsEl.children).forEach(b=>b.setAttribute('aria-pressed','false')); btn&&btn.setAttribute('aria-pressed','true');
  resolveAnswer(idx);
}

function confettiBurst(x, y){
  const root = document.getElementById('confetti');
  for (let i=0;i<120;i++){ 
    const s = document.createElement('div');
    s.className='confetti';
    const c = ['#ff6db2','#6b8cff','#37e6c2'][Math.floor(Math.random()*3)];
    const size = 6 + Math.random()*8;
    s.style.background=c; s.style.width=size+'px'; s.style.height=size+'px';
    s.style.left=(x + (Math.random()*120-60))+'px';
    s.style.top=(y + (Math.random()*20-10))+'px';
    s.style.transform=`translateY(0) rotate(0deg)`;
    root.appendChild(s);
    setTimeout(()=> s.remove(), 1000);
  }
}

function resolveAnswer(selectedIdx){
  clearTimer();
  const q = questions[currentIndex];
  const correctIdx = q.answerIndex;
  Array.from(optionsEl.children).forEach((b,idx)=>{
    if (idx===correctIdx) b.classList.add('correct');
    if (idx===selectedIdx && idx!==correctIdx) b.classList.add('incorrect');
    b.disabled=true;
  });
  const correct = (selectedIdx===correctIdx);
  if (correct){
    const btn = optionsEl.children[correctIdx];
    const rect = btn.getBoundingClientRect();
    confettiBurst(rect.left + rect.width/2, rect.top + rect.height/2);
    const isFinal = (currentIndex===10);
    // Payouts go straight to Wallet
    if (isFinal){ addWallet(CONFIG.FINAL_REWARD); updateStatusBars(); setTimeout(()=> endGame(true), 600); return; }
    if (currentIndex<5) addWallet(CONFIG.EARLY_REWARD); else addWallet(CONFIG.MID_REWARD);
    updateStatusBars();
    if (currentIndex===4){ // Tier 1 done
      rbTitle.textContent='Tier 1 complete!';
      rbBody.textContent='You cleared the $1 round. Next up: Tier 2 — $5 per correct and tougher questions.';
      roundBreakDialog.showModal();
      return;
    }
    if (currentIndex===9){ // Tier 2 done
      rbTitle.textContent='Tier 2 complete!';
      rbBody.textContent='Final round: one shot for $100. Good luck!';
      roundBreakDialog.showModal();
      return;
    }
    setTimeout(()=> nextQuestion(), 600);
  } else {
    // wrong
    const tier=tierForIndex(currentIndex);
    let missCount = (tier===1? earlyMisses : midMisses);
    const costs = (tier===1? CONFIG.EARLY_CONT_COSTS : CONFIG.MID_CONT_COSTS);
    if (missCount>=costs.length){ endGame(false,true); return; }
    const cost = costs[missCount];
    if (confirm(`Continue for ${(cost/100).toFixed(2)}? (from Wallet)`)){
      if (wallet()<cost){ walletDialog.showModal(); return; }
      addWallet(-cost);
      if (tier===1) earlyMisses++; else midMisses++;
      updateStatusBars();
      setTimeout(()=>{ answered=false; renderQuestion(); }, 250);
    } else {
      endGame(false,true);
    }
  }
}

roundBreakDialog?.addEventListener('close', ()=>{ nextQuestion(); });

function nextQuestion(){
  currentIndex++;
  if (currentIndex<=10) renderQuestion();
  else endGame(false);
}

quitBtn?.addEventListener('click', ()=>{ if (confirm('Quit this run?')) showView('home'); });

function endGame(wonFinal, kicked=false){
  showView('result');
  const where = (currentIndex===10? 'Final' : `Q${currentIndex+1}`);
  resultSummary.textContent = `You finished at ${where}. Wallet: ${(wallet()/100).toFixed(2)}`;
}

playAgainBtn?.addEventListener('click', async (e)=>{ e.preventDefault(); playBtn.click(); });
backHomeBtn?.addEventListener('click', ()=> showView('home'));

// boot
updateStatusBars();
console.log('Loaded v3.2-appskin');
