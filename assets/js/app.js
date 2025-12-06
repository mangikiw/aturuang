// ==========================================
// CONFIG & STATE
// ==========================================
const catColors = {
    'Makan': '#F97316', 'Transport': '#3B82F6', 'Belanja': '#8B5CF6',
    'Tagihan': '#EAB308', 'Tabungan': '#10B981', 'Darurat': '#EF4444', 'Lainnya': '#6B7280'
};

const defaultDompets = [
    { id: 'd_def1', name: 'Kebutuhan Harian', balance: 0, notes: '', categories: ['Makan', 'Transport', 'Belanja', 'Tagihan'] },
    { id: 'd_def2', name: 'Tabungan', balance: 0, notes: 'Target: 5jt', categories: ['Setor', 'Darurat'] }
];

const defaultData = {
    banks: [{ id: 'b_def1', name: 'Dompet Tunai', balance: 0 }],
    dompets: JSON.parse(JSON.stringify(defaultDompets)),
    transactions: []
};

let appData = null;
let currentUser = JSON.parse(localStorage.getItem('financeUser')); // Cek sesi login di browser
let activeTransactions = [];
let currentFilterLabel = "Bulan Ini";
let chartInstance = null;
let currentWalletForExpense = null;
let manageCatWalletId = null;
let currentView = 'dashboard';
let viewParam = null;

// ==========================================
// CORE FUNCTIONS (API & DATABASE CONNECTION)
// ==========================================

async function initApp() {
    if (!currentUser) {
        // Kalau belum login, tampilkan layar login
        document.getElementById('auth-view').classList.remove('auth-hidden');
        document.getElementById('app-interface').classList.add('hidden');
    } else {
        // Kalau sudah login, muat data
        await loadUserData();
        
        // Setup UI
        document.getElementById('auth-view').classList.add('auth-hidden');
        document.getElementById('app-interface').classList.remove('hidden');
        setTimeout(() => document.getElementById('app-interface').classList.add('opacity-100'), 100);
        
        document.getElementById('drawer-name').innerText = currentUser.name;
        document.getElementById('drawer-avatar').innerText = currentUser.name.charAt(0).toUpperCase();
        
        // Default filter
        document.getElementById('filter-time').value = 'this_month';
        runFilterLogic();
        navigateTo('dashboard');
    }
}

async function loadUserData() {
    // 1. Coba ambil data dari Server (MySQL)
    try {
        const res = await fetch(`api/data.php?action=load&user_id=${currentUser.id}`);
        const json = await res.json();
        
        if(json.status === 'success' && json.data) {
            appData = json.data;
            console.log("Data loaded from Server");
        } else {
            // Kalau di server kosong (user baru), pake default
            console.log("Data server kosong, init local.");
            loadLocalOrInit();
        }
    } catch (e) {
        // Kalau error/offline, ambil dari LocalStorage
        console.log("Offline mode / Server Error:", e);
        loadLocalOrInit();
    }
    
    // Safety check struktur data
    if(!appData.dompets) appData.dompets = JSON.parse(JSON.stringify(defaultDompets));
    if(!appData.banks) appData.banks = [];
    if(!appData.transactions) appData.transactions = [];
    
    // Sync balik ke server biar aman (kalau baru init)
    saveData(false);
}

function loadLocalOrInit() {
    appData = JSON.parse(localStorage.getItem(`financeData_v42_${currentUser.username}`));
    if(!appData) appData = JSON.parse(JSON.stringify(defaultData));
}

// FUNGSI SIMPAN DATA (PENTING!)
async function saveData(render = true) {
    if(!currentUser) return;
    
    // 1. Simpan ke LocalStorage (Biar UI instan & Offline Support)
    localStorage.setItem(`financeData_v42_${currentUser.username}`, JSON.stringify(appData));
    
    // 2. Kirim ke Database MySQL (Background Process)
    try {
        await fetch('api/data.php?action=save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, data: appData })
        });
        console.log("Synced to MySQL");
    } catch(e) { 
        console.log("Gagal sync ke server (Mungkin Offline):", e); 
    }

    runFilterLogic();
    if(render) renderCurrentView();
}

// ==========================================
// AUTHENTICATION (LOGIN/REGISTER)
// ==========================================

function toggleAuthMode(m) {
    document.getElementById('form-login').classList.toggle('hidden', m === 'register');
    document.getElementById('form-register').classList.toggle('hidden', m !== 'register');
}

async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    // Panggil API Login
    try {
        const res = await fetch('api/auth.php?action=login', {
            method: 'POST',
            body: JSON.stringify({ username: u, pin: p })
        });
        const result = await res.json();

        if (result.status === 'success') {
            currentUser = result.data;
            localStorage.setItem('financeUser', JSON.stringify(currentUser)); // Simpan sesi
            initApp();
        } else {
            document.getElementById('login-error').classList.remove('hidden');
        }
    } catch(e) { 
        alert("Gagal koneksi ke server."); 
    }
}

async function handleRegister() {
    const n = document.getElementById('reg-name').value;
    const u = document.getElementById('reg-user').value;
    const p = document.getElementById('reg-pass').value;
    
    if(!n || !u || !p) return alert("Lengkapi data!");

    // Panggil API Register
    try {
        const res = await fetch('api/auth.php?action=register', {
            method: 'POST',
            body: JSON.stringify({ name: n, username: u, pin: p })
        });
        const result = await res.json();
        
        if(result.status === 'success') {
            alert("Berhasil daftar! Silakan login.");
            toggleAuthMode('login');
        } else {
            alert("Gagal: " + result.message);
        }
    } catch(e) {
        alert("Gagal koneksi ke server.");
    }
}

function handleLogout() {
    if(confirm("Yakin mau keluar?")) {
        localStorage.removeItem('financeUser');
        location.reload();
    }
}

// ==========================================
// LOGIC TRANSAKSI & PERHITUNGAN
// ==========================================

function getCatColor(c) { return catColors[c] || '#6B7280'; }

