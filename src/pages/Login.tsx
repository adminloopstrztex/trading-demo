import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import Logo from '../components/Logo';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAccountStore((s) => s.login);
  const register = useAccountStore((s) => s.register);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim() || (mode === 'register' && !name.trim())) {
      setError('Completa todos los campos.');
      return;
    }
    setLoading(true);
    const result =
      mode === 'login'
        ? await login(email.trim(), password)
        : await register(name.trim(), email.trim(), password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'No se pudo continuar.');
      return;
    }
    const user = useAccountStore.getState().user;
    navigate(user?.role === 'admin' ? '/admin' : '/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0B0D] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo size={36} />
        </div>
        <p className="text-[#8B92A0] text-sm text-center mb-6">
          Simulador de inversión con saldo virtual. Demo educativa.
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

        <form
          onSubmit={handleSubmit}
          className="bg-[#101216] border border-[#1E2128] rounded-2xl p-6 space-y-4"
        >
          {mode === 'register' && (
            <div>
              <label className="block text-xs text-[#8B92A0] mb-1">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-[#0A0B0D] border border-[#1E2128] text-[#F2F3F5] px-3 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
                placeholder="Tu nombre"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-[#8B92A0] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-[#0A0B0D] border border-[#1E2128] text-[#F2F3F5] px-3 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8B92A0] mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-[#0A0B0D] border border-[#1E2128] text-[#F2F3F5] px-3 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-[#FF5C5C]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#16C784] hover:bg-[#13B374] disabled:opacity-50 text-[#0A0B0D] font-semibold rounded-xl py-2.5 text-sm transition"
          >
            {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          <p className="text-[11px] text-[#8B92A0] text-center">
            Saldo virtual de $10,000. Sin dinero real. Demo educativa.
          </p>
        </form>

        <div className="mt-4 text-[11px] text-[#5B6472] text-center leading-relaxed">
          Acceso admin (CRM): <span className="text-[#8B92A0]">admin@simtrade.com</span> /{' '}
          <span className="text-[#8B92A0]">admin123</span>
          <br />
          Usuario demo: <span className="text-[#8B92A0]">maria@example.com</span> /{' '}
          <span className="text-[#8B92A0]">demo1234</span>
        </div>
      </div>
    </div>
  );
}
