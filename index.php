<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Sistem Keuangan V42 - MySQL</title>
    
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>

    <link rel="stylesheet" href="assets/css/style.css">

    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Poppins', 'sans-serif'] },
                    colors: {
                        primary: '#4F46E5', // Indigo
                        secondary: '#10B981', // Emerald
                        dark: '#111827',
                        bg: '#F3F4F6',
                        danger: '#EF4444',
                        warning: '#F59E0B',
                        magic: '#8B5CF6'
                    },
                    boxShadow: {
                        'soft': '0 4px 20px rgba(0,0,0,0.05)',
                        'glow': '0 0 15px rgba(79, 70, 229, 0.3)'
                    }
                }
            }
        }
    </script>
    <style>
        /* PAKSA MATIKAN BLUR DAN ANIMASI BERAT */
        .modal-overlay {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background-color: rgba(0,0,0,0.6) !important; /* Gelap transparan */
        }
        
        /* Biar sudut lengkungan dashboard gak bocor di HP lama */
        .rounded-t-\[2\.5rem\] {
            -webkit-mask-image: -webkit-radial-gradient(white, black);
        }
    </style>
</head>
<body>

<div id="app-container">
    
    <input type="file" id="restore-file-input" accept="application/json" style="display:none;" onchange="processRestoreFile(this)">

    <div id="auth-view" class="auth-screen">
        <div class="text-center mb-10">
            <div class="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-glow transform rotate-3"><i class="ph ph-wallet text-4xl text-white"></i></div>
            <h1 class="text-3xl font-bold text-dark tracking-tight">Keuanganku</h1>
            <p class="text-gray-500 text-sm mt-2">V42 - MySQL Sync</p>
        </div>
        <div id="form-login" class="space-y-4">
            <div><label class="text-xs font-bold text-gray-400 uppercase ml-1">Username</label><input type="text" id="login-user" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary"></div>
            <div><label class="text-xs font-bold text-gray-400 uppercase ml-1">PIN</label><input type="password" id="login-pass" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary"></div>
            <div id="login-error" class="hidden text-danger text-xs font-bold text-center mt-2">Username atau PIN salah!</div>
            <button onclick="handleLogin()" class="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg btn-press shadow-lg shadow-indigo-500/30 mt-4">Masuk</button>
            <p class="text-center text-sm text-gray-500 mt-6">Belum punya akun? <button onclick="toggleAuthMode('register')" class="text-primary font-bold">Daftar</button></p>
        </div>
        <div id="form-register" class="space-y-4 hidden">
            <div><label class="text-xs font-bold text-gray-400 uppercase ml-1">Nama</label><input type="text" id="reg-name" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary"></div>
            <div><label class="text-xs font-bold text-gray-400 uppercase ml-1">Username</label><input type="text" id="reg-user" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary"></div>
            <div><label class="text-xs font-bold text-gray-400 uppercase ml-1">PIN (4-6 Digit)</label><input type="password" id="reg-pass" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary"></div>
            <button onclick="handleRegister()" class="w-full bg-dark text-white py-4 rounded-2xl font-bold text-lg btn-press mt-4">Buat Akun</button>
            <p class="text-center text-sm text-gray-500 mt-6">Sudah punya akun? <button onclick="toggleAuthMode('login')" class="text-primary font-bold">Masuk</button></p>
        </div>
    </div>

    <div id="app-interface" class="flex flex-col h-full hidden opacity-0 transition-opacity duration-500">
        
        <header class="h-16 flex-none flex items-center justify-between px-5 bg-white z-30 border-b border-gray-100 shadow-sm relative">
            <button class="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center btn-press text-gray-600" onclick="toggleDrawer(true)"><i class="ph ph-list text-2xl"></i></button>
            <h1 id="header-title" class="font-bold text-lg text-dark">Dashboard</h1>
            <button onclick="runAIAnalysis()" class="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-magic btn-press transition shadow-sm border border-gray-100 group">
                <i class="ph ph-sparkle text-xl group-hover:scale-110 transition-transform"></i>
            </button>
        </header>

        <main id="main-view" class="flex-1 flex flex-col overflow-hidden bg-gray-50 relative"></main>

        <div class="absolute bottom-[24px] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <button onclick="openIncomeModal()" class="pointer-events-auto bg-primary text-white w-16 h-16 rounded-full shadow-glow flex items-center justify-center btn-press border-4 border-white transform hover:rotate-90 transition-transform duration-300"><i class="ph ph-plus text-3xl font-bold"></i></button>
        </div>

        <footer class="h-[80px] flex-none bg-white border-t border-gray-100 z-40 flex justify-between items-start px-2 pt-3 text-[10px] font-medium text-gray-400">
            <button onclick="navigateTo('dashboard')" class="flex flex-col items-center gap-1 w-1/5 btn-press nav-btn text-primary" id="nav-dashboard"><i class="ph ph-house text-2xl"></i> Home</button>
            <button onclick="navigateTo('banks')" class="flex flex-col items-center gap-1 w-1/5 btn-press nav-btn" id="nav-banks"><i class="ph ph-bank text-2xl"></i> Sumber</button>
            <div class="w-1/5 pointer-events-none"></div> 
            <button onclick="navigateTo('dompet')" class="flex flex-col items-center gap-1 w-1/5 btn-press nav-btn" id="nav-dompet"><i class="ph ph-wallet text-2xl"></i> Dompet</button>
            <button onclick="navigateTo('riwayat')" class="flex flex-col items-center gap-1 w-1/5 btn-press nav-btn" id="nav-riwayat"><i class="ph ph-clock-counter-clockwise text-2xl"></i> Riwayat</button>
        </footer>

    </div>

    <div id="drawer-overlay" class="fixed inset-0 bg-black/50 z-[60] hidden transition-opacity duration-300 opacity-0" onclick="toggleDrawer(false)"></div>
    <div id="drawer-menu" class="fixed top-0 bottom-0 left-0 w-72 bg-white z-[61] transform -translate-x-full transition-transform duration-300 p-6 flex flex-col shadow-2xl rounded-r-3xl">
        <div class="mb-8 mt-4 flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl" id="drawer-avatar">U</div>
            <div><h2 class="text-lg font-bold text-dark" id="drawer-name">User</h2><p class="text-xs text-gray-500">Pengaturan & Tools</p></div>
        </div>
        <div class="space-y-2">
            <button onclick="backupData()" class="w-full flex items-center gap-4 p-4 hover:bg-blue-50 text-dark rounded-xl transition-colors font-medium text-sm"><i class="ph ph-download-simple text-xl text-primary"></i> Backup Data</button>
            <button onclick="triggerRestore()" class="w-full flex items-center gap-4 p-4 hover:bg-green-50 text-dark rounded-xl transition-colors font-medium text-sm"><i class="ph ph-upload-simple text-xl text-secondary"></i> Restore Data</button>
            <button onclick="openResetModal()" class="w-full flex items-center gap-4 p-4 hover:bg-red-50 text-dark rounded-xl transition-colors font-medium text-sm"><i class="ph ph-trash text-xl text-danger"></i> Reset Aplikasi</button>
        </div>
        <button onclick="openProfileModal()" class="w-full flex items-center gap-4 p-4 hover:bg-indigo-50 text-dark rounded-xl transition-colors font-medium text-sm">
            <i class="ph ph-user-gear text-xl text-primary"></i> Edit Profil
        </button>
        <button onclick="handleLogout()" class="mt-auto w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-red-50 hover:text-danger rounded-xl font-bold text-sm transition-colors"><i class="ph ph-sign-out text-xl"></i> Keluar</button>
    </div>

    <div id="modal-income" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-income')"></div><div class="modal-content">
        <div class="flex justify-between items-center mb-6"><h2 class="text-xl font-bold text-dark">Pemasukan</h2><button onclick="closeModal('modal-income')" class="bg-gray-100 p-2 rounded-full"><i class="ph ph-x"></i></button></div>
        <form onsubmit="handleSubmitIncome(event)">
            <div class="space-y-4">
                <div><label class="text-xs font-bold text-gray-400">DARI MANA</label><input type="text" id="inc-name" placeholder="Contoh: Gaji, Bonus" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-medium" required></div>
                <div><label class="text-xs font-bold text-gray-400">NOMINAL</label><div class="relative"><span class="absolute left-4 top-4 text-gray-400 font-bold">Rp</span><input type="text" inputmode="numeric" id="inc-amount" onkeyup="formatCurrency(this)" class="w-full pl-12 p-4 bg-gray-50 border rounded-2xl outline-none text-xl font-bold" placeholder="0" required></div></div>
                <div><label class="text-xs font-bold text-gray-400">TANGGAL</label><input type="datetime-local" id="inc-date" class="w-full p-3 bg-gray-50 border rounded-2xl text-sm"></div>
                <div><label class="text-xs font-bold text-gray-400">MASUK KE SUMBER</label><select id="inc-bank-target" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none appearance-none font-bold text-dark" required></select></div>
            </div>
            <button type="submit" class="w-full bg-secondary text-white py-4 rounded-2xl font-bold mt-6 btn-press shadow-lg shadow-green-500/20">Simpan ke Sumber</button>
        </form>
    </div></div>

    <div id="modal-expense" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-expense')"></div><div class="modal-content">
        <div class="flex justify-between items-center mb-4"><h2 class="text-xl font-bold text-danger">Catat Pengeluaran</h2><button onclick="closeModal('modal-expense')" class="bg-gray-100 p-2 rounded-full"><i class="ph ph-x"></i></button></div>
        <form onsubmit="handleSubmitExpense(event)">
            <input type="hidden" id="exp-from-id">
            <div class="bg-red-50 p-4 rounded-2xl mb-4 flex justify-between items-center border border-red-100"><div><p class="text-[10px] font-bold text-red-400 uppercase">Menggunakan Dompet</p><p id="exp-from-name" class="font-bold text-dark text-lg">Dompet</p></div><i class="ph ph-wallet text-2xl text-danger"></i></div>
            <div class="mb-4"><div class="flex justify-between items-end mb-2"><label class="text-xs font-bold text-gray-400">KATEGORI</label></div><div id="exp-category-list" class="flex flex-wrap gap-2 max-h-32 overflow-y-auto"></div><input type="hidden" id="exp-category-selected" required></div>
            <div class="space-y-4">
                <div><label class="text-xs font-bold text-gray-400">JUDUL</label><input type="text" id="exp-title" placeholder="Beli apa?" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-medium" required></div>
                <div><label class="text-xs font-bold text-gray-400">NOMINAL</label><div class="relative"><span class="absolute left-4 top-4 text-gray-400 font-bold">Rp</span><input type="text" inputmode="numeric" id="exp-amount" onkeyup="formatCurrency(this)" class="w-full pl-12 p-4 bg-gray-50 border rounded-2xl outline-none text-xl font-bold text-danger" placeholder="0" required></div></div>
                <div><label class="text-xs font-bold text-gray-400">TANGGAL</label><input type="datetime-local" id="exp-date" class="w-full p-3 bg-gray-50 border rounded-2xl text-sm"></div>
            </div>
            <button type="submit" class="w-full bg-danger text-white py-4 rounded-2xl font-bold mt-6 btn-press shadow-lg shadow-red-500/20">Bayar Sekarang</button>
        </form>
    </div></div>

    <div id="modal-alokasi" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-alokasi')"></div><div class="modal-content">
        <div class="flex justify-between items-center mb-6"><h2 id="alo-title" class="text-xl font-bold text-primary">Transfer Dana</h2><button onclick="closeModal('modal-alokasi')" class="bg-gray-100 p-2 rounded-full"><i class="ph ph-x"></i></button></div>
        <form onsubmit="handleSubmitAlokasi(event)">
            <div class="flex items-center gap-3 mb-4">
                <div class="flex-1 bg-gray-50 p-3 rounded-2xl border"><p class="text-[10px] text-gray-400 font-bold mb-1">DARI</p><select id="alo-from-id" class="w-full bg-transparent font-bold text-sm outline-none" required></select></div>
                <i class="ph ph-arrow-right text-gray-400"></i>
                <div class="flex-1 bg-gray-50 p-3 rounded-2xl border"><p class="text-[10px] text-gray-400 font-bold mb-1">KE</p><select id="alo-to-id" class="w-full bg-transparent font-bold text-sm outline-none" required></select></div>
            </div>
            <div class="space-y-4">
                <div><label class="text-xs font-bold text-gray-400">NOMINAL</label><div class="relative"><span class="absolute left-4 top-4 text-gray-400 font-bold">Rp</span><input type="text" inputmode="numeric" id="alo-amount" onkeyup="formatCurrency(this)" class="w-full pl-12 p-4 bg-gray-50 border rounded-2xl outline-none text-xl font-bold" placeholder="0" required></div></div>
                <div><label class="text-xs font-bold text-gray-400">TANGGAL</label><input type="datetime-local" id="alo-date" class="w-full p-3 bg-gray-50 border rounded-2xl text-sm"></div>
            </div>
            <button type="submit" id="alo-btn-submit" class="w-full bg-dark text-white py-4 rounded-2xl font-bold mt-6 btn-press">Proses</button>
        </form>
    </div></div>

    <div id="modal-add-entity" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-add-entity')"></div><div class="modal-content">
        <h2 class="text-xl font-bold mb-6" id="modal-entity-title">Tambah Baru</h2>
        <form onsubmit="handleAddEntity(event)">
            <input type="hidden" id="entity-type">
            <div class="space-y-4">
                <div><label class="text-xs font-bold text-gray-400">NAMA</label><input type="text" id="entity-name" placeholder="Contoh: BCA, Dompet Belanja" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-medium" required></div>
                <div><label class="text-xs font-bold text-gray-400">SALDO AWAL (Opsional)</label><div class="relative"><span class="absolute left-4 top-4 text-gray-400 font-bold">Rp</span><input type="text" inputmode="numeric" id="entity-balance" onkeyup="formatCurrency(this)" class="w-full pl-12 p-4 bg-gray-50 border rounded-2xl outline-none text-lg font-bold"></div></div>
            </div>
            <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl font-bold mt-6 btn-press">Simpan</button>
        </form>
    </div></div>

    <div id="modal-detail-tx" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-detail-tx')"></div><div class="modal-content"><div id="detail-tx-content"></div><div class="grid grid-cols-2 gap-3 mt-6"><button id="btn-edit-tx" class="bg-blue-50 text-blue-600 py-3 rounded-xl font-bold btn-press">Edit</button><button id="btn-del-tx" class="bg-red-50 text-danger py-3 rounded-xl font-bold btn-press">Hapus</button></div><button onclick="closeModal('modal-detail-tx')" class="w-full mt-3 py-3 text-gray-400 font-bold text-sm">Tutup</button></div></div>

    <div id="modal-edit-tx" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-edit-tx')"></div><div class="modal-content">
        <h2 class="text-xl font-bold mb-6">Edit Transaksi</h2>
        <form onsubmit="handleSaveEditTransaction(event)">
            <input type="hidden" id="edit-tx-id">
            <div class="space-y-4">
                <div><label class="text-xs font-bold text-gray-400">JUDUL</label><input type="text" id="edit-tx-title" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-medium" required></div>
                <div><label class="text-xs font-bold text-gray-400">NOMINAL BARU</label><div class="relative"><span class="absolute left-4 top-4 text-gray-400 font-bold">Rp</span><input type="text" inputmode="numeric" id="edit-tx-amount" onkeyup="formatCurrency(this)" class="w-full pl-12 p-4 bg-gray-50 border rounded-2xl outline-none text-xl font-bold" required></div></div>
                <div><label class="text-xs font-bold text-gray-400">TANGGAL</label><input type="datetime-local" id="edit-tx-date" class="w-full p-3 bg-gray-50 border rounded-2xl text-sm"></div>
                <div id="edit-cat-wrapper" class="hidden"><label class="text-xs font-bold text-gray-400">KATEGORI</label><input type="text" id="edit-tx-cat" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-medium"></div>
            </div>
            <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl font-bold mt-6 btn-press">Simpan Perubahan</button>
        </form>
    </div></div>

    <div id="modal-filter" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-filter')"></div><div class="modal-content">
        <div class="flex justify-between items-center mb-6"><h2 class="text-xl font-bold">Filter & Unduh</h2><button onclick="closeModal('modal-filter')" class="bg-gray-100 p-2 rounded-full"><i class="ph ph-x"></i></button></div>
        <div class="space-y-4 mb-6">
            <div><label class="text-xs font-bold text-gray-400">JENIS</label><select id="filter-type" class="w-full p-3 border rounded-xl bg-gray-50"><option value="all">Semua</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option><option value="transfer">Transfer</option></select></div>
            <div><label class="text-xs font-bold text-gray-400">WAKTU</label><select id="filter-time" onchange="toggleCustomDate()" class="w-full p-3 border rounded-xl bg-gray-50"><option value="this_month">Bulan Ini</option><option value="last_month">Bulan Lalu</option><option value="all">Semua Waktu</option><option value="custom">Pilih Tanggal...</option></select></div>
            <div id="custom-date-area" class="hidden grid grid-cols-2 gap-2"><input type="date" id="filter-start" class="p-2 border rounded-xl text-xs"><input type="date" id="filter-end" class="p-2 border rounded-xl text-xs"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <button onclick="applyFilterUI()" class="col-span-2 bg-primary text-white py-3 rounded-xl font-bold">Terapkan Filter</button>
            <button onclick="downloadCSV()" class="bg-green-50 text-green-700 py-3 rounded-xl font-bold text-xs border border-green-200 flex items-center justify-center gap-2"><i class="ph ph-file-csv text-lg"></i> Unduh CSV</button>
            <button onclick="downloadImage()" class="bg-blue-50 text-blue-700 py-3 rounded-xl font-bold text-xs border border-blue-200 flex items-center justify-center gap-2"><i class="ph ph-image text-lg"></i> Unduh Gambar</button>
        </div>
    </div></div>

    <div id="modal-manage-cats" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-manage-cats')"></div><div class="modal-content">
        <h2 class="text-xl font-bold mb-4">Atur Kategori</h2>
        <p class="text-xs text-gray-500 mb-6">Kelola kategori untuk dompet ini.</p>
        <div id="manage-cat-list" class="space-y-2 mb-6 max-h-48 overflow-y-auto"></div>
        <div class="flex gap-2">
            <input type="text" id="new-cat-input" placeholder="Nama kategori baru" class="flex-1 p-3 border rounded-xl text-sm">
            <button onclick="addNewCategoryInternal()" class="bg-primary text-white px-4 rounded-xl font-bold"><i class="ph ph-plus"></i></button>
        </div>
        <button onclick="closeModal('modal-manage-cats')" class="w-full mt-6 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">Selesai</button>
    </div></div>

    <div id="modal-ai" class="modal-wrapper center-modal"><div class="modal-overlay" onclick="closeModal('modal-ai')"></div><div class="modal-content">
        <div class="text-center">
            <div class="w-16 h-16 bg-magic/10 text-magic rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><i class="ph ph-sparkle-fill text-3xl"></i></div>
            <h2 class="text-lg font-bold mb-2">Analisis AI</h2>
            <div id="ai-result" class="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 text-left space-y-2">Memuat analisis...</div>
            <button onclick="closeModal('modal-ai')" class="mt-6 w-full py-3 bg-magic text-white rounded-xl font-bold shadow-lg shadow-purple-200">Terima Kasih</button>
        </div>
    </div></div>
    <div id="modal-chart-filter" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-chart-filter')"></div><div class="modal-content">
        <div class="flex justify-between items-center mb-6"><h2 class="text-xl font-bold">Filter Grafik</h2><button onclick="closeModal('modal-chart-filter')" class="bg-gray-100 p-2 rounded-full"><i class="ph ph-x"></i></button></div>
        <div class="space-y-4 mb-6">
            <div><label class="text-xs font-bold text-gray-400">TAMPILKAN DATA</label><select id="chart-filter-type" class="w-full p-3 border rounded-xl bg-gray-50"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></div>
            <div><label class="text-xs font-bold text-gray-400">WAKTU</label><select id="chart-filter-time" class="w-full p-3 border rounded-xl bg-gray-50"><option value="this_month">Bulan Ini</option><option value="last_month">Bulan Lalu</option><option value="all">Semua Waktu</option></select></div>
        </div>
        <button onclick="applyChartFilter()" class="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200">Terapkan pada Grafik</button>
    </div></div>

    <div id="modal-reset" class="modal-wrapper center-modal"><div class="modal-overlay" onclick="closeModal('modal-reset')"></div><div class="modal-content text-center"><div class="w-16 h-16 bg-red-100 text-danger rounded-full flex items-center justify-center mx-auto mb-4"><i class="ph ph-warning text-3xl"></i></div><h2 class="text-lg font-bold mb-2">Reset Aplikasi?</h2><p class="text-sm text-gray-500 mb-6">Data akan dihapus permanen.</p><div class="grid grid-cols-2 gap-3"><button onclick="closeModal('modal-reset')" class="py-3 rounded-xl border font-bold text-gray-500">Batal</button><button onclick="confirmReset()" class="py-3 rounded-xl bg-danger text-white font-bold">Hapus</button></div></div></div>
    
    <div id="report-render-area" class="fixed top-0 left-[-2000px] w-[600px] bg-white p-10 z-[-1]"><h1 class="text-3xl font-bold text-primary mb-2">Laporan Keuangan</h1><p class="text-gray-500 mb-6" id="rep-period">-</p><div class="grid grid-cols-2 gap-6 mb-6"><div class="bg-green-50 p-4 rounded-xl border border-green-100"><p class="text-xs uppercase text-green-600 font-bold">Masuk</p><h2 class="text-2xl font-bold text-green-700" id="rep-in">0</h2></div><div class="bg-red-50 p-4 rounded-xl border border-red-100"><p class="text-xs uppercase text-red-600 font-bold">Keluar</p><h2 class="text-2xl font-bold text-red-700" id="rep-out">0</h2></div></div><table class="w-full text-left text-sm"><thead class="border-b-2 border-gray-100"><tr><th class="py-2">Tanggal</th><th>Ket</th><th>Tipe</th><th class="text-right">Jml</th></tr></thead><tbody id="rep-list-table"></tbody></table></div>
    
    <div id="toast" class="fixed top-6 left-1/2 -translate-x-1/2 bg-dark text-white px-6 py-3 rounded-full shadow-xl z-[10002] text-sm font-medium transition-all duration-300 opacity-0 translate-y-[-20px] pointer-events-none flex items-center gap-2"><i class="ph ph-check-circle text-secondary text-xl"></i><span id="toast-msg">Berhasil</span></div>
    <div id="modal-profile" class="modal-wrapper"><div class="modal-overlay" onclick="closeModal('modal-profile')"></div><div class="modal-content">
    <h2 class="text-xl font-bold mb-6">Edit Profil</h2>
    <form onsubmit="handleUpdateProfile(event)">
        <div class="space-y-4">
            <div>
                <label class="text-xs font-bold text-gray-400">NAMA LENGKAP</label>
                <input type="text" id="prof-name" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-bold text-dark">
            </div>
            <div>
                <label class="text-xs font-bold text-gray-400">USERNAME</label>
                <input type="text" id="prof-user" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-bold text-dark">
            </div>
            <div>
                <label class="text-xs font-bold text-gray-400">PIN BARU</label>
                <div class="relative">
                    <input type="password" id="prof-pin" class="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-bold text-dark tracking-widest" placeholder="******">
                    
                    <button type="button" onclick="togglePinVisibility()" class="absolute right-0 top-0 bottom-0 px-4 text-gray-400 hover:text-primary flex items-center justify-center">
                        <i id="pin-icon" class="ph ph-eye-slash text-xl"></i>
                    </button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">*Masukkan PIN lama jika tidak ingin mengganti.</p>
            </div>
        </div>
        <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl font-bold mt-6 btn-press shadow-lg shadow-indigo-500/20">Simpan Perubahan</button>
    </form>
</div></div>

</div>

<script src="assets/js/app.js"></script>

</body>
</html>