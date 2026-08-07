import React from 'react';
import { Printer, X, FileText, Download, CheckCircle2, ShieldCheck, Truck, Utensils, Award, Users } from 'lucide-react';
import { DayMenu, SOPDocument } from '../types';
import OfficialStamp from './OfficialStamp';
import { PRIMARY_ASLAP_NAME } from '../utils/deliveryMaster';

interface FullDocumentBundlePDFProps {
  selectedDate: string;
  allDayMenus: DayMenu[];
  sops: SOPDocument[];
  shippingDocs: any[];
  onClose: () => void;
}

const OfficialKopSurat = ({ title, docNo }: { title: string; docNo?: string }) => (
  <div className="space-y-2 border-b-4 border-double border-neutral-900 pb-4 mb-4">
    <div className="flex items-center justify-start gap-4">
      <img 
        src="/logo%20yayasan.png"
        alt="Logo Yayasan Qomaruddin"
        className="h-16 w-16 md:h-20 md:w-20 object-contain shrink-0" 
      />
      <div className="text-center flex-1 space-y-1">
        <h3 className="font-extrabold text-neutral-950 text-xs md:text-sm tracking-wide uppercase">
          YAYASAN PONDOK PESANTREN QOMARUDDIN
        </h3>
        <h2 className="font-black text-neutral-900 text-lg md:text-xl tracking-wider uppercase font-display">
          UNIT DAPUR SPPG BUNGAH 2
        </h2>
        <p className="text-[9px] md:text-[10px] text-neutral-500 italic leading-tight">
          Jl. Raya Bungah No.12, Bungah, Gresik, Jawa Timur — Telp: (031) 3949012
        </p>
      </div>
    </div>
    <div className="text-center pt-2">
      <h1 className="font-black text-base md:text-lg text-neutral-950 tracking-wider underline uppercase">
        {title}
      </h1>
      {docNo && (
        <p className="text-xs font-mono font-bold text-neutral-800 mt-0.5">
          NO. DOKUMEN: {docNo}
        </p>
      )}
    </div>
  </div>
);

const organoleptikCriteria = [
  { key: 'rasa', label: 'Citarasa' },
  { key: 'warna', label: 'Warna Alami' },
  { key: 'aroma', label: 'Aroma Harum' },
  { key: 'tekstur', label: 'Tekstur Matang' }
];

