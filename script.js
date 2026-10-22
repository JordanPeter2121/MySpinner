// ===== FIREBASE CONFIGURATION =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD9UzpE9n8dptHyc5WLw_kWeTOYGK5oE3I",
    authDomain: "myspinner-46399.firebaseapp.com",
    projectId: "myspinner-46399",
    storageBucket: "myspinner-46399.firebasestorage.app",
    messagingSenderId: "481734374586",
    appId: "1:481734374586:web:3232a644f7d27bdbbf3e83"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ===== THEME COLORS =====
const wheelThemes = {
    "Default": ["#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#FF6B9D", "#FF9F45", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"],
    "Classic": ["#2196F3", "#F44336", "#FFEB3B", "#4CAF50", "#FF9800", "#9C27B0", "#00BCD4", "#E91E63"],
    "Ukraine": ["#0057B7", "#FFD700"],
    "Rainbow": ["#9C27B0", "#2196F3", "#4CAF50", "#FFEB3B", "#FF9800", "#F44336"],
    "Unicorn": ["#6A1B9A", "#E91E63", "#F48FB1", "#FFCCBC", "#FFF9C4", "#FFFFFF"],
    "Circus": ["#03A9F4", "#FFEB3B", "#E91E63", "#FF9800", "#F06292", "#4CAF50"],
    "Fruit Salad": ["#FF5722", "#FF9800", "#FFEB3B", "#8BC34A", "#4CAF50", "#CDDC39"]
};

// ===== PREFERENCES STATE =====
let preferences = { colorScheme: 'light', showClickToSpin: true, theme: 'Default' };
let wheels = [];
let wheelCounter = 0;
let activeWheelId = null;

function loadPreferences() {
    const saved = localStorage.getItem('spinnerPreferences');
    if (saved) preferences = { ...preferences, ...JSON.parse(saved) };
    applyPreferences();
}

function savePreferences() {
    localStorage.setItem('spinnerPreferences', JSON.stringify(preferences));
}

function applyPreferences() {
    applyColorScheme(preferences.colorScheme);
    const checkbox = document.getElementById('showClickToSpin');
    if (checkbox) checkbox.checked = preferences.showClickToSpin;
    updateThemePreview(preferences.theme);
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = preferences.theme;
    document.querySelectorAll('input[name="colorScheme"]').forEach(radio => {
        radio.checked = radio.value === preferences.colorScheme;
    });
    wheels.forEach(wheel => drawWheel(wheel.id));
}

function applyColorScheme(scheme) {
    const body = document.body;
    if (scheme === 'dark') body.classList.add('dark-mode');
    else if (scheme === 'light') body.classList.remove('dark-mode');
    else if (scheme === 'system') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            body.classList.add('dark-mode');
        } else body.classList.remove('dark-mode');
    }
}

function updateThemePreview(themeName) {
    const preview = document.getElementById('themePreview');
    if (!preview) return;
    const colors = wheelThemes[themeName] || wheelThemes['Default'];
    preview.innerHTML = '';
    colors.slice(0, 4).forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'theme-swatch';
        swatch.style.backgroundColor = color;
        preview.appendChild(swatch);
    });
}

// ===== TOAST =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fadeOut');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== WHEEL MANAGEMENT =====
function createWheel(options = null, name = null) {
    const id = `wheel-${wheelCounter++}`;
    const wheel = {
        id: id,
        name: name || `Wheel ${wheels.length + 1}`,
        options: options || ['Hanna', 'Charles', 'Eric', 'Beatriz', 'Fatima', 'Ali', 'Diya', 'Gabriel'],
        removedNames: [],
        currentRotation: 0,
        isSpinning: false,
        results: [],
        tickTimeouts: []
    };
    wheels.push(wheel);
    renderWheel(wheel);
    activeWheelId = id;
    return wheel;
}

