/**
 * SMAN 1 BELIMBING - Sistem Pelayanan Publik v2.0
 * Production-Ready Application Core
 * Supabase | Realtime | Rate Limiting | XSS Protection | Admin Auth
 */

const CONFIG = {
  SUPABASE_URL: "https://jqfwkvffhnmdillpmxsa.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_j_xu_Nnlf7YrQ3KWB2hp9g_XRQWmXEA",
  EDGE_FUNCTION_URL: "https://jqfwkvffhnmdillpmxsa.supabase.co/functions/v1",
  RATE_LIMIT_MAX: 30,
  RATE_LIMIT_WINDOW: 60000,
};

const Security = {
  sanitize(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  },
  validatePhone(phone) {
    const clean = phone.replace(/\D/g, "");
    return /^\d{10,15}$/.test(clean) ? clean : null;
  },
  validateDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return date >= today && date <= maxDate ? dateStr : null;
  },
  validateTime(timeStr) {
    return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(timeStr) ? timeStr : null;
  },
  checkRateLimit(endpoint) {
    const key = `rl_${endpoint}`;
    const now = Date.now();
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;
    const recent = data.filter(t => t > windowStart);
    if (recent.length >= CONFIG.RATE_LIMIT_MAX) {
      return { allowed: false, retryAfter: Math.ceil((recent[0] - windowStart) / 1000) };
    }
    recent.push(now);
    localStorage.setItem(key, JSON.stringify(recent));
    return { allowed: true };
  },
};

