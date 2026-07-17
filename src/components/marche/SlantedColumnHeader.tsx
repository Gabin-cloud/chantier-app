type SlantedColumnHeaderProps = {
  label: string;
  title?: string;
  /** Degrés d'inclinaison (~65 : presque vertical, un peu moins que 90°). */
  angle?: number;
};

/**
 * En-tête de colonne incliné pour tableaux denses (nombreuses pièces admin).
 */
export function SlantedColumnHeader({
  label,
  title,
  angle = 65,
}: SlantedColumnHeaderProps) {
  return (
    <th
      title={title ?? label}
      className="relative h-[7.5rem] w-[2rem] min-w-[2rem] max-w-[2rem] border border-slate-200 bg-slate-50 p-0 align-bottom"
    >
      <div className="flex h-full items-end overflow-visible pb-2 pl-1.5">
        <span
          className="inline-block max-w-[9.5rem] origin-bottom-left whitespace-nowrap text-left text-[10px] font-semibold leading-[1.15] text-slate-600"
          style={{ transform: `rotate(-${angle}deg)` }}
        >
          {label}
        </span>
      </div>
    </th>
  );
}