function renderWheel(wheel) {
    const container = document.getElementById('wheelsContainer');
    const wheelWrapper = document.createElement('div');
    wheelWrapper.className = 'wheel-wrapper';
    wheelWrapper.id = `wrapper-${wheel.id}`;
    
    wheelWrapper.innerHTML = `
        <div class="wheel-header">
            <div class="wheel-title">${wheel.name}</div>
            <button class="remove-wheel-btn" data-wheel-id="${wheel.id}" title="Remove wheel">✕</button>
        </div>
        <div class="wheel-body">
            <section class="wheel-section">
                <div class="wheel-container" id="container-${wheel.id}">
                    <div class="pointer-right"></div>
                    <canvas id="canvas-${wheel.id}" width="400" height="400"></canvas>
                    <div class="spin-overlay ${preferences.showClickToSpin ? '' : 'hidden'}" id="overlay-${wheel.id}">
                        <div class="overlay-text">
                            <div class="overlay-main">Click to spin</div>
                            <div class="overlay-sub">or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd></div>
                        </div>
                    </div>
                </div>
            </section>
            <aside class="panel-section">
                <div class="panel-tabs">
                    <button class="tab-btn active" data-tab="entries-${wheel.id}">
                        <span>Entries</span>
                        <span class="badge" id="count-${wheel.id}">${wheel.options.length}</span>
                    </button>
                    <button class="tab-btn" data-tab="results-${wheel.id}">
                        <span>Results</span>
                        <span class="badge" id="result-count-${wheel.id}">0</span>
                    </button>
                </div>
                <div class="tab-content active" id="entries-${wheel.id}">
                    <div class="toolbar">
                        <button class="tool-btn" id="shuffle-${wheel.id}"><span>Shuffle</span></button>
                        <button class="tool-btn" id="sort-${wheel.id}"><span>Sort</span></button>
                    </div>
                    <div class="textarea-wrapper">
                        <textarea id="input-${wheel.id}" placeholder="Type one name/option per line...">${wheel.options.join('\n')}</textarea>
                    </div>
                    <button class="add-wheel-btn" id="add-${wheel.id}"><span>Add wheel</span></button>
                </div>
                <div class="tab-content" id="results-${wheel.id}">
                    <div class="results-empty" id="empty-${wheel.id}">
                        <div class="empty-icon">🎯</div>
                        <p>No results yet</p>
                        <p class="small">Spin the wheel to see results here!</p>
                    </div>
                    <ul class="results-list" id="list-${wheel.id}"></ul>
                    <button class="clear-btn" id="clear-${wheel.id}" style="display:none;">Clear Results</button>
                </div>
            </aside>
        </div>
    `;
    
    container.appendChild(wheelWrapper);
    setupWheelEvents(wheel);
    drawWheel(wheel.id);
}

function setupWheelEvents(wheel) {
    const container = document.getElementById(`container-${wheel.id}`);
    const input = document.getElementById(`input-${wheel.id}`);
    const count = document.getElementById(`count-${wheel.id}`);
    const shuffleBtn = document.getElementById(`shuffle-${wheel.id}`);
    const sortBtn = document.getElementById(`sort-${wheel.id}`);
    const addBtn = document.getElementById(`add-${wheel.id}`);
    const clearBtn = document.getElementById(`clear-${wheel.id}`);
    const removeBtn = document.querySelector(`.remove-wheel-btn[data-wheel-id="${wheel.id}"]`);
    
    container.addEventListener("click", () => {
        activeWheelId = wheel.id;
        spinWheel(wheel.id);
    });
    
    [input, shuffleBtn, sortBtn, addBtn, clearBtn].forEach(el => {
        if (el) {
            el.addEventListener("focus", () => { activeWheelId = wheel.id; });
            el.addEventListener("click", () => { activeWheelId = wheel.id; });
        }
    });
    
    document.querySelectorAll(`.tab-btn`).forEach(btn => {
        if (btn.dataset.tab && btn.dataset.tab.includes(wheel.id)) {
            btn.addEventListener("click", () => {
                activeWheelId = wheel.id;
                document.querySelectorAll(`.tab-btn`).forEach(b => {
                    if (b.dataset.tab && b.dataset.tab.includes(wheel.id)) b.classList.remove("active");
                });
                document.querySelectorAll(`.tab-content`).forEach(c => {
                    if (c.id && c.id.includes(wheel.id)) c.classList.remove("active");
                });
                btn.classList.add("active");
                document.getElementById(btn.dataset.tab).classList.add("active");
            });
        }
    });
    
    input.addEventListener("input", () => {
        wheel.options = input.value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        wheel.removedNames = [];
        count.textContent = wheel.options.length;
        drawWheel(wheel.id);
    });
    
    shuffleBtn.addEventListener("click", () => {
        const arr = [...wheel.options];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        wheel.options = arr;
        wheel.removedNames = [];
        input.value = arr.join('\n');
        count.textContent = wheel.options.length;
        drawWheel(wheel.id);
    });
    
    sortBtn.addEventListener("click", () => {
        wheel.options.sort();
        wheel.removedNames = [];
        input.value = wheel.options.join('\n');
        count.textContent = wheel.options.length;
        drawWheel(wheel.id);
    });
    
    addBtn.addEventListener("click", () => {
        activeWheelId = wheel.id;
        openNewWheelModal();
    });
    
    clearBtn.addEventListener("click", () => {
        wheel.results = [];
        document.getElementById(`result-count-${wheel.id}`).textContent = '0';
        document.getElementById(`list-${wheel.id}`).innerHTML = '';
        document.getElementById(`empty-${wheel.id}`).style.display = 'block';
        clearBtn.style.display = 'none';
    });
    
    if (removeBtn) {
        removeBtn.addEventListener("click", () => {
            if (wheels.length > 1 && confirm("Remove this wheel?")) {
                const wrapper = document.getElementById(`wrapper-${wheel.id}`);
                wrapper.remove();
                wheels = wheels.filter(w => w.id !== wheel.id);
                if (activeWheelId === wheel.id) activeWheelId = wheels.length > 0 ? wheels[0].id : null;
                document.querySelectorAll('.wheel-title').forEach((title, index) => {
                    title.textContent = wheels[index]?.name || `Wheel ${index + 1}`;
                });
            } else if (wheels.length === 1) {
                alert("You must have at least one wheel!");
            }
        });
    }
}

