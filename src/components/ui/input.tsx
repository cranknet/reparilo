import { Icon } from "@/components/ui/icon";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  iconEnd?: string;
  iconStart?: string;
}

export function Input({ iconStart, iconEnd, className, ...props }: InputProps) {
  const hasIconStart = !!iconStart;
  const hasIconEnd = !!iconEnd;

  const inputClasses = [
    "w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20",
    hasIconStart && "ps-12",
    hasIconEnd && "pe-12",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="group relative">
      {iconStart && (
        <Icon
          className="absolute start-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary"
          name={iconStart}
          size="sm"
        />
      )}
      <input className={inputClasses} {...props} />
      {iconEnd && (
        <Icon
          className="absolute end-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          name={iconEnd}
          size="sm"
        />
      )}
    </div>
  );
}
