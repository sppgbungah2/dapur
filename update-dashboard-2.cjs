const fs = require('fs');

let content = fs.readFileSync('src/components/DashboardAdminView.tsx', 'utf8');

// Replace handleInitializeDocs with handleCentralInitialization
content = content.replace(/onClick=\{\(\) => handleInitializeDocs\(\)\}/g, 'onClick={handleCentralInitialization}');
content = content.replace(/handleInitializeDocs\(defaultMenu\.join\(', '\)\);/g, 'handleCentralInitialization();');
content = content.replace(/Inisialisasi Surat \(BAST, SJ, Orlep\)/g, 'Inisialisasi Semua Dokumen (SOP & Surat)');

fs.writeFileSync('src/components/DashboardAdminView.tsx', content);