function drawWheel(wheelId) {
    const wheel = wheels.find(w => w.id === wheelId);
    if (!wheel) return;
    const canvas = document.getElementById(`canvas-${wheelId}`);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 10;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const activeOptions = wheel.options.filter(name => !wheel.removedNames.includes(name));
    if (activeOptions.length === 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = "#e0e0e0";
        ctx.fill();
        ctx.fillStyle = "#999";
        ctx.font = "bold 24px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No options!", centerX, centerY);
        return;
    }
    const colors = wheelThemes[preferences.theme] || wheelThemes['Default'];
    const sliceAngle = (2 * Math.PI) / activeOptions.length;
    for (let i = 0; i < activeOptions.length; i++) {
        const startAngle = i * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        const fontSize = activeOptions.length > 12 ? 14 : activeOptions.length > 8 ? 18 : 22;
        ctx.font = `900 ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = "#2d3436";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(255,255,255,0.8)";
        ctx.shadowBlur = 4;
        let text = activeOptions[i];
        if (text.length > 14) text = text.substring(0, 12) + "..";
        ctx.fillText(text, radius - 25, 0);
        ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 3;
    ctx.stroke();
}

let currentWinnerWheelId = null;
let currentWinnerName = null;

function spinWheel(wheelId) {
    const wheel = wheels.find(w => w.id === wheelId);
    if (!wheel || wheel.isSpinning) return;
    const activeOptions = wheel.options.filter(name => !wheel.removedNames.includes(name));
    if (activeOptions.length < 2) {
        showToast("Need at least 2 options to spin!", "error");
        return;
    }
    initAudio();
    wheel.isSpinning = true;
    const container = document.getElementById(`container-${wheelId}`);
    container.classList.add("spinning");
    const spins = 5 + Math.random() * 5;
    const randomAngle = Math.random() * 360;
    const totalDegrees = (spins * 360) + randomAngle;
    wheel.currentRotation += totalDegrees;
    const canvas = document.getElementById(`canvas-${wheelId}`);
    canvas.style.transform = `rotate(${wheel.currentRotation}deg)`;
    scheduleTickSounds(wheel, 5000);
    setTimeout(() => {
        const winner = calculateResult(wheel);
        currentWinnerWheelId = wheelId;
        currentWinnerName = winner;
        showWinnerModal(winner);
        wheel.isSpinning = false;
        container.classList.remove("spinning");
        wheel.tickTimeouts.forEach(t => clearTimeout(t));
        wheel.tickTimeouts = [];
    }, 5200);
}

function scheduleTickSounds(wheel, totalDuration) {
    wheel.tickTimeouts.forEach(t => clearTimeout(t));
    wheel.tickTimeouts = [];
    let currentTime = 0;
    const baseInterval = 30;
    const maxInterval = 400;
    let tickCount = 0;
    while (currentTime < totalDuration - 100 && tickCount < 80) {
        const timeoutId = setTimeout(() => {
            if (wheel.isSpinning) playTick();
        }, currentTime);
        wheel.tickTimeouts.push(timeoutId);
        const progress = currentTime / totalDuration;
        currentTime += baseInterval + (maxInterval - baseInterval) * Math.pow(progress, 2);
        tickCount++;
    }
}

function calculateResult(wheel) {
    const activeOptions = wheel.options.filter(name => !wheel.removedNames.includes(name));
    const normalizedAngle = wheel.currentRotation % 360;
    const pointerAngle = (360 - normalizedAngle) % 360;
    const sliceDegree = 360 / activeOptions.length;
    const winningIndex = Math.floor(pointerAngle / sliceDegree);
    return activeOptions[winningIndex];
}

function showWinnerModal(name) {
    document.getElementById('winnerName').textContent = name;
    document.getElementById('winnerModal').classList.add('show');
    playWinSound();
}

document.getElementById('removeWinnerBtn').addEventListener('click', () => {
    if (currentWinnerWheelId && currentWinnerName) {
        const wheel = wheels.find(w => w.id === currentWinnerWheelId);
        if (wheel) {
            if (!wheel.removedNames.includes(currentWinnerName)) wheel.removedNames.push(currentWinnerName);
            const activeCount = wheel.options.filter(n => !wheel.removedNames.includes(n)).length;
            const count = document.getElementById(`count-${currentWinnerWheelId}`);
            if (count) count.textContent = activeCount;
            drawWheel(currentWinnerWheelId);
            addWinnerToResults(currentWinnerWheelId, currentWinnerName);
        }
    }
    document.getElementById('winnerModal').classList.remove('show');
    currentWinnerWheelId = null;
    currentWinnerName = null;
});

document.getElementById('continueBtn').addEventListener('click', () => {
    if (currentWinnerWheelId && currentWinnerName) {
        const wheel = wheels.find(w => w.id === currentWinnerWheelId);
        if (wheel) addWinnerToResults(currentWinnerWheelId, currentWinnerName);
    }
    document.getElementById('winnerModal').classList.remove('show');
    currentWinnerWheelId = null;
    currentWinnerName = null;
});

function addWinnerToResults(wheelId, winnerName) {
    const wheel = wheels.find(w => w.id === wheelId);
    if (!wheel) return;
    wheel.results.push(winnerName);
    const resultCount = document.getElementById(`result-count-${wheelId}`);
    const resultsList = document.getElementById(`list-${wheelId}`);
    const emptyResults = document.getElementById(`empty-${wheelId}`);
    const clearBtn = document.getElementById(`clear-${wheelId}`);
    if (resultCount) resultCount.textContent = wheel.results.length;
    if (emptyResults) emptyResults.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'block';
    if (resultsList) {
        const li = document.createElement("li");
        li.innerHTML = `<span>${winnerName}</span><span class="result-num">${wheel.results.length}</span>`;
        resultsList.prepend(li);
    }
}

document.getElementById('winnerModal').addEventListener('click', (e) => {
    if (e.target.id === 'winnerModal') {
        document.getElementById('winnerModal').classList.remove('show');
        currentWinnerWheelId = null;
        currentWinnerName = null;
    }
});

// ===== AUDIO =====
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTick() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(900, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.04);
}

function playWinSound() {
    if (!audioCtx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = audioCtx.currentTime + (i * 0.1);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
    });
}

// ===== GOOGLE SIGN-IN =====
document.getElementById('googleSignInBtn').addEventListener('click', async () => {
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitLoader = document.getElementById('submitLoader');
    
    try {
        submitBtn.disabled = true;
        submitText.style.display = 'none';
        submitLoader.style.display = 'block';
        
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        showToast(`Welcome ${user.displayName || user.email}!`, "success");
        document.getElementById('authModal').classList.remove('show');
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            // User closed popup, no error message needed
        } else {
            showToast("Google Sign-In failed. Please try again.", "error");
        }
    } finally {
        submitBtn.disabled = false;
        submitText.style.display = 'inline';
        submitLoader.style.display = 'none';
    }
});

// ===== SHARE FEATURE =====
function generateShareLink() {
    const activeWheel = wheels.find(w => w.id === activeWheelId);
    if (!activeWheel) return null;
    
    const shareData = {
        name: activeWheel.name,
        options: activeWheel.options,
        theme: preferences.theme
    };
    
    try {
        const jsonStr = JSON.stringify(shareData);
        const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?wheel=${encoded}`;
    } catch (error) {
        console.error("Error generating share link:", error);
        return null;
    }
}

function loadWheelFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const wheelData = params.get('wheel');
    
    if (wheelData) {
        try {
            const jsonStr = decodeURIComponent(escape(atob(wheelData)));
            const data = JSON.parse(jsonStr);
            
            if (data && Array.isArray(data.options) && data.options.length > 0) {
                document.getElementById('wheelsContainer').innerHTML = '';
                wheels = [];
                wheelCounter = 0;
                
                if (data.theme && wheelThemes[data.theme]) {
                    preferences.theme = data.theme;
                }
                
                createWheel(data.options, data.name || 'Shared Wheel');
                showToast("Wheel loaded from shared link!", "success");
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error("Error loading shared wheel:", error);
            showToast("Failed to load shared wheel", "error");
        }
    }
}

function openShareModal() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("show");
    
    const activeWheel = wheels.find(w => w.id === activeWheelId);
    if (!activeWheel) {
        showToast("No wheel to share!", "error");
        return;
    }
    
    const shareLink = generateShareLink();
    if (!shareLink) {
        showToast("Failed to generate share link!", "error");
        return;
    }
    
    document.getElementById('shareLinkInput').value = shareLink;
    const copyBtn = document.getElementById('copyLinkBtn');
    copyBtn.textContent = 'Copy';
    copyBtn.classList.remove('copied');
    
    document.getElementById('shareModal').classList.add("show");
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove("show");
}

