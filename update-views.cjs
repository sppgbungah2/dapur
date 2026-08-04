const fs = require('fs');

['src/components/SuratJalanView.tsx', 'src/components/BASTView.tsx', 'src/components/OrganoleptikView.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Remove the Initialization UI block which looks like this:
  // {/* Init actions if empty */}
  // ... until the next block or end of if empty
  
  // We can just find the button and remove it, or use regex
  
  if (file.includes('SuratJalanView.tsx')) {
    content = content.replace(/\{\/\* Init actions if empty \*\/\}.*?<\/div>/s, '');
  } else if (file.includes('BASTView.tsx')) {
    content = content.replace(/\{\/\* Init actions if empty \*\/\}.*?<\/div>/s, '');
  } else if (file.includes('OrganoleptikView.tsx')) {
    content = content.replace(/<button[^>]*onClick=\{handleInitializeOrlep\}.*?<\/button>/s, '');
    content = content.replace(/<span[^>]*Gunakan tombol Re-Inisialisasi.*?<\/span>/s, '');
  }

  fs.writeFileSync(file, content);
});
