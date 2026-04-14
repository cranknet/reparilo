interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={[
        "w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