function processTransaction(t, a, ty, s, d, dt, c = null) {
    if (a <= 0) return alert("Nominal harus > 0");

    // Update Saldo Realtime
    if (ty === 'income') {
        const b = appData.banks.find(x => x.id === d);
        if (b) b.balance += a;
    } else if (ty === 'transfer') {
        const sr = appData.banks.find(x => x.id === s) || appData.dompets.find(x => x.id === s);
        const ds = appData.dompets.find(x => x.id === d) || appData.banks.find(x => x.id === d);
        if (sr && ds) { sr.balance -= a; ds.balance += a; }
    } else if (ty === 'expense') {
        const dm = appData.dompets.find(x => x.id === s);
        if (dm) dm.balance -= a;
    }

    // Tambah ke History
    appData.transactions.unshift({
        id: Date.now(),
        date: dt || new Date().toISOString(),
        title: t,
        amount: a,
        type: ty,
        srcId: s,
        dstId: d,
        category: c
    });

    saveData(true); // Simpan & Render
    return true;
}

// ==========================================
// NAVIGATION & RENDERING UI
// ==========================================

function navigateTo(view, param = null) {
    currentView = view;
    viewParam = param;
    
    const titles = { 'dashboard': 'Dashboard', 'banks': 'Sumber Dana', 'dompet': 'Dompet Saya', 'riwayat': 'Riwayat Transaksi' };
    document.getElementById('header-title').innerText = titles[view] || (view === 'detail-source' ? (param.type === 'bank' ? 'Detail Sumber' : 'Detail Dompet') : 'Dashboard');

    // Update Bottom Nav Active State
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.replace('text-primary', 'text-gray-400'));
    const navId = 'nav-' + (view.includes('bank') ? 'banks' : view.includes('dompet') ? 'dompet' : view);
    const el = document.getElementById(navId);
    if (el) el.classList.replace('text-gray-400', 'text-primary');

    renderCurrentView(param);
}

function renderCurrentView(p) {
    const param = p || viewParam;
    const main = document.getElementById('main-view');
    main.innerHTML = ''; // Clear view

    if (currentView === 'dashboard') renderDashboard(main);
    else if (currentView === 'banks') renderBanks(main);
    else if (currentView === 'dompet') renderDompets(main);
    else if (currentView === 'riwayat') renderRiwayat(main);
    else if (currentView === 'detail-source') renderDetailSource(main, param);
}

// --- STATE TAMBAHAN UNTUK CHART ---
let chartFilterType = 'expense'; // Default: Pengeluaran
let chartFilterTime = 'this_month'; // Default: Bulan Ini

// --- UPDATE FUNGSI RENDER DASHBOARD (FIX LAYOUT CHART) ---
function renderDashboard(c) {
    const tot = appData.banks.reduce((a, b) => a + b.balance, 0) + appData.dompets.reduce((a, b) => a + b.balance, 0);
    
    c.innerHTML = `
        <div class="flex flex-col h-full bg-gray-50 overflow-hidden">
            
            <div class="flex-none bg-gray-50 pt-4 pb-12 z-0 -mb-9">
                <div class="px-5 mb-4">
                    <div class="bg-gradient-to-br from-indigo-600 to-blue-500 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden h-44 flex flex-col justify-center">
                        <i class="ph ph-wallet absolute -right-4 -bottom-6 text-9xl text-white/10"></i>
                        <p class="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Total Uang</p>
                        <h2 class="text-3xl font-bold mb-4">${formatIDR(tot)}</h2>
                        <div class="flex gap-2 relative z-10">
                            <div class="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"><i class="ph ph-bank"></i> ${formatSmall(appData.banks.reduce((a, b) => a + b.balance, 0))}</div>
                            <div class="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"><i class="ph ph-wallet"></i> ${formatSmall(appData.dompets.reduce((a, b) => a + b.balance, 0))}</div>
                        </div>
                    </div>
                </div>

                <div class="carousel-container pb-2 px-0" id="home-slider" onscroll="updateDots(this)">
                    <div class="carousel-slide w-full px-5"> 
                        <div class="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm h-52 relative flex flex-col justify-between">
                            <div class="flex justify-between items-center border-b border-gray-50 pb-2 mb-1">
                                <div><h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Analisis Pengeluaran</h4><p class="text-xs font-bold text-dark" id="chart-period-label">Bulan Ini</p></div>
                                <button onclick="openChartFilterModal()" class="flex items-center gap-1 bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-primary px-3 py-1.5 rounded-full transition-colors border border-gray-100"><i class="ph ph-faders text-sm"></i> <span class="text-[10px] font-bold">Filter</span></button>
                            </div>
                            <div class="flex-1 grid grid-cols-[130px_1fr] gap-4 items-center">
                                <div class="relative w-[130px] h-[110px] flex items-center justify-center">
                                    <canvas id="expenseChart"></canvas>
                                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none"><i class="ph ph-chart-pie-slice text-2xl text-gray-100"></i></div>
                                </div>
                                <div class="h-[110px] overflow-y-auto pr-1 flex flex-col justify-center space-y-2" id="chart-legend"></div>
                            </div>
                        </div>
                    </div>
                    <div class="carousel-slide w-full px-5">
                        <div class="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm h-52 flex flex-col justify-center">
                            <h4 class="text-xs font-bold text-gray-400 uppercase mb-4 text-center">Menu Cepat</h4>
                            <div class="grid grid-cols-3 gap-2 text-center">
                                <div onclick="navigateTo('banks')" class="flex flex-col items-center gap-2 tap-effect p-2 rounded-xl hover:bg-gray-50"><div class="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center shadow-sm"><i class="ph ph-bank text-2xl"></i></div><span class="text-[10px] font-bold text-gray-600">Sumber</span></div>
                                <div onclick="navigateTo('dompet')" class="flex flex-col items-center gap-2 tap-effect p-2 rounded-xl hover:bg-gray-50"><div class="w-12 h-12 bg-blue-100 text-primary rounded-2xl flex items-center justify-center shadow-sm"><i class="ph ph-wallet text-2xl"></i></div><span class="text-[10px] font-bold text-gray-600">Dompet</span></div>
                                <div onclick="openIncomeModal()" class="flex flex-col items-center gap-2 tap-effect p-2 rounded-xl hover:bg-gray-50"><div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-sm"><i class="ph ph-plus text-2xl"></i></div><span class="text-[10px] font-bold text-gray-600">Masuk</span></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-center gap-1.5 mt-3" id="slider-dots"><div class="dot active"></div><div class="dot"></div></div>
            </div>

            <div class="flex-1 bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.03)] relative z-10 flex flex-col overflow-hidden transform-gpu isolation-auto">
                <div class="flex-none px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-white rounded-t-[2.5rem] relative z-20">
                    <h3 class="font-bold text-dark text-base">Transaksi Terkini</h3>
                    <button onclick="navigateTo('riwayat')" class="text-xs font-bold text-primary bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">Lihat Semua</button>
                </div>

                <div class="flex-1 overflow-y-auto scroll-area px-5 pt-2 pb-4 relative z-10">
                    ${renderTxList(appData.transactions.slice(0, 10))}
                </div>
            </div>

        </div>
    `;
    
    setTimeout(() => initChart(), 100);
}

