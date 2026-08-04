const fs = require('fs');

let content = fs.readFileSync('src/components/DashboardAdminView.tsx', 'utf8');

content = content.replace(
  "import { createAllInitialShippingDocsForDate } from '../utils/docHelpers';",
  "import { createAllInitialShippingDocsForDate } from '../utils/docHelpers';\nimport { generateInitialDocsAsync } from '../utils/generateDocs';"
);

const handleInitializeDocsReplacement = `// Explicit document initialization for BAST, Surat Jalan, and Organoleptik
  const handleInitializeDocs = async (customMenuStr?: string) => {
    if (!setShippingDocs) return;
    const menuStr = customMenuStr || (hasMenu ? menuItems.join(', ') : 'Nasi Putih, Lauk Gizi, Sayur, Buah');
    const uploaderEmail = loggedInUser?.email || 'admin@sppg.com';
    const updatedDocs = await generateInitialDocsAsync(selectedDate, shippingDocs, menuStr, uploaderEmail);
    
    if (updatedDocs.length === shippingDocs.length) {
      setSuccessMsg(\`Berkas BAST, Surat Jalan, dan Organoleptik tanggal \${selectedDate} sudah lengkap.\`);
    } else {
      setShippingDocs(updatedDocs);
      setSuccessMsg(\`Berhasil menginisialisasi Berkas Digital (BAST, Surat Jalan, Organoleptik) ke Supabase berdasarkan data PM!\`);
    }
    setTimeout(() => setSuccessMsg(null), 4000);
  };`;

content = content.replace(
  /\/\/ Explicit document initialization for BAST, Surat Jalan, and Organoleptik[\s\S]*?setTimeout\(\(\) => setSuccessMsg\(null\), 4000\);\n  };/,
  handleInitializeDocsReplacement
);

fs.writeFileSync('src/components/DashboardAdminView.tsx', content);
