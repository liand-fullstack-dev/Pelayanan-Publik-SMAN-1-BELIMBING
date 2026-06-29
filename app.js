/* ============================================
   SISTEM PELAYANAN PUBLIK - SMAN 1 BELIMBING
   Production-Ready JavaScript Application
   ============================================ */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    API_BASE_URL: window.location.origin.includes('localhost') 
        ? 'http://localhost:3000/api' 
        : '/api',
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    ALLOWED_FILE_TYPES: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    MAX_KEPERLUAN_LENGTH: 500,
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 5000,
    ANIMATION_DURATION: 300
};

// ============================================
// STATE MANAGEMENT
// ============================================
const AppState = {
    theme: localStorage.getItem('theme') || 'light',
    isSubmitting: false,
    selectedFile: null,
    selectedTujuan: null,
    selectedRecommendation: null,
    appointments: [],
    stats: { total: 0, today: 0, waiting: 0, week: 0, month: 0, done: 0, cancelled: 0 }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const Utils = {
    debounce: (fn, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(null, args), delay);
        };
    },

    formatDate: (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return date.toLocaleDateString('id-ID', options);
    },

    formatTime: (timeStr) => {
        if (!timeStr) return '-';
        return timeStr + ' WIB';
    },

    formatDateTime: (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const options = { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('id-ID', options);
    },

    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    generateQueueNumber: (index) => {
        const prefix = 'A';
        const num = String(index + 1).padStart(3, '0');
        return `${prefix}-${num}`;
    },

    generateId: () => {
        return 'apt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    validatePhone: (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        return /^[0-9]{10,15}$/.test(cleaned);
    },

    validateName: (name) => {
        return name.trim().length >= 3 && name.trim().length <= 100;
    },

    validateDate: (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
    },

    getDayName: (dateStr) => {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[new Date(dateStr).getDay()];
    },

    getRecommendations: (tanggal, jam, existingAppointments) => {
        const times = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', 
                        '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
        
        const bookedTimes = existingAppointments
            .filter(a => a.tanggal === tanggal && a.status !== 'Dibatalkan')
            .map(a => a.jam);
        
        return times
            .filter(t => t !== jam && !bookedTimes.includes(t))
            .slice(0, 5)
            .map((time, idx) => ({
                time,
                label: idx === 0 ? 'Rekomendasi Terbaik' : 'Tersedia',
                density: Math.floor(Math.random() * 3) + 1
            }));
    }
};

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toastContainer');
    },

    show(type, title, message, duration = CONFIG.TOAST_DURATION) {
        if (!this.container) this.init();
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${Utils.escapeHtml(title)}</div>
                <div class="toast-message">${Utils.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="Tutup">
                <i class="fas fa-times"></i>
            </button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.dismiss(toast);
        });

        this.container.appendChild(toast);

        setTimeout(() => this.dismiss(toast), duration);
    },

    dismiss(toast) {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    },

    success(title, message) { this.show('success', title, message); },
    error(title, message) { this.show('error', title, message); },
    warning(title, message) { this.show('warning', title, message); },
    info(title, message) { this.show('info', title, message); }
};

// ============================================
// MODAL SYSTEM
// ============================================
const Modal = {
    overlay: null,
    modal: null,
    title: null,
    body: null,
    footer: null,
    closeBtn: null,
    onClose: null,

    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.modal = document.getElementById('modal');
        this.title = document.getElementById('modalTitle');
        this.body = document.getElementById('modalBody');
        this.footer = document.getElementById('modalFooter');
        this.closeBtn = document.getElementById('modalClose');

        this.closeBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    },

    open(title, content, buttons = []) {
        this.title.textContent = title;
        this.body.innerHTML = content;
        this.footer.innerHTML = '';
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = btn.class || 'btn btn-primary';
            button.innerHTML = btn.text;
            button.addEventListener('click', () => {
                if (btn.onClick) btn.onClick();
                if (btn.close !== false) this.close();
            });
            this.footer.appendChild(button);
        });

        this.overlay.classList.remove('hidden');
        requestAnimationFrame(() => this.overlay.classList.add('active'));
        document.body.style.overflow = 'hidden';
    },

    close() {
        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
            this.body.innerHTML = '';
            this.footer.innerHTML = '';
            document.body.style.overflow = '';
            if (this.onClose) {
                this.onClose();
                this.onClose = null;
            }
        }, 300);
    }
};

