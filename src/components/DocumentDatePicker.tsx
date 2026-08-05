import { CalendarDays } from 'lucide-react';

interface DocumentDatePickerProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

/** A compact, shared date header for operational document menus. */
export default function DocumentDatePicker({ selectedDate, onSelectDate }: DocumentDatePickerProps) {
  const year = selectedDate ? selectedDate.slice(0, 4) : new Date().getFullYear().toString();

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-2xs print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-800">Tahun Operasional</p>
          <h2 className="text-2xl font-black tracking-tight text-neutral-900">{year}</h2>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-700">
          <CalendarDays className="h-4 w-4 text-emerald-700" />
          <span>Pilih tanggal</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => event.target.value && onSelectDate(event.target.value)}
            className="bg-transparent font-mono text-xs font-bold text-neutral-900 outline-hidden"
            aria-label="Pilih tanggal dokumen"
          />
        </label>
      </div>
    </section>
  );
}
