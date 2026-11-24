import { Val, evaluate, parse } from './apl';

export interface Case {
  inputs: Record<string, Val>;
  expected: Val;
}

export interface Level {
  id: string;
  title: string;
  brief: string;
  hint: string;
  inputs: string[];
  /** glifos desbloqueados neste nível (parênteses, números e variáveis são sempre livres) */
  allowed: string[];
  /** 'set' ignora ordem/duplicatas; 'exact' compara o vetor inteiro */
  mode: 'set' | 'exact';
  /** solução de referência — usada só para gerar a saída esperada */
  solution: string;
  cases: Case[];
}

type Def = Omit<Level, 'cases'> & { cases: Record<string, Val>[] };

const defs: Def[] = [
  {
    id: 'intersecao',
    title: 'Interseção',
    brief: 'Produza os elementos que estão em A e também em B.',
    hint: 'O símbolo ∩ combina dois conjuntos: A ∩ B.',
    inputs: ['A', 'B'],
    allowed: ['∩'],
    mode: 'set',
    solution: 'A∩B',
    cases: [
      { A: [1, 2, 3, 4, 5], B: [2, 4, 5, 6] },
      { A: [7, 8, 9], B: [1, 2, 3] },
      { A: [1, 3, 5, 7], B: [1, 3, 5, 7] },
      { A: [10, 20, 30], B: [30, 40, 10, 50] },
    ],
  },
  {
    id: 'uniao',
    title: 'União',
    brief: 'Produza todos os elementos que estão em A ou em B (sem repetir).',
    hint: 'A ∪ B reúne os dois conjuntos.',
    inputs: ['A', 'B'],
    allowed: ['∩', '∪'],
    mode: 'set',
    solution: 'A∪B',
    cases: [
      { A: [1, 2, 3], B: [3, 4, 5] },
      { A: [], B: [9, 8] },
      { A: [2, 4, 6], B: [2, 4, 6] },
      { A: [5, 1], B: [1, 7, 5, 3] },
    ],
  },
  {
    id: 'diferenca',
    title: 'Diferença',
    brief: 'Produza os elementos de A que NÃO estão em B.',
    hint: 'Em APL, ~ entre dois valores é "sem": A ~ B. A ordem importa!',
    inputs: ['A', 'B'],
    allowed: ['∩', '∪', '~'],
    mode: 'set',
    solution: 'A~B',
    cases: [
      { A: [1, 2, 3, 4, 5], B: [2, 4] },
      { A: [1, 2], B: [1, 2, 3] },
      { A: [8, 9, 10], B: [] },
      { A: [3, 6, 9, 12], B: [6, 12, 15] },
    ],
  },
  {
    id: 'simetrica',
    title: 'Diferença simétrica',
    brief: 'Produza os elementos que estão em A ou em B, mas não nos dois.',
    hint: 'APL avalia da direita para a esquerda, sem precedência: use parênteses. Pense em (união) sem (interseção).',
    inputs: ['A', 'B'],
    allowed: ['∩', '∪', '~'],
    mode: 'set',
    solution: '(A∪B)~(A∩B)',
    cases: [
      { A: [1, 2, 3, 4], B: [3, 4, 5, 6] },
      { A: [1, 2], B: [1, 2] },
      { A: [], B: [4, 5] },
      { A: [10, 20, 30], B: [20, 40] },
    ],
  },
  {
    id: 'contagem',
    title: 'Quantos em comum?',
    brief: 'A saída é um número: quantos elementos A e B têm em comum.',
    hint: '≢ conta os elementos de um vetor. Lembre: tudo à direita de ≢ é calculado primeiro.',
    inputs: ['A', 'B'],
    allowed: ['∩', '∪', '~', '≢', '⍴'],
    mode: 'exact',
    solution: '≢A∩B',
    cases: [
      { A: [1, 2, 3, 4, 5], B: [2, 4, 5, 6] },
      { A: [1, 2], B: [3, 4] },
      { A: [7, 8, 9], B: [9, 8, 7] },
      { A: [], B: [1] },
    ],
  },
  {
    id: 'soma-uniao',
    title: 'Soma da união',
    brief: 'Some todos os elementos da união de A e B. A saída é um número.',
    hint: '+/ reduz um vetor somando seus elementos. Ex.: +/ 1 2 3 → 6.',
    inputs: ['A', 'B'],
    allowed: ['∩', '∪', '~', '+', '/'],
    mode: 'exact',
    solution: '+/A∪B',
    cases: [
      { A: [1, 2, 3], B: [3, 4] },
      { A: [10, 20], B: [20, 30] },
      { A: [], B: [5] },
      { A: [1, 1, 2], B: [2, 3, 3] },
    ],
  },
];

/** Gera as saídas esperadas executando a solução de referência. */
export const LEVELS: Level[] = defs.map((d) => {
  const ast = parse(d.solution);
  return {
    ...d,
    cases: d.cases.map((inputs) => {
      const r = evaluate(ast, inputs);
      if (!r.result) throw new Error(`Solução de referência falhou em ${d.id}: ${r.error?.message}`);
      return { inputs, expected: r.result };
    }),
  };
});
