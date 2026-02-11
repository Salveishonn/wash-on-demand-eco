import { FlaskConical } from "lucide-react";

export type TestFilterMode = "all" | "real" | "test";

interface AdminTestFilterProps {
  value: TestFilterMode;
  onChange: (mode: TestFilterMode) => void;
}

export function AdminTestFilter({ value, onChange }: AdminTestFilterProps) {
  const options: { value: TestFilterMode; label: string }[] = [
    { value: "all", label: "Todo" },
    { value: "real", label: "Reales" },
    { value: "test", label: "Test" },
  ];

  return (
    <div className="flex items-center gap-2">
      <FlaskConical className="w-4 h-4 text-muted-foreground" />
      <div className="flex rounded-lg border border-border overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              value === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
