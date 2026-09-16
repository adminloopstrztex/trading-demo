import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import Logo from '../components/Logo';

export default function Login() {
  const location = useLocation();
  const initialMode = (location.state as { mode?: string } | null)?.mode === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('PE');
  const [localPhone, setLocalPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tradingExperience, setTradingExperience] = useState(5);
  const [techComfort, setTechComfort] = useState(5);
  const [goal, setGoal] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAccountStore((s) => s.login);
  const register = useAccountStore((s) => s.register);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (!firstName.trim() || !lastName.trim() || !email.trim() || !localPhone.trim() || !password || !confirm) {
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
      if (!turnstileToken) {
        setError('Completa la verificación anti-robot.');
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
            phone: `${dialFor(country)} ${localPhone.trim()}`,
            password,
            survey: {
              tradingExperience,
              techComfort,
              goal: goal || null,
            },
            turnstileToken,
          });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'No se pudo continuar.');
      // El token de Turnstile es de un solo uso: reinícialo tras un fallo.
      if (mode === 'register') {
        setTurnstileToken('');
        setCaptchaReset((n) => n + 1);
      }
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
              <PhoneField
                country={country}
                onCountryChange={setCountry}
                localPhone={localPhone}
                onLocalPhoneChange={setLocalPhone}
              />
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

              {/* Verificación anti-bot real con Cloudflare Turnstile */}
              <TurnstileWidget onToken={setTurnstileToken} resetSignal={captchaReset} />
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

        </form>

        {/* Credenciales de prueba: SOLO en desarrollo, nunca en producción. */}
        {import.meta.env.DEV && (
          <div className="mt-4 text-[11px] text-[#5B6472] text-center leading-relaxed">
            Acceso admin (CRM): <span className="text-[#8B92A0]">admin@stratex.com</span> /{' '}
            <span className="text-[#8B92A0]">admin123</span>
            <br />
            Usuario demo: <span className="text-[#8B92A0]">maria@example.com</span> /{' '}
            <span className="text-[#8B92A0]">demo1234</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Cloudflare Turnstile (captcha anti-bot) ----
const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '0x4AAAAAAE5akPqZEURdwDd0';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

function TurnstileWidget({
  onToken,
  resetSignal,
}: {
  onToken: (token: string) => void;
  resetSignal: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };

    if (window.turnstile) render();
    else poll = setInterval(() => {
      if (window.turnstile) {
        if (poll) clearInterval(poll);
        render();
      }
    }, 200);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (widgetId.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* noop */
        }
        widgetId.current = null;
      }
    };
  }, [onToken]);

  // Reinicia el widget cuando el padre lo pide (p. ej. tras un registro fallido).
  useEffect(() => {
    if (resetSignal > 0 && widgetId.current !== null && window.turnstile) {
      try {
        window.turnstile.reset(widgetId.current);
      } catch {
        /* noop */
      }
    }
  }, [resetSignal]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}

