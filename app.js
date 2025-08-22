// Option B build — light skin + same game rules (wallet + tiers + no jackpot replay)
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
const winBalEls = [document.getElementById('winBal'), document.getElementById('winBalGame'), document.getElementById('winBalD')];
const entriesTodayEl = document.getElementById('entriesToday');

const roundInfo = document.getElementById('roundInfo');
const timerEl = document.getElementById('timer');
const questionText = document.getElementById('questionText');
const optionsEl = document.getElementById('options');
const progressBar = document.getElementById('progressBar');
const tierChip = document.getElementById('tierChip');
const quitBtn = document.getElementById('quitBtn');

const resultSummary = document.getElementById('resultSummary');
const playAgainBtn = document.getElementById('playAgainBtn');
const backHomeBtn = document.getElementById('backHomeBtn');

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
  ENTRY_SCHEDULE: [0,100,500,1000,2000], // $0, $1, $5, $10, $20
  EARLY_REWARD: 100, // $1
  MID_REWARD: 500,   // $5
  FINAL_REWARD: 10000, // $100
  EARLY_CONT_COSTS: [100,200,500], // $1,$2,$5 then out
  MID_CONT_COSTS: [500,1000,1500], // $5,$10,$15 then out
  TIME_PER_Q: 5
};

function wallet(){ return getCents('wallet'); }
function winnings(){ return getCents('winnings'); }
function updateBalances(){
  walletBalEls.forEach(el=> el && (el.textContent = dollars(wallet())));
  winBalEls.forEach(el=> el && (el.textContent = dollars(winnings())));
  entriesTodayEl.textContent = String(getEntriesToday());
}

function getEntriesToday(){ return Number(localStorage.getItem(entriesTodayKey) || 0); }
function incEntriesToday(){ localStorage.setItem(entriesTodayKey, String(getEntriesToday()+1)); }

openRulesBtn?.addEventListener('click', ()=> rulesDialog.showModal());
openWalletBtn?.addEventListener('click', ()=>{ updateBalances(); walletDialog.showModal(); });
manageWalletBtn?.addEventListener('click', ()=>{ updateBalances(); walletDialog.showModal(); });

walletForm?.addEventListener('click', (e)=>{
  const btn = e.target.closest('.topup');
  if (!btn) return;
  const amt = Number(btn.dataset.amt || 0);
  if (amt>0){ addCents('wallet', amt*100); updateBalances(); alert(`Added $${amt.toFixed(2)} (demo).`); }
});

playBtn?.addEventListener('click', async (e)=>{
  e.preventDefault();
  const cost = entryCostForNextGame();
  if (cost>0){
    if (wallet()<cost){ walletDialog.showModal(); return; }
    addCents('wallet', -cost);
  }
  incEntriesToday();
  await startGame();
});

function entryCostForNextGame(){
  const idx = Math.min(getEntriesToday(), CONFIG.ENTRY_SCHEDULE.length-1);
  return CONFIG.ENTRY_SCHEDULE[idx];
}

async function startGame(){
  questions = await loadQuestions(); // 11 questions (10 + final)
  currentIndex = 0;
  earlyMisses = 0;
  midMisses = 0;
  showView('game');
  renderQuestion();
  updateBalances();
}

function showView(which){
  Object.values(views).forEach(v=>{ v.hidden=true; v.classList.remove('active'); });
  views[which].hidden=false; views[which].classList.add('active');
}

async function loadQuestions(){
  const res = await fetch('questions.json?v=v3.0-optionB');
  const data = await res.json();
  const arr = data.slice().sort(()=> Math.random()-0.5);
  return arr.slice(0,11);
}

function tierForIndex(i){
  if (i<5) return 1;
  if (i<10) return 2;
  return 3;
}

