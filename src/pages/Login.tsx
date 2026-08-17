import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import Logo from '../components/Logo';

export default function Login() {
  const location = useLocation();
  const initialMode = (location.state as { mode?: string } | null)?.mode === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tradingExperience, setTradingExperience] = useState(5);
  const [techComfort, setTechComfort] = useState(5);
  const [goal, setGoal] = useState('');
  const [robot, setRobot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAccountStore((s) => s.login);
  const register = useAccountStore((s) => s.register);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !password || !confirm) {
        setError('Completa todos los campos.');
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirm) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (!robot) {
        setError('Confirma que no eres un robot.');
        return;
      }
    } else if (!email.trim() || !password) {
      setError('Completa email y contraseña.');
      return;
    }

    setLoading(true);
    const result =
      mode === 'login'
        ? await login(email.trim(), password)
        : await register({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            password,
            survey: {
              tradingExperience,
              techComfort,
              goal: goal || null,
            },
          });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'No se pudo continuar.');
      return;
    }
    const user = useAccountStore.getState().user;
    navigate(user?.permissions.includes('crm.view') ? '/admin' : '/app');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0B0D] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Link to="/" aria-label="Volver al inicio">
            <Logo size={36} />
          </Link>
        </div>
        <p className="text-[#8B92A0] text-sm text-center mb-6">
          Opera cripto, acciones y forex en tiempo real, con fondos de práctica.
        </p>

        <div className="flex bg-[#101216] border border-[#1E2128] rounded-xl p-1 mb-4">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 text-sm font-medium rounded-lg py-1.5 ${
              mode === 'login' ? 'bg-[#1E2128] text-[#F2F3F5]' : 'text-[#8B92A0]'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 text-sm font-medium rounded-lg py-1.5 ${
              mode === 'register' ? 'bg-[#1E2128] text-[#F2F3F5]' : 'text-[#8B92A0]'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#101216] border border-[#1E2128] rounded-2xl p-6 space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" autoComplete="email" />

          {mode === 'register' && (
            <>
              <Field label="Teléfono" type="tel" value={phone} onChange={setPhone} placeholder="+51 999 999 999" autoComplete="tel" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre" value={firstName} onChange={setFirstName} placeholder="Tu nombre" autoComplete="given-name" />
                <Field label="Apellido" value={lastName} onChange={setLastName} placeholder="Tu apellido" autoComplete="family-name" />
              </div>
            </>
          )}

          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />

          {mode === 'register' && (
            <>
              <Field label="Confirmar contraseña" type="password" value={confirm} onChange={setConfirm} placeholder="Repite la contraseña" autoComplete="new-password" />

              {/* Onboarding survey — helps tailor the learning experience. Optional. */}
              <div className="rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-3.5 space-y-4">
                <div>
                  <div className="text-xs font-medium text-[#B8BFCC]">Cuéntanos sobre ti</div>
                  <div className="text-[11px] text-[#5B6472]">Nos ayuda a adaptar la experiencia. Opcional.</div>
                </div>
                <Slider
                  label="Experiencia en trading e inversiones"
                  value={tradingExperience}
                  onChange={setTradingExperience}
                  minLabel="Ninguna"
                  maxLabel="Experto"
                />
                <Slider
                  label="¿Qué tan cómodo te sientes con la tecnología?"
                  value={techComfort}
                  onChange={setTechComfort}
                  minLabel="Poco"
                  maxLabel="Mucho"
                />
                <div>
                  <label htmlFor="goal" className="block text-xs text-[#8B92A0] mb-1">
                    ¿Qué te gustaría lograr?
                  </label>
                  <select
                    id="goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full rounded-xl bg-[#0A0B0D] border border-[#1E2128] text-[#F2F3F5] px-3 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
                  >
                    <option value="">Prefiero no decir</option>
                    <option value="basics">Aprender lo básico</option>
                    <option value="strategies">Practicar estrategias</option>
                    <option value="crypto">Explorar el mundo cripto</option>
                    <option value="ready-to-invest">Prepararme para invertir de verdad</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              {/* Simulated "no soy un robot" verification (a real reCAPTCHA needs Google keys + server check) */}
              <div className="flex items-center gap-3 rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-3">
                <input
                  id="robot"
                  type="checkbox"
                  checked={robot}
                  onChange={(e) => setRobot(e.target.checked)}
                  className="w-6 h-6 accent-[#16C784]"
                />
                <label htmlFor="robot" className="text-sm text-[#B8BFCC] flex-1 cursor-pointer select-none">
                  No soy un robot
                </label>
                <div className="text-right leading-none">
                  <div className="text-[10px] text-[#5B6472]">Verificación</div>
                  <div className="text-[9px] text-[#5B6472]">demo</div>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-[#FF5C5C]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#16C784] hover:bg-[#13B374] disabled:opacity-50 text-[#0A0B0D] font-semibold rounded-xl py-2.5 text-sm transition"
          >
            {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          <p className="text-[11px] text-[#8B92A0] text-center">
            Empieza con $10,000 en fondos de práctica. Sin comisiones.
          </p>
        </form>

        <div className="mt-4 text-[11px] text-[#5B6472] text-center leading-relaxed">
          Acceso admin (CRM): <span className="text-[#8B92A0]">admin@stratex.com</span> /{' '}
          <span className="text-[#8B92A0]">admin123</span>
          <br />
          Usuario demo: <span className="text-[#8B92A0]">maria@example.com</span> /{' '}
          <span className="text-[#8B92A0]">demo1234</span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-[#8B92A0] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl bg-[#0A0B0D] border border-[#1E2128] text-[#F2F3F5] px-3 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
      />
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs text-[#8B92A0]">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-[#16C784]">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-[#16C784]"
      />
      <div className="flex justify-between text-[10px] text-[#5B6472] mt-0.5">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
