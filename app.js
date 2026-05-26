// ============================================================
// Spinly — shared helpers.
// localStorage-only auth/balance — replace with backend later.
// ============================================================

const STARTING_BALANCE = 0;
const USERS_KEY = "sp_users";
const SESSION_KEY = "sp_session";

// Available promo codes
const PROMOS = {
  NEW2026: {
    code: "NEW2026",
    percent: 5,
    firstDepositOnly: true,
    description: "+5% к первому пополнению",
  },
  WHEEL10: {
    code: "WHEEL10",
    percent: 10,
    firstDepositOnly: false,
    description: "+10% к следующему пополнению",
  },
};

// ---------- VIP levels ----------
const LEVELS = [
  { lv: 1,  name: "Bronze",       xp: 0,     cashback: 0.5, color: "#cd7f32" },
  { lv: 2,  name: "Silver I",     xp: 500,   cashback: 1.0, color: "#c0c0c0" },
  { lv: 3,  name: "Silver II",    xp: 1500,  cashback: 1.5, color: "#c0c0c0" },
  { lv: 4,  name: "Gold I",       xp: 3000,  cashback: 2.0, color: "#f5c542" },
  { lv: 5,  name: "Gold II",      xp: 6000,  cashback: 2.5, color: "#f5c542" },
  { lv: 6,  name: "Platinum I",   xp: 10000, cashback: 3.0, color: "#e5e4e2" },
  { lv: 7,  name: "Platinum II",  xp: 16000, cashback: 4.0, color: "#e5e4e2" },
  { lv: 8,  name: "Diamond I",    xp: 25000, cashback: 5.0, color: "#38bdf8" },
  { lv: 9,  name: "Diamond II",   xp: 40000, cashback: 6.0, color: "#38bdf8" },
  { lv: 10, name: "Spinly Elite", xp: 60000, cashback: 8.0, color: "#ff5fa2" },
];

function getLevel(xp) {
  xp = Number(xp) || 0;
  let cur = LEVELS[0];
  let next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) cur = LEVELS[i];
    else { next = LEVELS[i]; break; }
  }
  return { current: cur, next };
}

// ---------- Wheel of Fortune ----------
const WHEEL_PRIZES = [
  { type: "money", amount: 5,    label: "€5",       color: "#5cd29a" },
  { type: "money", amount: 25,   label: "€25",      color: "#f5c542" },
  { type: "promo", promo: "WHEEL10", label: "+10%", color: "#ff5fa2", note: "Промокод +10% к след. пополнению" },
  { type: "money", amount: 100,  label: "€100",     color: "#38bdf8" },
  { type: "xp",    xp: 500,      label: "+500 XP",  color: "#5cd29a", note: "Бонусные очки опыта" },
  { type: "money", amount: 50,   label: "€50",      color: "#f5c542" },
  { type: "free",  label: "🎁 FREE",                color: "#ff5fa2", note: "Бонусное вращение" },
  { type: "money", amount: 250,  label: "€250",     color: "#38bdf8" },
];
const WHEEL_WEIGHTS = [25, 18, 8, 5, 12, 12, 5, 2];
const WHEEL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ---------- Missions ----------
const MISSIONS = [
  { id: "first_deposit", title: "Первые шаги",       desc: "Сделайте первое пополнение",                reward: 5,  target: 1,
    check: u => (u.transactions || []).some(t => t.type === "deposit") ? 1 : 0 },
  { id: "first_win",     title: "Удачный старт",     desc: "Выиграйте первый раунд",                    reward: 5,  target: 1,
    check: u => (u.stats?.wins || 0) > 0 ? 1 : 0 },
  { id: "bet_1000",      title: "На уровне",         desc: "Поставьте суммарно €1 000",                 reward: 25, target: 1000, isMoney: true,
    check: u => Math.min(u.stats?.totalBet || 0, 1000) },
  { id: "five_gems",     title: "Diamond Hands",     desc: "Откройте 5 алмазов в одном раунде Mines",   reward: 15, target: 5,
    check: u => Math.min(u.stats?.maxGemsInRound || 0, 5) },
  { id: "triple_seven",  title: "Triple Seven",      desc: "Соберите 7️⃣ 7️⃣ 7️⃣ в слотах",              reward: 50, target: 1,
    check: u => (u.stats?.slotJackpots || 0) > 0 ? 1 : 0 },
  { id: "vip_silver",    title: "Серебряный статус", desc: "Достигните уровня Silver II",                reward: 30, target: 1,
    check: u => getLevel(u.xp || 0).current.lv >= 3 ? 1 : 0 },
  { id: "big_win",       title: "Big Win",           desc: "Выиграйте €500 в одном раунде",             reward: 50, target: 500, isMoney: true,
    check: u => Math.min(u.stats?.biggestWin || 0, 500) },
  { id: "first_referral",title: "Inviter",           desc: "Пригласите первого друга",                  reward: 25, target: 1,
    check: u => (u.referrals || []).length > 0 ? 1 : 0 },
];