function updateDots(el) {
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    const dots = document.querySelectorAll('.dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
}

function renderBanks(c) {
    c.innerHTML = `<div class="flex-1 scroll-area p-5 space-y-4 pb-4">
        ${appData.banks.map(b => `<div onclick="navigateTo('detail-source',{type:'bank',id:'${b.id}'})" class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between tap-effect"><div class="flex items-center gap-4"><div class="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center text-xl"><i class="ph ph-bank"></i></div><div><h4 class="font-bold text-dark text-sm">${b.name}</h4><p class="text-xs text-gray-500 mt-0.5">${formatIDR(b.balance)}</p></div></div><i class="ph ph-caret-right text-gray-300"></i></div>`).join('')}
        <button onclick="openAddModal('bank')" class="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold text-sm hover:border-primary flex items-center justify-center gap-2"><i class="ph ph-plus-circle text-lg"></i> Tambah Sumber</button>
    </div>`; 
}

function renderDompets(c) {
    c.innerHTML = `<div class="flex-1 scroll-area p-5 space-y-4 pb-4">
        ${appData.dompets.map(d => `<div onclick="navigateTo('detail-source',{type:'dompet',id:'${d.id}'})" class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden tap-effect"><div class="absolute right-0 top-0 w-16 h-16 bg-primary opacity-5 rounded-bl-full pointer-events-none"></div><div class="flex justify-between items-start mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-indigo-50 text-primary flex items-center justify-center"><i class="ph ph-wallet"></i></div><h4 class="font-bold text-dark text-sm">${d.name}</h4></div><i class="ph ph-caret-right text-gray-300"></i></div><h3 class="text-2xl font-bold text-dark mb-1">${formatIDR(d.balance)}</h3>${d.notes ? `<p class="text-[10px] text-gray-500 bg-gray-50 inline-block px-2 py-1 rounded-lg border border-gray-100"><i class="ph ph-push-pin text-yellow-500"></i> ${d.notes}</p>` : ''}</div>`).join('')}
        <button onclick="openAddModal('dompet')" class="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold text-sm hover:border-primary flex items-center justify-center gap-2"><i class="ph ph-plus-circle text-lg"></i> Tambah Dompet</button>
    </div>`; 
}

function renderRiwayat(c) {
    c.innerHTML = `
    <div class="flex flex-col h-full bg-white">
        <div class="flex-none border-b border-gray-100 px-5 py-4 flex justify-between items-center shadow-sm z-10">
            <div><h2 class="font-bold text-lg">Riwayat</h2><p class="text-xs text-gray-400">${currentFilterLabel} • ${activeTransactions.length} Data</p></div>
            <button onclick="openModal('modal-filter')" class="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-dark hover:bg-gray-100 transition"><i class="ph ph-funnel text-xl"></i></button>
        </div>
        <div class="flex-1 scroll-area px-5 py-4 space-y-3 pb-4">
            ${renderTxList(activeTransactions)}
        </div>
    </div>`;
}

function renderDetailSource(c, p) {
    const item = (p.type === 'bank' ? appData.banks : appData.dompets).find(x => x.id === p.id);
    if (!item) return navigateTo('dashboard');
    const txs = appData.transactions.filter(t => t.srcId === p.id || t.dstId === p.id);
    const isD = p.type === 'dompet';

    // 1. GENERATOR WARNA KATEGORI (BIAR WARNA-WARNI)
    const getCatColorClass = (name) => {
        const colors = [
            'bg-red-50 text-red-600 border-red-100',
            'bg-blue-50 text-blue-600 border-blue-100',
            'bg-emerald-50 text-emerald-600 border-emerald-100',
            'bg-purple-50 text-purple-600 border-purple-100',
            'bg-amber-50 text-amber-600 border-amber-100',
            'bg-pink-50 text-pink-600 border-pink-100',
            'bg-cyan-50 text-cyan-600 border-cyan-100'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    // 2. UI KATEGORI (CHIPS COMPACT)
    let catUI = '';
    if (isD) {
        const cats = item.categories || [];
        const catChips = cats.map((cat, idx) => 
            // px-2.5 py-1: Ukuran chip pas, gak kegedean
            `<div class="inline-flex items-center px-2.5 py-1 border rounded-lg text-[10px] font-bold shadow-sm ${getCatColorClass(cat)} transition hover:opacity-80">
                ${cat} 
                <button onclick="removeCategoryInline('${item.id}', ${idx})" class="ml-1.5 opacity-40 hover:opacity-100"><i class="ph ph-x text-xs"></i></button>
             </div>`
        ).join('');
        
        // Tombol Plus (+) Minimalis
        const addBtn = `<button onclick="addCategoryInline('${item.id}')" class="w-6 h-6 rounded-md bg-gray-50 text-gray-400 border border-dashed border-gray-300 flex items-center justify-center hover:text-primary hover:border-primary transition btn-press"><i class="ph ph-plus font-bold text-xs"></i></button>`;

        catUI = `
            <div class="mt-3 pt-3 border-t border-gray-50">
                <div class="flex items-center gap-1 mb-2">
                    <i class="ph ph-tag text-gray-300 text-xs"></i>
                    <label class="text-[10px] font-bold text-gray-400 uppercase">Kategori</label>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                    ${catChips}
                    ${addBtn}
                </div>
            </div>
        `;
    }

    // 3. RENDER LAYOUT (COMPACT & FIXED TOP)
    c.innerHTML = `
        <div class="flex flex-col h-full bg-gray-50 overflow-hidden">
            
            <div class="flex-none bg-white rounded-b-3xl shadow-sm z-20 relative">
                <div class="px-5 py-3">
                    
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <div class="flex items-center gap-2 mb-0.5">
                                <button onclick="navigateTo('${isD ? 'dompet' : 'banks'}')" class="text-gray-400 hover:text-dark"><i class="ph ph-arrow-left text-lg"></i></button>
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${isD ? 'Dompet' : 'Sumber'}</span>
                            </div>
                            <h1 class="text-lg font-bold text-dark leading-tight">${item.name}</h1>
                            <h2 class="text-2xl font-bold text-primary tracking-tight mt-0.5">${formatIDR(item.balance)}</h2>
                        </div>
                        <button onclick="deleteEntity('${p.type}','${p.id}')" class="w-8 h-8 flex items-center justify-center text-red-300 hover:text-danger bg-red-50 rounded-lg"><i class="ph ph-trash text-lg"></i></button>
                    </div>

                    <div class="grid ${isD ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-3">
                        ${!isD ? 
                            `<button onclick="openIncomeModal('${p.id}')" class="bg-green-50 text-green-700 py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-0.5 tap-effect border border-green-100"><i class="ph ph-plus-circle text-lg"></i> Tambah</button>` : 
                            `<button onclick="openTopUpModal('${p.id}')" class="bg-green-50 text-green-700 py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-0.5 tap-effect border border-green-100"><i class="ph ph-download-simple text-lg"></i> Isi</button>`
                        }
                        
                        <button onclick="prepareAlokasi('${p.id}','${p.type}')" class="bg-blue-50 text-primary py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-0.5 tap-effect border border-blue-100"><i class="ph ph-arrows-left-right text-lg"></i> Pindah</button>
                        
                        ${isD ? `<button onclick="openExpenseModal('${p.id}')" class="bg-red-50 text-danger py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-0.5 tap-effect border border-red-100"><i class="ph ph-shopping-cart text-lg"></i> Bayar</button>` : ''}
                    </div>

                    ${isD ? `
                        <div class="mt-3">
                            <div class="flex items-center gap-2 bg-yellow-50/50 border border-yellow-100 px-3 py-1.5 rounded-lg">
                                <i class="ph ph-note-pencil text-yellow-400 text-xs"></i>
                                <input type="text" onchange="updateNotes('${p.id}',this.value)" class="w-full bg-transparent text-xs font-medium text-gray-600 outline-none placeholder-gray-400" placeholder="Tulis catatan..." value="${item.notes || ''}">
                            </div>
                            ${catUI}
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="flex-1 flex flex-col overflow-hidden bg-gray-50 relative z-10 pt-3">
                 <div class="px-5 pb-2 flex justify-between items-center">
                    <h3 class="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Riwayat Transaksi</h3>
                 </div>
                 
                 <div class="flex-1 overflow-y-auto scroll-area px-4 pb-4">
                    ${renderTxList(txs)}
                 </div>
            </div>

        </div>
    `;
}

function renderTxList(l) {
    if (!l || l.length === 0) return '<div class="text-center py-10 text-gray-400 text-xs italic">Belum ada transaksi.</div>';
    return l.map(t => {
        let i, c, s, b = '';
        if (t.type === 'income') { i = 'ph-arrow-down-left'; c = 'text-green-600 bg-green-50'; s = '+'; }
        else if (t.type === 'transfer') { i = 'ph-arrows-left-right'; c = 'text-blue-600 bg-blue-50'; s = ''; }
        else { i = 'ph-shopping-cart'; c = 'text-red-600 bg-red-50'; s = '-'; if (t.category) b = `<span class="px-2 py-[2px] rounded-full text-[9px] font-medium text-white tracking-wide ml-2" style="background:${getCatColor(t.category)}">${t.category}</span>`; }
        return `<div onclick="openTxDetail(${t.id})" class="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between tap-effect"><div class="flex items-center gap-3 overflow-hidden"><div class="w-10 h-10 rounded-full ${c} flex items-center justify-center flex-shrink-0"><i class="ph ${i} text-lg"></i></div><div class="min-w-0 flex flex-col justify-center"><h4 class="font-bold text-dark text-sm truncate leading-tight mb-0.5">${t.title}</h4><div class="flex items-center"><span class="text-[10px] text-gray-400 font-medium">${new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>${b}</div></div></div><span class="font-bold text-sm ${t.type === 'income' ? 'text-green-600' : (t.type === 'expense' ? 'text-red-600' : 'text-dark')} whitespace-nowrap">${s} ${formatSmall(t.amount)}</span></div>`;
    }).join('');
}

// --- LOGIKA BARU UNTUK CHART & FILTER ---

function initChart() {
    const ctx = document.getElementById('expenseChart'); 
    if (!ctx) return;
    
    // 1. Ambil Data Sesuai Filter
    const now = new Date();
    // Default filter values kalo belum ada
    if(typeof chartFilterType === 'undefined') { window.chartFilterType = 'expense'; window.chartFilterTime = 'this_month'; }

    let dataSet = appData.transactions.filter(t => t.type === chartFilterType); 

    // Filter Waktu
    if (chartFilterTime === 'this_month') {
        dataSet = dataSet.filter(t => new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
        document.getElementById('chart-period-label').innerText = "Bulan Ini";
    } else if (chartFilterTime === 'last_month') {
        dataSet = dataSet.filter(t => new Date(t.date).getMonth() === now.getMonth() - 1);
        document.getElementById('chart-period-label').innerText = "Bulan Lalu";
    } else {
        document.getElementById('chart-period-label').innerText = "Semua Waktu";
    }

    // 2. Olah Data Kategori
    const cm = {}; 
    dataSet.forEach(t => { 
        // Kalau Income, kategorinya biasanya 'Pemasukan', kalau Expense ambil kategorinya
        const c = t.category || (t.type === 'income' ? 'Sumber Lain' : 'Umum'); 
        cm[c] = (cm[c] || 0) + t.amount; 
    });
    
    const l = Object.keys(cm);
    const d = Object.values(cm);
    const colors = l.map(x => getCatColor(x));

    if (chartInstance) chartInstance.destroy();

    // 3. Render Tampilan KOSONG vs ADA DATA
    const legendEl = document.getElementById('chart-legend');
    
    // KONDISI: DATA KOSONG
    if (d.length === 0) { 
        // Chart jadi abu tipis
        chartInstance = new Chart(ctx, { 
            type: 'doughnut', 
            data: { datasets: [{ data: [1], backgroundColor: ['#f3f4f6'], borderWidth: 0 }] }, 
            options: { cutout: '85%', plugins: { tooltip: {enabled: false} }, maintainAspectRatio: false } 
        });
        
        // Tulisan Keterangan di Kanan
        legendEl.innerHTML = `
            <div class="text-center text-gray-400 py-2">
                <i class="ph ph-warning-circle text-2xl mb-1 opacity-50"></i>
                <p class="text-[10px] italic">Belum ada data<br>di periode ini.</p>
            </div>
        `;
        return; 
    }

    // KONDISI: ADA DATA
        chartInstance = new Chart(ctx, { 
        type: 'doughnut', 
        data: { labels: l, datasets: [{ data: d, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] }, 
        options: { 
            cutout: '65%',          // 1. Donat lebih tebal (makin kecil %, makin tebal)
            layout: { padding: 5 }, // 2. Padding dikit aja, biar chart tetep gede tapi aman
            plugins: { legend: { display: false } }, 
            maintainAspectRatio: false, 
            animation: { animateScale: true } 
        } 
    });

    // Render List Kategori di Kanan
    legendEl.innerHTML = l.map((x, i) => `
        <div class="flex items-center justify-between text-[10px] w-full">
            <div class="flex items-center gap-2 overflow-hidden">
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${colors[i]}"></div>
                <span class="truncate text-gray-600 font-bold max-w-[60px]">${x}</span>
            </div>
            <span class="font-bold text-dark">${formatSmall(d[i])}</span>
        </div>
    `).join('');
}

// --- FUNGSI MODAL FILTER CHART ---
function openChartFilterModal() {
    document.getElementById('chart-filter-type').value = chartFilterType;
    document.getElementById('chart-filter-time').value = chartFilterTime;
    openModal('modal-chart-filter');
}

function applyChartFilter() {
    chartFilterType = document.getElementById('chart-filter-type').value;
    chartFilterTime = document.getElementById('chart-filter-time').value;
    
    initChart(); // Render ulang chart doang
    closeModal('modal-chart-filter');
    showToast("Grafik Diupdate");
}

// ==========================================
// FILTERS & UTILS
// ==========================================

function runFilterLogic() {
    const ty = document.getElementById('filter-type').value, tm = document.getElementById('filter-time').value, now = new Date();
    let res = appData.transactions;
    if (ty !== 'all') res = res.filter(t => t.type === ty);
    
    if (tm === 'this_month') { res = res.filter(t => new Date(t.date).getMonth() === now.getMonth()); currentFilterLabel = "Bulan Ini"; }
    else if (tm === 'last_month') { res = res.filter(t => new Date(t.date).getMonth() === now.getMonth() - 1); currentFilterLabel = "Bulan Lalu"; }
    else if (tm === 'custom') { const s = new Date(document.getElementById('filter-start').value), e = new Date(document.getElementById('filter-end').value); if (s && e) { s.setHours(0, 0, 0); e.setHours(23, 59, 59); res = res.filter(t => new Date(t.date) >= s && new Date(t.date) <= e); currentFilterLabel = "Custom"; } }
    else currentFilterLabel = "Semua";
    
    activeTransactions = res;
}

function applyFilterUI() { runFilterLogic(); closeModal('modal-filter'); renderCurrentView(); showToast("Filter Diterapkan"); }
function updateNotes(id, v) { const d = appData.dompets.find(x => x.id === id); if (d) { d.notes = v; saveData(false); } }

// --- MODAL HANDLERS ---
function openManageCategories(id) { manageCatWalletId = id; const d = appData.dompets.find(x => x.id === id); if (!d) return; openModal('modal-manage-cats'); renderManageCatList(); }
function renderManageCatList() { const d = appData.dompets.find(x => x.id === manageCatWalletId); document.getElementById('manage-cat-list').innerHTML = d.categories.map((c, i) => `<div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100"><span class="text-sm font-medium">${c}</span><button onclick="removeCategoryInternal(${i})" class="text-red-400 hover:text-red-600"><i class="ph ph-trash text-lg"></i></button></div>`).join(''); }
function addNewCategoryInternal() { const val = document.getElementById('new-cat-input').value; if (!val) return; const d = appData.dompets.find(x => x.id === manageCatWalletId); d.categories.push(val); saveData(); document.getElementById('new-cat-input').value = ''; renderManageCatList(); }
function removeCategoryInternal(idx) { if (!confirm("Hapus kategori ini?")) return; const d = appData.dompets.find(x => x.id === manageCatWalletId); d.categories.splice(idx, 1); saveData(); renderManageCatList(); }

function runAIAnalysis() {
    openModal('modal-ai'); const now = new Date(); const txs = appData.transactions.filter(t => new Date(t.date).getMonth() === now.getMonth());
    const inc = txs.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const exp = txs.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    let msg = `Halo, ${currentUser.name.split(' ')[0]}! <br><br>`;
    if (inc === 0 && exp === 0) msg += "Belum ada aktivitas bulan ini. Yuk catat!";
    else { msg += `Pengeluaran bulan ini: <b>${formatIDR(exp)}</b>. `; if (inc > 0) { const r = (exp / inc) * 100; msg += `Pemasukan: <b>${formatIDR(inc)}</b>.<br>`; if (r > 80) msg += "<span class='text-red-500 font-bold'>Waspada!</span> >80% pemasukan terpakai."; else if (r < 50) msg += "<span class='text-green-600 font-bold'>Sehat!</span> Hemat pangkal kaya."; else msg += "Keuangan stabil, jaga terus!"; } else msg += "Jangan lupa catat pemasukan juga."; }
    setTimeout(() => document.getElementById('ai-result').innerHTML = msg, 800);
}

// --- OPEN/CLOSE MODALS ---
function openIncomeModal(tId) { openModal('modal-income'); document.getElementById('inc-bank-target').innerHTML = appData.banks.map(b => `<option value="${b.id}">${b.name}</option>`).join(''); if (tId) document.getElementById('inc-bank-target').value = tId; document.getElementById('inc-amount').value = ''; document.getElementById('inc-date').value = new Date().toISOString().slice(0, 16); }
function openExpenseModal(dId) { currentWalletForExpense = appData.dompets.find(d => d.id === dId); if (!currentWalletForExpense) return; openModal('modal-expense'); document.getElementById('exp-from-name').innerText = currentWalletForExpense.name; document.getElementById('exp-from-id').value = dId; document.getElementById('exp-amount').value = ''; document.getElementById('exp-date').value = new Date().toISOString().slice(0, 16); renderCategoryChips(); }
function openTopUpModal(dId) { openModal('modal-alokasi'); document.getElementById('alo-title').innerText = "Isi Saldo"; document.getElementById('alo-btn-submit').innerText = "Isi"; document.getElementById('alo-from-id').innerHTML = appData.banks.map(b => `<option value="${b.id}">[Sumber] ${b.name}</option>`).join(''); const t = appData.dompets.find(d => d.id === dId); document.getElementById('alo-to-id').innerHTML = `<option value="${t.id}">${t.name}</option>`; document.getElementById('alo-amount').value = ''; document.getElementById('alo-date').value = new Date().toISOString().slice(0, 16); }
function prepareAlokasi(id, t) { openModal('modal-alokasi'); document.getElementById('alo-title').innerText = t === 'dompet' ? "Alokasi" : "Pindah"; document.getElementById('alo-btn-submit').innerText = "Proses"; let f, to; if (t === 'dompet') { const d = appData.dompets.find(x => x.id === id); f = `<option value="${d.id}">${d.name}</option>`; to = appData.dompets.filter(x => x.id !== id).map(x => `<option value="${x.id}">${x.name}</option>`).join(''); } else { const b = appData.banks.find(x => x.id === id); f = `<option value="${b.id}">${b.name}</option>`; to = [...appData.banks.filter(x => x.id !== id), ...appData.dompets].map(x => `<option value="${x.id}">${x.name}</option>`).join(''); } document.getElementById('alo-from-id').innerHTML = f; document.getElementById('alo-to-id').innerHTML = to; document.getElementById('alo-amount').value = ''; document.getElementById('alo-date').value = new Date().toISOString().slice(0, 16); }
function openAddModal(t) { document.getElementById('entity-type').value = t; document.getElementById('modal-entity-title').innerText = t === 'bank' ? 'Tambah Sumber' : 'Tambah Dompet'; document.getElementById('entity-balance').value = ''; document.getElementById('entity-name').value = ''; openModal('modal-add-entity'); }
function openTxDetail(id) { const tx = appData.transactions.find(t => t.id === id); if (!tx) return; const gn = (i) => (appData.banks.find(x => x.id === i) || appData.dompets.find(x => x.id === i))?.name || '-'; document.getElementById('detail-tx-content').innerHTML = `<div class="text-center mb-6"><p class="text-xs text-gray-400 uppercase font-bold">${tx.type}</p><h2 class="text-3xl font-bold mt-2">${formatIDR(tx.amount)}</h2><p class="text-sm text-gray-600 mt-1">${tx.title}</p></div><div class="bg-gray-50 rounded-2xl p-4 space-y-3 text-sm"><div class="flex justify-between border-b pb-2"><span>Tgl</span><span class="font-bold">${new Date(tx.date).toLocaleDateString()}</span></div>${tx.category ? `<div class="flex justify-between border-b pb-2"><span>Kat</span><span class="font-bold">${tx.category}</span></div>` : ''}<div class="flex justify-between border-b pb-2"><span>Dari</span><span class="font-bold">${gn(tx.srcId)}</span></div><div class="flex justify-between"><span>Ke</span><span class="font-bold">${gn(tx.dstId)}</span></div></div>`; document.getElementById('btn-edit-tx').onclick = () => openEditTransaction(id); document.getElementById('btn-del-tx').onclick = () => deleteTransaction(id); openModal('modal-detail-tx'); }
function openEditTransaction(id) { closeModal('modal-detail-tx'); const tx = appData.transactions.find(t => t.id === id); if (!tx) return; document.getElementById('edit-tx-id').value = id; document.getElementById('edit-tx-title').value = tx.title; document.getElementById('edit-tx-amount').value = tx.amount.toLocaleString('id-ID'); document.getElementById('edit-tx-date').value = new Date(tx.date).toISOString().slice(0, 16); if (tx.type === 'expense') { document.getElementById('edit-cat-wrapper').classList.remove('hidden'); document.getElementById('edit-tx-cat').value = tx.category || ''; } else document.getElementById('edit-cat-wrapper').classList.add('hidden'); openModal('modal-edit-tx'); }

// --- FORM SUBMIT HANDLERS ---
function handleSubmitIncome(e) { e.preventDefault(); processTransaction(document.getElementById('inc-name').value, cleanCurrency(document.getElementById('inc-amount').value), 'income', null, document.getElementById('inc-bank-target').value, document.getElementById('inc-date').value); closeModal('modal-income'); e.target.reset(); showToast("Disimpan"); }
function handleSubmitExpense(e) { e.preventDefault(); const c = document.getElementById('exp-category-selected').value; if (!c) return alert("Pilih kategori"); processTransaction(document.getElementById('exp-title').value, cleanCurrency(document.getElementById('exp-amount').value), 'expense', document.getElementById('exp-from-id').value, null, document.getElementById('exp-date').value, c); closeModal('modal-expense'); e.target.reset(); showToast("Tercatat"); }
function handleSubmitAlokasi(e) { e.preventDefault(); processTransaction('Transfer', cleanCurrency(document.getElementById('alo-amount').value), 'transfer', document.getElementById('alo-from-id').value, document.getElementById('alo-to-id').value, document.getElementById('alo-date').value); closeModal('modal-alokasi'); e.target.reset(); showToast("Berhasil"); }
function handleAddEntity(e) { e.preventDefault(); createEntity(document.getElementById('entity-type').value, document.getElementById('entity-name').value, cleanCurrency(document.getElementById('entity-balance').value)); closeModal('modal-add-entity'); showToast("Ditambah"); }
function handleSaveEditTransaction(e) { e.preventDefault(); const id = parseInt(document.getElementById('edit-tx-id').value), idx = appData.transactions.findIndex(t => t.id === id); if (idx === -1) return; const old = appData.transactions[idx]; if (old.type === 'income') { const b = appData.banks.find(x => x.id === old.dstId); if (b) b.balance -= old.amount; } else if (old.type === 'expense') { const d = appData.dompets.find(x => x.id === old.srcId); if (d) d.balance += old.amount; } else { const s = appData.banks.find(x => x.id === old.srcId) || appData.dompets.find(x => x.id === old.srcId), d = appData.dompets.find(x => x.id === old.dstId); if (s && d) { s.balance += old.amount; d.balance -= old.amount; } } const nAmt = cleanCurrency(document.getElementById('edit-tx-amount').value); if (old.type === 'income') { const b = appData.banks.find(x => x.id === old.dstId); if (b) b.balance += nAmt; } else if (old.type === 'expense') { const d = appData.dompets.find(x => x.id === old.srcId); if (d) d.balance -= nAmt; } else { const s = appData.banks.find(x => x.id === old.srcId) || appData.dompets.find(x => x.id === old.srcId), d = appData.dompets.find(x => x.id === old.dstId); if (s && d) { s.balance -= nAmt; d.balance += nAmt; } } old.title = document.getElementById('edit-tx-title').value; old.amount = nAmt; old.date = document.getElementById('edit-tx-date').value; if (old.type === 'expense') old.category = document.getElementById('edit-tx-cat').value; saveData(true); closeModal('modal-edit-tx'); showToast("Diedit"); }
function createEntity(t, n, b) { const id = (t === 'bank' ? 'b_' : 'd_') + Date.now(); const obj = { id: id, name: n, balance: b || 0 }; if (t === 'dompet') { obj.notes = ''; obj.categories = ['Makan', 'Transport', 'Belanja']; appData.dompets.push(obj); } else appData.banks.push(obj); saveData(); }

// --- HELPERS ---
function renderCategoryChips() { document.getElementById('exp-category-list').innerHTML = (currentWalletForExpense.categories || []).map(c => `<button type="button" onclick="selectCategory('${c}',this)" class="cat-chip px-3 py-1.5 rounded-full text-xs font-medium text-white shadow-sm opacity-60 hover:opacity-100" style="background:${getCatColor(c)}">${c}</button>`).join(''); }
function selectCategory(c, b) { document.getElementById('exp-category-selected').value = c; document.querySelectorAll('.cat-chip').forEach(el => { el.style.opacity = '0.5'; el.style.transform = 'scale(1)' }); b.style.opacity = '1'; b.style.transform = 'scale(1.1)'; }
function deleteTransaction(id) { if (!confirm("Hapus?")) return; const idx = appData.transactions.findIndex(t => t.id === id); if (idx === -1) return; const t = appData.transactions[idx]; if (t.type === 'income') { const b = appData.banks.find(x => x.id === t.dstId); if (b) b.balance -= t.amount; } else if (t.type === 'expense') { const d = appData.dompets.find(x => x.id === t.srcId); if (d) d.balance += t.amount; } else { const s = appData.banks.find(x => x.id === t.srcId) || appData.dompets.find(x => x.id === t.srcId), d = appData.dompets.find(x => x.id === t.dstId); if (s && d) { s.balance += t.amount; d.balance -= t.amount; } } appData.transactions.splice(idx, 1); saveData(true); closeModal('modal-detail-tx'); showToast("Dihapus"); }
function deleteEntity(t, id) { if (!confirm("Hapus?")) return; if (t === 'bank') appData.banks = appData.banks.filter(x => x.id !== id); else appData.dompets = appData.dompets.filter(x => x.id !== id); saveData(true); navigateTo('dashboard'); showToast("Dihapus"); }
function formatIDR(n) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n); }
function formatSmall(n) { return n >= 1000000 ? (n / 1000000).toFixed(1) + 'jt' : (n / 1000).toFixed(0) + 'rb'; }
function cleanCurrency(v) { return parseInt(v.toString().replace(/[^0-9]/g, '')) || 0; }
function formatCurrency(i) { let v = i.value.replace(/[^0-9]/g, ''); if (v) i.value = parseInt(v).toLocaleString('id-ID'); else i.value = ''; }
function showToast(m) { const t = document.getElementById('toast'); document.getElementById('toast-msg').innerText = m; t.classList.remove('opacity-0', 'translate-y-[-20px]'); setTimeout(() => t.classList.add('opacity-0', 'translate-y-[-20px]'), 2000); }
function openModal(id) { document.getElementById(id).classList.add('open'); setTimeout(() => document.getElementById(id).classList.add('active'), 10); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); setTimeout(() => document.getElementById(id).classList.remove('open'), 300); }
function toggleDrawer(o) { const ov = document.getElementById('drawer-overlay'), m = document.getElementById('drawer-menu'); if (o) { ov.classList.remove('hidden'); setTimeout(() => ov.classList.remove('opacity-0'), 10); m.classList.remove('-translate-x-full'); } else { ov.classList.add('opacity-0'); m.classList.add('-translate-x-full'); setTimeout(() => ov.classList.add('hidden'), 300); } }
function toggleCustomDate() { const v = document.getElementById('filter-time').value; document.getElementById('custom-date-area').classList.toggle('hidden', v !== 'custom'); }
function downloadCSV() { if (!activeTransactions.length) return alert("Kosong"); let c = "Tgl,Judul,Jml\n"; activeTransactions.forEach(t => c += `${t.date},${t.title},${t.amount}\n`); const b = new Blob([c], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'Lap.csv'; a.click(); }
function downloadImage() { if (!activeTransactions.length) return alert("Kosong"); showToast("Proses..."); let i = 0, o = 0; activeTransactions.forEach(t => { if (t.type === 'income') i += t.amount; else if (t.type === 'expense') o += t.amount; }); document.getElementById('rep-in').innerText = formatIDR(i); document.getElementById('rep-out').innerText = formatIDR(o); document.getElementById('rep-period').innerText = currentFilterLabel; document.getElementById('rep-list-table').innerHTML = activeTransactions.slice(0, 30).map(t => `<tr><td>${new Date(t.date).toLocaleDateString()}</td><td>${t.title}</td><td>${t.type}</td><td class="text-right">${formatIDR(t.amount)}</td></tr>`).join(''); html2canvas(document.getElementById('report-render-area'), { scale: 2 }).then(c => { const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'Lap.png'; a.click(); showToast("Disimpan"); }); }
function backupData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData)); const a = document.createElement('a'); a.href = s; a.download = `Back_${currentUser.username}.json`; a.click(); toggleDrawer(false); }
function triggerRestore() { document.getElementById('restore-file-input').click(); }
function processRestoreFile(i) { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = (e) => { try { const d = JSON.parse(e.target.result); if (d.banks && d.transactions) { if (confirm("Restore?")) { appData = d; saveData(true); location.reload(); } } } catch (e) { alert("File Salah"); } }; r.readAsText(f); }
function openResetModal() { toggleDrawer(false); openModal('modal-reset'); }
function confirmReset() { appData = JSON.parse(JSON.stringify(defaultData)); saveData(true); location.reload(); }