function renderHUD(){
  roundInfo.textContent = `Q ${Math.min(currentIndex+1,11)}/11`;
  qTimeLeft = CONFIG.TIME_PER_Q;
  timerEl.textContent = `00:${String(qTimeLeft).padStart(2,'0')}`;
  progressBar.style.width = `${Math.min(currentIndex,10)/10*100}%`;
  const tier = tierForIndex(currentIndex);
  tierChip.textContent = tier===1 ? 'Tier 1 ($1/Q)' : (tier===2 ? 'Tier 2 ($5/Q)' : 'Final ($100)');
}

function renderQuestion(){
  clearTimer();
  answered=false;
  renderHUD();
  const isFinal = (currentIndex===10);
  const q = questions[currentIndex];
  questionText.textContent = isFinal ? 'Final challenge: answer correctly to win $100.' : q.q;
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
  timer = setInterval(()=>{
    qTimeLeft--;
    timerEl.textContent = `00:${String(Math.max(0,qTimeLeft)).padStart(2,'0')}`;
    if (qTimeLeft<=0){ clearTimer(); resolveAnswer(-1); }
  },1000);
}
function clearTimer(){ if (timer){ clearInterval(timer); timer=null; } }

function handleAnswer(idx, btn){
  if (answered) return; answered=true; Array.from(optionsEl.children).forEach(b=>b.setAttribute('aria-pressed','false')); btn&&btn.setAttribute('aria-pressed','true');
  resolveAnswer(idx);
}

function resolveAnswer(selectedIdx){
  clearTimer();
  const isFinal = (currentIndex===10);
  const q = questions[currentIndex];
  const correctIdx = q.answerIndex;
  Array.from(optionsEl.children).forEach((b,idx)=>{
    if (idx===correctIdx) b.classList.add('correct');
    if (idx===selectedIdx && idx!==correctIdx) b.classList.add('incorrect');
    b.disabled=true;
  });
  const correct = (selectedIdx===correctIdx);
  if (correct){
    if (isFinal){ addCents('winnings', CONFIG.FINAL_REWARD); updateBalances(); endGame(true); return; }
    if (currentIndex<5) addCents('winnings', CONFIG.EARLY_REWARD); else addCents('winnings', CONFIG.MID_REWARD);
    updateBalances();
    setTimeout(nextQuestion,700);
  } else {
    if (isFinal){ endGame(false); return; }
    offerContinue();
  }
}

function offerContinue(){
  const tier=tierForIndex(currentIndex);
  let missCount = (tier===1? earlyMisses : midMisses);
  const costs = (tier===1? CONFIG.EARLY_CONT_COSTS : CONFIG.MID_CONT_COSTS);
  if (missCount>=costs.length){ alert('Out of continues for this tier. Start a new game.'); endGame(false,true); return; }
  const cost = costs[missCount];
  if (confirm(`Continue for ${(cost/100).toFixed(2)}? (uses winnings first)`)){
    let remain = cost;
    const useWin = Math.min(winnings(), remain);
    if (useWin>0){ addCents('winnings', -useWin); remain -= useWin; }
    if (remain>0){
      if (wallet()<remain){ walletDialog.showModal(); return; }
      addCents('wallet', -remain);
    }
    if (tier===1) earlyMisses++; else midMisses++;
    updateBalances();
    setTimeout(()=>{ answered=false; renderQuestion(); }, 250);
  } else {
    endGame(false,true);
  }
}

function nextQuestion(){
  currentIndex++;
  if (currentIndex<=10) renderQuestion();
  else endGame(false);
}

quitBtn?.addEventListener('click', ()=>{ if (confirm('Quit this run?')) showView('home'); });

function endGame(wonFinal, kicked=false){
  showView('result');
  const where = (currentIndex===10? 'Final' : `Q${currentIndex+1}`);
  resultSummary.textContent = `You finished at ${where}. Wallet: ${(wallet()/100).toFixed(2)} • Winnings: ${(winnings()/100).toFixed(2)}`;
}

playAgainBtn?.addEventListener('click', async (e)=>{ e.preventDefault(); playBtn.click(); });
backHomeBtn?.addEventListener('click', ()=> showView('home'));

// boot
updateBalances();