// ---------- Helpers: stats, xp, hooks ----------
function bumpStat(key, by = 1) {
  const u = currentUser();
  if (!u) return;
  const users = getUsers();
  if (!users[u.login].stats) users[u.login].stats = {};
  users[u.login].stats[key] = (users[u.login].stats[key] || 0) + by;
  saveUsers(users);
}
function setMaxStat(key, value) {
  const u = currentUser();
  if (!u) return;
  const users = getUsers();
  if (!users[u.login].stats) users[u.login].stats = {};
  users[u.login].stats[key] = Math.max(users[u.login].stats[key] || 0, value);
  saveUsers(users);
}
function addXp(delta) {
  const u = currentUser();
  if (!u) return;
  const users = getUsers();
  users[u.login].xp = (users[u.login].xp || 0) + delta;
  saveUsers(users);
}

function onBet(amount) {
  bumpStat("totalBet", amount);
  bumpStat("rounds", 1);
  addXp(Math.floor(amount));
}
function onWin({ bet = 0, payout = 0, multiplier = 1, game, special }) {
  const profit = payout - bet;
  bumpStat("wins", 1);
  bumpStat("totalWon", payout);
  setMaxStat("biggestWin", profit);
  setMaxStat("biggestMultiplier", multiplier);
  if (game === "slots" && special === "777") bumpStat("slotJackpots", 1);
}
function onLoss({ bet = 0, game, special }) {
  if (game === "mines" && special === "bomb") bumpStat("bombs", 1);
  const u = currentUser();
  if (!u) return;
  const lvl = getLevel(u.xp || 0).current;
  const cashback = Math.round(bet * (lvl.cashback / 100) * 100) / 100;
  if (cashback > 0) {
    updateBalance(cashback);
    addTransaction({ type: "bonus", amount: cashback, method: "cashback",
                     note: `Cashback ${lvl.cashback}% · ${lvl.name}` });
  }
}
function onGemOpened(level) { setMaxStat("maxGemsInRound", level); }

// ---------- Missions ----------
function getMissionsStatus() {
  const u = currentUser();
  if (!u) return [];
  const claimed = u.missionsClaimed || [];
  return MISSIONS.map(m => {
    const progress = m.check(u);
    return {
      ...m,
      progress,
      completed: progress >= m.target,
      claimed: claimed.includes(m.id),
    };
  });
}
function claimMission(id) {
  const u = currentUser();
  if (!u) throw new Error("Не авторизован");
  const m = MISSIONS.find(x => x.id === id);
  if (!m) throw new Error("Миссия не найдена");
  if ((u.missionsClaimed || []).includes(id)) throw new Error("Уже получено");
  if (m.check(u) < m.target) throw new Error("Условие не выполнено");
  const users = getUsers();
  if (!users[u.login].missionsClaimed) users[u.login].missionsClaimed = [];
  users[u.login].missionsClaimed.push(id);
  saveUsers(users);
  updateBalance(m.reward);
  addTransaction({ type: "bonus", amount: m.reward, method: "mission", note: `Миссия: ${m.title}` });
  return m;
}