let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient && typeof window !== "undefined" && window.supabase) {
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

const AppState = {
  appointments: [],
  stats: {},
  isAdmin: false,
  adminToken: null,
  adminSessionExpiry: null,
  realtimeSubscription: null,
  theme: localStorage.getItem("theme") || "light",
};

const Utils = {
  formatDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric"
    });
  },
  formatTime(timeStr) {
    if (!timeStr) return "-";
    const [h, m] = timeStr.split(":");
    return `${h}:${m} WIB`;
  },
  formatDateTime(isoStr) {
    if (!isoStr) return "-";
    return new Date(isoStr).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  },
  debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  },
  generateId() {
    return "apt-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  },
  async generateQR(data, size = 160) {
    return new Promise((resolve) => {
      if (typeof QRCode !== "undefined") {
        const canvas = document.createElement("canvas");
        QRCode.toCanvas(canvas, data, { width: size, margin: 2 }, (err) => {
          resolve(err ? "" : canvas.toDataURL("image/png"));
        });
      } else {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="white"/><rect x="10" y="10" width="30" height="30" fill="black"/><rect x="15" y="15" width="20" height="20" fill="white"/><rect x="18" y="18" width="14" height="14" fill="black"/><rect x="${size-40}" y="10" width="30" height="30" fill="black"/><rect x="${size-35}" y="15" width="20" height="20" fill="white"/><rect x="${size-32}" y="18" width="14" height="14" fill="black"/><rect x="10" y="${size-40}" width="30" height="30" fill="black"/><rect x="15" y="${size-35}" width="20" height="20" fill="white"/><rect x="18" y="${size-32}" width="14" height="14" fill="black"/><text x="50%" y="55%" text-anchor="middle" font-size="14" font-family="monospace" fill="black">${data}</text></svg>`;
        resolve("data:image/svg+xml;base64," + btoa(svg));
      }
    });
  },
};

const Toast = {
  container: null,
  init() {
    this.container = document.getElementById("toastContainer");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "toast-container";
      this.container.id = "toastContainer";
      document.body.appendChild(this.container);
    }
  },
  show(type, title, message, duration = 4000) {
    this.init();
    const icons = {
      success: "fa-check-circle", error: "fa-times-circle",
      warning: "fa-exclamation-triangle", info: "fa-info-circle"
    };
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon"><i class="fas ${icons[type]}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${Security.sanitize(title)}</div>
        <div class="toast-message">${Security.sanitize(message)}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("toast-out");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success(t, m) { this.show("success", t, m); },
  error(t, m) { this.show("error", t, m); },
  warning(t, m) { this.show("warning", t, m); },
  info(t, m) { this.show("info", t, m); },
};

const Modal = {
  overlay: null, modal: null, title: null, body: null, footer: null,
  init() {
    this.overlay = document.getElementById("modalOverlay");
    this.modal = document.getElementById("modal");
    this.title = document.getElementById("modalTitle");
    this.body = document.getElementById("modalBody");
    this.footer = document.getElementById("modalFooter");
    if (!this.overlay) return;
    document.getElementById("modalClose")?.addEventListener("click", () => this.close());
    this.overlay.addEventListener("click", e => { if (e.target === this.overlay) this.close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && this.overlay?.classList.contains("active")) this.close(); });
  },
  open(title, bodyHtml, buttons = []) {
    this.init();
    if (!this.overlay) return;
    this.title.textContent = title;
    this.body.innerHTML = bodyHtml;
    this.footer.innerHTML = buttons.map(btn => {
      if (btn.close) return `<button class="${btn.class}" onclick="Modal.close()">${btn.text}</button>`;
      return `<button class="${btn.class}" id="mb-${btn.text.replace(/\s/g, "-")}">${btn.text}</button>`;
    }).join("");
    buttons.forEach(btn => {
      if (!btn.close && btn.onClick) {
        const el = document.getElementById(`mb-${btn.text.replace(/\s/g, "-")}`);
        if (el) el.addEventListener("click", btn.onClick);
      }
    });
    this.overlay.classList.remove("hidden");
    requestAnimationFrame(() => this.overlay.classList.add("active"));
    document.body.style.overflow = "hidden";
  },
  close() {
    if (!this.overlay) return;
    this.overlay.classList.remove("active");
    setTimeout(() => { this.overlay.classList.add("hidden"); document.body.style.overflow = ""; }, 250);
  },
};

const ThemeManager = {
  init() {
    const toggle = document.getElementById("themeToggle");
    const icon = document.getElementById("themeIcon");
    if (!toggle) return;
    if (AppState.theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      if (icon) icon.className = "fas fa-sun";
    }
    toggle.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
        AppState.theme = "light";
        if (icon) icon.className = "fas fa-moon";
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
        AppState.theme = "dark";
        if (icon) icon.className = "fas fa-sun";
      }
    });
  },
};

const Navigation = {
  init() {
    const navToggle = document.getElementById("navToggle");
    const navMenu = document.getElementById("navMenu");
    const navbar = document.getElementById("navbar");
    if (navToggle && navMenu) {
      navToggle.addEventListener("click", () => {
        navToggle.classList.toggle("active");
        navMenu.classList.toggle("active");
      });
      navMenu.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
          navToggle.classList.remove("active");
          navMenu.classList.remove("active");
        });
      });
    }
    if (navbar) {
      window.addEventListener("scroll", Utils.debounce(() => {
        navbar.classList.toggle("scrolled", window.scrollY > 20);
      }, 50));
    }
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener("click", e => {
        const href = anchor.getAttribute("href");
        if (href === "#") return;
        const target = document.querySelector(href);
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
    });
  },
};

const FAQManager = {
  init() {
    const faqList = document.getElementById("faqList");
    if (!faqList) return;
    faqList.querySelectorAll(".faq-question").forEach(q => {
      q.addEventListener("click", () => {
        const item = q.parentElement;
        const isActive = item.classList.contains("active");
        faqList.querySelectorAll(".faq-item").forEach(i => {
          i.classList.remove("active");
          i.querySelector(".faq-question").setAttribute("aria-expanded", "false");
        });
        if (!isActive) { item.classList.add("active"); q.setAttribute("aria-expanded", "true"); }
      });
    });
  },
};

const AppointmentService = {
  async fetchAll() {
    try {
      const rc = Security.checkRateLimit("fetch");
      if (!rc.allowed) throw new Error(`Rate limit. Retry after ${rc.retryAfter}s`);
      const res = await fetch(`${CONFIG.EDGE_FUNCTION_URL}/appointments`, {
        method: "GET", headers: { "Content-Type": "application/json" }
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      AppState.appointments = result.data || [];
      return AppState.appointments;
    } catch (e) {
      console.error("Fetch error:", e);
      try {
        const stored = localStorage.getItem("appointments");
        if (stored) AppState.appointments = JSON.parse(stored);
      } catch (x) { AppState.appointments = []; }
      return AppState.appointments;
    }
  },

  async create(data) {
    try {
      const rc = Security.checkRateLimit("create");
      if (!rc.allowed) throw new Error(`Terlalu banyak permintaan. Coba lagi dalam ${rc.retryAfter} detik.`);
      const res = await fetch(`${CONFIG.EDGE_FUNCTION_URL}/appointments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!result.success) {
        if (result.errors) throw new Error(result.errors.join("; "));
        throw new Error(result.message);
      }
      AppState.appointments.unshift(result.data);
      this.saveToStorage();
      return result.data;
    } catch (e) { console.error("Create error:", e); throw e; }
  },

  async update(id, data) {
    try {
      const token = AppState.adminToken;
      if (!token) throw new Error("Admin auth required");
      const res = await fetch(`${CONFIG.EDGE_FUNCTION_URL}/appointments/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json", "x-admin-token": token }, body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      const idx = AppState.appointments.findIndex(a => a.id === id);
      if (idx !== -1) {
        AppState.appointments[idx] = { ...AppState.appointments[idx], ...result.data };
        this.saveToStorage();
      }
      return result.data;
    } catch (e) { console.error("Update error:", e); throw e; }
  },

  async delete(id) {
    try {
      const token = AppState.adminToken;
      if (!token) throw new Error("Admin auth required");
      const res = await fetch(`${CONFIG.EDGE_FUNCTION_URL}/appointments/${id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json", "x-admin-token": token }
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      AppState.appointments = AppState.appointments.filter(a => a.id !== id);
      this.saveToStorage();
      return true;
    } catch (e) { console.error("Delete error:", e); throw e; }
  },

  async fetchStats() {
    try {
      const res = await fetch(`${CONFIG.EDGE_FUNCTION_URL}/stats`, {
        method: "GET", headers: { "Content-Type": "application/json" }
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      AppState.stats = result.stats;
      return result;
    } catch (e) {
      console.error("Stats error:", e);
      const today = new Date().toISOString().split("T")[0];
      const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay());
      const ms = new Date(); ms.setDate(1);
      return {
        stats: {
          total: AppState.appointments.length,
          today: AppState.appointments.filter(a => a.tanggal === today && a.status !== "Dibatalkan").length,
          week: AppState.appointments.filter(a => new Date(a.tanggal) >= ws && a.status !== "Dibatalkan").length,
          month: AppState.appointments.filter(a => new Date(a.tanggal) >= ms && a.status !== "Dibatalkan").length,
          done: AppState.appointments.filter(a => a.status === "Selesai").length,
          waiting: AppState.appointments.filter(a => a.status === "Menunggu Konfirmasi").length,
          confirmed: AppState.appointments.filter(a => a.status === "Dikonfirmasi").length,
          cancelled: AppState.appointments.filter(a => a.status === "Dibatalkan").length,
        },
        chartData: [],
      };
    }
  },

  saveToStorage() {
    try { localStorage.setItem("appointments", JSON.stringify(AppState.appointments)); }
    catch (e) { console.warn("Save failed:", e); }
  },

  generateDummyData() {
    const names = ["Ahmad Fauzi","Siti Nurhaliza","Budi Santoso","Dewi Lestari","Eko Prasetyo","Rina Wulandari","Fajar Nugroho","Gita Permata","Hadi Wijaya","Indah Sari","Joko Susilo","Kartika Dewi","Lukman Hakim","Maya Anggraini","Nanda Pratama"];
    const tujuan = ["Kepala Sekolah","Wakil Kepala Sekolah","Kepala Kurikulum","Guru BK","Wali Kelas","Guru Mata Pelajaran","Tata Usaha","Bendahara","Operator Sekolah","Komite Sekolah"];
    const statuses = ["Menunggu Konfirmasi","Dikonfirmasi","Selesai","Dibatalkan"];
    const keperluanList = ["Konsultasi perkembangan akademik","Pengambilan raport semester","Pembayaran SPP","Administrasi pendaftaran","Konsultasi masalah siswa","Pengambilan dokumen","Rapat koordinasi","Konsultasi beasiswa"];
    const today = new Date(), dummy = [];
    for (let i = 0; i < 25; i++) {
      const date = new Date(today); date.setDate(date.getDate() - Math.floor(Math.random() * 10));
      const dateStr = date.toISOString().split("T")[0];
      const hours = 8 + Math.floor(Math.random() * 8), minutes = Math.floor(Math.random() * 4) * 15;
      dummy.push({
        id: Utils.generateId(),
        nomor_antrian: `A-${String(i + 1).padStart(3, "0")}`,
        nama_lengkap: names[i % names.length],
        nomor_wa: "0812" + String(Math.floor(Math.random() * 100000000)).padStart(8, "0"),
        instansi: i % 3 === 0 ? "Orang Tua Murid" : (i % 5 === 0 ? "Komite Sekolah" : null),
        tujuan_bertemu: tujuan[i % tujuan.length],
        keperluan: keperluanList[i % keperluanList.length],
        tanggal: dateStr,
        jam: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        status: statuses[i % statuses.length],
        created_at: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    AppState.appointments = dummy;
    this.saveToStorage();
    return dummy;
  },

  subscribeToChanges(cb) {
    const sb = getSupabase();
    if (!sb) { console.warn("Supabase unavailable for realtime"); return null; }
    const sub = sb.channel("appointments-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, payload => {
        console.log("Realtime:", payload);
        if (cb) cb(payload);
      })
      .subscribe();
    AppState.realtimeSubscription = sub;
    return sub;
  },

  unsubscribe() {
    if (AppState.realtimeSubscription) {
      AppState.realtimeSubscription.unsubscribe();
      AppState.realtimeSubscription = null;
    }
  },
};

const AdminAuth = {
  async login(username, password) {
    try {
      const res = await fetch(`${CONFIG.EDGE_FUNCTION_URL}/admin-auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password })
      });
      const result = await res.json();
      if (!result.success) return { success: false, message: result.message, attemptsRemaining: result.attemptsRemaining, locked: result.locked };
      AppState.adminToken = result.token;
      AppState.adminSessionExpiry = new Date(result.expiresAt).getTime();
      AppState.isAdmin = true;
      localStorage.setItem("adminToken", result.token);
      localStorage.setItem("adminSessionExpiry", String(AppState.adminSessionExpiry));
      return { success: true, token: result.token };
    } catch (e) { console.error("Login error:", e); return { success: false, message: "Gagal terhubung ke server" }; }
  },

  async verifyToken(token) {
    if (!token) return false;
    try {
      const res = await fetch(`${CONFIG.EDGE_FUNCTION_URL}/admin-auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token })
      });
      const result = await res.json();
      return result.success && result.valid;
    } catch (e) { console.error("Verify error:", e); return false; }
  },

  async logout() {
    const token = AppState.adminToken;
    if (token) {
      try {
        await fetch(`${CONFIG.EDGE_FUNCTION_URL}/admin-auth`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout", token })
        });
      } catch (e) { console.warn("Logout failed:", e); }
    }
    AppState.adminToken = null;
    AppState.adminSessionExpiry = null;
    AppState.isAdmin = false;
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminSessionExpiry");
  },

  async checkSession() {
    const token = localStorage.getItem("adminToken");
    const expiry = parseInt(localStorage.getItem("adminSessionExpiry") || "0");
    if (!token || Date.now() > expiry) { await this.logout(); return false; }
    const valid = await this.verifyToken(token);
    if (valid) { AppState.adminToken = token; AppState.adminSessionExpiry = expiry; AppState.isAdmin = true; return true; }
    await this.logout(); return false;
  },

  async resetPassword(currentPassword, newPassword) {
    try {
      const res = await fetch(`${CONFIG.EDGE_FUNCTION_URL}/admin-auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", currentPassword, newPassword })
      });
      return await res.json();
    } catch (e) { return { success: false, message: "Gagal mereset password" }; }
  },
};

const FormHandler = {
  init() {
    const form = document.getElementById("appointmentForm");
    if (!form) return;
    this.setupCustomSelect();
    this.setupFileUpload();
    this.setupCharCount();
    this.setupDateValidation();
    form.addEventListener("submit", async e => { e.preventDefault(); await this.handleSubmit(form); });
  },

  setupCustomSelect() {
    const trigger = document.getElementById("tujuanTrigger");
    const options = document.getElementById("tujuanOptions");
    const hidden = document.getElementById("tujuanBertemu");
    const lainnya = document.getElementById("tujuanLainnyaField");
    if (!trigger || !options) return;
    trigger.addEventListener("click", e => { e.stopPropagation(); trigger.classList.toggle("active"); options.classList.toggle("open"); });
    options.querySelectorAll(".select-option").forEach(opt => {
      opt.addEventListener("click", () => {
        const value = opt.dataset.value;
        const text = opt.querySelector("span").textContent;
        hidden.value = value;
        trigger.querySelector(".select-placeholder").textContent = text;
        trigger.classList.add("has-value");
        trigger.classList.remove("active");
        options.classList.remove("open");
        if (lainnya) lainnya.classList.toggle("hidden", value !== "Lainnya");
        const err = document.getElementById("error-tujuanBertemu");
        if (err) err.textContent = "";
        trigger.style.borderColor = "";
      });
    });
    document.addEventListener("click", e => {
      if (!trigger.contains(e.target) && !options.contains(e.target)) {
        trigger.classList.remove("active"); options.classList.remove("open");
      }
    });
  },

  setupFileUpload() {
    const fileInput = document.getElementById("dokumen");
    const uploadArea = document.getElementById("fileUploadArea");
    const preview = document.getElementById("filePreview");
    const removeBtn = document.getElementById("fileRemove");
    if (!uploadArea || !fileInput) return;
    uploadArea.addEventListener("click", () => fileInput.click());
    uploadArea.addEventListener("dragover", e => { e.preventDefault(); uploadArea.classList.add("dragover"); });
    uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
    uploadArea.addEventListener("drop", e => {
      e.preventDefault(); uploadArea.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) this.handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener("change", e => { if (e.target.files.length > 0) this.handleFile(e.target.files[0]); });
    if (removeBtn) removeBtn.addEventListener("click", e => {
      e.stopPropagation(); fileInput.value = "";
      if (preview) preview.classList.add("hidden");
      uploadArea.classList.remove("hidden");
    });
  },

  handleFile(file) {
    const maxSize = 5 * 1024 * 1024;
    const allowed = ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/jpeg","image/jpg","image/png"];
    const err = document.getElementById("error-dokumen");
    if (file.size > maxSize) { if (err) err.textContent = "Ukuran file maksimal 5MB"; return; }
    if (!allowed.includes(file.type)) { if (err) err.textContent = "Format file tidak didukung"; return; }
    if (err) err.textContent = "";
    const uploadArea = document.getElementById("fileUploadArea");
    const preview = document.getElementById("filePreview");
    const fileName = document.getElementById("fileName");
    const fileSize = document.getElementById("fileSize");
    const fileIcon = document.getElementById("fileIcon");
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
    if (fileIcon) fileIcon.className = file.type.startsWith("image/") ? "fas fa-image" : "fas fa-file";
    if (uploadArea) uploadArea.classList.add("hidden");
    if (preview) preview.classList.remove("hidden");
  },

  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024, sizes = ["B","KB","MB","GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  setupCharCount() {
    const ta = document.getElementById("keperluan");
    const c = document.getElementById("charCount");
    if (!ta || !c) return;
    ta.addEventListener("input", () => {
      const len = ta.value.length;
      c.textContent = len;
      if (len > 500) { ta.value = ta.value.substring(0, 500); c.textContent = 500; }
    });
  },

  setupDateValidation() {
    const di = document.getElementById("tanggal");
    if (!di) return;
    const today = new Date().toISOString().split("T")[0];
    di.setAttribute("min", today);
    const max = new Date(); max.setDate(max.getDate() + 30);
    di.setAttribute("max", max.toISOString().split("T")[0]);
  },

  validateForm() {
    const fields = {
      namaLengkap: { el: document.getElementById("namaLengkap"), min: 3, req: true },
      nomorWA: { el: document.getElementById("nomorWA"), validator: Security.validatePhone, req: true },
      tujuanBertemu: { el: document.getElementById("tujuanBertemu"), req: true },
      keperluan: { el: document.getElementById("keperluan"), min: 10, req: true },
      tanggal: { el: document.getElementById("tanggal"), validator: Security.validateDate, req: true },
      jam: { el: document.getElementById("jam"), validator: Security.validateTime, req: true }
    };
    let valid = true, errors = {};
    for (const [key, cfg] of Object.entries(fields)) {
      const el = cfg.el;
      if (!el) continue;
      const errEl = document.getElementById(`error-${key}`);
      let val = el.value?.trim() || "";
      let err = "";
      if (cfg.req && !val) err = "Field ini wajib diisi";
      else if (val) {
        if (cfg.validator) {
          const v = cfg.validator(val);
          if (!v) err = key === "nomorWA" ? "Nomor WhatsApp tidak valid" : key === "tanggal" ? "Tanggal tidak valid" : "Nilai tidak valid";
          else if (key === "nomorWA") val = v;
        }
        if (cfg.min && val.length < cfg.min) err = `Minimal ${cfg.min} karakter`;
      }
      if (err) { valid = false; errors[key] = err; el.classList.add("error"); if (errEl) errEl.textContent = err; }
      else { el.classList.remove("error"); if (errEl) errEl.textContent = ""; }
    }
    const tv = document.getElementById("tujuanBertemu")?.value;
    if (tv === "Lainnya") {
      const le = document.getElementById("tujuanLainnya");
      const lee = document.getElementById("error-tujuanLainnya");
      if (le && !le.value.trim()) { valid = false; le.classList.add("error"); if (lee) lee.textContent = "Tujuan lainnya wajib diisi"; }
      else if (le) { le.classList.remove("error"); if (lee) lee.textContent = ""; }
    }
    return { isValid: valid, errors, values: this.getFormValues() };
  },

  getFormValues() {
    const t = document.getElementById("tujuanBertemu")?.value;
    const tl = document.getElementById("tujuanLainnya")?.value;
    return {
      namaLengkap: document.getElementById("namaLengkap")?.value?.trim() || "",
      nomorWA: Security.validatePhone(document.getElementById("nomorWA")?.value || ""),
      instansi: document.getElementById("instansi")?.value?.trim() || null,
      tujuanBertemu: t === "Lainnya" ? (tl?.trim() || "Lainnya") : t,
      keperluan: document.getElementById("keperluan")?.value?.trim() || "",
      tanggal: document.getElementById("tanggal")?.value,
      jam: document.getElementById("jam")?.value
    };
  },

  async handleSubmit(form) {
    const btnSubmit = document.getElementById("btnSubmit");
    const btnText = btnSubmit?.querySelector(".btn-text");
    const btnLoader = btnSubmit?.querySelector(".btn-loader");
    const v = this.validateForm();
    if (!v.isValid) {
      Toast.error("Validasi Gagal", "Periksa kembali data");
      const fe = Object.keys(v.errors)[0], el = document.getElementById(fe);
      if (el) el.focus();
      return;
    }
    if (btnText) btnText.classList.add("hidden");
    if (btnLoader) btnLoader.classList.remove("hidden");
    if (btnSubmit) btnSubmit.disabled = true;
    try {
      const data = await AppointmentService.create(v.values);
      Toast.success("Berhasil!", `Nomor antrian: ${data.nomor_antrian || data.nomorAntrian}`);
      this.showAppointmentCard(data);
      form.reset();
      const trigger = document.getElementById("tujuanTrigger");
      if (trigger) trigger.querySelector(".select-placeholder").textContent = "Pilih tujuan bertemu";
      trigger?.classList.remove("has-value");
      document.getElementById("filePreview")?.classList.add("hidden");
      document.getElementById("fileUploadArea")?.classList.remove("hidden");
      const cc = document.getElementById("charCount");
      if (cc) cc.textContent = "0";
    } catch (e) {
      Toast.error("Gagal", e.message || "Terjadi kesalahan");
    } finally {
      if (btnText) btnText.classList.remove("hidden");
      if (btnLoader) btnLoader.classList.add("hidden");
      if (btnSubmit) btnSubmit.disabled = false;
    }
  },

  async showAppointmentCard(data) {
    const overlay = document.getElementById("cardModalOverlay");
    if (!overlay) return;
    document.getElementById("cardNumber").textContent = data.nomor_antrian || data.nomorAntrian || "-";
    document.getElementById("cardStatus").textContent = data.status || "Menunggu Konfirmasi";
    document.getElementById("cardNama").textContent = data.nama_lengkap || data.namaLengkap || "-";
    document.getElementById("cardTujuan").textContent = data.tujuan_bertemu || data.tujuanBertemu || "-";
    document.getElementById("cardTanggal").textContent = Utils.formatDate(data.tanggal);
    document.getElementById("cardJam").textContent = Utils.formatTime(data.jam);
    document.getElementById("cardWA").textContent = data.nomor_wa || data.nomorWA || "-";
    document.getElementById("cardTimestamp").textContent = Utils.formatDateTime(data.created_at || data.createdAt);
    const qrData = JSON.stringify({ id: data.id, nomor: data.nomor_antrian || data.nomorAntrian, nama: data.nama_lengkap || data.namaLengkap });
    const qrContainer = document.getElementById("cardQR");
    if (qrContainer) {
      const qrUrl = await Utils.generateQR(qrData, 160);
      qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR" style="width:100%;height:100%;object-fit:contain;">`;
    }
    overlay.classList.remove("hidden");
    requestAnimationFrame(() => overlay.classList.add("active"));
    document.getElementById("btnPrintCard")?.addEventListener("click", () => window.print());
    document.getElementById("btnCopyNumber")?.addEventListener("click", () => {
      const num = data.nomor_antrian || data.nomorAntrian;
      navigator.clipboard.writeText(num).then(() => Toast.success("Disalin", `Nomor ${num} disalin`));
    });
    document.getElementById("btnShareCard")?.addEventListener("click", () => {
      const text = `Janji Kunjungan SMAN 1 BELIMBING\nNomor: ${data.nomor_antrian || data.nomorAntrian}\nNama: ${data.nama_lengkap || data.namaLengkap}\nTujuan: ${data.tujuan_bertemu || data.tujuanBertemu}\nTanggal: ${Utils.formatDate(data.tanggal)}\nJam: ${Utils.formatTime(data.jam)}\nStatus: ${data.status}`;
      if (navigator.share) navigator.share({ title: "Janji Kunjungan", text });
      else navigator.clipboard.writeText(text).then(() => Toast.success("Disalin", "Detail disalin"));
    });
    overlay.addEventListener("click", e => {
      if (e.target === overlay) { overlay.classList.remove("active"); setTimeout(() => overlay.classList.add("hidden"), 250); }
    });
  },
};

const HeroStats = {
  async update() {
    await AppointmentService.fetchStats();
    const s = AppState.stats;
    const totalEl = document.getElementById("statTotal");
    const todayEl = document.getElementById("statToday");
    const waitingEl = document.getElementById("statWaiting");
    if (totalEl) totalEl.textContent = s.total || 0;
    if (todayEl) todayEl.textContent = s.today || 0;
    if (waitingEl) waitingEl.textContent = s.waiting || 0;
    const preview = document.getElementById("heroQueuePreview");
    if (preview && AppState.appointments.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const ta = AppState.appointments.filter(a => a.tanggal === today).slice(0, 3);
      if (ta.length > 0) {
        preview.innerHTML = ta.map(apt =>
          `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--color-border);"><span style="font-weight:700;color:var(--color-primary);font-size:0.875rem;">${apt.nomor_antrian || apt.nomorAntrian}</span><span style="font-size:0.75rem;color:var(--color-text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Security.sanitize(apt.nama_lengkap || apt.namaLengkap)}</span><span style="font-size:0.75rem;color:var(--color-text-tertiary);">${Utils.formatTime(apt.jam)}</span></div>`
        ).join("");
      } else {
        preview.innerHTML = `<div style="text-align:center;padding:24px;color:var(--color-text-tertiary);font-size:0.875rem;"><i class="fas fa-calendar-check" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>Tidak ada antrian hari ini</div>`;
      }
    }
  },
};

const DaftarJanjiPage = {
  currentPage: 1, itemsPerPage: 12, filteredAppointments: [],
  init() { this.loadAppointments(); this.setupFilters(); this.setupRealtime(); },
  async loadAppointments() { await AppointmentService.fetchAll(); this.filterAndRender(); this.updateStats(); },
  setupRealtime() { AppointmentService.subscribeToChanges(() => { this.loadAppointments(); Toast.info("Update", "Data diperbarui"); }); },
  updateStats() {
    const today = new Date().toISOString().split("T")[0];
    const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay());
    const ms = new Date(); ms.setDate(1);
    const s = {
      total: AppState.appointments.length,
      today: AppState.appointments.filter(a => a.tanggal === today && a.status !== "Dibatalkan").length,
      week: AppState.appointments.filter(a => new Date(a.tanggal) >= ws && a.status !== "Dibatalkan").length,
      month: AppState.appointments.filter(a => new Date(a.tanggal) >= ms && a.status !== "Dibatalkan").length,
      done: AppState.appointments.filter(a => a.status === "Selesai").length,
      waiting: AppState.appointments.filter(a => a.status === "Menunggu Konfirmasi").length,
    };
    ["statTotal","statToday","statWeek","statMonth","statDone","statWaiting"].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = [s.total, s.today, s.week, s.month, s.done, s.waiting][i];
    });
  },
  setupFilters() {
    ["filterSearch","filterDate","filterTujuan","filterStatus","filterSort"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", Utils.debounce(() => { this.currentPage = 1; this.filterAndRender(); }, 300));
        el.addEventListener("change", () => { this.currentPage = 1; this.filterAndRender(); });
      }
    });
  },
  filterAndRender() {
    const search = (document.getElementById("filterSearch")?.value || "").toLowerCase();
    const date = document.getElementById("filterDate")?.value || "";
    const tujuan = document.getElementById("filterTujuan")?.value || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const sort = document.getElementById("filterSort")?.value || "newest";
    this.filteredAppointments = AppState.appointments.filter(apt =>
      (!search || (apt.nama_lengkap || apt.namaLengkap || "").toLowerCase().includes(search) || (apt.nomor_antrian || apt.nomorAntrian || "").toLowerCase().includes(search)) &&
      (!date || apt.tanggal === date) &&
      (!tujuan || (apt.tujuan_bertemu || apt.tujuanBertemu) === tujuan) &&
      (!status || apt.status === status)
    );
    this.filteredAppointments.sort((a, b) => {
      switch(sort) {
        case "newest": return new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt);
        case "oldest": return new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt);
        case "date": return new Date(a.tanggal + "T" + a.jam) - new Date(b.tanggal + "T" + b.jam);
        case "name": return (a.nama_lengkap || a.namaLengkap).localeCompare(b.nama_lengkap || b.namaLengkap);
        case "queue": return (a.nomor_antrian || a.nomorAntrian).localeCompare(b.nomor_antrian || b.nomorAntrian);
        default: return 0;
      }
    });
    this.renderGrid(); this.renderPagination();
  },
  renderGrid() {
    const grid = document.getElementById("appointmentsGrid");
    if (!grid) return;
    const sc = { "Menunggu Konfirmasi": "status-waiting", "Dikonfirmasi": "status-confirmed", "Selesai": "status-done", "Dibatalkan": "status-cancelled" };
    const si = { "Menunggu Konfirmasi": "fa-clock", "Dikonfirmasi": "fa-check", "Selesai": "fa-check-circle", "Dibatalkan": "fa-times-circle" };
    if (this.filteredAppointments.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-search" style="font-size:4rem;color:var(--color-text-muted);margin-bottom:16px;display:block;"></i><h3 style="font-size:1.25rem;font-weight:700;color:var(--color-text);margin-bottom:8px;">Tidak Ditemukan</h3><p style="color:var(--color-text-secondary);">Tidak ada janji temu yang sesuai filter.</p></div>`;
      return;
    }
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageItems = this.filteredAppointments.slice(start, end);
    grid.innerHTML = pageItems.map(apt =>
      `<div class="appointment-card-item"><div class="card-item-header"><span class="card-item-queue">${apt.nomor_antrian || apt.nomorAntrian}</span><span class="card-item-status ${sc[apt.status] || "status-waiting"}"><i class="fas ${si[apt.status] || "fa-clock"}"></i> ${apt.status}</span></div><div class="card-item-body"><div class="card-item-row"><div class="card-item-icon"><i class="fas fa-user"></i></div><div class="card-item-info"><span class="card-item-label">Nama</span><span class="card-item-value">${Security.sanitize(apt.nama_lengkap || apt.namaLengkap)}</span></div></div><div class="card-item-row"><div class="card-item-icon"><i class="fas fa-bullseye"></i></div><div class="card-item-info"><span class="card-item-label">Tujuan</span><span class="card-item-value">${Security.sanitize(apt.tujuan_bertemu || apt.tujuanBertemu)}</span></div></div><div class="card-item-row"><div class="card-item-icon"><i class="fas fa-calendar"></i></div><div class="card-item-info"><span class="card-item-label">Tanggal</span><span class="card-item-value">${Utils.formatDate(apt.tanggal)}</span></div></div><div class="card-item-row"><div class="card-item-icon"><i class="fas fa-clock"></i></div><div class="card-item-info"><span class="card-item-label">Jam</span><span class="card-item-value">${Utils.formatTime(apt.jam)}</span></div></div></div><div class="card-item-footer"><span class="card-item-time"><i class="fas fa-history" style="margin-right:4px;"></i>${Utils.formatDateTime(apt.created_at || apt.createdAt)}</span><div class="card-item-actions"><button class="card-item-btn" onclick="DaftarJanjiPage.copyToClipboard('${apt.nomor_antrian || apt.nomorAntrian}')" title="Salin"><i class="fas fa-copy"></i></button><button class="card-item-btn" onclick="DaftarJanjiPage.shareAppointment('${apt.id}')" title="Bagikan"><i class="fas fa-share-alt"></i></button></div></div></div>`
    ).join("");
  },
  renderPagination() {
    const totalPages = Math.ceil(this.filteredAppointments.length / this.itemsPerPage);
    const p = document.getElementById("pagination");
    if (!p) return;
    if (totalPages <= 1) { p.innerHTML = ""; return; }
    let html = `<button class="page-btn" ${this.currentPage === 1 ? "disabled" : ""} onclick="DaftarJanjiPage.goToPage(${this.currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1))
        html += `<button class="page-btn ${i === this.currentPage ? "active" : ""}" onclick="DaftarJanjiPage.goToPage(${i})">${i}</button>`;
      else if (i === this.currentPage - 2 || i === this.currentPage + 2)
        html += `<span class="page-btn" style="cursor:default;">...</span>`;
    }
    html += `<button class="page-btn" ${this.currentPage === totalPages ? "disabled" : ""} onclick="DaftarJanjiPage.goToPage(${this.currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
    p.innerHTML = html;
  },
  goToPage(page) {
    const totalPages = Math.ceil(this.filteredAppointments.length / this.itemsPerPage);
    if (page < 1 || page > totalPages) return;
    this.currentPage = page; this.renderGrid(); this.renderPagination();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => Toast.success("Disalin", `Nomor ${text} disalin`)); },
  shareAppointment(id) {
    const apt = AppState.appointments.find(a => a.id === id);
    if (!apt) return;
    const text = `Janji Kunjungan SMAN 1 BELIMBING\nNomor: ${apt.nomor_antrian || apt.nomorAntrian}\nNama: ${apt.nama_lengkap || apt.namaLengkap}\nTujuan: ${apt.tujuan_bertemu || apt.tujuanBertemu}\nTanggal: ${Utils.formatDate(apt.tanggal)}\nJam: ${Utils.formatTime(apt.jam)}\nStatus: ${apt.status}`;
    if (navigator.share) navigator.share({ title: "Janji Kunjungan", text });
    else navigator.clipboard.writeText(text).then(() => Toast.success("Disalin", "Detail disalin"));
  },
};

