const fs = require('fs');

let content = fs.readFileSync('src/components/DashboardAdminView.tsx', 'utf8');

// We want to combine SOP generation and Document Initialization into one button.
const combineFunction = `  // Centralized Initialization for ALL Documents
  const handleCentralInitialization = async () => {
    if (!onGenerateSOPs || !setShippingDocs) return;
    
    // 1. Generate SOPs
    const menuStr = hasMenu ? menuItems.join(', ') : 'Nasi Putih, Lauk Gizi, Sayur, Buah';
    const menuArr = hasMenu ? menuItems : ['Nasi Putih', 'Lauk Gizi Masak', 'Sayur Segar', 'Krupuk', 'Buah'];
    onGenerateSOPs(selectedDate, menuArr);

    // 2. Generate BAST, Surat Jalan, Organoleptik
    const uploaderEmail = loggedInUser?.email || 'admin@sppg.com';
    const updatedDocs = await generateInitialDocsAsync(selectedDate, shippingDocs, menuStr, uploaderEmail);
    setShippingDocs(updatedDocs);
    
    setSuccessMsg(\`Berhasil menginisialisasi SEMUA dokumen (SOP, BAST, Surat Jalan, Organoleptik) ke Supabase untuk tanggal \${selectedDate}!\`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };`;

content = content.replace(/\/\/ Explicit document initialization for BAST, Surat Jalan, and Organoleptik[\s\S]*?setTimeout\(\(\) => setSuccessMsg\(null\), 4000\);\n  };/, combineFunction);

content = content.replace(/<button[^>]*onClick=\{handleInitializeDocs\}[^>]*>[\s\S]*?<\/button>/, '');

content = content.replace(/<button[^>]*onClick=\{handleQuickGenerateSOPs\}[^>]*>[\s\S]*?<\/button>/, `
              <button
                onClick={handleCentralInitialization}
                className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-amber-400/30"
              >
                <FileText className="w-4 h-4 text-amber-100" />
                Inisialisasi Semua Dokumen (SOP & Surat)
              </button>
`);

fs.writeFileSync('src/components/DashboardAdminView.tsx', content);
