// Mini-interpretador de APL (subconjunto) para o protótipo do LogicLab.
// Valores são sempre vetores de números (escalar = vetor de 1 elemento).
// Avaliação da direita para a esquerda, sem precedência — como em APL.

export type Val = number[];

export type AplNode =
  | { id: string; kind: 'num'; value: Val }
  | { id: string; kind: 'var'; name: string }
  | { id: string; kind: 'monad'; fn: string; arg: AplNode }
  | { id: string; kind: 'dyad'; fn: string; left: AplNode; right: AplNode };

export class AplError extends Error {
  constructor(message: string, public pos?: number, public nodeId?: string) {
    super(message);
  }
}

/* ───────────────────────── funções primitivas ───────────────────────── */

const bool = (b: boolean) => (b ? 1 : 0);
const unique = (v: Val) => v.filter((x, i) => v.indexOf(x) === i);

function int(x: number): number {
  if (!Number.isInteger(x)) throw new Error('Requer números inteiros.');
  return x;
}
function gcd(a: number, b: number): number {
  a = Math.abs(int(a));
  b = Math.abs(int(b));
  while (b) [a, b] = [b, a % b];
  return a;
}
function zip(a: Val, b: Val, f: (x: number, y: number) => number): Val {
  if (a.length === b.length) return a.map((x, i) => f(x, b[i]));
  if (a.length === 1) return b.map((y) => f(a[0], y));
  if (b.length === 1) return a.map((x) => f(x, b[0]));
  throw new Error(`Comprimentos incompatíveis (${a.length} e ${b.length}).`);
}

const scalar: Record<string, (a: number, b: number) => number> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '×': (a, b) => a * b,
  '÷': (a, b) => {
    if (b === 0) throw new Error('Divisão por zero.');
    return a / b;
  },
  '⌈': (a, b) => Math.max(a, b),
  '⌊': (a, b) => Math.min(a, b),
  '=': (a, b) => bool(a === b),
  '≠': (a, b) => bool(a !== b),
  '<': (a, b) => bool(a < b),
  '>': (a, b) => bool(a > b),
  '≤': (a, b) => bool(a <= b),
  '≥': (a, b) => bool(a >= b),
  '∧': (a, b) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0), // MMC (E para 0/1)
  '∨': (a, b) => gcd(a, b), // MDC (OU para 0/1)
};

const dyadic: Record<string, (a: Val, b: Val) => Val> = {
  ...Object.fromEntries(
    Object.entries(scalar).map(([k, f]) => [k, (a: Val, b: Val) => zip(a, b, f)]),
  ),
  '∩': (a, b) => unique(a.filter((x) => b.includes(x))),
  '∪': (a, b) => unique([...a, ...b]),
  '~': (a, b) => a.filter((x) => !b.includes(x)),
  '∊': (a, b) => a.map((x) => bool(b.includes(x))),
  ',': (a, b) => [...a, ...b],
  '/': (a, b) => {
    // compressão / replicação: (máscara)/vetor
    const m = a.length === 1 && b.length !== 1 ? b.map(() => a[0]) : a;
    if (m.length !== b.length) throw new Error(`Comprimentos incompatíveis (${a.length} e ${b.length}).`);
    return b.flatMap((x, i) => {
      const k = int(m[i]);
      if (k < 0) throw new Error('Contagem negativa em /.');
      return Array<number>(k).fill(x);
    });
  },
};

const monadic: Record<string, (a: Val) => Val> = {
  '-': (a) => a.map((x) => -x),
  '|': (a) => a.map((x) => Math.abs(x)),
  '×': (a) => a.map((x) => Math.sign(x)),
  '⍳': (a) => {
    if (a.length !== 1) throw new Error('⍳ espera um único número.');
    const n = int(a[0]);
    if (n < 0) throw new Error('⍳ espera um número ≥ 0.');
    return Array.from({ length: n }, (_, i) => i + 1); // origem de índice 1
  },
  '⍴': (a) => [a.length],
  '≢': (a) => [a.length],
  '⌽': (a) => [...a].reverse(),
  '∪': unique,
  '~': (a) =>
    a.map((x) => {
      if (x !== 0 && x !== 1) throw new Error('~ espera apenas 0 ou 1.');
      return 1 - x;
    }),
};

const identity: Record<string, Val> = { '+': [0], '-': [0], '×': [1], '∧': [1], '∨': [0], '∪': [], ',': [] };

function reduce(fn: string, a: Val): Val {
  if (!a.length) {
    const id = identity[fn];
    if (!id) throw new Error(`${fn}/ não é definido para vetor vazio.`);
    return id;
  }
  let acc: Val = [a[a.length - 1]];
  for (let i = a.length - 2; i >= 0; i--) acc = dyadic[fn]([a[i]], acc); // direita → esquerda
  return acc;
}

/* ───────────────────── metadados (teclado e rótulos) ───────────────────── */

export interface GlyphInfo {
  glyph: string;
  group: string;
  monad?: string;
  dyad?: string;
  /** tecla após a crase (`) no teclado físico */
  shortcut?: string;
}