document.getElementById('closeShare').addEventListener('click', closeShareModal);
document.getElementById('shareCloseBtn').addEventListener('click', closeShareModal);
document.getElementById('shareModal').addEventListener('click', (e) => {
    if (e.target.id === 'shareModal') closeShareModal();
});

document.getElementById('copyLinkBtn').addEventListener('click', async () => {
    const input = document.getElementById('shareLinkInput');
    const copyBtn = document.getElementById('copyLinkBtn');
    
    try {
        await navigator.clipboard.writeText(input.value);
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        showToast("Link copied to clipboard!", "success");
        setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
        }, 2000);
    } catch (error) {
        input.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        showToast("Link copied!", "success");
        setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
        }, 2000);
    }
});

document.getElementById('shareViaWeb').addEventListener('click', async () => {
    const shareLink = document.getElementById('shareLinkInput').value;
    const activeWheel = wheels.find(w => w.id === activeWheelId);
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: `MySpinner - ${activeWheel?.name || 'Wheel'}`,
                text: `Check out this wheel: ${activeWheel?.name || 'My Wheel'}`,
                url: shareLink
            });
            showToast("Shared successfully!", "success");
        } catch (error) {
            if (error.name !== 'AbortError') {
                showToast("Failed to share", "error");
            }
        }
    } else {
        showToast("Web Share not supported on this browser", "error");
    }
});

document.getElementById('shareViaWhatsApp').addEventListener('click', () => {
    const shareLink = document.getElementById('shareLinkInput').value;
    const activeWheel = wheels.find(w => w.id === activeWheelId);
    const text = encodeURIComponent(`Check out my wheel "${activeWheel?.name || 'My Wheel'}" on MySpinner: ${shareLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    closeShareModal();
    showToast("Opening WhatsApp...", "success");
});

document.getElementById('shareViaEmail').addEventListener('click', () => {
    const shareLink = document.getElementById('shareLinkInput').value;
    const activeWheel = wheels.find(w => w.id === activeWheelId);
    const subject = encodeURIComponent(`MySpinner - ${activeWheel?.name || 'Wheel'}`);
    const body = encodeURIComponent(`Check out this wheel:\n\n${shareLink}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    closeShareModal();
    showToast("Opening email...", "success");
});

// ===== NEW WHEEL =====
function openNewWheelModal() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("show");
    document.getElementById('newWheelModal').classList.add("show");
}

function closeNewWheelModal() {
    document.getElementById('newWheelModal').classList.remove("show");
}

document.getElementById('closeNewWheel').addEventListener('click', closeNewWheelModal);
document.getElementById('newWheelModal').addEventListener('click', (e) => {
    if (e.target.id === 'newWheelModal') closeNewWheelModal();
});

document.getElementById('newEmpty').addEventListener('click', () => {
    closeNewWheelModal();
    createWheel([], 'Empty Wheel');
    showToast("New empty wheel created!", "success");
});

document.getElementById('newDefault').addEventListener('click', () => {
    closeNewWheelModal();
    createWheel(['Hanna', 'Charles', 'Eric', 'Beatriz', 'Fatima', 'Ali', 'Diya', 'Gabriel'], 'Default Wheel');
    showToast("New wheel with default options created!", "success");
});

// ===== SAVE WHEEL =====
function openSaveModal() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("show");
    const activeWheel = wheels.find(w => w.id === activeWheelId);
    const defaultName = activeWheel ? activeWheel.name.toLowerCase().replace(/\s+/g, '-') : 'my-wheel';
    document.getElementById('saveFileName').value = defaultName;
    document.getElementById('saveError').classList.remove('show');
    document.getElementById('saveError').textContent = '';
    document.getElementById('saveModal').classList.add("show");
    setTimeout(() => document.getElementById('saveFileName').focus(), 100);
}

function closeSaveModal() {
    document.getElementById('saveModal').classList.remove("show");
}

document.getElementById('closeSave').addEventListener('click', closeSaveModal);
document.getElementById('saveCancelBtn').addEventListener('click', closeSaveModal);
document.getElementById('saveModal').addEventListener('click', (e) => {
    if (e.target.id === 'saveModal') closeSaveModal();
});

