# LogicLab 2.0 — protótipo estilo *Turing Complete*, com APL

Puzzle de conjuntos: dados `A` e `B`, escreva uma **expressão APL** que produza a saída esperada.
O circuito no centro é só uma visualização (somente leitura) da árvore da expressão.

```
[ header: nível · objetivo · portas/caracteres                 ]
[ editor APL     ][  circuito (readonly)  ][ entradas  A = {…} ]
[                ][  árvore da expressão  ][            B = {…} ]
[ teclado APL    ][                       ][ OUT esperado/atual ]
```

## Executar

Requer Node.js 18+.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # checagem de tipos + build de produção
```

## Como jogar

- Escreva a expressão no editor (ou use o **teclado APL** na tela). Ela é avaliada a cada tecla.
- Atalho no teclado físico: ``` ` ``` + letra (ex.: `` `c `` → ∩, `` `v `` → ∪). Cada tecla do teclado mostra o seu atalho.
- APL avalia **da direita para a esquerda, sem precedência**: `≢A∩B` = `≢(A∩B)`. Use parênteses.
- Passe o mouse sobre um nó para ver o sinal que passa por ele.
- Quando todos os casos de teste passam, clique em **Concluir nível** (ou Enter). Portas e caracteres são o "placar".
- Cada nível desbloqueia só alguns símbolos (teclas bloqueadas ficam tracejadas).
- Progresso e expressões ficam no `localStorage`.

## Níveis

1. Interseção · 2. União · 3. Diferença · 4. Diferença simétrica · 5. Quantos em comum? · 6. Soma da união

## Código

| arquivo | conteúdo |
|---|---|
| `src/apl.ts` | tokenizer, parser, avaliador (valor por nó) e metadados dos símbolos |
| `src/levels.ts` | definição dos níveis; a saída esperada é gerada rodando a solução de referência |
| `src/App.tsx` | estado e layout (editor, painel de I/O, casos de teste, persistência) |
| `src/Circuit.tsx` | circuito SVG somente leitura |
| `src/Keyboard.tsx` | teclado APL |

### Subconjunto de APL implementado

Valores são sempre vetores numéricos (escalar = vetor de 1 elemento; índice começa em 1).

- Monádicas: `∪` únicos · `~` não · `⍳` iota · `≢`/`⍴` tamanho · `⌽` inverter · `-` negar · `|` abs · `×` sinal
- Diádicas: `∩ ∪ ~ ∊ ,` · `+ - × ÷ ⌈ ⌊` · `= ≠ < > ≤ ≥ ∧ ∨` · `/` comprimir
- Redução `f/` (ex.: `+/`, `⌈/`), `⍬` (vetor vazio), `¯` (negativo), comentários com `⍝`.

## Fora do escopo (por ser protótipo)

Matrizes/rank > 1, indexação `A[i]`, atribuição `←`, funções definidas pelo usuário, `⍵⍺`, operadores além de `/`.
O circuito é uma árvore: uma variável usada duas vezes aparece como dois nós de entrada.
