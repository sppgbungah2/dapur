with open('src/components/BASTView.tsx', 'r') as f:
    content = f.read()

if "const filteredDocsByDate = filteredDocs.filter" not in content:
    insert_loc = "  // Dashboard / List View\n"
    insert_str = "  // Dashboard / List View\n  const filteredDocsByDate = filteredDocs.filter(d => d.date === viewDate);\n"
    content = content.replace(insert_loc, insert_str)
    with open('src/components/BASTView.tsx', 'w') as f:
        f.write(content)