// ============================================
// THEME MANAGER
// ============================================
const ThemeManager = {
    toggle: null,
    icon: null,

    init() {
        this.toggle = document.getElementById('themeToggle');
        this.icon = document.getElementById('themeIcon');
        
        this.toggle.addEventListener('click', () => this.toggleTheme());
        
        if (AppState.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.icon.className = 'fas fa-sun';
        }

        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('theme')) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
    },

    setTheme(theme) {
        AppState.theme = theme;
        localStorage.setItem('theme', theme);
        
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.icon.className = 'fas fa-sun';
        } else {
            document.documentElement.removeAttribute('data-theme');
            this.icon.className = 'fas fa-moon';
        }
    }
};

// ============================================
// NAVIGATION
// ============================================
const Navigation = {
    navbar: null,
    toggle: null,
    menu: null,

    init() {
        this.navbar = document.getElementById('navbar');
        this.toggle = document.getElementById('navToggle');
        this.menu = document.getElementById('navMenu');

        window.addEventListener('scroll', Utils.debounce(() => {
            if (window.scrollY > 50) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }
        }, 100));

        this.toggle.addEventListener('click', () => {
            this.toggle.classList.toggle('active');
            this.menu.classList.toggle('active');
        });

        this.menu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                this.toggle.classList.remove('active');
                this.menu.classList.remove('active');
            });
        });

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                if (href === '#') return;
                
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    const offset = 80;
                    const top = target.getBoundingClientRect().top + window.scrollY - offset;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });
        });
    }
};

// ============================================
// FORM VALIDATION
// ============================================
const FormValidator = {
    rules: {
        namaLengkap: {
            required: true,
            minLength: 3,
            maxLength: 100,
            validate: (val) => Utils.validateName(val),
            messages: {
                required: 'Nama lengkap wajib diisi',
                minLength: 'Nama minimal 3 karakter',
                maxLength: 'Nama maksimal 100 karakter',
                invalid: 'Nama tidak valid'
            }
        },
        nomorWA: {
            required: true,
            validate: (val) => Utils.validatePhone(val),
            messages: {
                required: 'Nomor WhatsApp wajib diisi',
                invalid: 'Nomor WhatsApp tidak valid (10-15 digit)'
            }
        },
        tujuanBertemu: {
            required: true,
            messages: {
                required: 'Pilih tujuan bertemu'
            }
        },
        tujuanLainnya: {
            required: (form) => form.tujuanBertemu === 'Lainnya',
            minLength: 3,
            maxLength: 100,
            messages: {
                required: 'Sebutkan tujuan lainnya',
                minLength: 'Minimal 3 karakter',
                maxLength: 'Maksimal 100 karakter'
            }
        },
        keperluan: {
            required: true,
            minLength: 10,
            maxLength: 500,
            messages: {
                required: 'Keperluan wajib diisi',
                minLength: 'Keperluan minimal 10 karakter',
                maxLength: 'Keperluan maksimal 500 karakter'
            }
        },
        tanggal: {
            required: true,
            validate: (val) => Utils.validateDate(val),
            messages: {
                required: 'Tanggal wajib dipilih',
                invalid: 'Tanggal tidak boleh di masa lalu'
            }
        },
        jam: {
            required: true,
            messages: {
                required: 'Jam wajib dipilih'
            }
        }
    },

    validateField(name, value, value, formData = {}) {
        const rule = this.rules[name];
        if (!rule) return { valid: true };

        const isRequired = typeof rule.required === 'function' 
            ? rule.required(formData) 
            : rule.required;

        if (isRequired && (!value || value.trim() === '')) {
            return { valid: false, message: rule.messages.required };
        }

        if (!value && !isRequired) {
            return { valid: true };
        }

        if (rule.minLength && value.length < rule.minLength) {
            return { valid: false, message: rule.messages.minLength };
        }

        if (rule.maxLength && value.length > rule.maxLength) {
            return { valid: false, message: rule.messages.maxLength };
        }

        if (rule.validate && !rule.validate(value)) {
            return { valid: false, message: rule.messages.invalid || 'Format tidak valid' };
        }

        return { valid: true };
    },

    showError(fieldName, message) {
        const field = document.getElementById(fieldName);
        const errorEl = document.getElementById(`error-${fieldName}`);
        
        if (field) field.classList.add('error');
        if (errorEl) errorEl.textContent = message;
    },

    clearError(fieldName) {
        const field = document.getElementById(fieldName);
        const errorEl = document.getElementById(`error-${fieldName}`);
        
        if (field) field.classList.remove('error');
        if (errorEl) errorEl.textContent = '';
    },

    clearAllErrors() {
        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        document.querySelectorAll('input.error, textarea.error').forEach(el => el.classList.remove('error'));
    },

    validateForm(formData) {
        this.clearAllErrors();
        let isValid = true;
        const errors = {};

        for (const [fieldName, rule] of Object.entries(this.rules)) {
            const value = formData[fieldName] || '';
            const result = this.validateField(fieldName, value, formData);
            
            if (!result.valid) {
                isValid = false;
                errors[fieldName] = result.message;
                this.showError(fieldName, result.message);
            }
        }

        return { isValid, errors };
    }
};

