import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SUB_TYPE } from '../../constants/chat.ts';
import './Text.css';

export const messageType = SUB_TYPE.PLAIN_TEXT;

const hasMarkdownSyntax = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const lines = value.split(/\r?\n/);
  const hasBlockSyntax = lines.some((line, index) => {
    const isTableSeparator = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
    const hasTableHeader = index > 0 && /\|/.test(lines[index - 1]);

    return (
      /^\s{0,3}#{1,6}\s+\S+/.test(line) ||
      /^\s{0,3}(?:[-*+]|\d{1,9}[.)])\s+\S+/.test(line) ||
      /^\s{0,3}>\s?\S+/.test(line) ||
      /^\s{0,3}(?:---+|\*\*\*+|___+)\s*$/.test(line) ||
      /^\s{0,3}(?:```|~~~)/.test(line) ||
      (isTableSeparator && hasTableHeader)
    );
  });

  return (
    hasBlockSyntax ||
    /\*\*[\S](?:.*?[\S])?\*\*/.test(value) ||
    /__[\S](?:.*?[\S])?__/.test(value) ||
    /(?<![*\w])\*(?!\s)[^*\n]+(?<!\s)\*(?![\w*])/.test(value) ||
    /(?<![\w_])_(?!\s)[^_\n]+(?<!\s)_(?!\w)/.test(value) ||
    /~~[\S](?:.*?[\S])?~~/.test(value) ||
    /`+[^`\n]+`+/.test(value) ||
    /!?\[[\S](?:.*?[\S])?]\([^)\n]+\)/.test(value) ||
    /<https?:\/\/[^>\n]+>/.test(value) ||
    /\[\^[^\]\n]+\]/.test(value)
  );
};

const Text = ({ content }) => {
  if (!hasMarkdownSyntax(content)) {
    return <div className="markdown-plain">{content}</div>;
  }

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} breaks>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default Text;