// ---------- Referrals ----------
function genReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function findUserByReferralCode(code) {
  if (!code) return null;
  const users = getUsers();
  for (const login in users) {
    if (users[login].referralCode === code) return login;
  }
  return null;
}
function trackReferralOnFirstDeposit(login, amount) {
  const users = getUsers();
  const u = users[login];
  if (!u || !u.referredBy) return;
  const inviterLogin = findUserByReferralCode(u.referredBy);
  if (!inviterLogin || inviterLogin === login) return;
  const inviter = users[inviterLogin];
  if (!inviter.referrals) inviter.referrals = [];
  if (inviter.referrals.includes(login)) return;
  inviter.referrals.push(login);
  const bonus = Math.min(amount * 0.1, 100);
  inviter.balance = (inviter.balance || 0) + bonus;
  if (!inviter.transactions) inviter.transactions = [];
  inviter.transactions.unshift({
    id: txId(),
    type: "bonus",
    amount: bonus,
    method: "referral",
    status: "completed",
    createdAt: Date.now(),
    note: `Реферал ${login} (+10% от €${fmt(amount)})`,
  });
  saveUsers(users);
}

// ---------- Wheel of Fortune ----------
function canSpinWheel() {
  const u = currentUser();
  if (!u) return { ok: false, nextAt: 0, extra: 0 };
  const extra = u.extraSpins || 0;
  if (extra > 0) return { ok: true, nextAt: 0, extra };
  const last = u.lastWheelSpin || 0;
  const now = Date.now();
  if (now - last < WHEEL_COOLDOWN_MS) return { ok: false, nextAt: last + WHEEL_COOLDOWN_MS, extra: 0 };
  return { ok: true, nextAt: 0, extra: 0 };
}
function spinWheel() {
  const u = currentUser();
  if (!u) throw new Error("Не авторизован");
  const status = canSpinWheel();
  if (!status.ok) throw new Error("Уже использовано сегодня");

  const total = WHEEL_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let idx = 0;
  for (let i = 0; i < WHEEL_WEIGHTS.length; i++) {
    r -= WHEEL_WEIGHTS[i];
    if (r <= 0) { idx = i; break; }
  }
  const prize = WHEEL_PRIZES[idx];
  const users = getUsers();

  // Consume extra spin or set cooldown
  if ((users[u.login].extraSpins || 0) > 0) {
    users[u.login].extraSpins -= 1;
  } else {
    users[u.login].lastWheelSpin = Date.now();
  }

  // Apply prize
  let summary = "";
  if (prize.type === "money") {
    saveUsers(users);
    updateBalance(prize.amount);
    addTransaction({ type: "bonus", amount: prize.amount, method: "wheel", note: "Колесо фортуны" });
    summary = `Вы выиграли €${fmt(prize.amount)}`;
  } else if (prize.type === "promo") {
    users[u.login].pendingPromo = prize.promo;
    saveUsers(users);
    addTransaction({ type: "bonus", amount: 0, method: "wheel_promo",
                     note: `Промокод ${prize.promo} активирован — +${PROMOS[prize.promo].percent}% к следующему пополнению` });
    summary = `Промокод ${prize.promo} активирован (+${PROMOS[prize.promo].percent}% к след. депозиту)`;
  } else if (prize.type === "xp") {
    users[u.login].xp = (users[u.login].xp || 0) + prize.xp;
    saveUsers(users);
    addTransaction({ type: "bonus", amount: 0, method: "wheel_xp", note: `+${prize.xp} XP с Колеса фортуны` });
    summary = `Получено +${prize.xp} XP`;
  } else if (prize.type === "free") {
    users[u.login].extraSpins = (users[u.login].extraSpins || 0) + 1;
    saveUsers(users);
    addTransaction({ type: "bonus", amount: 0, method: "wheel_free", note: "Бонусное вращение Колеса" });
    summary = "Бонусное вращение! Крутите ещё раз.";
  }

  return { prize, index: idx, summary };
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch { return {}; }
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

function currentUser() {
  const login = localStorage.getItem(SESSION_KEY);
  if (!login) return null;
  const users = getUsers();
  return users[login] ? { login, ...users[login] } : null;
}

function registerUser(login, password, opts = {}) {
  login = login.trim().toLowerCase();
  if (login.length < 3) throw new Error("Логин должен быть не короче 3 символов");
  if (password.length < 4) throw new Error("Пароль должен быть не короче 4 символов");
  const users = getUsers();
  if (users[login]) throw new Error("Пользователь с таким логином уже существует");

  // Validate referral code if provided
  let referredBy = null;
  if (opts.referredBy) {
    const code = String(opts.referredBy).trim().toUpperCase();
    if (code) {
      const inviter = findUserByReferralCode(code);
      if (!inviter) throw new Error("Реферальный код не найден");
      if (inviter === login) throw new Error("Нельзя пригласить себя");
      referredBy = code;
    }
  }

  const now = Date.now();
  users[login] = {
    password,
    balance: STARTING_BALANCE,
    email: null,
    createdAt: now,
    transactions: [],
    xp: 0,
    stats: {},
    missionsClaimed: [],
    lastWheelSpin: 0,
    referralCode: genReferralCode(),
    referredBy,
    referrals: [],
  };
  saveUsers(users);
  localStorage.setItem(SESSION_KEY, login);
}

function loginUser(login, password) {
  login = login.trim().toLowerCase();
  const users = getUsers();
  if (!users[login] || users[login].password !== password) {
    throw new Error("Неверный логин или пароль");
  }
  localStorage.setItem(SESSION_KEY, login);
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.href = "index.html";
}

function updateBalance(delta) {
  const u = currentUser();
  if (!u) return null;
  const users = getUsers();
  users[u.login].balance = Math.max(0, (users[u.login].balance || 0) + delta);
  saveUsers(users);
  return users[u.login].balance;
}

function fmt(n) {
  return Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function txId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }) +
         " · " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// ---------- Profile / Wallet ops ----------
