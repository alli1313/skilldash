// SkillDash — Trust Skin + Wallet + Tiered Structure (demo-only client logic)
const views = {
  home: document.getElementById('view-home'),
  game: document.getElementById('view-game'),
  result: document.getElementById('view-result'),
};

// UI elements
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

// Local storage helpers (cents to avoid float issues)
function getCents(key){ return Number(localStorage.getItem(key) || 0); }
function setCents(key, val){ localStorage.setItem(key, String(Math.max(0, Math.floor(val)))); }
function addCents(key, delta){ setCents(key, getCents(key) + Math.floor(delta)); }

function dollars(cents){ return '$' + (cents/100).toFixed(2); }

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// State
let questions = [];
let currentIndex = 0;
let timer = null;
let qTimeLeft = 5;
let answered = false;
let earlyMisses = 0;
let midMisses = 0;
let entriesTodayKey = 'entries-' + todayKey();

const CONFIG = {
  FREE_PER_DAY: 1,
  ENTRY_SCHEDULE: [0, 100, 500, 1000, 2000], // cents for games 1..5 today (0 = free)
  EARLY_REWARD: 100, // $1 in cents
  MID_REWARD: 500, // $5
  FINAL_REWARD: 10000, // $100
  EARLY_CONT_COSTS: [100, 200, 500], // $1, $2, $5 then OUT
  MID_CONT_COSTS: [500, 1000, 1500], // $5, $10, $15 then OUT
  TIME_PER_Q: 5
};

// Wallet & winnings
function wallet(){ return getCents('wallet'); }
function winnings(){ return getCents('winnings'); }
function updateBalances(){
  walletBalEls.forEach(el => el && (el.textContent = dollars(wallet())));
  winBalEls.forEach(el => el && (el.textContent = dollars(winnings())));
  entriesTodayEl.textContent = String(getEntriesToday());
}

function getEntriesToday(){
  return Number(localStorage.getItem(entriesTodayKey) || 0);
}
function incEntriesToday(){
  const k = entriesTodayKey;
  const n = Number(localStorage.getItem(k) || 0) + 1;
  localStorage.setItem(k, String(n));
}

function resetDailyIfNeeded(){
  // naive: if key not for today, reset counters; rely on different key each day
  // Clean up old day keys optionally (omitted for brevity)
}

// Dialogs
openRulesBtn?.addEventListener('click', ()=> rulesDialog.showModal());
openWalletBtn?.addEventListener('click', ()=> { updateBalances(); walletDialog.showModal(); });
manageWalletBtn?.addEventListener('click', ()=> { updateBalances(); walletDialog.showModal(); });

walletForm?.addEventListener('click', (e)=>{
  const btn = e.target.closest('.topup');
  if (!btn) return;
  const amt = Number(btn.dataset.amt || 0);
  if (amt > 0){
    addCents('wallet', amt*100);
    updateBalances();
    alert(`Added $${amt.toFixed(2)} to your wallet (demo).`);
  }
});

// Start game flow
playBtn?.addEventListener('click', async (e)=>{
  e.preventDefault();
  resetDailyIfNeeded();

  let cost = entryCostForNextGame();
  if (cost > 0){
    if (wallet() < cost){
      alert(`Entry costs ${dollars(cost)}. Please top up your wallet.`);
      walletDialog.showModal();
      return;
    }
    addCents('wallet', -cost);
  }
  incEntriesToday();

  await startGame();
});

function entryCostForNextGame(){
  const entries = getEntriesToday();
  // entries is count before starting next game; schedule index = entries (0-based)
  // clamp to last value if more than array
  return CONFIG.ENTRY_SCHEDULE[Math.min(entries, CONFIG.ENTRY_SCHEDULE.length-1)];
}

// Game logic
async function startGame(){
  questions = await loadQuestions();
  currentIndex = 0;
  earlyMisses = 0;
  midMisses = 0;
  showView('game');
  renderHUD();
  renderQuestion();
  startQuestionTimer();
  updateBalances();
}

function showView(which){
  Object.values(views).forEach(v => { v.hidden = true; v.classList.remove('active'); });
  views[which].hidden = false;
  views[which].classList.add('active');
}

async function loadQuestions(){
  const res = await fetch('questions.json');
  const data = await res.json();
  // shuffle and pick 10
  const arr = data.slice().sort(()=> Math.random() - 0.5);
  return arr.slice(0, 10);
}

function tierForIndex(i){
  if (i < 5) return 1; // early
  if (i < 10) return 2; // mid
  return 3; // final
}

function renderHUD(){
  roundInfo.textContent = `Q ${Math.min(currentIndex+1, 11)}/11`;
  timerEl.textContent = `00:${String(qTimeLeft).padStart(2,'0')}`;
  progressBar.style.width = `${(currentIndex)/10*100}%`;
  const tier = tierForIndex(currentIndex);
  tierChip.textContent = tier === 1 ? 'Tier 1 ($1/Q)' : (tier === 2 ? 'Tier 2 ($5/Q)' : 'Final ($100)');
}

function renderQuestion(){
  clearTimer();
  qTimeLeft = CONFIG.TIME_PER_Q;
  answered = false;
  renderHUD();

  const isFinal = (currentIndex >= 10); // final is index 10
  if (isFinal){
    questionText.textContent = "Final challenge: answer correctly to win $100.";
  } else {
    questionText.textContent = questions[currentIndex].q;
  }

  optionsEl.innerHTML = '';
  const opts = isFinal ? questions[0].choices : questions[currentIndex].choices;
  opts.forEach((choice, idx)=>{
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = choice;
    btn.addEventListener('click', ()=> handleAnswer(idx, btn), { passive: true });
    optionsEl.appendChild(btn);
  });

  startQuestionTimer();
}

