import re

with open('src/components/BASTView.tsx', 'r') as f:
    content = f.read()

# Add activeDateView state
if "const [activeDateView, setActiveDateView]" not in content:
    content = content.replace("const [activeDoc, setActiveDoc] = useState<any | null>(null);", 
                              "const [activeDoc, setActiveDoc] = useState<any | null>(null);\n  const [activeDateView, setActiveDateView] = useState<string | null>(null);")

target = "  // Dashboard / List View\n  const totalBAST = filteredDocs.length;"
replacement = """  // Grid of Date Cards View
  if (!activeDateView) {
    // Collect all dates from menus
    const dates = [...(allDayMenus || [])].sort((a,b) => a.date.localeCompare(b.date));
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
              <FileText className="h-6 w-6 text-emerald-800 shrink-0" />
              Arsip BAST Logistik Harian
            </h2>
            <p className="text-xs text-neutral-500 font-mono">
              Silakan pilih tanggal untuk melihat atau menginisiasi BAST.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {dates.map(mn => {
            const docsForDate = allBastDocs.filter(d => d.date === mn.date);
            const totalDocs = docsForDate.length;
            const signedDocs = docsForDate.filter(d => d.bastSignatureDriver && d.bastSignatureReceiver).length;
            const hasDocs = totalDocs > 0;
            
            return (
              <div 
                key={mn.date}
                onClick={() => setActiveDateView(mn.date)}
                className="bg-white border border-neutral-200 hover:border-emerald-600 rounded-2xl p-5 shadow-3xs cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] text-neutral-400 font-mono block uppercase tracking-wider mb-1">
                    TANGGAL DISTRIBUSI
                  </span>
                  <h4 className="font-bold text-sm text-neutral-850 group-hover:text-emerald-800 transition-colors">
                    {mn.date}
                  </h4>
                  <p className="text-[10px] text-neutral-500 mt-2">
                    {hasDocs ? `${signedDocs} dari ${totalDocs} BAST TTD Lengkap` : 'BAST Belum Diinisiasi'}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-end">
                  <span className="text-[10px] font-bold flex items-center gap-1 text-emerald-700">
                    Buka Detail <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Dashboard / List View
  const viewDate = activeDateView || selectedDate;
  const filteredDocsByDate = filteredDocs.filter(d => d.date === viewDate);
  const totalBAST = filteredDocsByDate.length;
  const completedBAST = filteredDocsByDate.filter(d => d.status === 'Selesai').length;
  const activeBAST = filteredDocsByDate.filter(d => d.status === 'Aktif').length;

  let totalSigsNeeded = totalBAST * 2;
  let filledSigs = 0;
  filteredDocsByDate.forEach(d => {
    if (d.bastSignatureDriver) filledSigs++;
    if (d.bastSignatureReceiver) filledSigs++;
  });
  const complianceScore = totalSigsNeeded > 0 ? Math.round((filledSigs / totalSigsNeeded) * 100) : 100;
  
  // Override selectedDate behavior for internal components
  const localSelectedDate = viewDate;
"""

if "Grid of Date Cards View" not in content:
    content = content.replace(target, replacement)
    
target_dashboard = """    <div className="space-y-6 animate-fade-in" id="bast-dashboard">
      
      {/* 1. Header & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
              <FileText className="h-6 w-6 text-emerald-800 shrink-0" />
              Arsip &amp; Rekapitulasi BAST
            </h2>"""

replacement_dashboard = """    <div className="space-y-6 animate-fade-in" id="bast-dashboard">
      
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
              <FileText className="h-6 w-6 text-emerald-800 shrink-0" />
              Detail BAST: {viewDate}
            </h2>"""

content = content.replace(target_dashboard, replacement_dashboard)

# Replace other occurrences of selectedDate in the return block with viewDate
content = content.replace("({selectedDate})", "({viewDate})")
content = content.replace("Hari Ini: {selectedDate}", "Hari Ini: {viewDate}")
content = content.replace("tanggal {selectedDate}.", "tanggal {viewDate}.")
content = content.replace("BAST untuk tanggal {selectedDate}", "BAST untuk tanggal {viewDate}")

# In handleInitializeBast, use viewDate instead of selectedDate
content = content.replace("const existing = shippingDocs.filter(d => d.type === 'serah_terima' && d.date === selectedDate);", 
                          "const initDate = activeDateView || selectedDate;\n    const existing = shippingDocs.filter(d => d.type === 'serah_terima' && d.date === initDate);")
content = content.replace(".eq('date', selectedDate)", ".eq('date', initDate)")
content = content.replace("`sppg_portions_${selectedDate}`", "`sppg_portions_${initDate}`")
content = content.replace("const updatedDocs = await generateInitialDocsAsync(selectedDate, shippingDocs, '', loggedInUser?.email || 'admin@sppg.com', 'serah_terima');",
                          "const updatedDocs = await generateInitialDocsAsync(initDate, shippingDocs, '', loggedInUser?.email || 'admin@sppg.com', 'serah_terima');")
content = content.replace("serah_terima' && d.date === selectedDate", "serah_terima' && d.date === viewDate")

content = content.replace("filteredDocs.map(", "filteredDocsByDate.map(")
content = content.replace("filteredDocs.length", "filteredDocsByDate.length")

with open('src/components/BASTView.tsx', 'w') as f:
    f.write(content)
