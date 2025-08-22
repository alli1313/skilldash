// Mobile-first SkillDash Demo
const views = {
  home: document.getElementById('view-home'),
  game: document.getElementById('view-game'),
  result: document.getElementById('view-result'),
};

const playBtns = [document.getElementById('playBtn'), document.getElementById('playBtn2'), document.getElementById('playFromHeader')];
const openRulesBtns = [document.getElementById('openRulesBtn'), document.getElementById('openRulesBtn2'), document.getElementById('openRulesBtn3')];
const rulesDialog = document.getElementById('rulesDialog');

const navToggle = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');

const timerEl = document.getElementById('timer');
const freePlaysBadge = document.getElementById('freePlaysBadge');
const roundInfo = document.getElementById('roundInfo');
const progressBar = document.getElementById('progressBar');
const questionText = document.getElementById('questionText');
const optionsEl = document.getElementById('options');
const submitBtn = document.getElementById('submitBtn');
const nextBtn = document.getElementById('nextBtn');
const quitBtn = document.getElementById('quitBtn');

const resultSummary = document.getElementById('resultSummary');
const prizeForm = document.getElementById('prizeForm');
const playAgainBtn = document.getElementById('playAgainBtn');
const backHomeBtn = document.getElementById('backHomeBtn');
const claimBtn = document.getElementById('claimBtn');

document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav
navToggle?.addEventListener('click', () => {
  const expanded = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!expanded));
  siteNav.classList.toggle('open');
});

openRulesBtns.forEach(btn => btn?.addEventListener('click', () => rulesDialog.showModal()));
rulesDialog?.addEventListener('click', (e) => {
  // close when clicking the backdrop
  const rect = rulesDialog.getBoundingClientRect();
  const inDialog = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
  if (!inDialog) rulesDialog.close();
});

playBtns.forEach(btn => btn?.addEventListener('click', (e) => {
  e.preventDefault();
  startGame();
}));

quitBtn?.addEventListener('click', () => {
  if (confirm('Quit this round? Your progress will be lost.')) showView('home');
});

playAgainBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  startGame();
});

backHomeBtn?.addEventListener('click', () => showView('home'));
claimBtn?.addEventListener('click', () => {
  alert('In a real release, we would validate the score server-side and send a digital gift card via a provider API.');
});

// ---- Free play counter (demo, client-side only) ----
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getFreePlaysLeft() {
  const key = 'freePlay-' + todayKey();
  const used = Number(localStorage.getItem(key) || 0);
  return Math.max(0, 1 - used);
}
function consumeFreePlay() {
  const key = 'freePlay-' + todayKey();
  const used = Number(localStorage.getItem(key) || 0);
  localStorage.setItem(key, String(used + 1));
}
function updateFreePlaysBadge() {
  const left = getFreePlaysLeft();
  freePlaysBadge.textContent = `Free plays left today: ${left}`;
}

// ---- Game State ----
let questions = [];
let currentIndex = 0;
let score = 0;
let timer = null;
const TOTAL_QUESTIONS = 10;
const TIME_LIMIT = 90; // seconds for the whole round
let timeLeft = TIME_LIMIT;
let answeredThisQuestion = false;
let selectedIndex = null;

// Load questions (from local JSON for demo)
async function loadQuestions() {
  const res = await fetch('questions.json');
  const data = await res.json();
  // shuffle and take 10
  const shuffled = data.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, TOTAL_QUESTIONS);
}

function showView(which){
  Object.values(views).forEach(v => { v.hidden = true; v.classList.remove('active'); });
  views[which].hidden = false;
  views[which].classList.add('active');
}

async function startGame() {
  if (getFreePlaysLeft() <= 0) {
    const proceed = confirm('You have used today\'s free play in this demo. Start a new round anyway?');
    if (!proceed) return;
  } else {
    consumeFreePlay();
  }

  updateFreePlaysBadge();
  questions = await loadQuestions();
  currentIndex = 0;
  score = 0;
  timeLeft = TIME_LIMIT;
  answeredThisQuestion = false;
  selectedIndex = null;

  showView('game');
  renderHUD();
  renderQuestion();
  startTimer();
}

function renderHUD(){
  roundInfo.textContent = `Q ${currentIndex+1}/${TOTAL_QUESTIONS}`;
  progressBar.style.width = `${(currentIndex)/TOTAL_QUESTIONS*100}%`;
  timerEl.textContent = formatTime(timeLeft);
  updateFreePlaysBadge();
}

function renderQuestion(){
  const q = questions[currentIndex];
  questionText.textContent = q.q;
  optionsEl.innerHTML = '';
  selectedIndex = null;
  answeredThisQuestion = false;
  submitBtn.disabled = true;
  nextBtn.disabled = true;

  q.choices.forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = choice;
    btn.addEventListener('click', () => selectOption(idx, btn), { passive: true });
    optionsEl.appendChild(btn);
  });
}

function selectOption(idx, btn){
  if (answeredThisQuestion) return;
  selectedIndex = idx;
  Array.from(optionsEl.children).forEach(c => c.setAttribute('aria-pressed', 'false'));
  btn.setAttribute('aria-pressed', 'true');
  submitBtn.disabled = false;
}

submitBtn.addEventListener('click', () => {
  if (answeredThisQuestion || selectedIndex === null) return;
  answeredThisQuestion = true;
  const q = questions[currentIndex];
  const correctIdx = q.answerIndex;
  const optionButtons = Array.from(optionsEl.children);
  optionButtons.forEach((btn, idx) => {
    if (idx === correctIdx) btn.classList.add('correct');
    if (idx === selectedIndex && idx !== correctIdx) btn.classList.add('incorrect');
    btn.disabled = true;
  });
  if (selectedIndex === correctIdx) score++;
  progressBar.style.width = `${(currentIndex+1)/TOTAL_QUESTIONS*100}%`;

  // ✅ Automatically advance to next question after a short pause
  setTimeout(() => {
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      currentIndex++;
      renderHUD();
      renderQuestion();
    } else {
      endGame();
    }
  }, 1000); // 1 second delay so players see the correct answer highlight
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < TOTAL_QUESTIONS - 1){
    currentIndex++;
    renderHUD();
    renderQuestion();
  } else {
    endGame();
  }
});

function endGame(){
  stopTimer();
  const target = 8;
  const success = (score >= target) && timeLeft >= 0;
  showView('result');
  resultSummary.textContent = `You scored ${score}/${TOTAL_QUESTIONS} with ${formatTime(timeLeft)} remaining.`;
  prizeForm.hidden = !success;
}

function startTimer(){
  stopTimer();
  timer = setInterval(() => {
    timeLeft--;
    timerEl.textContent = formatTime(timeLeft);
    if (timeLeft <= 0){
      endGame();
    }
  }, 1000);
}

function stopTimer(){
  if (timer) { clearInterval(timer); timer = null; }
}

function formatTime(total){
  const t = Math.max(0, total);
  const m = Math.floor(t/60);
  const s = t % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// boot
updateFreePlaysBadge();
