import { useState } from 'react';

interface CalculatorProps {
  onClose?: () => void;
}

type CalcMode = 'basic' | 'sci';

const PI = Math.PI;
const E = Math.E;

export default function Calculator({ onClose }: CalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [memory, setMemory] = useState(0);
  const [mode, setMode] = useState<CalcMode>('basic');
  const [isRad, setIsRad] = useState(true);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<number | null>(null);

  const toRad = (deg: number) => deg * PI / 180;
  const getCurrentNum = () => parseFloat(display);

  const append = (val: string) => {
    if (waitingForOperand) {
      setDisplay(val === '.' ? '0.' : val);
      setExpression(prev => prev + val);
      setWaitingForOperand(false);
    } else {
      if (val === '.' && display.includes('.')) return;
      const newDisp = display === '0' && val !== '.' ? val : display + val;
      setDisplay(newDisp);
      setExpression(prev => prev + val);
    }
  };

  const appendOp = (op: string) => {
    setWaitingForOperand(true);
    setExpression(prev => prev + op);
    setDisplay(display);
  };

  const clear = () => {
    setDisplay('0');
    setExpression('');
    setWaitingForOperand(false);
  };

  const backspace = () => {
    if (display.length > 1) setDisplay(display.slice(0, -1));
    else setDisplay('0');
  };

  const calculate = () => {
    try {
      let expr = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, String(PI))
        .replace(/e/g, String(E));
      // eslint-disable-next-line no-eval
      const result = Function('"use strict"; return (' + expr + ')')();
      const res = typeof result === 'number' && isFinite(result) ? result : NaN;
      const str = isNaN(res) ? 'Error' : String(parseFloat(res.toFixed(10)));
      setDisplay(str);
      setExpression(str);
      setLastAnswer(isNaN(res) ? null : res);
      setWaitingForOperand(true);
    } catch {
      setDisplay('Error');
      setExpression('');
    }
  };

  const applyFn = (fn: (n: number) => number) => {
    const n = getCurrentNum();
    const result = fn(n);
    const str = isNaN(result) || !isFinite(result) ? 'Error' : String(parseFloat(result.toFixed(10)));
    setDisplay(str);
    setExpression(str);
    setWaitingForOperand(true);
  };

  const trigFn = (fn: 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan') => {
    const n = getCurrentNum();
    let result: number;
    const val = isRad ? n : toRad(n);
    switch (fn) {
      case 'sin': result = Math.sin(val); break;
      case 'cos': result = Math.cos(val); break;
      case 'tan': result = Math.tan(val); break;
      case 'asin': result = isRad ? Math.asin(n) : Math.asin(n) * 180 / PI; break;
      case 'acos': result = isRad ? Math.acos(n) : Math.acos(n) * 180 / PI; break;
      case 'atan': result = isRad ? Math.atan(n) : Math.atan(n) * 180 / PI; break;
      default: result = NaN;
    }
    const str = isNaN(result) || !isFinite(result) ? 'Error' : String(parseFloat(result.toFixed(10)));
    setDisplay(str);
    setExpression(str);
    setWaitingForOperand(true);
  };

  type BtnStyle = 'num' | 'op' | 'func' | 'eq' | 'clear' | 'mem';

  const Btn = ({ label, onClick, style = 'num', span = 1 }: {
    label: string; onClick: () => void; style?: BtnStyle; span?: number;
  }) => {
    const styles: Record<BtnStyle, string> = {
      num: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
      op: 'bg-blue-100 hover:bg-blue-200 text-blue-800',
      func: 'bg-purple-100 hover:bg-purple-200 text-purple-800',
      eq: 'bg-blue-600 hover:bg-blue-700 text-white',
      clear: 'bg-red-100 hover:bg-red-200 text-red-700',
      mem: 'bg-amber-100 hover:bg-amber-200 text-amber-800',
    };
    return (
      <button
        onClick={onClick}
        className={`calc-btn font-semibold text-sm transition-all active:scale-95 ${styles[style]}`}
        style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
        {label}
      </button>
    );
  };

  return (
    <div className="card p-3 shadow-xl" style={{ background: '#1e293b', borderRadius: '1rem' }}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          <button onClick={() => setMode('basic')}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${mode === 'basic' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            基础
          </button>
          <button onClick={() => setMode('sci')}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${mode === 'sci' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            科学
          </button>
          {mode === 'sci' && (
            <button onClick={() => setIsRad(!isRad)}
              className="px-3 py-1 rounded text-xs font-bold text-amber-400 hover:text-amber-300">
              {isRad ? 'RAD' : 'DEG'}
            </button>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        )}
      </div>

      {/* 表达式显示 */}
      <div className="mb-1 px-2 min-h-5">
        <div className="text-gray-500 text-xs text-right truncate font-mono">{expression || ' '}</div>
      </div>

      {/* 主显示屏 */}
      <div className="rounded-xl p-3 mb-3" style={{ background: '#0f172a' }}>
        <div className="text-right">
          <span className="text-white font-mono text-2xl font-bold truncate block">
            {display.length > 12 ? parseFloat(display).toExponential(6) : display}
          </span>
          {lastAnswer !== null && lastAnswer.toString() !== display && (
            <span className="text-gray-500 text-xs">Ans: {lastAnswer}</span>
          )}
        </div>
      </div>

      {/* 科学函数区 */}
      {mode === 'sci' && (
        <div className="grid grid-cols-4 gap-1.5 mb-1.5">
          <Btn label="sin" onClick={() => trigFn('sin')} style="func"/>
          <Btn label="cos" onClick={() => trigFn('cos')} style="func"/>
          <Btn label="tan" onClick={() => trigFn('tan')} style="func"/>
          <Btn label="π" onClick={() => append('π')} style="func"/>
          <Btn label="asin" onClick={() => trigFn('asin')} style="func"/>
          <Btn label="acos" onClick={() => trigFn('acos')} style="func"/>
          <Btn label="atan" onClick={() => trigFn('atan')} style="func"/>
          <Btn label="e" onClick={() => append('e')} style="func"/>
          <Btn label="x²" onClick={() => applyFn(n => n * n)} style="func"/>
          <Btn label="√x" onClick={() => applyFn(Math.sqrt)} style="func"/>
          <Btn label="log" onClick={() => applyFn(Math.log10)} style="func"/>
          <Btn label="ln" onClick={() => applyFn(Math.log)} style="func"/>
          <Btn label="xʸ" onClick={() => appendOp('**')} style="func"/>
          <Btn label="|x|" onClick={() => applyFn(Math.abs)} style="func"/>
          <Btn label="1/x" onClick={() => applyFn(n => 1/n)} style="func"/>
          <Btn label="n!" onClick={() => applyFn(factorial)} style="func"/>
          <Btn label="M+" onClick={() => setMemory(m => m + getCurrentNum())} style="mem"/>
          <Btn label="M-" onClick={() => setMemory(m => m - getCurrentNum())} style="mem"/>
          <Btn label="MR" onClick={() => { setDisplay(String(memory)); setExpression(String(memory)); }} style="mem"/>
          <Btn label="MC" onClick={() => setMemory(0)} style="mem"/>
        </div>
      )}

      {/* 基础按键区 */}
      <div className="grid grid-cols-4 gap-1.5">
        <Btn label="C" onClick={clear} style="clear"/>
        <Btn label="⌫" onClick={backspace} style="clear"/>
        <Btn label="%" onClick={() => applyFn(n => n / 100)} style="op"/>
        <Btn label="÷" onClick={() => appendOp('÷')} style="op"/>
        <Btn label="7" onClick={() => append('7')} />
        <Btn label="8" onClick={() => append('8')} />
        <Btn label="9" onClick={() => append('9')} />
        <Btn label="×" onClick={() => appendOp('×')} style="op"/>
        <Btn label="4" onClick={() => append('4')} />
        <Btn label="5" onClick={() => append('5')} />
        <Btn label="6" onClick={() => append('6')} />
        <Btn label="-" onClick={() => appendOp('-')} style="op"/>
        <Btn label="1" onClick={() => append('1')} />
        <Btn label="2" onClick={() => append('2')} />
        <Btn label="3" onClick={() => append('3')} />
        <Btn label="+" onClick={() => appendOp('+')} style="op"/>
        <Btn label="+/-" onClick={() => applyFn(n => -n)} />
        <Btn label="0" onClick={() => append('0')} />
        <Btn label="." onClick={() => append('.')} />
        <Btn label="=" onClick={calculate} style="eq"/>
      </div>
    </div>
  );
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n > 170) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}