document.getElementById('saveConfirmBtn').addEventListener('click', () => {
    const fileName = document.getElementById('saveFileName').value.trim();
    const errorEl = document.getElementById('saveError');
    if (!fileName) {
        errorEl.textContent = 'Please enter a file name!';
        errorEl.classList.add('show');
        return;
    }
    const cleanName = fileName.replace(/\.wheel$/i, '');
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
        errorEl.textContent = 'Only letters, numbers, hyphens and underscores allowed!';
        errorEl.classList.add('show');
        return;
    }
    const activeWheel = wheels.find(w => w.id === activeWheelId);
    if (!activeWheel) {
        errorEl.textContent = 'No wheel to save!';
        errorEl.classList.add('show');
        return;
    }
    const wheelData = {
        version: "1.0",
        appName: "MySpinner",
        createdAt: new Date().toISOString(),
        wheel: {
            name: activeWheel.name,
            options: activeWheel.options,
            theme: preferences.theme,
            results: activeWheel.results
        }
    };
    const jsonContent = JSON.stringify(wheelData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}.wheel`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeSaveModal();
    showToast(`Wheel saved as "${cleanName}.wheel"`, "success");
});

document.getElementById('saveFileName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('saveConfirmBtn').click();
    }
});

// ===== OPEN WHEEL =====
const fileInput = document.getElementById('fileInput');

function openFilePicker() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("show");
    fileInput.click();
}

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.wheel') && !file.name.endsWith('.json')) {
        showToast("Please select a .wheel file!", "error");
        fileInput.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (!data.wheel || !Array.isArray(data.wheel.options)) {
                throw new Error("Invalid wheel file format!");
            }
            const wheelName = data.wheel.name || file.name.replace(/\.wheel$/i, '');
            const options = data.wheel.options;
            if (data.wheel.theme && wheelThemes[data.wheel.theme]) {
                preferences.theme = data.wheel.theme;
                updateThemePreview(preferences.theme);
                const themeSelect = document.getElementById('themeSelect');
                if (themeSelect) themeSelect.value = preferences.theme;
            }
            createWheel(options, wheelName);
            showToast(`Wheel "${wheelName}" loaded successfully!`, "success");
        } catch (error) {
            console.error("Error loading wheel:", error);
            showToast("Failed to load wheel: Invalid file format!", "error");
        }
        fileInput.value = '';
    };
    reader.onerror = () => {
        showToast("Failed to read file!", "error");
        fileInput.value = '';
    };
    reader.readAsText(file);
});

// ===== PREFERENCES =====
function openPreferencesModal() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("show");
    document.getElementById('preferencesModal').classList.add("show");
}

function closePreferencesModal() {
    document.getElementById('preferencesModal').classList.remove("show");
}

const preferencesBtn = document.getElementById("preferencesBtn");
const mobilePreferences = document.getElementById("mobilePreferences");
const closePreferences = document.getElementById("closePreferences");
const prefCloseBtn = document.getElementById("prefCloseBtn");

if (preferencesBtn) preferencesBtn.addEventListener("click", openPreferencesModal);
if (mobilePreferences) mobilePreferences.addEventListener("click", openPreferencesModal);
if (closePreferences) closePreferences.addEventListener("click", closePreferencesModal);
if (prefCloseBtn) prefCloseBtn.addEventListener("click", closePreferencesModal);

const preferencesModal = document.getElementById("preferencesModal");
if (preferencesModal) {
    preferencesModal.addEventListener("click", (e) => {
        if (e.target === preferencesModal) closePreferencesModal();
    });
}

document.querySelectorAll('input[name="colorScheme"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
        preferences.colorScheme = e.target.value;
        applyColorScheme(preferences.colorScheme);
        savePreferences();
    });
});

const showClickToSpinCheckbox = document.getElementById("showClickToSpin");
if (showClickToSpinCheckbox) {
    showClickToSpinCheckbox.addEventListener("change", (e) => {
        preferences.showClickToSpin = e.target.checked;
        document.querySelectorAll('.spin-overlay').forEach(overlay => {
            if (preferences.showClickToSpin) overlay.classList.remove('hidden');
            else overlay.classList.add('hidden');
        });
        savePreferences();
    });
}

const themeSelect = document.getElementById("themeSelect");
if (themeSelect) {
    themeSelect.addEventListener("change", (e) => {
        preferences.theme = e.target.value;
        updateThemePreview(preferences.theme);
        wheels.forEach(wheel => drawWheel(wheel.id));
        savePreferences();
    });
}

if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (preferences.colorScheme === 'system') applyColorScheme('system');
    });
}

// ===== HELP & FEEDBACK =====
function openHelpFeedbackModal() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("show");
    document.getElementById('helpFeedbackModal').classList.add("show");
}

function closeHelpFeedbackModal() {
    document.getElementById('helpFeedbackModal').classList.remove("show");
}

const helpFeedbackBtn = document.getElementById("helpFeedbackBtn");
const mobileHelpFeedback = document.getElementById("mobileHelpFeedback");
const closeHelpFeedback = document.getElementById("closeHelpFeedback");
const hfCloseBtn = document.getElementById("hfCloseBtn");

if (helpFeedbackBtn) helpFeedbackBtn.addEventListener("click", openHelpFeedbackModal);
if (mobileHelpFeedback) mobileHelpFeedback.addEventListener("click", openHelpFeedbackModal);
if (closeHelpFeedback) closeHelpFeedback.addEventListener("click", closeHelpFeedbackModal);
if (hfCloseBtn) hfCloseBtn.addEventListener("click", closeHelpFeedbackModal);

const helpFeedbackModal = document.getElementById("helpFeedbackModal");
if (helpFeedbackModal) {
    helpFeedbackModal.addEventListener("click", (e) => {
        if (e.target === helpFeedbackModal) closeHelpFeedbackModal();
    });
}

document.querySelectorAll(".hf-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".hf-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".hf-content").forEach(c => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.hf + "Content").classList.add("active");
    });
});

// ===== ABOUT =====
function openAboutModal() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("show");
    document.getElementById('aboutModal').classList.add("show");
}

function closeAboutModal() {
    document.getElementById('aboutModal').classList.remove("show");
}

const aboutBtn = document.getElementById("aboutBtn");
const mobileAbout = document.getElementById("mobileAbout");
const closeAbout = document.getElementById("closeAbout");

if (aboutBtn) aboutBtn.addEventListener("click", openAboutModal);
if (mobileAbout) mobileAbout.addEventListener("click", openAboutModal);
if (closeAbout) closeAbout.addEventListener("click", closeAboutModal);

const aboutModal = document.getElementById("aboutModal");
if (aboutModal) {
    aboutModal.addEventListener("click", (e) => {
        if (e.target === aboutModal) closeAboutModal();
    });
}

// ===== AUTHENTICATION =====
const moreBtn = document.getElementById("moreBtn");
const dropdownMenu = document.getElementById("dropdownMenu");
const myAccountBtn = document.getElementById("myAccountBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
const mobileMenuClose = document.getElementById("mobileMenuClose");
const mobileMyAccount = document.getElementById("mobileMyAccount");

if (moreBtn) {
    moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle("show");
    });
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
        mobileMenuOverlay.classList.add("show");
    });
}
if (mobileMenuClose) {
    mobileMenuClose.addEventListener("click", () => {
        mobileMenuOverlay.classList.remove("show");
    });
}
if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener("click", (e) => {
        if (e.target === mobileMenuOverlay) {
            mobileMenuOverlay.classList.remove("show");
        }
    });
}
if (mobileMyAccount) {
    mobileMyAccount.addEventListener("click", () => {
        mobileMenuOverlay.classList.remove("show");
        if (currentUser) {
            openAccountModal();
        } else {
            openAuthModal("login");
        }
    });
}

document.addEventListener("click", (e) => {
    if (dropdownMenu && !dropdownMenu.contains(e.target) && e.target !== moreBtn) {
        dropdownMenu.classList.remove("show");
    }
});

let currentUser = null;
let authMode = "login";

const authModal = document.getElementById("authModal");
const closeAuth = document.getElementById("closeAuth");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authName = document.getElementById("authName");
const nameGroup = document.getElementById("nameGroup");
const authError = document.getElementById("authError");
const submitBtn = document.getElementById("submitBtn");
const submitText = document.getElementById("submitText");
const submitLoader = document.getElementById("submitLoader");

function openAuthModal(mode = "login") {
    authMode = mode;
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    authForm.reset();
    authError.classList.remove("show");
    authError.textContent = "";
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    document.querySelector(`.auth-tab[data-auth="${mode}"]`).classList.add("active");
    updateAuthUI();
    authModal.classList.add("show");
}

function updateAuthUI() {
    if (authMode === "login") {
        authTitle.textContent = "Welcome Back!";
        authSubtitle.textContent = "Sign in to save your wheels";
        submitText.textContent = "Login";
        nameGroup.style.display = "none";
    } else {
        authTitle.textContent = "Create Account";
        authSubtitle.textContent = "Join MySpinner today";
        submitText.textContent = "Register";
        nameGroup.style.display = "flex";
    }
}

document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        authMode = tab.dataset.auth;
        document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        authError.classList.remove("show");
        updateAuthUI();
    });
});

if (closeAuth) {
    closeAuth.addEventListener("click", () => authModal.classList.remove("show"));
}
if (authModal) {
    authModal.addEventListener("click", (e) => {
        if (e.target === authModal) authModal.classList.remove("show");
    });
}

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authError.classList.remove("show");
    
    const email = authEmail.value.trim();
    const password = authPassword.value;
    const name = authName.value.trim();
    
    if (!email || !password) {
        showError("Email and password are required!");
        return;
    }
    if (password.length < 6) {
        showError("Password must be at least 6 characters!");
        return;
    }
    
    submitBtn.disabled = true;
    submitText.style.display = "none";
    submitLoader.style.display = "block";
    
    try {
        if (authMode === "login") {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (name) {
                await updateProfile(cred.user, { displayName: name });
            }
        }
        authModal.classList.remove("show");
    } catch (error) {
        console.error("Auth error:", error);
        showError(getFriendlyError(error.code));
    } finally {
        submitBtn.disabled = false;
        submitText.style.display = "inline";
        submitLoader.style.display = "none";
    }
});

function showError(msg) {
    authError.textContent = msg;
    authError.classList.add("show");
}

function getFriendlyError(code) {
    const errors = {
        "auth/email-already-in-use": "Email already registered! Please login.",
        "auth/invalid-email": "Invalid email format!",
        "auth/weak-password": "Password too weak (min 6 characters)!",
        "auth/user-not-found": "Account not found! Please register first.",
        "auth/wrong-password": "Wrong password!",
        "auth/invalid-credential": "Invalid email or password!",
        "auth/too-many-requests": "Too many attempts. Try again later!",
        "auth/network-request-failed": "Connection problem!"
    };
    return errors[code] || "An error occurred. Please try again!";
}

const accountModal = document.getElementById("accountModal");
const closeAccount = document.getElementById("closeAccount");
const userAvatar = document.getElementById("userAvatar");
const userPhoto = document.getElementById("userPhoto");
const logoutBtn = document.getElementById("logoutBtn");

if (myAccountBtn) {
    myAccountBtn.addEventListener("click", () => {
        if (dropdownMenu) dropdownMenu.classList.remove("show");
        if (currentUser) {
            openAccountModal();
        } else {
            openAuthModal("login");
        }
    });
}

function openAccountModal() {
    if (!currentUser) return;
    document.getElementById("accountPhoto").src = currentUser.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.displayName || currentUser.email || "User");
    document.getElementById("accountName").textContent = currentUser.displayName || "User";
    document.getElementById("accountEmail").textContent = currentUser.email;
    
    // Show provider type
    const providerData = currentUser.providerData;
    const isGoogle = providerData.some(p => p.providerId === 'google.com');
    document.getElementById("accountProvider").textContent = isGoogle ? "Google Account" : "Email Account";
    
    accountModal.classList.add("show");
}

if (closeAccount) {
    closeAccount.addEventListener("click", () => accountModal.classList.remove("show"));
}
if (accountModal) {
    accountModal.addEventListener("click", (e) => {
        if (e.target === accountModal) accountModal.classList.remove("show");
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to logout?")) {
            try {
                await signOut(auth);
                accountModal.classList.remove("show");
                showToast("Logged out successfully", "success");
            } catch (error) {
                console.error("Logout error:", error);
                showToast("Failed to logout", "error");
            }
        }
    });
}

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        userAvatar.style.display = "block";
        userPhoto.src = user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || user.email || "U");
        userPhoto.alt = user.displayName || "User";
    } else {
        userAvatar.style.display = "none";
    }
});

if (userAvatar) {
    userAvatar.addEventListener("click", () => {
        if (currentUser) openAccountModal();
        else openAuthModal("login");
    });
}

// ===== NEW / SAVE / OPEN / SHARE BUTTONS =====
document.getElementById('btnNew').addEventListener('click', openNewWheelModal);
document.getElementById('btnSave').addEventListener('click', openSaveModal);
document.getElementById('btnOpen').addEventListener('click', openFilePicker);
document.getElementById('btnShare').addEventListener('click', openShareModal);

document.getElementById('mobileBtnNew').addEventListener('click', openNewWheelModal);
document.getElementById('mobileBtnSave').addEventListener('click', openSaveModal);
document.getElementById('mobileBtnOpen').addEventListener('click', openFilePicker);
document.getElementById('mobileBtnShare').addEventListener('click', openShareModal);

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (activeWheelId) {
            spinWheel(activeWheelId);
        }
    }
});

// ===== INIT =====
loadPreferences();
loadWheelFromUrl();
if (wheels.length === 0) {
    createWheel();
}