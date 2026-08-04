import re

with open('src/components/PortionMasterView.tsx', 'r') as f:
    content = f.read()

# Remove the save button block
content = re.sub(r'(\s*<button\s+onClick=\{handleSave\}.*?Simpan Porsi \(\{formattedDate\(\)\}\).*?</button>)', '', content, flags=re.DOTALL)

# Remove the section between 2. DATE SELECTOR and 5. CARDS DECK
content = re.sub(r'(\s*\{\/\* 2\. DATE SELECTOR MODE OPTION \*\/\}.*?)(?=\{\/\* 5\. CARDS DECK)', '', content, flags=re.DOTALL)

with open('src/components/PortionMasterView.tsx', 'w') as f:
    f.write(content)