function changePassword(oldPw, newPw) {
  const u = currentUser();
  if (!u) throw new Error("Не авторизован");
  if (u.password !== oldPw) throw new Error("Старый пароль введён неверно");
  if (newPw.length < 4) throw new Error("Новый пароль должен быть не короче 4 символов");
  if (newPw === oldPw) throw new Error("Новый пароль совпадает со старым");
  const users = getUsers();
  users[u.login].password = newPw;
  saveUsers(users);
}

function setEmail(email) {
  const u = currentUser();
  if (!u) throw new Error("Не авторизован");
  email = String(email).trim().toLowerCase();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!ok) throw new Error("Введите корректный email");
  const users = getUsers();
  users[u.login].email = email;
  saveUsers(users);
}

function addTransaction(tx) {
  const u = currentUser();
  if (!u) return;
  const users = getUsers();
  if (!users[u.login].transactions) users[u.login].transactions = [];
  users[u.login].transactions.unshift({
    id: txId(),
    createdAt: Date.now(),
    status: "completed",
    ...tx,
  });
  saveUsers(users);
}

function deposit(amount, method) {
  amount = Number(amount);
  if (!(amount > 0)) throw new Error("Введите сумму");
  if (amount < 5) throw new Error("Минимальное пополнение €5");
  if (amount > 10000) throw new Error("Максимум €10,000 за раз");

  const u = currentUser();
  const users = getUsers();
  const wasFirstDeposit = !(u.transactions || []).some(t => t.type === "deposit");

  // Apply pending promo (if any & still valid)
  let bonus = 0;
  let promoCode = null;
  if (u && u.pendingPromo && PROMOS[u.pendingPromo]) {
    const promo = PROMOS[u.pendingPromo];
    const hasDeposited = (u.transactions || []).some(t => t.type === "deposit");
    if (!promo.firstDepositOnly || !hasDeposited) {
      bonus = Math.round(amount * promo.percent) / 100;
      promoCode = u.pendingPromo;
    }
  }

  updateBalance(amount + bonus);
  addTransaction({ type: "deposit", amount, method });

  if (promoCode) {
    addTransaction({
      type: "bonus",
      amount: bonus,
      method: promoCode,
      note: `Промокод ${promoCode} +${PROMOS[promoCode].percent}%`,
    });
    if (!users[u.login].promosUsed) users[u.login].promosUsed = [];
    users[u.login].promosUsed.push(promoCode);
    delete users[u.login].pendingPromo;
    saveUsers(users);
  }

  // XP for deposits: 5 XP per €1
  addXp(Math.floor(amount * 5));

  if (wasFirstDeposit) trackReferralOnFirstDeposit(u.login, amount);

  return { amount, bonus, promo: promoCode };
}

