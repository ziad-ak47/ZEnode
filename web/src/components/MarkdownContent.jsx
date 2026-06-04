import { useMemo, useEffect } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';

// Configure marked once
marked.setOptions({ breaks: true, gfm: true });

// Syntax-highlight code blocks
const renderer = new marked.Renderer();
renderer.code = (code, lang) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(code, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({ renderer });

// Strip dangerous tags/attrs
function sanitize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '')
    .replace(/ on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

const HLJS_CSS = `
.hljs{background:#282828;color:#ebdbb2;border-radius:6px;padding:12px 14px;overflow-x:auto;font-size:13px;line-height:1.55;font-family:'JetBrains Mono',monospace}
.hljs-keyword,.hljs-selector-tag{color:#fb4934}.hljs-string,.hljs-attr{color:#b8bb26}
.hljs-number,.hljs-literal{color:#d3869b}.hljs-comment{color:#928374;font-style:italic}
.hljs-function,.hljs-title{color:#83a598}.hljs-type,.hljs-class{color:#fabd2f}
.hljs-variable,.hljs-name{color:#fe8019}.hljs-built_in{color:#8ec07c}
`;

const MD_CSS = `
.md-content p{margin:0 0 6px}.md-content p:last-child{margin-bottom:0}
.md-content strong{color:var(--fg);font-weight:700}.md-content em{color:var(--fg2);font-style:italic}
.md-content code{background:var(--bg1);border:1px solid var(--bg2);border-radius:4px;padding:1px 5px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--orange-b)}
.md-content pre{margin:6px 0}.md-content pre code{background:none;border:none;padding:0;font-size:inherit;color:inherit}
.md-content blockquote{border-left:3px solid var(--blue);margin:6px 0;padding:2px 10px;color:var(--fg3);background:rgba(69,133,136,.06);border-radius:0 4px 4px 0}
.md-content ul,.md-content ol{padding-left:20px;margin:4px 0}.md-content li{margin:2px 0}
.md-content a{color:var(--blue-b);text-decoration:underline}
.md-content h1,.md-content h2,.md-content h3{color:var(--fg);font-weight:700;margin:8px 0 4px}
.md-content h1{font-size:1.3em}.md-content h2{font-size:1.15em}.md-content h3{font-size:1em}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.textContent = HLJS_CSS + MD_CSS;
  document.head.appendChild(el);
}

export function MarkdownContent({ text }) {
  useEffect(() => { injectStyles(); }, []);
  const html = useMemo(() => sanitize(marked.parse(text || '')), [text]);
  return (
    <div
      className="md-content"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--fg1)', wordBreak: 'break-word' }}
    />
  );
}
