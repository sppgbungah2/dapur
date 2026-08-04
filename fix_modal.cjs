const fs = require('fs');
const file = 'src/components/DashboardAdminView.tsx';
let code = fs.readFileSync(file, 'utf8');

const startTag = '{sqlModalOpen && (';
const endTag = '    </div>\n  );\n}';

const startIndex = code.indexOf(startTag);
const endIndex = code.lastIndexOf('    </div>');

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + code.substring(endIndex);
  fs.writeFileSync(file, code, 'utf8');
  console.log("Fixed modal!");
} else {
  console.log("Not found");
}
