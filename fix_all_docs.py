import re
import os

files = ['src/components/SuratJalanView.tsx', 'src/components/BASTView.tsx', 'src/components/OrganoleptikView.tsx']

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # Find the viewDate declaration that was further down
    # First, let's remove any existing `const viewDate = activeDateView || selectedDate;` 
    content = re.sub(r"^[ \t]*const viewDate = activeDateView \|\| selectedDate;[ \t]*\n", "", content, flags=re.MULTILINE)
    
    # Also remove `const localSelectedDate = viewDate;`
    content = re.sub(r"^[ \t]*const localSelectedDate = viewDate;[ \t]*\n", "", content, flags=re.MULTILINE)

    # Now, find `const [activeDateView, setActiveDateView] = useState<string | null>(null);`
    # and insert `const viewDate = activeDateView || selectedDate;\n  const localSelectedDate = viewDate;` after it.
    
    insert_str = "  const [activeDateView, setActiveDateView] = useState<string | null>(null);\n  const viewDate = activeDateView || selectedDate;\n  const localSelectedDate = viewDate;"
    
    content = re.sub(
        r"  const \[activeDateView, setActiveDateView\] = useState<string \| null>\(null\);",
        insert_str,
        content
    )
    
    with open(file, 'w') as f:
        f.write(content)
        
    print(f"Fixed {file}")
