import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

type MarkdownProps = {
    content: string;
    className?: string;
};

export function Markdown({ content, className }: MarkdownProps) {
    return (
        <ReactMarkdown
            className={cn('prose prose-invert text-sm break-words', className)}
            components={{
                h1: ({node, ...props}) => <h1 className="text-xl font-bold" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-semibold" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-base font-semibold" {...props} />,
                p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-5" {...props} />,
                li: ({node, ...props}) => <li className="mb-1" {...props} />,
                a: ({node, ...props}) => <a className="text-primary hover:underline" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
