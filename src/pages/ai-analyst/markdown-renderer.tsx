import { useEffect, useState } from "react";
import "./code-highlight.css";

type MdModule = typeof import("react-markdown");
type PluginModule =
  | typeof import("rehype-highlight")
  | typeof import("remark-gfm");

interface MarkdownRendererProps {
  className?: string;
  content: string;
}

export default function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  const [mod, setMod] = useState<{
    Markdown: MdModule["default"];
    remarkPlugins: PluginModule[];
    rehypePlugins: PluginModule[];
  } | null>(null);

  useEffect(() => {
    Promise.all([
      import("react-markdown"),
      import("rehype-highlight"),
      import("remark-gfm"),
    ]).then(([md, rehype, remark]) => {
      setMod({
        Markdown: md.default,
        remarkPlugins: [remark.default],
        rehypePlugins: [rehype.default],
      });
    });
  }, []);

  if (!mod) {
    return (
      <div className={className}>
        <div className="h-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className={className}>
      <mod.Markdown
        rehypePlugins={mod.rehypePlugins}
        remarkPlugins={mod.remarkPlugins}
      >
        {content}
      </mod.Markdown>
    </div>
  );
}