export const GLYPHS: GlyphInfo[] = [
  { glyph: '∩', group: 'Conjuntos', dyad: 'Interseção', shortcut: 'c' },
  { glyph: '∪', group: 'Conjuntos', monad: 'Únicos', dyad: 'União', shortcut: 'v' },
  { glyph: '~', group: 'Conjuntos', monad: 'Não', dyad: 'Diferença' },
  { glyph: '∊', group: 'Conjuntos', dyad: 'Pertence', shortcut: 'e' },
  { glyph: '⍳', group: 'Vetores', monad: 'Iota (1…n)', shortcut: 'i' },
  { glyph: '≢', group: 'Vetores', monad: 'Contagem', shortcut: 't' },
  { glyph: '⍴', group: 'Vetores', monad: 'Tamanho', shortcut: 'r' },
  { glyph: '⌽', group: 'Vetores', monad: 'Inverter', shortcut: 'q' },
  { glyph: ',', group: 'Vetores', dyad: 'Concatenar' },
  { glyph: '/', group: 'Vetores', monad: 'Reduzir (f/)', dyad: 'Comprimir' },
  { glyph: '+', group: 'Aritmética', dyad: 'Soma' },
  { glyph: '-', group: 'Aritmética', monad: 'Negar', dyad: 'Subtração' },
  { glyph: '×', group: 'Aritmética', monad: 'Sinal', dyad: 'Produto', shortcut: '-' },
  { glyph: '÷', group: 'Aritmética', dyad: 'Divisão', shortcut: '=' },
  { glyph: '⌈', group: 'Aritmética', dyad: 'Máximo', shortcut: 's' },
  { glyph: '⌊', group: 'Aritmética', dyad: 'Mínimo', shortcut: 'd' },
  { glyph: '|', group: 'Aritmética', monad: 'Valor absoluto' },
  { glyph: '=', group: 'Lógica', dyad: 'Igual', shortcut: '5' },
  { glyph: '≠', group: 'Lógica', dyad: 'Diferente', shortcut: '8' },
  { glyph: '<', group: 'Lógica', dyad: 'Menor', shortcut: '3' },
  { glyph: '>', group: 'Lógica', dyad: 'Maior', shortcut: '7' },
  { glyph: '≤', group: 'Lógica', dyad: 'Menor ou igual', shortcut: '4' },
  { glyph: '≥', group: 'Lógica', dyad: 'Maior ou igual', shortcut: '6' },
  { glyph: '∧', group: 'Lógica', dyad: 'E / MMC', shortcut: '0' },
  { glyph: '∨', group: 'Lógica', dyad: 'OU / MDC', shortcut: '9' },
];

export const SHORTCUTS: Record<string, string> = {
  ...Object.fromEntries(GLYPHS.filter((g) => g.shortcut).map((g) => [g.shortcut!, g.glyph])),
  '2': '¯',
  ']': '⍬',
};

export function describe(fn: string, arity: 1 | 2): string {
  if (fn.length > 1) return `Reduzir ${fn[0]}`;
  const g = GLYPHS.find((x) => x.glyph === fn);
  return (arity === 1 ? g?.monad : g?.dyad) ?? fn;
}

/* ───────────────────────────── tokenizer ───────────────────────────── */

type Tok =
  | { k: 'num'; v: number; pos: number }
  | { k: 'name'; v: string; pos: number }
  | { k: 'fn'; v: string; pos: number }
  | { k: 'lp' | 'rp' | 'zilde'; pos: number };

const FNS = new Set([...Object.keys(dyadic), ...Object.keys(monadic)]);

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '⍝') { while (i < src.length && src[i] !== '\n') i++; continue; } // comentário
    const rest = (re: RegExp) => { re.lastIndex = i; return re.exec(src); };
    let m: RegExpExecArray | null;
    if ((m = rest(/¯?(?:\d+\.?\d*|\.\d+)/y))) {
      out.push({ k: 'num', v: parseFloat(m[0].replace('¯', '-')), pos: i });
      i += m[0].length;
    } else if ((m = rest(/[A-Za-z_]\w*/y))) {
      out.push({ k: 'name', v: m[0], pos: i });
      i += m[0].length;
    } else if (c === '⍬') { out.push({ k: 'zilde', pos: i++ }); }
    else if (c === '(') { out.push({ k: 'lp', pos: i++ }); }
    else if (c === ')') { out.push({ k: 'rp', pos: i++ }); }
    else if (FNS.has(c)) { out.push({ k: 'fn', v: c, pos: i++ }); }
    else throw new AplError(`Símbolo desconhecido: "${c}"`, i);
  }
  return out;
}

/* ─────────────────────────────── parser ─────────────────────────────── */

