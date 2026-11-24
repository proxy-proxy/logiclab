import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AplError, AplNode, EvalResult, SHORTCUTS, Val,
  countGates, evaluate, fmtApl, fmtSet, parse, sameValue,
} from './apl';
import { LEVELS } from './levels';
import { Circuit } from './Circuit';
import { Keyboard } from './Keyboard';

interface Saved {
  level: number;
  exprs: Record<string, string>;
  solved: Record<string, { gates: number; chars: number }>;
}

const KEY = 'logiclab-apl-v2';

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s) return { level: Math.min(Math.max(0, s.level | 0), LEVELS.length - 1), exprs: s.exprs ?? {}, solved: s.solved ?? {} };
  } catch { /* sem storage: segue sem persistir */ }
  return { level: 0, exprs: {}, solved: {} };
}

const countChars = (src: string) => src.replace(/⍝.*$/gm, '').replace(/\s+/g, '').length;

export default function App() {
  const [saved, setSaved] = useState<Saved>(load);
  const [caseIdx, setCaseIdx] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [tick, setTick] = useState(false); // aguardando tecla após a crase
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lastGood = useRef<{ level: string; ast: AplNode } | null>(null);

  const level = LEVELS[saved.level];
  const src = saved.exprs[level.id] ?? '';
  const allowed = useMemo(() => new Set(level.allowed), [level]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ }
  }, [saved]);

  /* ── análise da expressão ── */
  const parsed = useMemo(() => {
    if (!src.trim()) return { kind: 'empty' as const };
    try {
      return { kind: 'ok' as const, ast: parse(src, allowed) };
    } catch (e) {
      if (e instanceof AplError) return { kind: 'error' as const, error: e };
      throw e;
    }
  }, [src, allowed]);

  if (parsed.kind === 'ok') lastGood.current = { level: level.id, ast: parsed.ast };
  else if (parsed.kind === 'empty' || lastGood.current?.level !== level.id) lastGood.current = null;
  const ast = parsed.kind === 'ok' ? parsed.ast : lastGood.current?.ast ?? null;
  const valid = parsed.kind === 'ok';

  const evals = useMemo<EvalResult[] | null>(
    () => (ast ? level.cases.map((c) => evaluate(ast, c.inputs)) : null),
    [ast, level],
  );
  const passes = useMemo(
    () => level.cases.map((c, i) => valid && !!evals?.[i].result && sameValue(evals[i].result!, c.expected, level.mode)),
    [evals, level, valid],
  );
  const allPass = passes.every(Boolean);

  const kase = level.cases[caseIdx];
  const ev = evals?.[caseIdx] ?? null;
  const show = (v: Val) => (level.mode === 'set' ? fmtSet(v) : fmtApl(v));
  const gates = valid ? countGates(parsed.ast) : 0;
  const chars = countChars(src);
  const best = saved.solved[level.id];

  /* ── ações ── */
  const setSrc = (s: string) => {
    setCelebrate(false);
    setSaved((p) => ({ ...p, exprs: { ...p.exprs, [level.id]: s } }));
  };

  const goto = (i: number) => {
    setSaved((p) => ({ ...p, level: Math.min(Math.max(0, i), LEVELS.length - 1) }));
    setCaseIdx(0);
    setCelebrate(false);
  };

  // posição do cursor a restaurar depois da próxima renderização
  // (useLayoutEffect, e não rAF: senão digitar rápido após um atalho insere na posição errada)
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (caret.current !== null && ta) {
      ta.focus();
      ta.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  }, [src]);

  const insert = (s: string) => {
    const ta = taRef.current;
    const a = ta?.selectionStart ?? src.length;
    const b = ta?.selectionEnd ?? a;
    caret.current = a + s.length;
    setSrc(src.slice(0, a) + s + src.slice(b));
  };

  const backspace = () => {
    const ta = taRef.current;
    const a = ta?.selectionStart ?? src.length;
    const b = ta?.selectionEnd ?? a;
    const from = a === b ? Math.max(0, a - 1) : a;
    caret.current = from;
    setSrc(src.slice(0, from) + src.slice(b));
  };

  const complete = () => {
    if (!allPass || !valid) return;
    setSaved((p) => {
      const old = p.solved[level.id];
      return {
        ...p,
        solved: {
          ...p.solved,
          [level.id]: { gates: Math.min(old?.gates ?? Infinity, gates), chars: Math.min(old?.chars ?? Infinity, chars) },
        },
      };
    });
    setCelebrate(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (tick) {
      setTick(false);
      const g = SHORTCUTS[e.key];
      if (g) { e.preventDefault(); insert(g); return; }
    } else if (e.key === '`') {
      e.preventDefault();
      setTick(true);
      return;
    }
    if (e.key === 'Enter') { // uma linha só; Enter conclui se estiver tudo certo
      e.preventDefault();
      complete();
    }
  };

  /* ── resultado da entrada selecionada ── */
  const outcome: 'ok' | 'bad' | 'none' =
    !ev || !valid ? 'none' : ev.result && passes[caseIdx] ? 'ok' : 'bad';

  const nextLevel = saved.level < LEVELS.length - 1;

  return (
    <div className="app">
      {/* ─────────── header ─────────── */}
      <header className="topbar">
        <div className="brand">
          <span className="logo">◈</span>
          <b>LogicLab</b>
          <span className="tag">APL</span>
        </div>

        <div className="levelnav">
          <button className="nav" onClick={() => goto(saved.level - 1)} disabled={saved.level === 0} aria-label="Nível anterior">‹</button>
          <div className="leveltitle">
            <small>NÍVEL {saved.level + 1}/{LEVELS.length}</small>
            <strong>{level.title}</strong>
          </div>
          <button className="nav" onClick={() => goto(saved.level + 1)} disabled={!nextLevel} aria-label="Próximo nível">›</button>
          <div className="pips">
            {LEVELS.map((l, i) => (
              <button
                key={l.id}
                className={'pip' + (i === saved.level ? ' cur' : '') + (saved.solved[l.id] ? ' done' : '')}
                onClick={() => goto(i)}
                title={`${i + 1}. ${l.title}${saved.solved[l.id] ? ' ✓' : ''}`}
              />
            ))}
          </div>
        </div>

        <p className="brief">{level.brief}</p>

        <div className="stats">
          <span>Portas <b>{gates}</b></span>
          <span>Caracteres <b>{chars}</b></span>
          {best && <span className="best">Melhor <b>{best.gates}·{best.chars}</b></span>}
        </div>
      </header>

      <main className="board">
        {/* ─────────── esquerda: editor + teclado ─────────── */}
        <aside className="panel left">
          <section>
            <h2>Expressão</h2>
            <textarea
              ref={taRef}
              className={'editor' + (parsed.kind === 'error' ? ' invalid' : '')}
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => setTick(false)}
              placeholder="ex.: A ∩ B"
              rows={3}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Expressão APL"
              autoFocus
            />
            <div className="status" role="status">
              {tick ? (
                <span className="dim">` + tecla… (ex.: ` c → ∩)</span>
              ) : parsed.kind === 'error' ? (
                <span className="bad">✗ {parsed.error.message}{parsed.error.pos !== undefined && <em> · col. {parsed.error.pos + 1}</em>}</span>
              ) : parsed.kind === 'empty' ? (
                <span className="dim">Digite ou use o teclado abaixo. Da direita para a esquerda!</span>
              ) : (
                <span className="good">✓ expressão válida</span>
              )}
            </div>
            <details className="hint">
              <summary>Dica</summary>
              <p>{level.hint}</p>
            </details>
          </section>

          <section className="kbdwrap">
            <h2>Teclado APL <small>atalho: ` + tecla</small></h2>
            <Keyboard allowed={allowed} onInsert={insert} onBackspace={backspace} onClear={() => setSrc('')} />
          </section>
        </aside>

        {/* ─────────── centro: circuito (somente leitura) ─────────── */}
        <section className="panel center">
          <h2>
            Circuito <span className="ro">somente leitura</span>
          </h2>
          <Circuit
            ast={ast}
            ev={ev}
            stale={parsed.kind === 'error'}
            outcome={outcome}
            placeholder="Escreva uma expressão para ver o circuito."
          />

          {celebrate && (
            <div className="victory" role="dialog" aria-label="Nível concluído">
              <h3>✓ Nível concluído</h3>
              <p>
                <b>{gates}</b> portas · <b>{chars}</b> caracteres
              </p>
              <div className="vbtns">
                <button onClick={() => setCelebrate(false)}>Continuar editando</button>
                {nextLevel && <button className="primary" onClick={() => goto(saved.level + 1)}>Próximo nível →</button>}
              </div>
            </div>
          )}
        </section>

        {/* ─────────── direita: entradas e saída esperada ─────────── */}
        <aside className="panel right">
          <section>
            <h2>Entradas</h2>
            {level.inputs.map((name) => (
              <div className="io in" key={name}>
                <span className="name">{name}</span>
                <span className="eq">=</span>
                <code>{fmtSet(kase.inputs[name])}</code>
              </div>
            ))}
          </section>

          <section>
            <h2>Saída esperada</h2>
            <div className="io out">
              <span className="name">OUT</span>
              <span className="eq">=</span>
              <code>{show(kase.expected)}</code>
            </div>
          </section>

          <section>
            <h2>Saída atual</h2>
            <div className={'io got ' + outcome}>
              <span className="name">OUT</span>
              <span className="eq">=</span>
              <code>
                {!ev ? '—' : ev.error ? 'erro' : show(ev.result!)}
              </code>
              <span className="mark">{outcome === 'ok' ? '✓' : outcome === 'bad' ? '✗' : ''}</span>
            </div>
            {ev?.error && valid && <p className="bad small">{ev.error.message}</p>}
          </section>

          <section>
            <h2>Casos de teste <small>{passes.filter(Boolean).length}/{passes.length}</small></h2>
            <div className="cases">
              {level.cases.map((_, i) => (
                <button
                  key={i}
                  className={'case' + (i === caseIdx ? ' sel' : '') + (valid ? (passes[i] ? ' pass' : ' fail') : '')}
                  onClick={() => setCaseIdx(i)}
                >
                  <span>{i + 1}</span>
                  <i>{valid ? (passes[i] ? '✓' : '✗') : '·'}</i>
                </button>
              ))}
            </div>
            <button className={'primary submit' + (allPass && valid ? ' ready' : '')} disabled={!allPass || !valid} onClick={complete}>
              {best ? 'Enviar de novo' : 'Concluir nível'}
            </button>
            {!allPass && <p className="dim small">Todos os casos precisam passar. Enter também conclui.</p>}
          </section>
        </aside>
      </main>
    </div>
  );
}
