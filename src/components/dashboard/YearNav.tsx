import { ChevronLeft, ChevronRight } from 'lucide-react';

interface YearNavProps {
  year: number;
  onChange: (delta: number) => void;
}

export function YearNav({ year, onChange }: YearNavProps) {
  return (
    <div className="year-selector">
      <button className="year-btn" onClick={() => onChange(-1)}>
        <ChevronLeft size={20} />
      </button>
      <span className="year-display">{year}</span>
      <button className="year-btn" onClick={() => onChange(1)}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
