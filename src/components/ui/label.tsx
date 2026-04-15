interface LabelProps {
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
}

export function Label({ children, className, htmlFor }: LabelProps) {
  return (
    <label
      className={[
        "font-bold text-on-surface-variant text-xs uppercase tracking-wider",
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
