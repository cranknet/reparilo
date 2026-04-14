interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={[
        "w-full resize-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