function applyPromo(code) {
  const u = currentUser();
  if (!u) throw new Error("Не авторизован");
  code = String(code).trim().toUpperCase();
  if (!code) throw new Error("Введите промокод");
  const promo = PROMOS[code];
  if (!promo) throw new Error("Такого промокода не существует");

  const usedList = u.promosUsed || [];
  if (usedList.includes(code)) throw new Error("Этот промокод уже использован");

  if (promo.firstDepositOnly) {
    const hasDeposited = (u.transactions || []).some(t => t.type === "deposit");
    if (hasDeposited) throw new Error("Доступен только до первого пополнения");
  }

  const users = getUsers();
  users[u.login].pendingPromo = code;
  saveUsers(users);
  return promo;
}

function clearPromo() {
  const u = currentUser();
  if (!u) return;
  const users = getUsers();
  delete users[u.login].pendingPromo;
  saveUsers(users);
}

function getActivePromo() {
  const u = currentUser();
  if (!u || !u.pendingPromo) return null;
  return PROMOS[u.pendingPromo] || null;
}

function withdraw(amount, method) {
  amount = Number(amount);
  const u = currentUser();
  if (!u) throw new Error("Не авторизован");
  if (!(amount > 0)) throw new Error("Введите сумму");
  if (amount < 10) throw new Error("Минимальный вывод €10");
  if (amount > u.balance) throw new Error("Недостаточно средств на балансе");
  updateBalance(-amount);
  addTransaction({ type: "withdraw", amount: -amount, method });
  return amount;
}

function getTransactions() {
  const u = currentUser();
  return u ? (u.transactions || []) : [];
}

// ---------- SVG Logo ----------
function logoSvg() {
  return `
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg-ring" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stop-color="#f5c542"/>
          <stop offset="60%" stop-color="#ff8c42"/>
          <stop offset="100%" stop-color="#ff5fa2"/>
        </linearGradient>
        <radialGradient id="lg-core" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0%"  stop-color="#fff5d6"/>
          <stop offset="60%" stop-color="#f5c542"/>
          <stop offset="100%" stop-color="#c98e1f"/>
        </radialGradient>
      </defs>
      <g class="ring">
        <circle cx="20" cy="20" r="16" stroke="url(#lg-ring)" stroke-width="2.5"
                stroke-dasharray="5 4" stroke-linecap="round" fill="none"/>
      </g>
      <g class="core">
        <circle cx="20" cy="20" r="7" fill="url(#lg-core)"/>
        <circle cx="17.5" cy="17.5" r="2.2" fill="rgba(255,255,255,0.7)"/>
      </g>
    </svg>
  `;
}

function renderHeader() {
  const slot = document.getElementById("header-slot");
  if (!slot) return;
  const u = currentUser();
  const muted = (window.SFX && SFX.isMuted()) ? true : false;
  const muteIcon = muted ? "🔇" : "🔊";

  const userBox = u
    ? `<a class="balance" id="balance-chip" href="profile.html" title="Открыть профиль">€ ${fmt(u.balance)}</a>
       <a class="user-pill" href="profile.html" title="Профиль">
         <span class="avatar-sm">${u.login[0].toUpperCase()}</span>
         <span class="user-handle">${u.login}</span>
       </a>
       <button class="btn ghost" onclick="logout()">Выйти</button>`
    : `<a class="btn" href="account.html">Войти</a>
       <a class="btn primary" href="account.html?tab=register">Регистрация</a>`;

  slot.innerHTML = `
    <header class="site">
      <div class="row">
        <a class="logo" href="index.html">
          <span class="mark">${logoSvg()}</span>
          <span class="wordmark">Spinly</span>
        </a>
        <nav class="menu">
          <a href="index.html" class="nav-home">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>
            <span>Главная</span>
          </a>
          <span class="nav-divider"></span>
          <a href="mines.html">Mines</a>
          <a href="slots.html">Слоты</a>
          <a href="dice.html">Dice</a>
          <span class="nav-divider"></span>
          <a href="wheel.html" class="nav-bonus">🎁 Бонусы</a>
        </nav>
        <div class="user-box">
          <button class="icon-btn mute-btn" title="Звук" aria-label="Звук">${muteIcon}</button>
          ${userBox}
        </div>
      </div>
    </header>
  `;
}

