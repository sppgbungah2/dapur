import React from 'react';

interface OfficialStampProps {
  date?: string;
  docNo?: string;
  label?: string;
  className?: string;
}

export const OfficialStamp: React.FC<OfficialStampProps> = ({
  date,
  docNo,
  label = "DOKUMEN RESMI TERKUNCI",
  className = ""
}) => {
  return (
    <div className={`inline-flex flex-col items-center justify-center p-3 border-4 border-double border-red-700/95 rounded-2xl text-red-700 select-none pointer-events-none bg-white/95 shadow-md font-mono font-black text-center uppercase tracking-tight rotate-[-8deg] opacity-95 print:opacity-100 ${className}`}>
      <div className="text-[8px] font-extrabold tracking-widest text-red-800 border-b-2 border-red-700 pb-0.5 w-full">
        ★ YAYASAN PP. QOMARUDDIN ★
      </div>
      <div className="text-[11px] font-black text-red-900 my-1 px-2.5 py-0.5 bg-red-100/90 rounded border border-red-700/80">
        UNIT DAPUR SPPG BUNGAH 2
      </div>
      <div className="text-[9px] font-black text-red-800 tracking-wider flex items-center justify-center gap-1">
        <span className="text-emerald-700 text-xs">✓</span> {label}
      </div>
      {(date || docNo) && (
        <div className="text-[7.5px] font-mono text-red-900 mt-1 pt-0.5 border-t border-dashed border-red-700/60 w-full">
          {date ? `TGL: ${date}` : ''} {docNo ? `• NO: ${docNo}` : ''}
        </div>
      )}
    </div>
  );
};

export default OfficialStamp;