// Lista completa de países (nombre en español, código ISO, código de marcación, bandera).
const COUNTRIES = [
  { code: 'AF', name: 'Afganistán', dial: '+93', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', dial: '+355', flag: '🇦🇱' },
  { code: 'DE', name: 'Alemania', dial: '+49', flag: '🇩🇪' },
  { code: 'AD', name: 'Andorra', dial: '+376', flag: '🇦🇩' },
  { code: 'AO', name: 'Angola', dial: '+244', flag: '🇦🇴' },
  { code: 'AG', name: 'Antigua y Barbuda', dial: '+1268', flag: '🇦🇬' },
  { code: 'SA', name: 'Arabia Saudita', dial: '+966', flag: '🇸🇦' },
  { code: 'DZ', name: 'Argelia', dial: '+213', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', dial: '+374', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaiyán', dial: '+994', flag: '🇦🇿' },
  { code: 'BS', name: 'Bahamas', dial: '+1242', flag: '🇧🇸' },
  { code: 'BD', name: 'Bangladés', dial: '+880', flag: '🇧🇩' },
  { code: 'BB', name: 'Barbados', dial: '+1246', flag: '🇧🇧' },
  { code: 'BH', name: 'Baréin', dial: '+973', flag: '🇧🇭' },
  { code: 'BE', name: 'Bélgica', dial: '+32', flag: '🇧🇪' },
  { code: 'BZ', name: 'Belice', dial: '+501', flag: '🇧🇿' },
  { code: 'BJ', name: 'Benín', dial: '+229', flag: '🇧🇯' },
  { code: 'BY', name: 'Bielorrusia', dial: '+375', flag: '🇧🇾' },
  { code: 'MM', name: 'Birmania (Myanmar)', dial: '+95', flag: '🇲🇲' },
  { code: 'BO', name: 'Bolivia', dial: '+591', flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia y Herzegovina', dial: '+387', flag: '🇧🇦' },
  { code: 'BW', name: 'Botsuana', dial: '+267', flag: '🇧🇼' },
  { code: 'BR', name: 'Brasil', dial: '+55', flag: '🇧🇷' },
  { code: 'BN', name: 'Brunéi', dial: '+673', flag: '🇧🇳' },
  { code: 'BG', name: 'Bulgaria', dial: '+359', flag: '🇧🇬' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226', flag: '🇧🇫' },
  { code: 'BI', name: 'Burundi', dial: '+257', flag: '🇧🇮' },
  { code: 'BT', name: 'Bután', dial: '+975', flag: '🇧🇹' },
  { code: 'CV', name: 'Cabo Verde', dial: '+238', flag: '🇨🇻' },
  { code: 'KH', name: 'Camboya', dial: '+855', flag: '🇰🇭' },
  { code: 'CM', name: 'Camerún', dial: '+237', flag: '🇨🇲' },
  { code: 'CA', name: 'Canadá', dial: '+1', flag: '🇨🇦' },
  { code: 'QA', name: 'Catar', dial: '+974', flag: '🇶🇦' },
  { code: 'TD', name: 'Chad', dial: '+235', flag: '🇹🇩' },
  { code: 'CZ', name: 'Chequia', dial: '+420', flag: '🇨🇿' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'CY', name: 'Chipre', dial: '+357', flag: '🇨🇾' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'KM', name: 'Comoras', dial: '+269', flag: '🇰🇲' },
  { code: 'CG', name: 'Congo (Rep.)', dial: '+242', flag: '🇨🇬' },
  { code: 'CD', name: 'Congo (RD)', dial: '+243', flag: '🇨🇩' },
  { code: 'KP', name: 'Corea del Norte', dial: '+850', flag: '🇰🇵' },
  { code: 'KR', name: 'Corea del Sur', dial: '+82', flag: '🇰🇷' },
  { code: 'CI', name: 'Costa de Marfil', dial: '+225', flag: '🇨🇮' },
  { code: 'CR', name: 'Costa Rica', dial: '+506', flag: '🇨🇷' },
  { code: 'HR', name: 'Croacia', dial: '+385', flag: '🇭🇷' },
  { code: 'CU', name: 'Cuba', dial: '+53', flag: '🇨🇺' },
  { code: 'DK', name: 'Dinamarca', dial: '+45', flag: '🇩🇰' },
  { code: 'DM', name: 'Dominica', dial: '+1767', flag: '🇩🇲' },
  { code: 'EC', name: 'Ecuador', dial: '+593', flag: '🇪🇨' },
  { code: 'EG', name: 'Egipto', dial: '+20', flag: '🇪🇬' },
  { code: 'SV', name: 'El Salvador', dial: '+503', flag: '🇸🇻' },
  { code: 'AE', name: 'Emiratos Árabes Unidos', dial: '+971', flag: '🇦🇪' },
  { code: 'ER', name: 'Eritrea', dial: '+291', flag: '🇪🇷' },
  { code: 'SK', name: 'Eslovaquia', dial: '+421', flag: '🇸🇰' },
  { code: 'SI', name: 'Eslovenia', dial: '+386', flag: '🇸🇮' },
  { code: 'ES', name: 'España', dial: '+34', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', dial: '+1', flag: '🇺🇸' },
  { code: 'EE', name: 'Estonia', dial: '+372', flag: '🇪🇪' },
  { code: 'SZ', name: 'Esuatini', dial: '+268', flag: '🇸🇿' },
  { code: 'ET', name: 'Etiopía', dial: '+251', flag: '🇪🇹' },
  { code: 'PH', name: 'Filipinas', dial: '+63', flag: '🇵🇭' },
  { code: 'FI', name: 'Finlandia', dial: '+358', flag: '🇫🇮' },
  { code: 'FJ', name: 'Fiyi', dial: '+679', flag: '🇫🇯' },
  { code: 'FR', name: 'Francia', dial: '+33', flag: '🇫🇷' },
  { code: 'GA', name: 'Gabón', dial: '+241', flag: '🇬🇦' },
  { code: 'GM', name: 'Gambia', dial: '+220', flag: '🇬🇲' },
  { code: 'GE', name: 'Georgia', dial: '+995', flag: '🇬🇪' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'GD', name: 'Granada', dial: '+1473', flag: '🇬🇩' },
  { code: 'GR', name: 'Grecia', dial: '+30', flag: '🇬🇷' },
  { code: 'GT', name: 'Guatemala', dial: '+502', flag: '🇬🇹' },
  { code: 'GN', name: 'Guinea', dial: '+224', flag: '🇬🇳' },
  { code: 'GW', name: 'Guinea-Bisáu', dial: '+245', flag: '🇬🇼' },
  { code: 'GQ', name: 'Guinea Ecuatorial', dial: '+240', flag: '🇬🇶' },
  { code: 'GY', name: 'Guyana', dial: '+592', flag: '🇬🇾' },
  { code: 'HT', name: 'Haití', dial: '+509', flag: '🇭🇹' },
  { code: 'HN', name: 'Honduras', dial: '+504', flag: '🇭🇳' },
  { code: 'HU', name: 'Hungría', dial: '+36', flag: '🇭🇺' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩' },
  { code: 'IQ', name: 'Irak', dial: '+964', flag: '🇮🇶' },
  { code: 'IR', name: 'Irán', dial: '+98', flag: '🇮🇷' },
  { code: 'IE', name: 'Irlanda', dial: '+353', flag: '🇮🇪' },
  { code: 'IS', name: 'Islandia', dial: '+354', flag: '🇮🇸' },
  { code: 'MH', name: 'Islas Marshall', dial: '+692', flag: '🇲🇭' },
  { code: 'SB', name: 'Islas Salomón', dial: '+677', flag: '🇸🇧' },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { code: 'IT', name: 'Italia', dial: '+39', flag: '🇮🇹' },
  { code: 'JM', name: 'Jamaica', dial: '+1876', flag: '🇯🇲' },
  { code: 'JP', name: 'Japón', dial: '+81', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordania', dial: '+962', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazajistán', dial: '+7', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenia', dial: '+254', flag: '🇰🇪' },
  { code: 'KG', name: 'Kirguistán', dial: '+996', flag: '🇰🇬' },
  { code: 'KI', name: 'Kiribati', dial: '+686', flag: '🇰🇮' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼' },
  { code: 'LA', name: 'Laos', dial: '+856', flag: '🇱🇦' },
  { code: 'LS', name: 'Lesoto', dial: '+266', flag: '🇱🇸' },
  { code: 'LV', name: 'Letonia', dial: '+371', flag: '🇱🇻' },
  { code: 'LB', name: 'Líbano', dial: '+961', flag: '🇱🇧' },
  { code: 'LR', name: 'Liberia', dial: '+231', flag: '🇱🇷' },
  { code: 'LY', name: 'Libia', dial: '+218', flag: '🇱🇾' },
  { code: 'LI', name: 'Liechtenstein', dial: '+423', flag: '🇱🇮' },
  { code: 'LT', name: 'Lituania', dial: '+370', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxemburgo', dial: '+352', flag: '🇱🇺' },
  { code: 'MK', name: 'Macedonia del Norte', dial: '+389', flag: '🇲🇰' },
  { code: 'MG', name: 'Madagascar', dial: '+261', flag: '🇲🇬' },
  { code: 'MY', name: 'Malasia', dial: '+60', flag: '🇲🇾' },
  { code: 'MW', name: 'Malaui', dial: '+265', flag: '🇲🇼' },
  { code: 'MV', name: 'Maldivas', dial: '+960', flag: '🇲🇻' },
  { code: 'ML', name: 'Malí', dial: '+223', flag: '🇲🇱' },
  { code: 'MT', name: 'Malta', dial: '+356', flag: '🇲🇹' },
  { code: 'MA', name: 'Marruecos', dial: '+212', flag: '🇲🇦' },
  { code: 'MU', name: 'Mauricio', dial: '+230', flag: '🇲🇺' },
  { code: 'MR', name: 'Mauritania', dial: '+222', flag: '🇲🇷' },
  { code: 'MX', name: 'México', dial: '+52', flag: '🇲🇽' },
  { code: 'FM', name: 'Micronesia', dial: '+691', flag: '🇫🇲' },
  { code: 'MD', name: 'Moldavia', dial: '+373', flag: '🇲🇩' },
  { code: 'MC', name: 'Mónaco', dial: '+377', flag: '🇲🇨' },
  { code: 'MN', name: 'Mongolia', dial: '+976', flag: '🇲🇳' },
  { code: 'ME', name: 'Montenegro', dial: '+382', flag: '🇲🇪' },
  { code: 'MZ', name: 'Mozambique', dial: '+258', flag: '🇲🇿' },
  { code: 'NA', name: 'Namibia', dial: '+264', flag: '🇳🇦' },
  { code: 'NR', name: 'Nauru', dial: '+674', flag: '🇳🇷' },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵' },
  { code: 'NI', name: 'Nicaragua', dial: '+505', flag: '🇳🇮' },
  { code: 'NE', name: 'Níger', dial: '+227', flag: '🇳🇪' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'NO', name: 'Noruega', dial: '+47', flag: '🇳🇴' },
  { code: 'NZ', name: 'Nueva Zelanda', dial: '+64', flag: '🇳🇿' },
  { code: 'OM', name: 'Omán', dial: '+968', flag: '🇴🇲' },
  { code: 'NL', name: 'Países Bajos', dial: '+31', flag: '🇳🇱' },
  { code: 'PK', name: 'Pakistán', dial: '+92', flag: '🇵🇰' },
  { code: 'PW', name: 'Palaos', dial: '+680', flag: '🇵🇼' },
  { code: 'PS', name: 'Palestina', dial: '+970', flag: '🇵🇸' },
  { code: 'PA', name: 'Panamá', dial: '+507', flag: '🇵🇦' },
  { code: 'PG', name: 'Papúa Nueva Guinea', dial: '+675', flag: '🇵🇬' },
  { code: 'PY', name: 'Paraguay', dial: '+595', flag: '🇵🇾' },
  { code: 'PE', name: 'Perú', dial: '+51', flag: '🇵🇪' },
  { code: 'PL', name: 'Polonia', dial: '+48', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'PR', name: 'Puerto Rico', dial: '+1', flag: '🇵🇷' },
  { code: 'GB', name: 'Reino Unido', dial: '+44', flag: '🇬🇧' },
  { code: 'CF', name: 'República Centroafricana', dial: '+236', flag: '🇨🇫' },
  { code: 'DO', name: 'República Dominicana', dial: '+1', flag: '🇩🇴' },
  { code: 'RW', name: 'Ruanda', dial: '+250', flag: '🇷🇼' },
  { code: 'RO', name: 'Rumanía', dial: '+40', flag: '🇷🇴' },
  { code: 'RU', name: 'Rusia', dial: '+7', flag: '🇷🇺' },
  { code: 'WS', name: 'Samoa', dial: '+685', flag: '🇼🇸' },
  { code: 'KN', name: 'San Cristóbal y Nieves', dial: '+1869', flag: '🇰🇳' },
  { code: 'SM', name: 'San Marino', dial: '+378', flag: '🇸🇲' },
  { code: 'VC', name: 'San Vicente y las Granadinas', dial: '+1784', flag: '🇻🇨' },
  { code: 'LC', name: 'Santa Lucía', dial: '+1758', flag: '🇱🇨' },
  { code: 'ST', name: 'Santo Tomé y Príncipe', dial: '+239', flag: '🇸🇹' },
  { code: 'SN', name: 'Senegal', dial: '+221', flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia', dial: '+381', flag: '🇷🇸' },
  { code: 'SC', name: 'Seychelles', dial: '+248', flag: '🇸🇨' },
  { code: 'SL', name: 'Sierra Leona', dial: '+232', flag: '🇸🇱' },
  { code: 'SG', name: 'Singapur', dial: '+65', flag: '🇸🇬' },
  { code: 'SY', name: 'Siria', dial: '+963', flag: '🇸🇾' },
  { code: 'SO', name: 'Somalia', dial: '+252', flag: '🇸🇴' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰' },
  { code: 'ZA', name: 'Sudáfrica', dial: '+27', flag: '🇿🇦' },
  { code: 'SD', name: 'Sudán', dial: '+249', flag: '🇸🇩' },
  { code: 'SS', name: 'Sudán del Sur', dial: '+211', flag: '🇸🇸' },
  { code: 'SE', name: 'Suecia', dial: '+46', flag: '🇸🇪' },
  { code: 'CH', name: 'Suiza', dial: '+41', flag: '🇨🇭' },
  { code: 'SR', name: 'Surinam', dial: '+597', flag: '🇸🇷' },
  { code: 'TH', name: 'Tailandia', dial: '+66', flag: '🇹🇭' },
  { code: 'TZ', name: 'Tanzania', dial: '+255', flag: '🇹🇿' },
  { code: 'TJ', name: 'Tayikistán', dial: '+992', flag: '🇹🇯' },
  { code: 'TL', name: 'Timor Oriental', dial: '+670', flag: '🇹🇱' },
  { code: 'TG', name: 'Togo', dial: '+228', flag: '🇹🇬' },
  { code: 'TO', name: 'Tonga', dial: '+676', flag: '🇹🇴' },
  { code: 'TT', name: 'Trinidad y Tobago', dial: '+1868', flag: '🇹🇹' },
  { code: 'TN', name: 'Túnez', dial: '+216', flag: '🇹🇳' },
  { code: 'TM', name: 'Turkmenistán', dial: '+993', flag: '🇹🇲' },
  { code: 'TR', name: 'Turquía', dial: '+90', flag: '🇹🇷' },
  { code: 'TV', name: 'Tuvalu', dial: '+688', flag: '🇹🇻' },
  { code: 'UA', name: 'Ucrania', dial: '+380', flag: '🇺🇦' },
  { code: 'UG', name: 'Uganda', dial: '+256', flag: '🇺🇬' },
  { code: 'UY', name: 'Uruguay', dial: '+598', flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistán', dial: '+998', flag: '🇺🇿' },
  { code: 'VU', name: 'Vanuatu', dial: '+678', flag: '🇻🇺' },
  { code: 'VA', name: 'Vaticano', dial: '+379', flag: '🇻🇦' },
  { code: 'VE', name: 'Venezuela', dial: '+58', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', dial: '+967', flag: '🇾🇪' },
  { code: 'DJ', name: 'Yibuti', dial: '+253', flag: '🇩🇯' },
  { code: 'ZM', name: 'Zambia', dial: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabue', dial: '+263', flag: '🇿🇼' },
];

// Países destacados arriba de la lista (los más frecuentes para este público).
const FEATURED = ['PE', 'MX', 'CO', 'AR', 'CL', 'EC', 'BO', 'VE', 'PY', 'UY', 'ES', 'US'];

const featuredCountries = FEATURED.map((c) => COUNTRIES.find((x) => x.code === c)!);
const otherCountries = COUNTRIES.filter((c) => !FEATURED.includes(c.code));

function dialFor(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.dial ?? '';
}

function PhoneField({
  country,
  onCountryChange,
  localPhone,
  onLocalPhoneChange,
}: {
  country: string;
  onCountryChange: (v: string) => void;
  localPhone: string;
  onLocalPhoneChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-[#8B92A0] mb-1">Teléfono</label>
      <div className="flex gap-2">
        <select
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          aria-label="País"
          className="shrink-0 w-[135px] rounded-xl bg-[#0A0B0D] border border-[#1E2128] text-[#F2F3F5] px-2 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
        >
          <optgroup label="Frecuentes">
            {featuredCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.dial})
              </option>
            ))}
          </optgroup>
          <optgroup label="Todos los países">
            {otherCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.dial})
              </option>
            ))}
          </optgroup>
        </select>
        <input
          type="tel"
          value={localPhone}
          onChange={(e) => onLocalPhoneChange(e.target.value)}
          placeholder="999 999 999"
          autoComplete="tel-national"
          className="flex-1 min-w-0 rounded-xl bg-[#0A0B0D] border border-[#1E2128] text-[#F2F3F5] px-3 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
        />
      </div>
      <p className="mt-1 text-[10px] text-[#5B6472]">Código: {dialFor(country)}</p>
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