// ============================================
// CUSTOM SELECT COMPONENT
// ============================================
const CustomSelect = {
    trigger: null,
    options: null,
    hiddenInput: null,
    tujuanLainnyaField: null,

    init() {
        this.trigger = document.getElementById('tujuanTrigger');
        this.options = document.getElementById('tujuanOptions');
        this.hiddenInput = document.getElementById('tujuanBertemu');
        this.tujuanLainnyaField = document.getElementById('tujuanLainnyaField');

        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        this.options.querySelectorAll('.select-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(option);
            });
        });

        document.addEventListener('click', () => this.close());
    },

    toggle() {
        const isOpen = this.options.classList.contains('open');
        if (isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        this.trigger.classList.add('active');
        this.options.classList.add('open');
    },

    close() {
        this.trigger.classList.remove('active');
        this.options.classList.remove('open');
    },

    select(option) {
        const value = option.dataset.value;
        const text = option.querySelector('span').textContent;
        const icon = option.querySelector('i').className;

        this.trigger.innerHTML = `
            <span class="select-placeholder"><i class="${icon}" style="margin-right: 8px; color: var(--color-primary);"></i>${text}</span>
            <i class="fas fa-chevron-down"></i>
        `;
        this.trigger.classList.add('has-value');
        this.hiddenInput.value = value;
        AppState.selectedTujuan = value;

        FormValidator.clearError('tujuanBertemu');

        if (value === 'Lainnya') {
            this.tujuanLainnyaField.classList.remove('hidden');
        } else {
            this.tujuanLainnyaField.classList.add('hidden');
            document.getElementById('tujuanLainnya').value = '';
        }

        this.close();
    }
};

// ============================================
// FILE UPLOAD COMPONENT
// ============================================
const FileUpload = {
    input: null,
    area: null,
    preview: null,
    fileName: null,
    fileSize: null,
    fileIcon: null,
    removeBtn: null,

    init() {
        this.input = document.getElementById('dokumen');
        this.area = document.getElementById('fileUploadArea');
        this.preview = document.getElementById('filePreview');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.fileIcon = document.getElementById('fileIcon');
        this.removeBtn = document.getElementById('fileRemove');

        this.area.addEventListener('click', () => this.input.click());
        this.input.addEventListener('change', (e) => this.handleFile(e.target.files[0]));
        this.removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearFile();
        });

        this.area.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.area.classList.add('dragover');
        });

        this.area.addEventListener('dragleave', () => {
            this.area.classList.remove('dragover');
        });

        this.area.addEventListener('drop', (e) => {
            e.preventDefault();
            this.area.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFile(file);
        });
    },

    handleFile(file) {
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (!CONFIG.ALLOWED_FILE_TYPES.includes(ext)) {
            Toast.error('Format File Tidak Valid', 'Hanya mendukung PDF, DOC, DOCX, JPG, JPEG, PNG');
            return;
        }

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            Toast.error('Ukuran File Terlalu Besar', 'Maksimal ukuran file adalah 5MB');
            return;
        }

        AppState.selectedFile = file;
        this.fileName.textContent = file.name;
        this.fileSize.textContent = Utils.formatFileSize(file.size);

        const iconMap = {
            pdf: 'fa-file-pdf',
            doc: 'fa-file-word',
            docx: 'fa-file-word',
            jpg: 'fa-file-image',
            jpeg: 'fa-file-image',
            png: 'fa-file-image'
        };
        this.fileIcon.className = `fas ${iconMap[ext] || 'fa-file'}`;

        this.area.classList.add('hidden');
        this.preview.classList.remove('hidden');
        FormValidator.clearError('dokumen');

        Toast.success('File Berhasil Dipilih', file.name);
    },

    clearFile() {
        AppState.selectedFile = null;
        this.input.value = '';
        this.area.classList.remove('hidden');
        this.preview.classList.add('hidden');
    }
};