// --- HELPER BARU UNTUK KATEGORI INLINE ---
function addCategoryInline(id) {
    const n = prompt("Nama Kategori Baru:");
    if (n) {
        const d = appData.dompets.find(x => x.id === id);
        if (d) {
            if(!d.categories) d.categories = [];
            d.categories.push(n);
            saveData(true);
        }
    }
}

function removeCategoryInline(id, idx) {
    if (confirm("Hapus kategori ini?")) {
        const d = appData.dompets.find(x => x.id === id);
        if (d) {
            d.categories.splice(idx, 1);
            saveData(true);
        }
    }
}

// --- FITUR EDIT PROFIL ---

// 1. Fungsi buat Buka Popup Edit & Isi datanya otomatis
function openProfileModal() {
    toggleDrawer(false); // Tutup menu samping dulu biar rapi
    
    // Masukin data User yang sekarang ke dalam form input
    document.getElementById('prof-name').value = currentUser.name;
    document.getElementById('prof-user').value = currentUser.username;
    document.getElementById('prof-pin').value = currentUser.pin; 
    
    // Munculin Modal
    openModal('modal-profile');
}

// 2. Fungsi pas tombol "Simpan" diklik
async function handleUpdateProfile(e) {
    e.preventDefault(); // Biar gak reload halaman
    
    // Ambil data yang diketik user
    const n = document.getElementById('prof-name').value;
    const u = document.getElementById('prof-user').value;
    const p = document.getElementById('prof-pin').value;

    if (!n || !u || !p) return alert("Data tidak boleh kosong!");

    // Kirim ke Server (PHP)
    try {
        const res = await fetch('api/auth.php?action=update_profile', {
            method: 'POST',
            body: JSON.stringify({ id: currentUser.id, name: n, username: u, pin: p })
        });
        const result = await res.json();

        if (result.status === 'success') {
            // Kalau sukses, Update data di HP (LocalStorage)
            currentUser = result.data;
            localStorage.setItem('financeUser', JSON.stringify(currentUser));
            
            // Update Nama di Menu Samping secara langsung
            document.getElementById('drawer-name').innerText = currentUser.name;
            document.getElementById('drawer-avatar').innerText = currentUser.name.charAt(0).toUpperCase();
            
            closeModal('modal-profile');
            showToast("Profil Berhasil Diupdate!");
        } else {
            alert(result.message); // Misal username udah dipake orang lain
        }
    } catch (err) {
        alert("Gagal koneksi ke server");
    }
}

// --- FUNGSI SHOW/HIDE PIN ---
function togglePinVisibility() {
    const input = document.getElementById('prof-pin');
    const icon = document.getElementById('pin-icon');
    
    if (input.type === "password") {
        input.type = "text"; // Ubah jadi teks biasa (kelihatan)
        icon.classList.replace('ph-eye-slash', 'ph-eye'); // Ganti ikon mata terbuka
    } else {
        input.type = "password"; // Ubah jadi password (sensor)
        icon.classList.replace('ph-eye', 'ph-eye-slash'); // Ganti ikon mata dicoret
    }
}

initApp();