// Delegated mute handler — survives header re-renders.
function attachMuteHandler() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".mute-btn");
    if (!btn) return;
    if (!window.SFX) return;
    const nowMuted = SFX.toggleMute();
    // Update icon on every mute button currently in DOM (safe even if only one).
    document.querySelectorAll(".mute-btn").forEach(b => {
      b.textContent = nowMuted ? "🔇" : "🔊";
    });
    if (!nowMuted) SFX.click();
  });
}

function flashBalance() {
  const chip = document.getElementById("balance-chip");
  if (!chip) return;
  chip.classList.remove("flash");
  void chip.offsetWidth;
  chip.classList.add("flash");
}

function renderFooter() {
  const slot = document.getElementById("footer-slot");
  if (!slot) return;
  slot.innerHTML = `
    <footer class="site">
      <div class="container">
        <div class="links">
          <a href="faq.html">FAQ</a>
          <a href="terms.html">Пользовательское соглашение</a>
          <a href="privacy.html">Политика конфиденциальности</a>
          <a href="https://t.me/spinly_support" target="_blank" rel="noopener">Поддержка в Telegram</a>
        </div>
        <div>© ${new Date().getFullYear()} Spinly. Лицензированная площадка, Республика Кипр.</div>
        <div style="margin-top: 4px;">Только для лиц старше 18 лет. Играйте ответственно.</div>
      </div>
    </footer>
  `;
}

function injectTgSupport() {
  if (document.querySelector(".tg-support")) return;
  const btn = document.createElement("a");
  btn.className = "tg-support";
  btn.href = "https://t.me/spinly_support";
  btn.target = "_blank";
  btn.rel = "noopener";
  btn.title = "Связаться с поддержкой в Telegram";
  btn.innerHTML = `
    <span class="tg-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
      </svg>
    </span>
    <span>Поддержка</span>
  `;
  document.body.appendChild(btn);
}

function requireAuth() {
  if (!currentUser()) {
    location.href = "account.html";
    return false;
  }
  return true;
}

// ---------- Background FX ----------
function injectBackground() {
  if (document.querySelector(".bg-fx")) return;
  const fx = document.createElement("div");
  fx.className = "bg-fx";
  fx.innerHTML = `
    <div class="orb o1"></div>
    <div class="orb o2"></div>
    <div class="orb o3"></div>
    <div class="orb o4"></div>
  `;
  document.body.prepend(fx);
}

// ---------- Confetti ----------
function confetti(count = 80) {
  let layer = document.querySelector(".confetti-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "confetti-layer";
    document.body.appendChild(layer);
  }
  const colors = ["#f5c542", "#ff5fa2", "#8b5cf6", "#38bdf8", "#2ecc71"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    const left = Math.random() * 100;
    const dx = (Math.random() - 0.5) * 200;
    const dur = 2.5 + Math.random() * 2;
    const delay = Math.random() * 0.4;
    p.style.left = left + "vw";
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.setProperty("--dx", dx + "px");
    p.style.animationDuration = dur + "s";
    p.style.animationDelay = delay + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(p);
    setTimeout(() => p.remove(), (dur + delay + 0.2) * 1000);
  }
}

// ---------- Hover whoosh (game cards & nav links) ----------
function attachHoverSounds() {
  let lastHovered = null;
  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest(".game-card:not(.soon), nav.menu a");
    if (target && target !== lastHovered) {
      lastHovered = target;
      if (window.SFX) window.SFX.whoosh();
    } else if (!target) {
      lastHovered = null;
    }
  });
}

// ---------- Button ripple ----------
function attachRipples() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
    ripple.style.top  = (e.clientY - rect.top  - size / 2) + "px";
    btn.appendChild(ripple);
    if (window.SFX) SFX.click();
    setTimeout(() => ripple.remove(), 600);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  injectBackground();
  renderHeader();
  renderFooter();
  injectTgSupport();
  attachRipples();
  attachMuteHandler();
  attachHoverSounds();
});