// ============================================
// FAQ COMPONENT
// ============================================
const FAQ = {
    init() {
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', () => {
                const item = question.parentElement;
                const isActive = item.classList.contains('active');
                
                document.querySelectorAll('.faq-item').forEach(i => {
                    i.classList.remove('active');
                    i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                });

                if (!isActive) {
                    item.classList.add('active');
                    question.setAttribute('aria-expanded', 'true');
                }
            });
        });
    }
};

// ============================================
// APPOINTMENT CARD
// ============================================
const AppointmentCard = {
    overlay: null,
    modal: null,
    currentData: null,

    init() {
        this.overlay = document.getElementById('cardModalOverlay');
        this.modal = document.getElementById('cardModal');

        document.getElementById('btnPrintCard').addEventListener('click', () => this.print());
        document.getElementById('btnCopyNumber').addEventListener('click', () => this.copyNumber());
        document.getElementById('btnShareCard').addEventListener('click', () => this.share());

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    },

    show(data) {
        this.currentData = data;
        
        document.getElementById('cardNumber').textContent = data.nomorAntrian;
        document.getElementById('cardStatus').textContent = data.status;
        document.getElementById('cardNama').textContent = data.namaLengkap;
        document.getElementById('cardTujuan').textContent = data.tujuanBertemu;
        document.getElementById('cardTanggal').textContent = Utils.formatDate(data.tanggal);
        document.getElementById('cardJam').textContent = Utils.formatTime(data.jam);
        document.getElementById('cardWA').textContent = data.nomorWA;
        document.getElementById('cardTimestamp').textContent = Utils.formatDateTime(data.createdAt);

        const qrContainer = document.getElementById('cardQR');
        qrContainer.innerHTML = '';
        this.generateQRCode(qrContainer, data.nomorAntrian);

        this.overlay.classList.remove('hidden');
        requestAnimationFrame(() => this.overlay.classList.add('active'));
        document.body.style.overflow = 'hidden';
    },

    generateQRCode(container, text) {
        const canvas = document.createElement('canvas');
        const size = 140;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);

        const cellSize = 7;
        const cells = Math.floor(size / cellSize);
        
        let seed = 0;
        for (let i = 0; i < text.length; i++) {
            seed += text.charCodeAt(i);
        }

        const random = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        const drawFinder = (x, y) => {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(x * cellSize, y * cellSize, cellSize * 7, cellSize * 7);
            ctx.fillStyle = 'white';
            ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, cellSize * 5, cellSize * 5);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, cellSize * 3, cellSize * 3);
        };

        drawFinder(1, 1);
        drawFinder(cells - 8, 1);
        drawFinder(1, cells - 8);

        for (let i = 0; i < cells; i++) {
            for (let j = 0; j < cells; j++) {
                if ((i < 9 && j < 9) || (i > cells - 10 && j < 9) || (i < 9 && j > cells - 10)) {
                    continue;
                }
                
                if (random() > 0.5) {
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
                }
            }
        }

        container.appendChild(canvas);
    },

    close() {
        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    },

    print() {
        window.print();
    },

    copyNumber() {
        if (this.currentData) {
            navigator.clipboard.writeText(this.currentData.nomorAntrian).then(() => {
                Toast.success('Berhasil Disalin', `Nomor antrian ${this.currentData.nomorAntrian} telah disalin`);
            }).catch(() => {
                Toast.error('Gagal Menyalin', 'Silakan salin secara manual');
            });
        }
    },

    share() {
        if (!this.currentData) return;
        
        const text = `Janji Kunjungan SMAN 1 BELIMBING\n\nNomor: ${this.currentData.nomorAntrian}\nNama: ${this.currentData.namaLengkap}\nTujuan: ${this.currentData.tujuanBertemu}\nTanggal: ${Utils.formatDate(this.currentData.tanggal)}\)}\nJam: ${Utils.formatTimenJam: ${Utils.formatTime(this.currentData.jam)}\nStatus: ${this.currentData.status}`;

        if (navigator.share) {
            navigator.share({
                title: 'Janji Kunjungan SMAN 1 BELIMBING',
                text: text
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text).then(() => {
                Toast.success('Berhasil Disalin', 'Detail janji telah disalin ke clipboard');
            });
        }
    }
};

