import { useMemo, useState } from 'react';
import { AplNode, EvalResult, Val, describe, fmtApl } from './apl';

/** Visualização somente leitura da expressão como circuito (árvore, entradas à esquerda → saída à direita). */

const COL = 160; // distância horizontal entre colunas
const ROW = 92; // distância vertical entre folhas
const PAD = 28;
const W = 92; // largura dos nós

interface LNode { n: AplNode; x: number; y: number; h: number }
interface Wire { from: LNode; to: LNode; slot: number; key: string }

const heightOf = (n: AplNode) => (n.kind === 'dyad' ? 60 : n.kind === 'monad' ? 52 : 36);
const depthOf = (n: AplNode): number =>
  n.kind === 'monad' ? 1 + depthOf(n.arg)
  : n.kind === 'dyad' ? 1 + Math.max(depthOf(n.left), depthOf(n.right))
  : 0;
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

function build(root: AplNode) {
  const nodes: LNode[] = [];
  const wires: Wire[] = [];
  const D = depthOf(root);
  let row = 0;

  const place = (n: AplNode, d: number): LNode => {
    let y: number;
    let kids: LNode[] = [];
    if (n.kind === 'dyad') {
      const l = place(n.left, d + 1);
      const r = place(n.right, d + 1);
      kids = [l, r];
      y = (l.y + r.y) / 2;
    } else if (n.kind === 'monad') {
      const c = place(n.arg, d + 1);
      kids = [c];
      y = c.y;
    } else {
      y = row++ * ROW;
    }
    const ln: LNode = { n, x: (D - d) * COL, y, h: heightOf(n) };
    nodes.push(ln);
    kids.forEach((k, i) => wires.push({ from: k, to: ln, slot: kids.length === 1 ? 0 : i === 0 ? -1 : 1, key: `${k.n.id}>${n.id}` }));
    return ln;
  };

  const rootNode = place(root, 0);
  const out: LNode = { n: root, x: (D + 1) * COL, y: rootNode.y, h: 44 };
  const width = out.x + W;
  const height = (row - 1) * ROW + 70;
  return { nodes, wires, root: rootNode, out, width, height };
}

interface Props {
  ast: AplNode | null;
  ev: EvalResult | null;
  /** a expressão atual é inválida: mostramos a última árvore válida esmaecida */
  stale: boolean;
  outcome: 'ok' | 'bad' | 'none';
  placeholder: string;
}

export function Circuit({ ast, ev, stale, outcome, placeholder }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const g = useMemo(() => (ast ? build(ast) : null), [ast]);

  if (!ast || !g) {
    return (
      <div className="circuit empty">
        <p>{placeholder}</p>
      </div>
    );
  }

  const value = (id: string): Val | undefined => ev?.values.get(id);
  const errId = ev?.error?.id;
  const sig = (id: string) => {
    const v = value(id);
    return id === errId ? 'err' : v === undefined ? 'off' : v.length ? 'on' : 'zero';
  };

  const cw = Math.max(g.width + PAD * 2, 560);
  const ch = Math.max(g.height + PAD * 2, 260);
  const ox = (cw - g.width) / 2;
  const oy = (ch - g.height) / 2 + 34; // folga: nós se estendem ±h/2 ao redor do centro

  const path = (w: Wire) => {
    const x1 = w.from.x + W, y1 = w.from.y;
    const x2 = w.to.x, y2 = w.to.y + w.slot * 12;
    const dx = (x2 - x1) * 0.5;
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  };

  const hoverNode = hover && hover !== 'OUT' ? g.nodes.find((n) => n.n.id === hover)?.n : undefined;
  const hoverVal = hover === 'OUT' ? value(ast.id) : hover ? value(hover) : undefined;

  const label = (n: AplNode) =>
    n.kind === 'var' ? `entrada ${n.name}`
    : n.kind === 'num' ? 'literal'
    : `${n.fn}  ${describe(n.fn, n.kind === 'monad' ? 1 : 2)}`;

  return (
    <div className={'circuit' + (stale ? ' stale' : '')}>
      <svg viewBox={`0 0 ${cw} ${ch}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Circuito da expressão (somente leitura)">
        <g transform={`translate(${ox},${oy})`}>
          {g.wires.map((w) => (
            <path key={w.key} d={path(w)} className={`wire ${sig(w.from.n.id)}`} />
          ))}
          <path
            d={`M${g.root.x + W},${g.root.y} L${g.out.x},${g.out.y}`}
            className={`wire ${outcome === 'bad' ? 'err' : sig(ast.id)}`}
          />

          {g.nodes.map(({ n, x, y, h }) => {
            const s = sig(n.id);
            const v = value(n.id);
            const isLeaf = n.kind === 'var' || n.kind === 'num';
            const cls = `node ${n.kind} ${s}${hover === n.id ? ' hover' : ''}`;
            return (
              <g key={n.id} className={cls} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
                <rect x={x} y={y - h / 2} width={W} height={h} rx={isLeaf ? 18 : 8} className="body" />
                {n.kind === 'var' && <text x={x + W / 2} y={y + 5} className="t-name">{n.name}</text>}
                {n.kind === 'num' && <text x={x + W / 2} y={y + 4} className="t-lit">{clip(fmtApl(n.value), 11)}</text>}
                {(n.kind === 'monad' || n.kind === 'dyad') && (
                  <>
                    <text x={x + W / 2} y={y - 2} className="t-glyph">{n.fn}</text>
                    <text x={x + W / 2} y={y + h / 2 - 8} className="t-sub">
                      {clip(describe(n.fn, n.kind === 'monad' ? 1 : 2), 15)}
                    </text>
                    {n.kind === 'dyad' ? (
                      <>
                        <circle cx={x} cy={y - 12} r={3.5} className="port" />
                        <circle cx={x} cy={y + 12} r={3.5} className="port" />
                      </>
                    ) : (
                      <circle cx={x} cy={y} r={3.5} className="port" />
                    )}
                  </>
                )}
                <circle cx={x + W} cy={y} r={3.5} className="port" />
                {!(n.kind === 'num') && v && (
                  <text x={x + W / 2} y={y + h / 2 + 16} className="t-val">{clip(fmtApl(v), 16)}</text>
                )}
              </g>
            );
          })}

          {/* terminal de saída */}
          <g className={`node out ${outcome}`} onMouseEnter={() => setHover('OUT')} onMouseLeave={() => setHover(null)}>
            <rect x={g.out.x} y={g.out.y - 22} width={W} height={44} rx={8} className="body" />
            <circle cx={g.out.x} cy={g.out.y} r={3.5} className="port" />
            <text x={g.out.x + W / 2} y={g.out.y + 5} className="t-glyph small">OUT</text>
            {value(ast.id) && (
              <text x={g.out.x + W / 2} y={g.out.y + 40} className="t-val">{clip(fmtApl(value(ast.id)!), 16)}</text>
            )}
          </g>
        </g>
      </svg>

      <div className="inspector" aria-live="polite">
        {stale ? (
          <span className="warn">Expressão inválida — exibindo o último circuito válido.</span>
        ) : ev?.error ? (
          <span className="bad">⚠ {ev.error.message}</span>
        ) : hover ? (
          <>
            <b>{hover === 'OUT' ? 'OUT' : label(hoverNode!)}</b>
            <span className="sep">→</span>
            <code>{hoverVal ? fmtApl(hoverVal) : '—'}</code>
          </>
        ) : (
          <span className="dim">Passe o mouse sobre um nó para ver o sinal que passa por ele.</span>
        )}
      </div>
    </div>
  );
}