export default function FullDocumentBundlePDF({
  selectedDate,
  allDayMenus,
  sops,
  shippingDocs,
  onClose
}: FullDocumentBundlePDFProps) {
  // Filter docs for selectedDate
  const dayMenu = allDayMenus.find(m => m.date === selectedDate);
  const daySjDocs = shippingDocs.filter(d => d.type === 'surat_jalan' && d.date === selectedDate);
  const dayBastDocs = shippingDocs.filter(d => d.type === 'serah_terima' && d.date === selectedDate);
  const dayOrlepDocs = shippingDocs.filter(d => d.type === 'organoleptik' && d.date === selectedDate);
  const daySops = sops.filter(s => s.date === selectedDate);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="full-document-bundle-print-overlay" className="fixed print-overlay-container inset-0 z-50 bg-neutral-900/80 backdrop-blur-sm flex flex-col overflow-y-auto animate-fade-in print:p-0 print:static print:bg-white print:overflow-visible">
      {/* Top Bar - Hidden during print */}
      <div className="sticky top-0 z-50 bg-neutral-900 text-white p-4 border-b border-neutral-800 flex items-center justify-between shadow-lg no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm md:text-base text-white">
              Rekapitulasi Dokumen Lengkap Tanggal {selectedDate}
            </h2>
            <p className="text-xs text-neutral-400">
              Kumpulan Surat Jalan, BAST, Uji Organoleptik, dan SOP Checklist 7 Divisi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak / Unduh Bundle PDF
          </button>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-all cursor-pointer"
            title="Tutup Preview"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-8 bg-white print:p-0 print:m-0 print:max-w-none print:w-full">
        
        {/* ========================================== */}
        {/* SECTION 1: SURAT JALAN (1 document per page) */}
        {/* ========================================== */}
        {daySjDocs.map((doc, idx) => (
          <div 
            key={doc.id || idx}
            className={`p-8 bg-white border border-neutral-300 rounded-2xl shadow-sm space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 ${
              idx > 0 ? 'print-page-break' : ''
            }`}
            style={{ pageBreakBefore: idx > 0 ? 'always' : 'auto', breakBefore: idx > 0 ? 'page' : 'auto' }}
          >
            {/* Header */}
            <OfficialKopSurat title="SURAT JALAN LOGISTIK" docNo={doc.sjNo} />

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs font-sans bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <div>
                <p className="text-neutral-500 font-semibold">Kepada Yth:</p>
                <p className="font-extrabold text-neutral-900 text-sm">{doc.sjKepada || doc.receiverName}</p>
                <p className="text-neutral-600">Tanggal Kirim: <strong>{doc.date}</strong> ({doc.sjWaktu || '06:30 WIB'})</p>
              </div>
              <div>
                <p className="text-neutral-500 font-semibold">Armada & Driver:</p>
                <p className="font-bold text-neutral-900">{doc.sjDriver || 'Ahmad Maghfur'} ({doc.vehicleNumber || 'W 8006 EG'})</p>
                <p className="text-neutral-600">Status: <strong className="text-emerald-700 uppercase">{doc.status || 'Terkirim'}</strong></p>
              </div>
            </div>

            {/* Table Rows */}
            <table className="w-full text-left text-xs border-collapse border border-neutral-900">
              <thead>
                <tr className="bg-neutral-100 text-neutral-900 font-bold border-b border-neutral-900 uppercase tracking-wider text-[10px]">
                  <th className="p-2.5 border-r border-neutral-900 w-12 text-center">No</th>
                  <th className="p-2.5 border-r border-neutral-900">Jenis / Nama Barang</th>
                  <th className="p-2.5 border-r border-neutral-900 text-center w-24">Jumlah Porsi</th>
                  <th className="p-2.5 border-r border-neutral-900 text-center w-24">Peralatan Kirim</th>
                  <th className="p-2.5 border-r border-neutral-900 text-center w-24">Peralatan Kembali</th>
                  <th className="p-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {(doc.sjRows || []).map((row: any, rIdx: number) => (
                  <tr key={rIdx}>
                    <td className="p-2 text-center border-r border-neutral-900 font-mono">{rIdx + 1}</td>
                    <td className="p-2 border-r border-neutral-900 font-bold text-neutral-800">{row.jenis}</td>
                    <td className="p-2 border-r border-neutral-900 text-center font-mono font-bold text-emerald-800">{row.porsi}</td>
                    <td className="p-2 border-r border-neutral-900 text-center font-mono">{row.alatSebelum || row.porsi}</td>
                    <td className="p-2 border-r border-neutral-900 text-center font-mono">{row.alatSesudah || row.porsi}</td>
                    <td className="p-2 text-neutral-600 text-[11px]">{row.keterangan || 'Lengkap & Baik'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-neutral-500 uppercase block">Catatan Driver / Aslap:</span>
              <p className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs text-neutral-800 italic font-mono">
                "{doc.comments || 'Pengiriman makanan terdistribusi aman & tepat waktu menggunakan box insulated.'}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center text-xs font-sans pt-6 relative">
              {(doc.status === 'Terkunci' || doc.status === 'Selesai') && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                  <OfficialStamp date={doc.date} docNo={doc.sjNo} />
                </div>
              )}
              <div className="space-y-12">
                <p className="font-bold text-neutral-700">Pengirim (Aslap Dapur Utama):</p>
                {doc.sjSignatureAslap ? (
                  <img src={doc.sjSignatureAslap} alt="TTD Aslap" className="h-14 mx-auto object-contain" />
                ) : (
                  <div className="h-14 border border-dashed border-neutral-300 rounded flex items-center justify-center text-[10px] text-neutral-400">Berttd Digital</div>
                )}
                <p className="font-bold border-t border-neutral-400 pt-1 mx-8">{PRIMARY_ASLAP_NAME}</p>
              </div>

              <div className="space-y-12">
                <p className="font-bold text-neutral-700">Penerima ({doc.sjKepada}):</p>
                {doc.sjSignatureReceiver ? (
                  <img src={doc.sjSignatureReceiver} alt="TTD Penerima" className="h-14 mx-auto object-contain" />
                ) : (
                  <div className="h-14 border border-dashed border-neutral-300 rounded flex items-center justify-center text-[10px] text-neutral-400">Berttd Digital</div>
                )}
                <p className="font-bold border-t border-neutral-400 pt-1 mx-8">{doc.receiverName || doc.sjKepada}</p>
              </div>
            </div>
          </div>
        ))}

        {/* ========================================== */}
        {/* SECTION 2: BAST (1 document per page) */}
        {/* ========================================== */}
        {dayBastDocs.map((doc, idx) => (
          <div 
            key={doc.id || idx}
            className="p-8 bg-white border border-neutral-300 rounded-2xl shadow-sm space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print-page-break"
            style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
          >
            {/* Header */}
            <OfficialKopSurat title="BERITA ACARA SERAH TERIMA (BAST)" docNo={doc.bastNo} />

            {/* Content */}
            <div className="space-y-3 text-xs leading-relaxed text-neutral-800">
              <p>Pada hari ini tanggal <strong>{doc.date}</strong>, telah dilaksanakan serah terima Makanan Bergizi Gratis antara:</p>

              <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Pihak Pertama (Penyedia Dapur):</p>
                  <p className="font-extrabold text-neutral-900">{doc.bastDriver || 'Ahmad Maghfur'}</p>
                  <p className="text-[11px] text-neutral-600">Dapur Qomaruddin SPPG Bungah 2</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Pihak Kedua (Penerima):</p>
                  <p className="font-extrabold text-neutral-900">{doc.bastPenerima || doc.receiverName}</p>
                  <p className="text-[11px] text-neutral-600">{doc.bastSekolah || doc.receiverName}</p>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-1">
                <p className="font-bold text-emerald-950">Detail Rincian Barang Diserahkan:</p>
                <div className="flex items-center justify-between font-mono text-xs text-emerald-900">
                  <span>Jumlah Paket Makanan:</span>
                  <strong className="text-base text-emerald-800">{doc.bastJumlah || 0} PORSI</strong>
                </div>
                <p className="text-[11px] text-neutral-600">Waktu Penyerahan: <strong>{doc.bastWaktu || '06:30 WIB'}</strong> | Kategori: <strong>PAKET PROGRAM MAKAN BERGIZI GRATIS</strong></p>
              </div>

              <div className="space-y-1 pt-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Keterangan / Catatan Serah Terima:</span>
                <p className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs text-neutral-800 italic font-mono">
                  "{doc.comments || 'Makanan dan perlengkapan Dapur SPPG diterima dalam keadaan lengkap, hangat, higienis, dan baik.'}"
                </p>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 text-center text-xs font-sans pt-8 relative">
              {(doc.status === 'Terkunci' || doc.status === 'Selesai') && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                  <OfficialStamp date={doc.date} docNo={doc.bastNo} />
                </div>
              )}
              <div className="space-y-12">
                <p className="font-bold text-neutral-700">Pihak Pertama (Pengirim):</p>
                {doc.bastSignatureDriver ? (
                  <img src={doc.bastSignatureDriver} alt="TTD Driver" className="h-14 mx-auto object-contain" />
                ) : (
                  <div className="h-14 border border-dashed border-neutral-300 rounded flex items-center justify-center text-[10px] text-neutral-400">Berttd Digital</div>
                )}
                <p className="font-bold border-t border-neutral-400 pt-1 mx-8">{doc.bastDriver || 'Ahmad Maghfur'}</p>
              </div>

              <div className="space-y-12">
                <p className="font-bold text-neutral-700">Pihak Kedua (Penerima):</p>
                {doc.bastSignatureReceiver ? (
                  <img src={doc.bastSignatureReceiver} alt="TTD Penerima" className="h-14 mx-auto object-contain" />
                ) : (
                  <div className="h-14 border border-dashed border-neutral-300 rounded flex items-center justify-center text-[10px] text-neutral-400">Berttd Digital</div>
                )}
                <p className="font-bold border-t border-neutral-400 pt-1 mx-8">{doc.bastPenerima || doc.receiverName}</p>
              </div>
            </div>
          </div>
        ))}

        {/* ========================================== */}
        {/* SECTION 3: UJI ORGANOLEPTIK (1 doc per page) */}
        {/* ========================================== */}
        {dayOrlepDocs.map((doc, idx) => (
          <div 
            key={doc.id || idx}
            className="p-8 bg-white border border-neutral-300 rounded-2xl shadow-sm space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print-page-break"
            style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
          >
            {/* Header */}
            <OfficialKopSurat title="FORM UJI ORGANOLEPTIK & KELAYAKAN SENSORIK" docNo={`ORLEP-${doc.date}`} />

            <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <div>
                <p className="text-neutral-500 font-semibold">Lembaga / Tujuan:</p>
                <p className="font-extrabold text-neutral-900">{doc.orlepDesa || doc.receiverName}</p>
                <p className="text-neutral-600">Panelis Organoleptik: <strong>{doc.orlepPanelis || 'Panelis Organoleptik'}</strong></p>
              </div>
              <div>
                <p className="text-neutral-500 font-semibold">Hari / Tanggal Uji:</p>
                <p className="font-extrabold text-neutral-900">{doc.date}</p>
                <p className="text-neutral-600">Jam Uji: <strong>{doc.orlepJam || '06:00 WIB'}</strong></p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-xs text-neutral-800">Menu Hidangan Dites:</p>
              <div className="p-3 bg-neutral-100 rounded-lg text-xs font-medium text-neutral-800 border border-neutral-200">
                {doc.orlepMenu || (dayMenu?.menuList.join(', ')) || 'Nasi Putih, Lauk Utama, Sayur, Buah'}
              </div>
            </div>

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2 text-xs">
              <p className="font-bold text-neutral-900">Catatan Evaluasi Organoleptik:</p>
              <p className="italic text-neutral-700 font-serif bg-white p-3 rounded-lg border border-neutral-200">
                "{doc.orlepKritik || 'Suhu hangat terjaga prima, rasa gurih seimbang, hidangan segar layak konsumsi.'}"
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-xs text-neutral-800">Tabel Penilaian Mutu Sensorik (Uji Panelis)</p>
              <table className="w-full text-left text-xs border-collapse border border-neutral-300">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700 font-bold text-center">
                    <th className="p-2 border-r border-neutral-300 text-left">Komponen Gizi Hidangan</th>
                    {organoleptikCriteria.map(criterion => <th key={criterion.key} className="p-2 border-r border-neutral-300">{criterion.label}</th>)}
                    <th className="p-2">Rata-Rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-center">
                  {[
                    ['MP', `Makanan Pokok (${dayMenu?.menuList?.[0] || 'Nasi Putih'})`],
                    ['LH', `Lauk Hewani (${dayMenu?.menuList?.[1] || 'Lauk Protein'})`],
                    ['LN', `Lauk Nabati (${dayMenu?.menuList?.[2] || 'Tahu/Tempe'})`],
                    ['SY', `Sayur Hidangan (${dayMenu?.menuList?.[3] || 'Sayuran'})`],
                    ['B', `Buah / Susu (${dayMenu?.menuList?.[4] || 'Buah/Susu'})`]
                  ].map(([code, label]) => {
                    const grid = doc.orlepGrid || {};
                    const scores = organoleptikCriteria.map(criterion => Number(grid[`${code}_${criterion.key}`]) || 4);
                    const average = (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1);
                    return (
                      <tr key={code}>
                        <td className="p-2 border-r border-neutral-300 font-bold text-neutral-800">{label}</td>
                        {scores.map((score, scoreIndex) => <td key={organoleptikCriteria[scoreIndex].key} className="p-2 border-r border-neutral-300 font-mono">{score} / 5</td>)}
                        <td className="p-2 font-black text-emerald-800 bg-emerald-50/40">{average}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Signature */}
            <div className="text-right text-xs pt-6 relative">
              {(doc.status === 'Terkunci' || doc.status === 'Selesai') && (
                <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                  <OfficialStamp date={doc.date} docNo={doc.orlepNo || `ORLEP-${doc.date}`} />
                </div>
              )}
              <div className="inline-block text-center w-64 space-y-12">
                <p className="font-bold text-neutral-700">Penguji / Panelis Checker:</p>
                {doc.orlepSignature ? (
                  <img src={doc.orlepSignature} alt="TTD QC" className="h-14 mx-auto object-contain" />
                ) : (
                  <div className="h-14 border border-dashed border-neutral-300 rounded flex items-center justify-center text-[10px] text-neutral-400">Berttd Digital</div>
                )}
                <p className="font-bold border-t border-neutral-400 pt-1">{doc.orlepPanelis || 'Panelis Organoleptik'}</p>
              </div>
            </div>
          </div>
        ))}

        {/* ========================================== */}
        {/* SECTION 4: SOP CHECKLIST 7 DIVISI (1 div per page) */}
        {/* ========================================== */}
        {daySops.map((sopDoc, idx) => (
          <div 
            key={sopDoc.id || idx}
            className="p-8 bg-white border border-neutral-300 rounded-2xl shadow-sm space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print-page-break"
            style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
          >
            {/* Header */}
            <OfficialKopSurat title={`CHECKLIST SOP HARIAN DIVISI ${sopDoc.division.toUpperCase()}`} docNo={`SOP-${sopDoc.division.toUpperCase()}-${sopDoc.date}`} />

            <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <div>
                <p className="text-neutral-500 font-semibold">Penanggung Jawab:</p>
                <p className="font-extrabold text-neutral-900">{sopDoc.creatorName} ({sopDoc.creatorRole})</p>
              </div>
              <div>
                <p className="text-neutral-500 font-semibold">Status SOP:</p>
                <p className="font-extrabold text-emerald-700 uppercase">
                  {sopDoc.isCheckedAll ? '🟢 LENGKAP 100%' : '🟡 PROSES CHECKLIST'}
                </p>
              </div>
            </div>

            {/* Checklist Table */}
            <table className="w-full text-left text-xs border-collapse border border-neutral-900">
              <thead>
                <tr className="bg-neutral-100 text-neutral-900 font-bold border-b border-neutral-900 uppercase tracking-wider text-[10px]">
                  <th className="p-2.5 border-r border-neutral-900 w-12 text-center">No</th>
                  <th className="p-2.5 border-r border-neutral-900">Butir Pekerjaan Standard SOP</th>
                  <th className="p-2.5 border-r border-neutral-900 text-center w-28">Status Centang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {(sopDoc.tasks || []).map((t, tIdx) => (
                  <tr key={t.id || tIdx}>
                    <td className="p-2 text-center border-r border-neutral-900 font-mono">{tIdx + 1}</td>
                    <td className="p-2 border-r border-neutral-900 text-neutral-800">{t.text || (t as any).title}</td>
                    <td className="p-2 text-center font-bold text-emerald-700 font-mono">
                      {t.completed ? '✓ SELESAI' : '— BELUM'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 text-center text-xs font-sans pt-6 relative">
              {(sopDoc.isCheckedAll || sopDoc.status === 'selesai' || (sopDoc.status as string) === 'Terkunci') && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                  <OfficialStamp date={sopDoc.date} docNo={`SOP-${sopDoc.division.toUpperCase()}`} />
                </div>
              )}
              <div className="space-y-12">
                <p className="font-bold text-neutral-700">Koordinator Divisi:</p>
                {sopDoc.signatureCoordinatorUrl ? (
                  <img src={sopDoc.signatureCoordinatorUrl} alt="TTD Koordinator" className="h-14 mx-auto object-contain" />
                ) : (
                  <div className="h-14 border border-dashed border-neutral-300 rounded flex items-center justify-center text-[10px] text-neutral-400">Berttd Digital</div>
                )}
                <p className="font-bold border-t border-neutral-400 pt-1 mx-8">{sopDoc.signerCoordinator || sopDoc.creatorName}</p>
              </div>

              <div className="space-y-12">
                <p className="font-bold text-neutral-700">Supervisor / Aslap:</p>
                {sopDoc.signatureSupervisorUrl ? (
                  <img src={sopDoc.signatureSupervisorUrl} alt="TTD Supervisor" className="h-14 mx-auto object-contain" />
                ) : (
                  <div className="h-14 border border-dashed border-neutral-300 rounded flex items-center justify-center text-[10px] text-neutral-400">Berttd Digital</div>
                )}
                <p className="font-bold border-t border-neutral-400 pt-1 mx-8">{sopDoc.signerSupervisor || 'Ahmad Maghfur'}</p>
              </div>
            </div>
          </div>
        ))}

      </div>

      {/* Floating Bottom Sticky Action Bar */}
      <div className="sticky bottom-0 z-50 bg-neutral-900/95 backdrop-blur-md text-white p-4 border-t border-neutral-800 flex items-center justify-between no-print shadow-2xl">
        <div className="text-xs text-neutral-300 hidden sm:block font-medium">
          💡 Gunakan tombol <strong className="text-emerald-400 font-bold">Cetak / Simpan PDF</strong> lalu pilih <strong className="text-white">"Save as PDF"</strong> pada dialog print browser Anda.
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ CETAK / SIMPAN BUNDLE PDF</span>
          </button>
          <button
            onClick={onClose}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-bold text-xs px-4 py-3 rounded-xl transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
