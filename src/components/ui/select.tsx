interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={[
        "w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-highest px-4 py-3.5 text-sm outline-none transition-all focus:bg-surface-container-lowest focus-visible:ring-2 focus-visible:ring-primary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
