import React, { useState } from 'react';
import { 
  ClipboardCheck, Search, Filter, Calendar, CheckSquare, Eye, Printer, ShieldAlert, FileMinus, Trash2
} from 'lucide-react';
import { SOPDocument, Division, UserRole } from '../types';

interface SOPRecapProps {
  sops: SOPDocument[];
  onSelectSOP: (sop: SOPDocument) => void;
  onDeleteSOP?: (sopId: string) => void;
}

export default function SOPRecap({ sops, onSelectSOP, onDeleteSOP }: SOPRecapProps) {
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Calculate General Aggregated Metrics
  const totalSOPs = sops.length;
  const completedSOPs = sops.filter(s => s.status === 'selesai').length;
  const activeSOPs = sops.filter(s => s.status === 'aktif').length;
  
  // Calculate total task checklist compliance
  let totalTasks = 0;
  let finishedTasks = 0;
  sops.forEach(s => {
    totalTasks += s.tasks.length;
    finishedTasks += s.tasks.filter(t => t.completed).length;
  });
  const complianceRate = totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 100;

  // 2. Filter SOP list
  const filteredSOPs = sops.filter(sop => {
    const matchesDiv = filterDivision === 'all' || sop.division === filterDivision;
    const matchesStatus = filterStatus === 'all' || sop.status === filterStatus;
    const matchesQuery = searchQuery.trim() === '' || 
      sop.signerSupervisor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sop.signerCoordinator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sop.division.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sop.date.includes(searchQuery);

    return matchesDiv && matchesStatus && matchesQuery;
  });

  // Helper date formatter
  const formatIndoDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[date.getDay()]}, ${parts[2]} ${months[date.getMonth()]} ${parts[0]}`;
  };

  return (
    <div className="space-y-6">
      {/* Aggregated Performance Scorecard Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs flex flex-col justify-between">
          <span className="text-neutral-400 font-medium text-xs block uppercase tracking-wider">Total Form SOP</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-neutral-800">{totalSOPs}</span>
            <span className="text-[10px] text-neutral-400 font-mono">Berkas</span>
          </div>
        </div>
        
        <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100/50 flex flex-col justify-between">
          <span className="text-emerald-800/80 font-semibold text-xs block uppercase tracking-wider">SOP Terkunci</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-800">{completedSOPs}</span>
            <span className="text-[10px] text-emerald-500 font-mono font-bold">Kunci</span>
          </div>
        </div>

        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100/50 flex flex-col justify-between">
          <span className="text-amber-800/80 font-semibold text-xs block uppercase tracking-wider">Sedang Berjalan</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-amber-700">{activeSOPs}</span>
            <span className="text-[10px] text-amber-500 font-mono font-bold">Eksis</span>
          </div>
        </div>

        <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50 flex flex-col justify-between">
          <span className="text-indigo-800/80 font-semibold text-xs block uppercase tracking-wider">Skor Kepatuhan</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-indigo-800">{complianceRate}%</span>
            <span className="text-[10px] text-indigo-500 font-mono font-bold">Tasks</span>
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-4">
        <h3 className="font-bold text-neutral-800 text-sm font-display flex items-center gap-1.5 border-b border-neutral-100 pb-2.5">
          <Filter className="h-4 w-4 text-emerald-700" />
          Filter & Cari Bank Rekapitulasi SOP
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          {/* Search Input bar */}
          <div className="relative flex-1 md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Cari TTD / Tanggal (YYYY-MM-DD)..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg text-xs bg-neutral-50/50 outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Division selection */}
          <select
            value={filterDivision}
            onChange={e => setFilterDivision(e.target.value)}
            className="border border-neutral-200 bg-neutral-50/50 rounded-lg px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">Semua Divisi (7 Divisi)</option>
            {Object.values(Division).map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>

          {/* Status Selection */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-neutral-200 bg-neutral-50/50 rounded-lg px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">Semua Status</option>
            <option value="aktif">Sedang Berjalan (Aktif)</option>
            <option value="selesai">Sudah TTD & Dikunci (Selesai)</option>
          </select>
        </div>
      </div>

      {/* Main Records log Table */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-xs overflow-hidden">
        {filteredSOPs.length === 0 ? (
          <div className="p-16 text-center text-xs text-neutral-400 space-y-2">
            <ShieldAlert className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="font-semibold text-neutral-600 text-sm">Arsip Berkas Kosong</p>
            <p className="max-w-xs mx-auto text-neutral-400">Tidak ada berkas SOP yang cocok dengan filter pencarian Anda di dalam pangkalan data SPPG.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70 text-xs text-neutral-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-5">Hari, Tanggal</th>
                  <th className="py-4 px-5">Divisi Pelaksana</th>
                  <th className="py-4 px-5 text-center">Progress / Compliance</th>
                  <th className="py-4 px-5 font-mono">Supervisor (Pembuat)</th>
                  <th className="py-4 px-5 font-mono">Koordinator (Lapangan)</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5 text-right no-print">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {filteredSOPs.map((sop) => {
                  const completedCount = sop.tasks.filter(t => t.completed).length;
                  const totalCount = sop.tasks.length;
                  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                  
                  return (
                    <tr key={sop.id} className="hover:bg-neutral-50/40 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-5 font-semibold text-neutral-900 select-none">
                        {formatIndoDate(sop.date)}
                      </td>
                      {/* Division */}
                      <td className="py-3.5 px-5">
                        <span className="font-bold text-neutral-800">{sop.division.split(' ')[0]}</span>
                        <span className="text-[10px] text-neutral-400 block font-sans">{sop.division}</span>
                      </td>
                      {/* Compliance Performance Slider */}
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-extrabold text-[#0f5132]">{completedCount} / {totalCount} ({pct}%)</span>
                          {/* Minimal bar chart inside cell */}
                          <div className="w-24 bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${pct === 100 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {/* Creator */}
                      <td className="py-3.5 px-5 font-medium">
                        {sop.signerSupervisor}
                        {sop.signatureSupervisorUrl ? (
                          <span className="text-[9px] text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded-xs block w-fit mt-1 uppercase font-bold font-mono">SIGNED ✓</span>
                        ) : (
                          <span className="text-[9px] text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded-xs block w-fit mt-1 uppercase font-semibold font-mono">PENDING TTD</span>
                        )}
                      </td>
                      {/* Coordinator */}
                      <td className="py-3.5 px-5 font-medium">
                        {sop.signerCoordinator}
                        {sop.signatureCoordinatorUrl ? (
                          <span className="text-[9px] text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded-xs block w-fit mt-1 uppercase font-bold font-mono">SIGNED ✓</span>
                        ) : (
                          <span className="text-[9px] text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded-xs block w-fit mt-1 uppercase font-semibold font-mono">PENDING TTD</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold border ${
                          sop.status === 'selesai'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {sop.status === 'selesai' ? 'TERKUNCI' : 'AKTIF'}
                        </span>
                      </td>
                      {/* Action buttons */}
                      <td className="py-3.5 px-5 text-right no-print">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectSOP(sop)}
                            className="text-white bg-emerald-800 hover:bg-emerald-950 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Buka
                          </button>
                          {onDeleteSOP && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Hapus berkas SOP ${sop.division} tanggal ${formatIndoDate(sop.date)}? Berkas SOP yang dihapus tidak dapat dikembalikan.`)) {
                                  onDeleteSOP(sop.id);
                                }
                              }}
                              className="text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              title="Hapus SOP"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              <span className="hidden sm:inline">Hapus</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
