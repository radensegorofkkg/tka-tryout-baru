'use client';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Mengubah teks berisi rumus $...$ menjadi HTML. Teks biasa di-escape (aman dari skrip).
export function renderTeks(teks) {
  const t = String(teks ?? '').replace(/\\\$/g, '\u0000');
  return t
    .split(/(\$[^$]+\$)/g)
    .map((bagian) => {
      if (/^\$[^$]+\$$/.test(bagian)) {
        try {
          return katex.renderToString(bagian.slice(1, -1), { throwOnError: false, strict: 'ignore' });
        } catch {
          return esc(bagian);
        }
      }
      return esc(bagian).replace(/\u0000/g, '$').replace(/\n/g, '<br/>');
    })
    .join('');
}

export default function Teks({ children, style }) {
  return <span style={style} dangerouslySetInnerHTML={{ __html: renderTeks(children) }} />;
}