function startQuestionTimer(){
  clearTimer();
  timer = setInterval(()=>{
    qTimeLeft--;
    timerEl.textContent = `00:${String(Math.max(0,qTimeLeft)).padStart(2,'0')}`;
    if (qTimeLeft <= 0){
      clearTimer();
      // auto mark as missed (no selection)
      handleTimeout();
    }
  }, 1000);
}
function clearTimer(){ if (timer){ clearInterval(timer); timer = null; } }

function handleTimeout(){
  if (answered) return;
  // Treat as incorrect selection
  resolveAnswer(-1);
}

function handleAnswer(idx, btn){
  if (answered) return;
  answered = true;
  // show pressed
  Array.from(optionsEl.children).forEach(b => b.setAttribute('aria-pressed','false'));
  btn && btn.setAttribute('aria-pressed','true');
  resolveAnswer(idx);
}

function resolveAnswer(selectedIdx){
  clearTimer();
  const isFinal = (currentIndex >= 10);
  const q = questions[Math.min(currentIndex, 9)];
  const correctIdx = q.answerIndex;

  // Visual feedback
  const optionButtons = Array.from(optionsEl.children);
  optionButtons.forEach((b, idx)=>{
    if (idx === correctIdx) b.classList.add('correct');
    if (idx === selectedIdx && idx !== correctIdx) b.classList.add('incorrect');
    b.disabled = true;
  });

  const correct = (!isFinal && selectedIdx === correctIdx) || (isFinal && selectedIdx === correctIdx);
  if (correct){
    if (currentIndex < 5){
      // early reward
      addCents('winnings', CONFIG.EARLY_REWARD);
    } else if (currentIndex < 10){
      addCents('winnings', CONFIG.MID_REWARD);
    } else {
      // final jackpot
      addCents('winnings', CONFIG.FINAL_REWARD);
      endGame(true);
      return;
    }
    updateBalances();
    setTimeout(nextQuestion, 700);
  } else {
    // Offer continue per tier (unless final)
    if (isFinal){
      // one shot only
      endGame(false);
    } else {
      offerContinue();
    }
  }
}

function continueCostForMiss(){
  const tier = tierForIndex(currentIndex);
  if (tier === 1){
    const idx = Math.min(earlyMisses, CONFIG.EARLY_CONT_COSTS.length-1);
    return CONFIG.EARLY_CONT_COSTS[idx];
  } else if (tier === 2){
    const idx = Math.min(midMisses, CONFIG.MID_CONT_COSTS.length-1);
    return CONFIG.MID_CONT_COSTS[idx];
  }
  return Infinity;
}

function offerContinue(){
  const tier = tierForIndex(currentIndex);
  let missCount, maxMisses, costs;
  if (tier === 1){
    missCount = earlyMisses;
    maxMisses = CONFIG.EARLY_CONT_COSTS.length;
    costs = CONFIG.EARLY_CONT_COSTS;
  } else {
    missCount = midMisses;
    maxMisses = CONFIG.MID_CONT_COSTS.length;
    costs = CONFIG.MID_CONT_COSTS;
  }

  if (missCount >= maxMisses){
    // OUT
    alert('Out of continues for this tier. You’ll need to start a new game.');
    endGame(false, true);
    return;
  }

  const cost = costs[missCount];
  // try to use winnings first
  let msg = `Continue for ${dollars(cost)}? (Winnings used first)`;
  if (confirm(msg)){
    // pay from winnings then wallet
    let remain = cost;
    const win = winnings();
    const useWin = Math.min(win, remain);
    if (useWin > 0){
      addCents('winnings', -useWin);
      remain -= useWin;
    }
    if (remain > 0){
      if (wallet() < remain){
        alert(`You need ${dollars(remain)} more. Please top up your wallet.`);
        walletDialog.showModal();
        return;
      }
      addCents('wallet', -remain);
    }

    // increment miss counter
    if (tier === 1) earlyMisses++; else midMisses++;
    updateBalances();

    // Reload current question (same index but new timer)
    setTimeout(()=>{
      answered = false;
      renderQuestion();
    }, 300);
  } else {
    endGame(false, true);
  }
}

function nextQuestion(){
  currentIndex++;
  if (currentIndex < 10){
    renderQuestion();
  } else if (currentIndex === 10){
    // proceed to final
    renderQuestion();
  } else {
    endGame(false);
  }
}

quitBtn?.addEventListener('click', ()=>{
  if (confirm('Quit this run?')) showView('home');
});

function endGame(wonFinal, kicked=false){
  // Summarize
  const entries = getEntriesToday();
  let msg = `You finished at Q${Math.min(currentIndex+1,11)}.
`;
  msg += `Wallet: ${dollars(wallet())} • Winnings: ${dollars(winnings())}`;
  // Show result view
  showView('result');
  resultSummary.textContent = msg;
}

playAgainBtn?.addEventListener('click', async (e)=>{
  e.preventDefault();
  playBtn.click();
});
backHomeBtn?.addEventListener('click', ()=> showView('home'));

// Boot
updateBalances();
