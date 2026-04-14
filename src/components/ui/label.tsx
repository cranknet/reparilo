interface LabelProps {
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
}

export function Label({ children, className, htmlFor }: LabelProps) {
  return (
    <label
      className={[
        "font-bold text-[11px] text-on-surface-variant uppercase tracking-wider",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}
