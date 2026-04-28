import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "./code-highlight.css";

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

interface MarkdownRendererProps {
  className?: string;
  content: string;
}

export default function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={className}>
      <Markdown rehypePlugins={rehypePlugins} remarkPlugins={remarkPlugins}>
        {content}
      </Markdown>
    </div>
  );
}
