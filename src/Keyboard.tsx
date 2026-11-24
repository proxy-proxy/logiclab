import { GLYPHS } from './apl';

interface Props {
  allowed: Set<string>;
  onInsert: (s: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

const GROUPS = ['Conjuntos', 'Vetores', 'Aritmética', 'Lógica'];

export function Keyboard({ allowed, onInsert, onBackspace, onClear }: Props) {
  // mouseDown/preventDefault mantém o foco (e o cursor) no editor
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="kbd">
      {GROUPS.map((group) => {
        const keys = GLYPHS.filter((g) => g.group === group);
        return (
          <div className="kgroup" key={group}>
            <span className="klabel">{group}</span>
            <div className="krow">
              {keys.map((g) => {
                const ok = allowed.has(g.glyph);
                const tip = [
                  g.glyph,
                  g.monad && `monádico: ${g.monad}`,
                  g.dyad && `diádico: ${g.dyad}`,
                  g.shortcut && `atalho: \` + ${g.shortcut}`,
                  !ok && '🔒 bloqueado neste nível',
                ].filter(Boolean).join(' · ');
                return (
                  <button
                    key={g.glyph}
                    className={'key' + (ok ? '' : ' locked')}
                    disabled={!ok}
                    title={tip}
                    onMouseDown={keep}
                    onClick={() => onInsert(g.glyph)}
                  >
                    {g.glyph}
                    {g.shortcut && <i>{g.shortcut}</i>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="kgroup">
        <span className="klabel">Estrutura</span>
        <div className="krow">
          {[
            { s: '(', tip: 'abre parêntese' },
            { s: ')', tip: 'fecha parêntese' },
            { s: '¯', tip: 'menos alto (número negativo) · atalho: ` + 2', k: '2' },
            { s: '⍬', tip: 'zilde: vetor vazio · atalho: ` + ]', k: ']' },
          ].map(({ s, tip, k }) => (
            <button key={s} className="key" onMouseDown={keep} onClick={() => onInsert(s)} title={tip}>
              {s}
              {k && <i>{k}</i>}
            </button>
          ))}
          <button className="key wide" onMouseDown={keep} onClick={onBackspace} title="Apagar">⌫</button>
          <button className="key wide" onMouseDown={keep} onClick={onClear} title="Limpar expressão">Limpar</button>
        </div>
      </div>
    </div>
  );
}
