import re

with open('src/components/SuratJalanView.tsx', 'r') as f:
    content = f.read()

# Add activeDateView state
if "const [activeDateView, setActiveDateView]" not in content:
    content = content.replace("const [activeDoc, setActiveDoc] = useState<any | null>(null);", 
                              "const [activeDoc, setActiveDoc] = useState<any | null>(null);\n  const [activeDateView, setActiveDateView] = useState<string | null>(null);")

# At the main return (after if (activeDoc) block), check if activeDateView is null
target = "  // Dashboard / List View\n  const totalSJ = filteredDocs.length;"
replacement = """  // Grid of Date Cards View
  if (!activeDateView) {
    // Collect all dates from menus
    const dates = [...allDayMenus].sort((a,b) => a.date.localeCompare(b.date));
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
              <Truck className="h-6 w-6 text-emerald-800 shrink-0" />
              Arsip Surat Jalan Harian
            </h2>
            <p className="text-xs text-neutral-500 font-mono">
              Silakan pilih tanggal untuk melihat atau menginisiasi Surat Jalan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {dates.map(mn => {
            const sjForDate = allSjDocs.filter(d => d.date === mn.date);
            const totalSj = sjForDate.length;
            const signedSj = sjForDate.filter(d => d.sjSignatureAslap && d.sjSignatureReceiver).length;
            const hasSj = totalSj > 0;
            
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
                    {hasSj ? `${signedSj} dari ${totalSj} Surat Jalan TTD Lengkap` : 'Surat Jalan Belum Diinisiasi'}
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
  const totalSJ = filteredDocsByDate.length;
  const completedSJ = filteredDocsByDate.filter(d => d.status === 'Selesai').length;
  const activeSJ = filteredDocsByDate.filter(d => d.status === 'Aktif').length;

  let totalSigsNeeded = totalSJ * 2;
  let filledSigs = 0;
  filteredDocsByDate.forEach(d => {
    if (d.sjSignatureAslap) filledSigs++;
    if (d.sjSignatureReceiver) filledSigs++;
  });
  const complianceScore = totalSigsNeeded > 0 ? Math.round((filledSigs / totalSigsNeeded) * 100) : 100;
  
  // Override selectedDate behavior for internal components
  const localSelectedDate = viewDate;
"""

# Replace in content
if "Grid of Date Cards View" not in content:
    content = content.replace(target, replacement)
    
    # Also we need to replace all occurrences of selectedDate in the dashboard view with localSelectedDate
    # Wait, instead of replacing, I can just redefine selectedDate locally? No, selectedDate is a prop.
    # Let's just fix the dashboard part: 
    # dateDocs should use localSelectedDate
    # But wait, dateDocs is defined at the top. Let's move dateDocs down or just redefine it.
    
with open('src/components/SuratJalanView.tsx', 'w') as f:
    f.write(content)
