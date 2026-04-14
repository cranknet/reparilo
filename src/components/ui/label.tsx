interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  htmlFor: string;
}

export function Label({ children, className, htmlFor, ...props }: LabelProps) {
  return (
    <label
      className={[
        "font-bold text-[11px] text-on-surface-variant uppercase tracking-wider",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      htmlFor={htmlFor}
      {...props}
    >
      {children}
    </label>
  );
}