export function parse(src: string, allowed?: Set<string>): AplNode {
  const toks = tokenize(src);
  let p = 0;
  let seq = 0;
  const nid = () => `n${seq++}`;

  const use = (glyph: string, pos: number) => {
    if (allowed && !allowed.has(glyph))
      throw new AplError(`"${glyph}" ainda não está desbloqueado neste nível.`, pos);
  };

  function operand(): AplNode {
    const t = toks[p];
    if (t.k === 'num') {
      const value: Val = [];
      while (toks[p]?.k === 'num') value.push((toks[p++] as { v: number }).v); // 1 2 3 = vetor
      return { id: nid(), kind: 'num', value };
    }
    if (t.k === 'zilde') { p++; return { id: nid(), kind: 'num', value: [] }; }
    if (t.k === 'name') { p++; return { id: nid(), kind: 'var', name: t.v }; }
    if (t.k === 'lp') {
      p++;
      const inner = expr();
      const close = toks[p];
      if (close?.k !== 'rp') throw new AplError('Falta fechar o parêntese ")".', close?.pos ?? src.length);
      p++;
      return inner;
    }
    throw new AplError('Esperava um valor.', t.pos);
  }

  function expr(): AplNode {
    const t = toks[p];
    if (!t) throw new AplError('Expressão incompleta.', src.length);
    if (t.k === 'rp') throw new AplError('Parêntese ")" inesperado.', t.pos);

    if (t.k === 'fn') {
      // função monádica (ou redução f/)
      p++;
      let fn = t.v;
      const next = toks[p];
      if (next?.k === 'fn' && next.v === '/' && fn !== '/') {
        if (!dyadic[fn]) throw new AplError(`${fn} não pode ser reduzido com /.`, t.pos);
        use(fn, t.pos); use('/', next.pos);
        p++;
        fn += '/';
      } else {
        if (!monadic[fn]) throw new AplError(`${fn} precisa de um valor à esquerda.`, t.pos);
        use(fn, t.pos);
      }
      return { id: nid(), kind: 'monad', fn, arg: expr() };
    }

    const left = operand();
    const n = toks[p];
    if (!n || n.k === 'rp') return left;
    if (n.k === 'fn') {
      p++;
      if (!dyadic[n.v]) throw new AplError(`${n.v} não pode ser usado entre dois valores.`, n.pos);
      use(n.v, n.pos);
      return { id: nid(), kind: 'dyad', fn: n.v, left, right: expr() };
    }
    throw new AplError('Esperava uma função entre dois valores.', n.pos);
  }

  const root = expr();
  if (p < toks.length) throw new AplError('Parêntese ")" inesperado.', toks[p].pos);
  return root;
}

/* ───────────────────────────── avaliação ───────────────────────────── */

export interface EvalResult {
  /** valor de cada nó já calculado (mesmo quando há erro mais adiante) */
  values: Map<string, Val>;
  result?: Val;
  error?: { id: string; message: string };
}

function guard<T>(id: string, f: () => T): T {
  try {
    return f();
  } catch (e) {
    throw e instanceof AplError ? e : new AplError((e as Error).message, undefined, id);
  }
}

export function evaluate(root: AplNode, env: Record<string, Val>): EvalResult {
  const values = new Map<string, Val>();
  const ev = (n: AplNode): Val => {
    let v: Val;
    switch (n.kind) {
      case 'num':
        v = n.value;
        break;
      case 'var': {
        const x = env[n.name];
        if (!x) throw new AplError(`Variável "${n.name}" não existe neste nível.`, undefined, n.id);
        v = x;
        break;
      }
      case 'monad': {
        const a = ev(n.arg);
        v = guard(n.id, () => (n.fn.length > 1 ? reduce(n.fn[0], a) : monadic[n.fn](a)));
        break;
      }
      case 'dyad': {
        const b = ev(n.right); // APL: direita primeiro
        const a = ev(n.left);
        v = guard(n.id, () => dyadic[n.fn](a, b));
        break;
      }
    }
    values.set(n.id, v);
    return v;
  };
  try {
    return { values, result: ev(root) };
  } catch (e) {
    if (e instanceof AplError) return { values, error: { id: e.nodeId ?? root.id, message: e.message } };
    throw e;
  }
}

/* ───────────────────────────── utilitários ───────────────────────────── */

export const countGates = (n: AplNode): number =>
  n.kind === 'monad' ? 1 + countGates(n.arg)
  : n.kind === 'dyad' ? 1 + countGates(n.left) + countGates(n.right)
  : 0;

export const normSet = (v: Val) => [...new Set(v)].sort((a, b) => a - b);

export function sameValue(a: Val, b: Val, mode: 'set' | 'exact'): boolean {
  const x = mode === 'set' ? normSet(a) : a;
  const y = mode === 'set' ? normSet(b) : b;
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

const num = (x: number) => {
  const s = String(Math.round(x * 1e4) / 1e4);
  return s.startsWith('-') ? '¯' + s.slice(1) : s;
};
/** estilo APL: `2 4 5` — vazio é ⍬ (zilde) */
export const fmtApl = (v: Val) => (v.length ? v.map(num).join(' ') : '⍬');
/** estilo conjunto: `{2, 4, 5}` */
export const fmtSet = (v: Val) => '{' + normSet(v).map(num).join(', ') + '}';