const AdminPage = {
  currentPage: 1, itemsPerPage: 10, filteredData: [],

  async init() {
    const auth = await AdminAuth.checkSession();
    if (!auth) { this.showLogin(); return; }
    this.hideLogin();
    await this.loadData();
    this.setupListeners();
    this.renderChart();
    this.setupRealtime();
  },

  showLogin() {
    const main = document.querySelector(".admin-main");
    if (!main || document.getElementById("adminLoginScreen")) return;
    const html = `<div id="adminLoginScreen" style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--color-bg-secondary);padding:24px;"><div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:24px;padding:60px 40px;width:100%;max-width:420px;box-shadow:var(--shadow-xl);"><div style="text-align:center;margin-bottom:48px;"><div style="width:64px;height:64px;background:linear-gradient(135deg,var(--color-primary),var(--color-primary-dark));border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:white;font-size:1.5rem;"><i class="fas fa-shield-alt"></i></div><h2 style="font-size:1.5rem;font-weight:800;margin-bottom:8px;">Admin Login</h2><p style="color:var(--color-text-secondary);font-size:0.875rem;">SMAN 1 BELIMBING Dashboard</p></div><form id="adminLoginForm" style="display:flex;flex-direction:column;gap:24px;"><div><label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:8px;">Username</label><input type="text" id="adminUsername" style="width:100%;padding:12px 16px;border:1.5px solid var(--color-border);border-radius:12px;font-size:0.9375rem;background:var(--color-bg);color:var(--color-text);" placeholder="Masukkan username" autocomplete="username"><span id="loginErrorUsername" style="display:block;font-size:0.75rem;color:var(--color-danger);margin-top:4px;min-height:18px;"></span></div><div><label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:8px;">Password</label><div style="position:relative;"><input type="password" id="adminPassword" style="width:100%;padding:12px 16px;padding-right:40px;border:1.5px solid var(--color-border);border-radius:12px;font-size:0.9375rem;background:var(--color-bg);color:var(--color-text);" placeholder="Masukkan password" autocomplete="current-password"><button type="button" id="togglePassword" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--color-text-tertiary);cursor:pointer;"><i class="fas fa-eye"></i></button></div><span id="loginErrorPassword" style="display:block;font-size:0.75rem;color:var(--color-danger);margin-top:4px;min-height:18px;"></span></div><div id="loginAttemptsInfo" style="font-size:0.75rem;color:var(--color-warning);display:none;"></div><button type="submit" id="btnAdminLogin" class="btn btn-primary" style="width:100%;padding:16px;font-size:1rem;"><span id="loginBtnText">Masuk</span><span id="loginBtnLoader" class="hidden" style="display:flex;align-items:center;gap:8px;"><i class="fas fa-circle-notch fa-spin"></i> Memproses...</span></button></form><div style="margin-top:32px;padding-top:32px;border-top:1px solid var(--color-border);text-align:center;"><a href="/" style="color:var(--color-primary);font-size:0.875rem;font-weight:500;"><i class="fas fa-arrow-left" style="margin-right:8px;"></i>Kembali ke Beranda</a></div></div></div>`;
    const content = main.querySelector(".admin-content");
    if (content) content.style.display = "none";
    const header = main.querySelector(".admin-header");
    if (header) header.style.display = "none";
    main.insertAdjacentHTML("beforeend", html);
    this.setupLoginForm();
  },

  hideLogin() {
    const ls = document.getElementById("adminLoginScreen");
    if (ls) ls.remove();
    const main = document.querySelector(".admin-main");
    if (main) {
      const c = main.querySelector(".admin-content");
      if (c) c.style.display = "";
      const h = main.querySelector(".admin-header");
      if (h) h.style.display = "";
    }
  },

  setupLoginForm() {
    const form = document.getElementById("adminLoginForm");
    const toggle = document.getElementById("togglePassword");
    const pw = document.getElementById("adminPassword");
    if (toggle && pw) {
      toggle.addEventListener("click", () => {
        const isP = pw.type === "password";
        pw.type = isP ? "text" : "password";
        toggle.querySelector("i").className = isP ? "fas fa-eye-slash" : "fas fa-eye";
      });
    }
    if (form) form.addEventListener("submit", async e => { e.preventDefault(); await this.handleLogin(); });
  },

  async handleLogin() {
    const un = document.getElementById("adminUsername")?.value?.trim();
    const pw = document.getElementById("adminPassword")?.value;
    const btnText = document.getElementById("loginBtnText");
    const btnLoader = document.getElementById("loginBtnLoader");
    const btnSubmit = document.getElementById("btnAdminLogin");
    const errU = document.getElementById("loginErrorUsername");
    const errP = document.getElementById("loginErrorPassword");
    const attInfo = document.getElementById("loginAttemptsInfo");
    if (errU) errU.textContent = "";
    if (errP) errP.textContent = "";
    if (attInfo) attInfo.style.display = "none";
    if (!un || !pw) {
      if (!un && errU) errU.textContent = "Username wajib diisi";
      if (!pw && errP) errP.textContent = "Password wajib diisi";
      return;
    }
    if (btnText) btnText.classList.add("hidden");
    if (btnLoader) btnLoader.classList.remove("hidden");
    if (btnSubmit) btnSubmit.disabled = true;
    try {
      const result = await AdminAuth.login(un, pw);
      if (result.success) {
        Toast.success("Berhasil", "Login berhasil");
        setTimeout(() => { this.hideLogin(); this.init(); }, 500);
      } else {
        if (result.locked) { if (errP) errP.textContent = result.message; }
        else {
          if (errP) errP.textContent = result.message;
          if (attInfo && result.attemptsRemaining !== undefined) {
            attInfo.textContent = `Percobaan tersisa: ${result.attemptsRemaining}`;
            attInfo.style.display = "block";
          }
        }
      }
    } catch (e) {
      if (errP) errP.textContent = "Terjadi kesalahan. Coba lagi.";
    } finally {
      if (btnText) btnText.classList.remove("hidden");
      if (btnLoader) btnLoader.classList.add("hidden");
      if (btnSubmit) btnSubmit.disabled = false;
    }
  },

  async loadData() {
    await AppointmentService.fetchAll();
    await AppointmentService.fetchStats();
    this.updateStats();
    this.filterAndRender();
  },

  setupRealtime() {
    AppointmentService.subscribeToChanges(() => {
      this.loadData();
      Toast.info("Realtime", "Data diperbarui");
    });
  },

  updateStats() {
    const s = AppState.stats;
    const e = {
      dashTotal: document.getElementById("dashTotal"),
      dashDone: document.getElementById("dashDone"),
      dashWaiting: document.getElementById("dashWaiting"),
      dashToday: document.getElementById("dashToday")
    };
    if (e.dashTotal) e.dashTotal.textContent = s.total || 0;
    if (e.dashDone) e.dashDone.textContent = s.done || 0;
    if (e.dashWaiting) e.dashWaiting.textContent = s.waiting || 0;
    if (e.dashToday) e.dashToday.textContent = s.today || 0;
  },

  renderChart() {
    const c = document.getElementById("chartBar");
    if (!c) return;
    const period = document.getElementById("chartPeriod")?.value || "7";
    const days = parseInt(period);
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const ds = date.toISOString().split("T")[0];
      const count = AppState.appointments.filter(a => a.tanggal === ds).length;
      const label = date.toLocaleDateString("id-ID", { weekday: "short" });
      data.push({ label, value: count });
    }
    const maxValue = Math.max(...data.map(d => d.value), 1);
    c.innerHTML = data.map(d =>
      `<div class="chart-bar-item"><span class="chart-bar-value">${d.value}</span><div class="chart-bar-fill" style="height:${(d.value / maxValue * 200)}px;"></div><span class="chart-bar-label">${d.label}</span></div>`
    ).join("");
  },

  filterAndRender() {
    const search = (document.getElementById("adminSearch")?.value || "").toLowerCase();
    this.filteredData = AppState.appointments.filter(apt =>
      !search ||
      (apt.nama_lengkap || apt.namaLengkap || "").toLowerCase().includes(search) ||
      (apt.nomor_antrian || apt.nomorAntrian || "").toLowerCase().includes(search) ||
      (apt.tujuan_bertemu || apt.tujuanBertemu || "").toLowerCase().includes(search)
    );
    this.filteredData.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
    this.renderTable();
    this.renderPagination();
  },

  renderTable() {
    const tbody = document.getElementById("adminTableBody");
    if (!tbody) return;
    const sc = { "Menunggu Konfirmasi": "status-waiting", "Dikonfirmasi": "status-confirmed", "Selesai": "status-done", "Dibatalkan": "status-cancelled" };
    if (this.filteredData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:60px;color:var(--color-text-tertiary);"><i class="fas fa-inbox" style="font-size:2rem;margin-bottom:12px;display:block;"></i>Tidak ada data</td></tr>`;
      return;
    }
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const items = this.filteredData.slice(start, end);
    tbody.innerHTML = items.map(apt =>
      `<tr data-id="${apt.id}"><td><strong>${apt.nomor_antrian || apt.nomorAntrian}</strong></td><td>${Security.sanitize(apt.nama_lengkap || apt.namaLengkap)}</td><td>${Security.sanitize(apt.tujuan_bertemu || apt.tujuanBertemu)}</td><td>${Utils.formatDate(apt.tanggal)}</td><td>${Utils.formatTime(apt.jam)}</td><td><span class="table-status ${sc[apt.status] || "status-waiting"}"><i class="fas fa-circle" style="font-size:6px;"></i> ${apt.status}</span></td><td><div class="table-actions"><button class="table-action-btn success" onclick="AdminPage.confirmApt('${apt.id}')" title="Konfirmasi"><i class="fas fa-check"></i></button><button class="table-action-btn" onclick="AdminPage.editStatus('${apt.id}')" title="Edit"><i class="fas fa-edit"></i></button><button class="table-action-btn danger" onclick="AdminPage.deleteApt('${apt.id}')" title="Hapus"><i class="fas fa-trash"></i></button></div></td></tr>`
    ).join("");
  },

  renderPagination() {
    const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
    const p = document.getElementById("adminPagination");
    if (!p) return;
    if (totalPages <= 1) { p.innerHTML = ""; return; }
    let html = `<button class="page-btn" ${this.currentPage === 1 ? "disabled" : ""} onclick="AdminPage.goToPage(${this.currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1))
        html += `<button class="page-btn ${i === this.currentPage ? "active" : ""}" onclick="AdminPage.goToPage(${i})">${i}</button>`;
      else if (i === this.currentPage - 2 || i === this.currentPage + 2)
        html += `<span class="page-btn" style="cursor:default;">...</span>`;
    }
    html += `<button class="page-btn" ${this.currentPage === totalPages ? "disabled" : ""} onclick="AdminPage.goToPage(${this.currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
    p.innerHTML = html;
  },

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
    if (page < 1 || page > totalPages) return;
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
  },

  async confirmApt(id) {
    try {
      await AppointmentService.update(id, { status: "Dikonfirmasi" });
      this.updateStats();
      this.filterAndRender();
      Toast.success("Berhasil", "Janji dikonfirmasi");
    } catch (e) { Toast.error("Gagal", e.message); }
  },

  editStatus(id) {
    const apt = AppState.appointments.find(a => a.id === id);
    if (!apt) return;
    const so = ["Menunggu Konfirmasi", "Dikonfirmasi", "Selesai", "Dibatalkan"];
    const options = so.map(s => `<option value="${s}" ${s === apt.status ? "selected" : ""}>${s}</option>`).join("");
    Modal.open("Ubah Status", `<div style="margin-bottom:16px;"><label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:8px;">Status Janji ${apt.nomor_antrian || apt.nomorAntrian}</label><select id="editStatusSelect" class="filter-select" style="width:100%;padding:12px;border:1.5px solid var(--color-border);border-radius:12px;font-size:0.9375rem;">${options}</select></div>`, [
      { text: "Batal", class: "btn btn-outline", close: true },
      { text: "Simpan", class: "btn btn-primary", onClick: async () => {
        const ns = document.getElementById("editStatusSelect").value;
        try {
          await AppointmentService.update(id, { status: ns });
          this.updateStats(); this.filterAndRender(); Modal.close();
          Toast.success("Berhasil", "Status diperbarui");
        } catch (e) { Toast.error("Gagal", e.message); }
      }}
    ]);
  },

  async deleteApt(id) {
    const apt = AppState.appointments.find(a => a.id === id);
    if (!apt) return;
    Modal.open("Konfirmasi Hapus", `<div style="text-align:center;padding:16px;"><i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--color-warning);margin-bottom:16px;display:block;"></i><h3 style="margin-bottom:8px;">Hapus Janji Temu?</h3><p style="color:var(--color-text-secondary);">Janji <strong>${apt.nomor_antrian || apt.nomorAntrian}</strong> milik <strong>${Security.sanitize(apt.nama_lengkap || apt.namaLengkap)}</strong> akan dihapus permanen.</p></div>`, [
      { text: "Batal", class: "btn btn-outline", close: true },
      { text: "Hapus", class: "btn btn-primary", onClick: async () => {
        try {
          await AppointmentService.delete(id);
          this.updateStats(); this.filterAndRender(); Modal.close();
          Toast.success("Berhasil", "Janji dihapus");
        } catch (e) { Toast.error("Gagal", e.message); }
      }}
    ]);
  },

  exportData(format) {
    if (format === "excel") {
      const headers = ["Nomor Antrian", "Nama", "WhatsApp", "Instansi", "Tujuan", "Keperluan", "Tanggal", "Jam", "Status", "Waktu Pengajuan"];
      const rows = AppState.appointments.map(a => [
        a.nomor_antrian || a.nomorAntrian,
        a.nama_lengkap || a.namaLengkap,
        a.nomor_wa || a.nomorWA,
        a.instansi || "-",
        a.tujuan_bertemu || a.tujuanBertemu,
        a.keperluan,
        a.tanggal,
        a.jam,
        a.status,
        a.created_at || a.createdAt,
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `janji-temu-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      Toast.success("Export", "File CSV diunduh");
    } else {
      Toast.info("Info", "Export PDF perlu backend");
    }
  },

  setupListeners() {
    document.getElementById("adminSearch")?.addEventListener("input", Utils.debounce(() => {
      this.currentPage = 1; this.filterAndRender();
    }, 300));
    document.getElementById("chartPeriod")?.addEventListener("change", () => this.renderChart());
    const sidebar = document.getElementById("adminSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const toggle = document.getElementById("sidebarToggle");
    if (toggle && sidebar && overlay) {
      toggle.addEventListener("click", () => { sidebar.classList.toggle("open"); overlay.classList.toggle("active"); });
      overlay.addEventListener("click", () => { sidebar.classList.remove("open"); overlay.classList.remove("active"); });
    }
    document.querySelectorAll(".admin-sidebar-link").forEach(link => {
      link.addEventListener("click", e => {
        if (link.getAttribute("href") === "/") return;
        e.preventDefault();
        document.querySelectorAll(".admin-sidebar-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");
        if (sidebar) sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("active");
      });
    });
    const logoutBtn = document.getElementById("adminLogout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await AdminAuth.logout();
        Toast.info("Logout", "Anda keluar");
        setTimeout(() => window.location.reload(), 1000);
      });
    }
  },
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();
  Navigation.init();
  Modal.init();
  Toast.init();
  FAQManager.init();
  if (typeof window.supabase !== "undefined") getSupabase();
  const path = window.location.pathname;
  if (path === "/" || path === "/index.html") {
    FormHandler.init();
    HeroStats.update();
    AppointmentService.subscribeToChanges(() => HeroStats.update());
  }
  if (path === "/daftar-janji" || path === "/daftar-janji.html") DaftarJanjiPage.init();
  if (path === "/admin" || path === "/admin.html") AdminPage.init();
});

// Expose to window for inline handlers
window.AdminPage = AdminPage;
window.DaftarJanjiPage = DaftarJanjiPage;
window.AppointmentService = AppointmentService;
window.AdminAuth = AdminAuth;
window.Utils = Utils;
window.Toast = Toast;
window.Modal = Modal;
window.Security = Security;
