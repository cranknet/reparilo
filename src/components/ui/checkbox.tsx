interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      className={[
        "h-5 w-5 rounded border-none bg-surface-container-highest text-primary focus:ring-primary/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      type="checkbox"
      {...props}
    />
  );
}
