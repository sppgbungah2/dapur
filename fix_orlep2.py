import re

with open('src/components/OrganoleptikView.tsx', 'r') as f:
    content = f.read()

target = """  return (
    <div className="space-y-6 animate-fade-in" id="orlep-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-emerald-700 shrink-0" />
              Arsip Lembar Pengujian Organoleptik
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              SOP-Aligned
            </span>
          </div>
          <p className="text-sm text-neutral-500">Lembar kendali kualitas rasa, kematangan tekstur makanan, serta kepatuhan thermal suhu kritis CCP hidangan dapur sebelum didistribusikan.</p>
        </div>
      </div>"""

replacement = """  // Grid of Date Cards View
  if (!activeDateView) {
    const dates = [...(allDayMenus || [])].sort((a,b) => a.date.localeCompare(b.date));
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-emerald-700 shrink-0" />
                Arsip Lembar Pengujian Organoleptik
              </h2>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
                SOP-Aligned
              </span>
            </div>
            <p className="text-sm text-neutral-500">Lembar kendali kualitas rasa, kematangan tekstur makanan, serta kepatuhan thermal suhu kritis CCP hidangan dapur sebelum didistribusikan.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {dates.map(mn => {
            const docsForDate = shippingDocs.filter(d => d.type === 'organoleptik').filter(d => d.date === mn.date);
            const totalDocs = docsForDate.length;
            const signedDocs = docsForDate.filter(d => d.orlepSignature).length;
            const hasDocs = totalDocs > 0;
            
            return (
              <div 
                key={mn.date}
                onClick={() => setActiveDateView(mn.date)}
                className="bg-white border border-neutral-200 hover:border-emerald-600 rounded-2xl p-5 shadow-3xs cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] text-neutral-400 font-mono block uppercase tracking-wider mb-1">
                    TANGGAL UJI
                  </span>
                  <h4 className="font-bold text-sm text-neutral-850 group-hover:text-emerald-800 transition-colors">
                    {mn.date}
                  </h4>
                  <p className="text-[10px] text-neutral-500 mt-2">
                    {hasDocs ? `${signedDocs} dari ${totalDocs} Form TTD Lengkap` : 'Organoleptik Belum Diinisiasi'}
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

  const viewDate = activeDateView || selectedDate;
  const localSelectedDate = viewDate;

  return (
    <div className="space-y-6 animate-fade-in" id="orlep-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveDateView(null)}
              className="mr-2 p-1.5 bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Kembali ke Daftar Tanggal"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-emerald-700 shrink-0" />
              Detail Organoleptik: {viewDate}
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              SOP-Aligned
            </span>
          </div>
          <p className="text-sm text-neutral-500">Lembar kendali kualitas rasa, kematangan tekstur makanan, serta kepatuhan thermal suhu kritis CCP hidangan dapur sebelum didistribusikan.</p>
        </div>
      </div>"""

content = content.replace(target, replacement)
content = content.replace("({selectedDate})", "({viewDate})")
content = content.replace("tanggal {selectedDate}.", "tanggal {viewDate}.")
content = content.replace("=== selectedDate", "=== viewDate")
content = content.replace("const initDate = activeDateView || selectedDate;", "const initDate = viewDate;")
content = content.replace("`sppg_portions_${selectedDate}`", "`sppg_portions_${viewDate}`")
content = content.replace("generateInitialDocsAsync(selectedDate", "generateInitialDocsAsync(viewDate")

with open('src/components/OrganoleptikView.tsx', 'w') as f:
    f.write(content)
