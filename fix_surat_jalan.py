import re

with open('src/components/SuratJalanView.tsx', 'r') as f:
    content = f.read()

# Replace selectedDate inside the dashboard with viewDate
# Also add back button to the dashboard
target = """    <div className="space-y-6 animate-fade-in" id="sj-dashboard">
      
      {/* 1. Header & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
              <Truck className="h-6 w-6 text-emerald-800 shrink-0" />
              Arsip &amp; Rekapitulasi Surat Jalan Logistik
            </h2>"""

replacement = """    <div className="space-y-6 animate-fade-in" id="sj-dashboard">
      
      {/* 1. Header & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveDateView(null)}
              className="mr-2 p-1.5 bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Kembali ke Daftar Tanggal"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
              <Truck className="h-6 w-6 text-emerald-800 shrink-0" />
              Detail Surat Jalan: {viewDate}
            </h2>"""

content = content.replace(target, replacement)

# Replace other occurrences of selectedDate in the return block with viewDate
content = content.replace("({selectedDate})", "({viewDate})")
content = content.replace("Hari Ini: {selectedDate}", "Hari Ini: {viewDate}")
content = content.replace("tanggal {selectedDate}.", "tanggal {viewDate}.")

# In handleInitializeSuratJalan, use viewDate instead of selectedDate
content = content.replace("const existing = shippingDocs.filter(d => d.type === 'surat_jalan' && d.date === selectedDate);", 
                          "const initDate = activeDateView || selectedDate;\n    const existing = shippingDocs.filter(d => d.type === 'surat_jalan' && d.date === initDate);")
content = content.replace(".eq('date', selectedDate)", ".eq('date', initDate)")
content = content.replace("`sppg_portions_${selectedDate}`", "`sppg_portions_${initDate}`")
content = content.replace("const updatedDocs = await generateInitialDocsAsync(selectedDate, shippingDocs, '', loggedInUser?.email || 'admin@sppg.com', 'surat_jalan');",
                          "const updatedDocs = await generateInitialDocsAsync(initDate, shippingDocs, '', loggedInUser?.email || 'admin@sppg.com', 'surat_jalan');")
content = content.replace("Surat Jalan untuk tanggal {selectedDate}", "Surat Jalan untuk tanggal {initDate}")
content = content.replace("Surat Jalan ${selectedDate}", "Surat Jalan ${initDate}")
content = content.replace("surat_jalan' && d.date === selectedDate", "surat_jalan' && d.date === viewDate")


# Note: filterDate logic uses selectedDate in useEffect, but we want it to use viewDate.
# Wait, actually, let's just make filteredDocsByDate the source of truth for the list view.
content = content.replace("filteredDocs.map(", "filteredDocsByDate.map(")
content = content.replace("filteredDocs.length", "filteredDocsByDate.length")


with open('src/components/SuratJalanView.tsx', 'w') as f:
    f.write(content)
