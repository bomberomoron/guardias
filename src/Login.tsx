import { useEffect, useState, type FormEvent } from 'react'
import { api } from './lib/api'
import { monthName, nextMonthISO } from './lib/dates'
import { NOMBRE_CUARTEL } from './config'
import ProfileFields, { emptyDraft, legajoDe, validar, type PerfilDraft } from './ProfileFields'

type Mode = 'ingresar' | 'crear' | 'olvide'

export default function Login({ recovery, onRecovered }: { recovery: boolean; onRecovered: () => void }) {
  const [mode, setMode] = useState<Mode>('ingresar')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [perfil, setPerfil] = useState<PerfilDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mes, setMes] = useState(monthName(nextMonthISO()))

  useEffect(() => {
    setError('')
    setNotice('')
  }, [mode])

  useEffect(() => {
    api.targetMonth().then((m) => setMes(monthName(m))).catch(() => {})
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (recovery) {
        await api.updatePassword(pw)
        onRecovered()
      } else if (mode === 'ingresar') {
        await api.signIn(email.trim(), pw)
      } else if (mode === 'crear') {
        const problema = validar(perfil)
        if (problema) throw new Error(problema)
        const legajo = legajoDe(perfil)
        if (!(await api.legajoDisponible(legajo)))
          throw new Error(`El legajo ${legajo} ya tiene una cuenta. Si es tuyo, ingresá o recuperá la clave.`)
        const { needsConfirm } = await api.signUp(email.trim(), pw, {
          nombre: perfil.nombre.trim(),
          apellido: perfil.apellido.trim(),
          legajo,
          dependencia: perfil.dependencia as Exclude<PerfilDraft['dependencia'], ''>,
        })
        if (needsConfirm) setNotice(`Te mandamos un mail a ${email.trim()}. Abrí el enlace para activar tu cuenta y después ingresá.`)
      } else {
        await api.resetPassword(email.trim())
        setNotice('Si el mail está registrado, te llega un enlace para crear una clave nueva.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <header className="login-head">
        <Badge />
        <h1>
          Guardias de <span className="month">{mes}</span>
        </h1>
        <p className="muted">{NOMBRE_CUARTEL}</p>
      </header>

      <form className="login-card" onSubmit={submit}>
        {recovery ? (
          <h2>Elegí una clave nueva</h2>
        ) : (
          mode !== 'olvide' && (
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'ingresar'} onClick={() => setMode('ingresar')}>
                Ingresar
              </button>
              <button type="button" role="tab" aria-selected={mode === 'crear'} onClick={() => setMode('crear')}>
                Crear cuenta
              </button>
            </div>
          )
        )}
        {mode === 'olvide' && !recovery && <h2>Recuperar la clave</h2>}

        {mode === 'crear' && !recovery && <ProfileFields value={perfil} onChange={setPerfil} />}
        {!recovery && (
          <label>
            {mode === 'crear' ? 'Mail de contacto' : 'Mail'}
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
        {(mode !== 'olvide' || recovery) && (
          <label>
            {mode === 'crear' || recovery ? 'Clave (mínimo 6 caracteres)' : 'Clave'}
            <input
              id="clave"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'crear' || recovery ? 'new-password' : 'current-password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </label>
        )}

        {error && <p className="msg error" role="alert">{error}</p>}
        {notice && <p className="msg ok" role="status">{notice}</p>}

        <button className="btn primary" disabled={busy}>
          {busy
            ? 'Un momento…'
            : recovery
              ? 'Guardar clave'
              : mode === 'ingresar'
                ? 'Ingresar'
                : mode === 'crear'
                  ? 'Crear cuenta'
                  : 'Enviar enlace'}
        </button>

        {!recovery && (
          <button type="button" className="link" onClick={() => setMode(mode === 'olvide' ? 'ingresar' : 'olvide')}>
            {mode === 'olvide' ? 'Volver a ingresar' : 'Me olvidé la clave'}
          </button>
        )}
      </form>
    </main>
  )
}

function Badge() {
  // Escudo simple con siete butacas: los lugares de cada guardia
  return (
    <svg className="badge" viewBox="0 0 64 72" aria-hidden="true">
      <path d="M32 2 60 12v24c0 17-12 28-28 34C16 64 4 53 4 36V12Z" fill="var(--red)" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={11 + i * 6.2} y={32} width={4.4} height={9} rx={1.2} fill="#fff" opacity={i < 5 ? 1 : 0.35} />
      ))}
    </svg>
  )
}
