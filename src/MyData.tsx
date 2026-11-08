import { useState, type FormEvent } from 'react'
import { api } from './lib/api'
import type { MiPerfil } from './lib/types'
import ProfileFields, { LEGAJO_PREFIJO, legajoDe, validar, type PerfilDraft } from './ProfileFields'

/**
 * Completar o corregir los datos propios.
 * "completar": aparece sola si a la cuenta le faltan datos (por ejemplo, cuentas creadas antes de este cambio).
 */
export default function MyData({
  perfil, modo, onSaved, onBack,
}: { perfil: MiPerfil; modo: 'completar' | 'editar'; onSaved: (p: MiPerfil) => void; onBack?: () => void }) {
  const [draft, setDraft] = useState<PerfilDraft>({
    nombre: perfil.nombre ?? '',
    apellido: perfil.apellido ?? '',
    legajoNum: perfil.legajo?.startsWith(LEGAJO_PREFIJO) ? perfil.legajo.slice(LEGAJO_PREFIJO.length) : '',
    dependencia: perfil.dependencia ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problema = validar(draft)
    if (problema) return setError(problema)
    setBusy(true)
    setError('')
    try {
      const datos = {
        nombre: draft.nombre.trim(),
        apellido: draft.apellido.trim(),
        legajo: legajoDe(draft),
        dependencia: draft.dependencia as NonNullable<MiPerfil['dependencia']>,
      }
      await api.updateMyProfile(datos)
      setSaved(true)
      onSaved({ ...perfil, ...datos })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <header className="login-head">
        {onBack && <button className="link" onClick={onBack}>Volver a mis guardias</button>}
        <h1>{modo === 'completar' ? 'Completá tus datos' : 'Mis datos'}</h1>
        <p className="muted">
          {modo === 'completar'
            ? 'Antes de cargar guardias necesitamos tu legajo y tu dependencia. Tu nombre aparece así en la planilla del cuartel.'
            : `Ingresás con ${perfil.email}. Tu nombre aparece así en la planilla del cuartel.`}
        </p>
      </header>
      <form className="login-card" onSubmit={submit} onChange={() => setSaved(false)}>
        <ProfileFields value={draft} onChange={setDraft} />
        {error && <p className="msg error" role="alert">{error}</p>}
        {saved && modo === 'editar' && <p className="msg ok" role="status">Datos guardados.</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar datos'}</button>
        {modo === 'completar' && (
          <button type="button" className="link" onClick={() => api.signOut()}>Salir</button>
        )}
      </form>
    </main>
  )
}
