import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Update currentSubTab state
content = content.replace(
    "const [currentSubTab, setCurrentSubTab] = useState<'dashboard' | 'create' | 'recap'>('dashboard');",
    "const [currentSubTab, setCurrentSubTab] = useState<'date-grid' | 'dashboard' | 'create' | 'recap'>('date-grid');"
)

# Update the sub tab buttons to include Date Grid
target_buttons = """                {/* Sub Tab selection buttons */}
                <div className="flex border border-neutral-200 bg-neutral-50 p-1 rounded-xl shrink-0 tab-buttons no-print flex-wrap gap-1 sm:gap-0">
                  <button
                    onClick={() => setCurrentSubTab('dashboard')}"""
replacement_buttons = """                {/* Sub Tab selection buttons */}
                <div className="flex border border-neutral-200 bg-neutral-50 p-1 rounded-xl shrink-0 tab-buttons no-print flex-wrap gap-1 sm:gap-0">
                  <button
                    onClick={() => setCurrentSubTab('date-grid')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentSubTab === 'date-grid'
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Kalender SOP
                  </button>
                  <button
                    onClick={() => setCurrentSubTab('dashboard')}"""
content = content.replace(target_buttons, replacement_buttons)

# Add the 'date-grid' render block
target_render = """              {/* Render Selected SubTab */}
              {currentSubTab === 'create' ? ("""

replacement_render = """              {/* Render Selected SubTab */}
              {currentSubTab === 'date-grid' ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
                        <Calendar className="h-6 w-6 text-emerald-800 shrink-0" />
                        Pilih Tanggal SOP Harian
                      </h2>
                      <p className="text-xs text-neutral-500 font-mono">
                        Silakan pilih tanggal untuk mengelola dan mengisi checklist SOP Dapur.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {[...dayMenus].sort((a,b) => a.date.localeCompare(b.date)).map(mn => {
                      const sopsForDate = sops.filter(s => s.date === mn.date);
                      const totalSops = sopsForDate.length;
                      const completedSops = sopsForDate.filter(s => s.status === 'selesai').length;
                      const hasSops = totalSops > 0;
                      
                      return (
                        <div 
                          key={mn.date}
                          onClick={() => {
                            setSelectedDate(mn.date);
                            setCurrentSubTab('dashboard');
                          }}
                          className="bg-white border border-neutral-200 hover:border-emerald-600 rounded-2xl p-5 shadow-3xs cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group flex flex-col justify-between"
                        >
                          <div>
                            <span className="text-[10px] text-neutral-400 font-mono block uppercase tracking-wider mb-1">
                              TANGGAL SOP
                            </span>
                            <h4 className="font-bold text-sm text-neutral-850 group-hover:text-emerald-800 transition-colors">
                              {mn.date}
                            </h4>
                            <p className="text-[10px] text-neutral-500 mt-2">
                              {hasSops ? `${completedSops} dari ${totalSops} SOP Terkunci` : 'SOP Belum Diinisiasi'}
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-end">
                            <span className="text-[10px] font-bold flex items-center gap-1 text-emerald-700">
                              Buka Checklist <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : currentSubTab === 'create' ? ("""

content = content.replace(target_render, replacement_render)

with open('src/App.tsx', 'w') as f:
    f.write(content)
