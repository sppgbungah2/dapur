with open('src/components/OrganoleptikView.tsx', 'r') as f:
    content = f.read()

# I replaced filteredDocsByDate with filteredDocs in OrganoleptikView, let's revert that.
content = content.replace("filteredDocs.length < dateDocs.length", "filteredDocsByDate.length < dateDocs.length")
content = content.replace("Lembar Pengujian Terfilter ({filteredDocs.length} Berkas)", "Lembar Pengujian Terfilter ({filteredDocsByDate.length} Berkas)")
content = content.replace("Menampilkan {filteredDocs.length} dari total {dateDocs.length} berkas hari ini", "Menampilkan {filteredDocsByDate.length} dari total {dateDocs.length} berkas hari ini")
content = content.replace("filteredDocs.length === 0 ?", "filteredDocsByDate.length === 0 ?")
content = content.replace("filteredDocs.map((doc) => {", "filteredDocsByDate.map((doc) => {")

# Then add back the declaration
insert_loc = "  // Dashboard / List View\n"
insert_str = "  // Dashboard / List View\n  const filteredDocsByDate = filteredDocs.filter(d => d.date === viewDate);\n"
content = content.replace(insert_loc, insert_str)

with open('src/components/OrganoleptikView.tsx', 'w') as f:
    f.write(content)
