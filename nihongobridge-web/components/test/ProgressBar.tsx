interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export function ProgressBar({ current, total, label = "Test progress" }: ProgressBarProps) {
  const percentage = total ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  return (
    <div className="w-full" aria-label={`${label}: ${current} of ${total}`}>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-sumi/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
      >
        <div
          className="h-full rounded-full bg-vermilion transition-[width] duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
