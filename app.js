// ============================================================
// Spinly — shared helpers.
// localStorage-only auth/balance — replace with backend later.
// ============================================================

const STARTING_BALANCE = 1000;
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
};

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

function registerUser(login, password) {
  login = login.trim().toLowerCase();
  if (login.length < 3) throw new Error("Логин должен быть не короче 3 символов");
  if (password.length < 4) throw new Error("Пароль должен быть не короче 4 символов");
  const users = getUsers();
  if (users[login]) throw new Error("Пользователь с таким логином уже существует");
  const now = Date.now();
  users[login] = {
    password,
    balance: STARTING_BALANCE,
    email: null,
    createdAt: now,
    transactions: [{
      id: txId(),
      type: "bonus",
      amount: STARTING_BALANCE,
      method: "welcome",
      status: "completed",
      createdAt: now,
      note: "Приветственный бонус",
    }],
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
        <div>© ${new Date().getFullYear()} Spinly — демо-версия.</div>
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
      <svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