// ============================================
// APPOINTMENT SERVICE
// ============================================
const AppointmentService = {
    async submit(formData) {
        try {
            const payload = {
                ...formData,
                id: Utils.generateId(),
                status: 'Menunggu Konfirmasi',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const conflicts = await this.checkConflicts(formData.tanggal, formData.jam, formData.namaLengkap);
            
            if (conflicts.length > 0) {
                return { 
                    success: false, 
                    conflict: true, 
                    message: 'Jadwal sudah memiliki antrian',
                    recommendations: Utils.getRecommendations(formData.tanggal, formData.jam, AppState.appointments)
                };
            }

            const existingCount = AppState.appointments.filter(a => 
                a.status !== 'Dibatalkan'
            ).length;
            payload.nomorAntrian = Utils.generateQueueNumber(existingCount);

            AppState.appointments.push(payload);
            this.saveToStorage();

            await this.sendWhatsApp(payload);

            return { success: true, data: payload };

        } catch (error) {
            console.error('Submit error:', error);
            return { success: false, message: 'Terjadi kesalahan sistem' };
        }
    },

    async checkConflicts(tanggal, jam, nama) {
        return AppState.appointments.filter(a => 
            a.tanggal === tanggal && 
            a.jam === jam && 
            a.status !== 'Dibatalkan' &&
            a.namaLengkap.toLowerCase() === nama.toLowerCase()
        );
    },

    async sendWhatsApp(data) {
        console.log('Sending WhatsApp to:', data.nomorWA);
        
        const message = `========== JANJI KUNJUNGAN ==========\n\nNomor Antrian :\n${data.nomorAntrian}\n\nNama :\n${data.namaLengkap}\n\nTujuan Bertemu :\n${data.tujuanBertemu}\n\nKeperluan :\n${data.keperluan}\n\nTanggal :\n${Utils.formatDate(data.tanggal)}\n\nJam :\n${Utils.formatTime(data.jam)}\n\nDokumen :\n${data.dokumen ? 'Ada' : 'Tidak Ada'}\n\nStatus :\n${data.status}\n\n===================================`;

        console.log('WhatsApp message:', message);
        return true;
    },

    saveToStorage() {
        localStorage.setItem('appointments', JSON.stringify(AppState.appointments));
    },

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('appointments');
            if (stored) {
                AppState.appointments = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load appointments:', e);
            AppState.appointments = [];
        }
    },

    generateDummyData() {
        const names = ['Ahmad Fauzi', 'Siti Aminah', 'Budi Santoso', 'Dewi Lestari', 'Eko Prasetyo',
            'Rina Wulandari', 'Agus Supriyadi', 'Maya Sari', 'Indra Gunawan', 'Lina Marlina',
            'Hadi Wijaya', 'Nina Kusuma', 'Joko Susilo', 'Putri Andini', 'Rudi Hartono',
            'Ani Susanti', 'Samsul Arifin', 'Yuni Astuti', 'Tono Wibowo', 'Rina Fitriani',
            'Dedi Kurniawan', 'Sari Indah', 'Bambang Pamungkas', 'Lia Damayanti', 'Fajar Nugroho',
            'Nia Ramadhani', 'Iwan Setiawan', 'Tika Puspita', 'Yusuf Maulana', 'Dina Oktaviani',
            'Reza Aditya', 'Mira Lestari', 'Doni Saputra', 'Rani Permata', 'Adi Wijaya',
            'Siska Melati', 'Hendra Kusuma', 'Wulan Sari', 'Bayu Aji', 'Nisa Rahmawati',
            'Candra Wijaya', 'Fitri Handayani', 'Dani Ramadhan', 'Rosa Amelia', 'Gilang Pratama',
            'Vina Mariana', 'Eko Setyawan', 'Tari Wulandari', 'Rian Saputra', 'Dewi Anggraini'];

        const tujuanList = ['Kepala Sekolah', 'Wakil Kepala Sekolah', 'Kepala Kurikulum', 
            'Guru BK', 'Wali Kelas', 'Guru Mata Pelajaran', 'Tata Usaha', 'Bendahara', 
            'Operator Sekolah', 'Komite Sekolah'];

        const keperluanList = ['Konsultasi nilai anak', 'Administrasi ijazah', 'Pengambilan raport',
            'Diskusi program sekolah', 'Izin tidak masuk', 'Undangan rapat', 'Legalisir dokumen',
            'Pembayaran SPP', 'Pengambilan surat', 'Konsultasi BK'];

        const statuses = ['Menunggu Konfirmasi', 'Dikonfirmasi', 'Selesai', 'Dibatalkan'];
        const statusWeights = [0.4, 0.3, 0.2, 0.1];

        const dummyData = [];
        const today = new Date();

        for (let i = 0; i < 50; i++) {
            const randomDays = Math.floor(Math.random() * 60) - 30;
            const date = new Date(today);
            date.setDate(date.getDate() + randomDays);
            
            const hours = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', 
                        '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'];
            
            let status = statuses[0];
            const rand = Math.random();
            let cumulative = 0;
            for (let j = 0; j < statuses.length; j++) {
                cumulative += statusWeights[j];
                if (rand < cumulative) {
                    status = statuses[j];
                    break;
                }
            }

            const tanggal = date.toISOString().split('T')[0];
            const jam = hours[Math.floor(Math.random() * hours.length)];
            
            const nama = names[Math.floor(Math.random() * names.length)];
            const isDuplicate = dummyData.some(d => 
                d.tanggal === tanggal && d.jam === jam && d.namaLengkap === nama
            );
            
            if (isDuplicate) continue;

            dummyData.push({
                id: Utils.generateId(),
                namaLengkap: nama,
                nomorWA: '08' + Math.floor(Math.random() * 9000000000 + 1000000000),
                instansi: Math.random() > 0.5 ? 'Orang Tua Siswa' : '',
                tujuanBertemu: tujuanList[Math.floor(Math.random() * tujuanList.length)],
                tujuanLainnya: '',
                keperluan: keperluanList[Math.floor(Math.random() * keperluanList.length)],
                dokumen: null,
                tanggal: tanggal,
                jam: jam,
                nomorAntrian: Utils.generateQueueNumber(i),
                status: status,
                createdAt: new Date(date.getTime() - Math.random() * 86400000).toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        AppState.appointments = dummyData;
        this.saveToStorage();
    },

    updateStats() {
        const today = new Date().toISOString().split('T')[0];
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const monthStart = new Date();
        monthStart.setDate(1);

        AppState.stats = {
            total: AppState.appointments.length,
            today: AppState.appointments.filter(a => a.tanggal === today && a.status !== 'Dibatalkan').length,
            waiting: AppState.appointments.filter(a => a.status === 'Menunggu Konfirmasi').length,
            week: AppState.appointments.filter(a => new Date(a.tanggal) >= weekStart && a.status !== 'Dibatalkan').length,
            month: AppState.appointments.filter(a => new Date(a.tanggal) >= monthStart && a.status !== 'Dibatalkan').length,
            done: AppState.appointments.filter(a => a.status === 'Selesai').length,
            cancelled: AppState.appointments.filter(a => a.status === 'Dibatalkan').length
        };

        const animateNumber = (el, target) => {
            if (!el) return;
            const duration = 1000;
            const start = 0;
            const startTime = performance.now();
            
            const update = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const current = Math.floor(start + (target - start) * easeProgress);
                el.textContent = current;
                
                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            };
            
            requestAnimationFrame(update);
        };

        animateNumber(document.getElementById('statTotal'), AppState.stats.total);
        animateNumber(document.getElementById('statToday'), AppState.stats.today);
        animateNumber(document.getElementById('statWaiting'), AppState.stats.waiting);
    },

    cleanupOldAppointments() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const beforeCount = AppState.appointments.length;
        AppState.appointments = AppState.appointments.filter(a => {
            const aptDate = new Date(a.tanggal);
            return aptDate >= thirtyDaysAgo || a.status === 'Menunggu Konfirmasi';
        });
        
        if (AppState.appointments.length < beforeCount) {
            this.saveToStorage();
            console.log(`Cleaned up ${beforeCount - AppState.appointments.length} old appointments`);
        }
    }
};

