import re

with open('src/components/PortionMasterView.tsx', 'r') as f:
    content = f.read()

target = """        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadPortions();
              loadAllPortions();
            }}
            disabled={loading}
            className="p-2 border border-neutral-200 rounded-xl bg-white text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-transform active:scale-[0.98] flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : `Simpan Porsi (${formattedDate()})`}
          </button>
        </div>"""

content = content.replace(target, "")

with open('src/components/PortionMasterView.tsx', 'w') as f:
    f.write(content)