// ============================================
// FORM HANDLER
// ============================================
const FormHandler = {
    form: null,
    submitBtn: null,
    btnText: null,
    btnLoader: null,

    init() {
        this.form = document.getElementById('appointmentForm');
        this.submitBtn = document.getElementById('btnSubmit');
        this.btnText = this.submitBtn.querySelector('.btn-text');
        this.btnLoader = this.submitBtn.querySelector('.btn-loader');

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('tanggal').setAttribute('min', today);

        const keperluan = document.getElementById('keperluan');
        const charCount = document.getElementById('charCount');
        keperluan.addEventListener('input', () => {
            const len = keperluan.value.length;
            charCount.textContent = len;
            if (len > CONFIG.MAX_KEPERLUAN_LENGTH) {
                charCount.style.color = 'var(--color-danger)';
            } else {
                charCount.style.color = '';
            }
        });

        this.form.querySelectorAll('input, textarea').forEach(field => {
            field.addEventListener('blur', () => {
                const result = FormValidator.validateField(field.name, field.value, this.getFormData());
                if (!result.valid) {
                    FormValidator.showError(field.name, result.message);
                } else {
                    FormValidator.clearError(field.name);
                }
            });

            field.addEventListener('input', () => {
                if (field.classList.contains('error')) {
                    const result = FormValidator.validateField(field.name, field.value, this.getFormData());
                    if (result.valid) {
                        FormValidator.clearError(field.name);
                    }
                }
            });
        });

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    },

    getFormData() {
        const formData = new FormData(this.form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        return data;
    },

    setLoading(loading) {
        AppState.isSubmitting = loading;
        this.submitBtn.disabled = loading;
        
        if (loading) {
            this.btnText.classList.add('hidden');
            this.btnLoader.classList.remove('hidden');
        } else {
            this.btnText.classList.remove('hidden');
            this.btnLoader.classList.add('hidden');
        }
    },

    async handleSubmit(e) {
        e.preventDefault();
        
        if (AppState.isSubmitting) return;

        const formData = this.getFormData();
        
        const validation = FormValidator.validateForm(formData);
        if (!validation.isValid) {
            Toast.error('Validasi Gagal', 'Periksa kembali data yang Anda masukkan');
            return;
        }

        this.setLoading(true);

        try {
            const result = await AppointmentService.submit(formData);

            if (result.conflict) {
                this.showRecommendationModal(result.recommendations, formData);
                this.setLoading(false);
                return;
            }

            if (result.success) {
                Toast.success('Berhasil!', 'Janji temu berhasil diajukan');
                AppointmentService.updateStats();
                AppointmentCard.show(result.data);
                this.form.reset();
                FileUpload.clearFile();
                CustomSelect.trigger.innerHTML = `
                    <span class="select-placeholder">Pilih tujuan bertemu</span>
                    <i class="fas fa-chevron-down"></i>
                `;
                CustomSelect.trigger.classList.remove('has-value');
                document.getElementById('tujuanLainnyaField').classList.add('hidden');
                document.getElementById('charCount').textContent = '0';
            } else {
                Toast.error('Gagal', result.message || 'Terjadi kesalahan');
            }
        } catch (error) {
            Toast.error('Gagal', 'Terjadi kesalahan sistem. Silakan coba lagi.');
        } finally {
            this.setLoading(false);
        }
    },

    showRecommendationModal(recommendations, formData) {
        if (!recommendations || recommendations.length === 0) {
            Modal.open('Jadwal Penuh', `
                <div style="text-align: center; padding: var(--space-8);">
                    <i class="fas fa-calendar-times" style="font-size: 3rem; color: var(--color-danger); margin-bottom: var(--space-4);"></i>
                    <h3 style="margin-bottom: var(--space-3);">Jadwal Penuh</h3>
                    <p style="color: var(--color-text-secondary);">Semua jadwal pada tanggal tersebut sudah penuh. Silakan pilih tanggal lain.</p>
                </div>
            `, [{ text: 'Mengerti', class: 'btn btn-primary', close: true }]);
            return;
        }

        let selectedTime = null;
        
        const content = `
            <div style="margin-bottom: var(--space-4);">
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">
                    <i class="fas fa-info-circle" style="color: var(--color-warning); margin-right: var(--space-2);"></i>
                    Jadwal pada <strong>${Utils.formatDate(formData.tanggal)} jam ${formData.jam}</strong> sudah memiliki antrian. 
                    Berikut rekomendasi jadwal alternatif:
                </p>
                <div class="recommendation-list">
                    ${recommendations.map((rec, idx) => `
                        <div class="recommendation-item" data-time="${rec.time}" data-index="${idx}">
                            <div>
                                <div class="recommendation-time">${rec.time} WIB</div>
                                <div class="recommendation-info">${Utils.getDayName(formData.tanggal)}, ${Utils.formatDate(formData.tanggal)}</div>
                            </div>
                            <span class="recommendation-badge">${rec.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        Modal.open('Rekomendasi Jadwal', content, [
            { text: 'Batal', class: 'btn btn-outline', close: true },
            { 
                text: 'Pilih Jadwal', 
                class: 'btn btn-primary',
                onClick: () => {
                    if (selectedTime) {
                        document.getElementById('jam').value = selectedTime;
                        FormHandler.handleSubmit(new Event('submit'));
                    }
                }
            }
        ]);

        setTimeout(() => {
            document.querySelectorAll('.recommendation-item').forEach(item => {
                item.addEventListener('click', () => {
                    document.querySelectorAll('.recommendation-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    selectedTime = item.dataset.time;
                });
            });
        }, 100);
    }
};

// ============================================
// HERO QUEUE PREVIEW
// ============================================
const HeroQueuePreview = {
    init() {
        const container = document.getElementById('heroQueuePreview');
        if (!container) return;

        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = AppState.appointments
            .filter(a => a.tanggal === today && a.status !== 'Dibatalkan')
            .sort((a, b) => a.jam.localeCompare(b.jam))
            .slice(0, 4);

        if (todayAppointments.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: var(--space-8); color: var(--color-text-tertiary);">
                    <i class="fas fa-calendar-check" style="font-size: 2rem; margin-bottom: var(--space-3); display: block;"></i>
                    <p style="font-size: 0.875rem;">Belum ada antrian hari ini</p>
                </div>
            `;
            return;
        }

        container.innerHTML = todayAppointments.map(apt => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) 0; border-bottom: 1px solid var(--color-border);">
                <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <span style="background: var(--color-primary-50); color: var(--color-primary); padding: var(--space-1) var(--space-3); border-radius: var(--radius-md); font-size: 0.75rem; font-weight: 700;">${apt.nomorAntrian}</span>
                    <span style="font-size: 0.875rem; font-weight: 600;">${apt.namaLengkap}</span>
                </div>
                <span style="font-size: 0.75rem; color: var(--color-text-tertiary);">${apt.jam}</span>
            </div>
        `).join('');
    }
};

// ============================================
// CRON SIMULATION (Auto Cleanup)
// ============================================
const CronJob = {
    init() {
        AppointmentService.cleanupOldAppointments();
        
        setInterval(() => {
            AppointmentService.cleanupOldAppointments();
        }, 3600000);
    }
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    Navigation.init();
    Modal.init();
    Toast.init();
    CustomSelect.init();
    FileUpload.init();
    FAQ.init();
    AppointmentCard.init();
    FormHandler.init();
    
    AppointmentService.loadFromStorage();
    
    if (AppState.appointments.length === 0) {
        AppointmentService.generateDummyData();
    }
    
    AppointmentService.updateStats();
    HeroQueuePreview.init();
    
    CronJob.init();

    console.log('Sistem Pelayanan Publik SMAN 1 BELIMBING - Ready');
});

// Expose for debugging
window.AppState = AppState;
window.Utils = Utils;
