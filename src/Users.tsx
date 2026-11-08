import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './lib/api'
import type { Dependencia, Rol, Usuario } from './lib/types'
import { DEPENDENCIAS } from './ProfileFields'

const ROL_NOMBRE: Record<Rol, string> = { usuario: 'Usuario', admin: 'Administrador', super: 'Superusuario' }
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

export default function Users({ miRol, miEmail, onBack }: { miRol: Rol; miEmail: string; onBack: () => void }) {
  const [users, setUsers] = useState<Usuario[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [dep, setDep] = useState<Dependencia | 'todas'>('todas')
  const [soloSinGuardias, setSoloSinGuardias] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const esSuper = miRol === 'super'

  const load = useCallback(async () => {
    setError('')
    try {
      setUsers(await api.listUsers())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const visibles = useMemo(() => {
    const term = sinTildes(q.trim())
    return (users ?? []).filter((u) => {
      if (dep !== 'todas' && u.dependencia !== dep) return false
      if (soloSinGuardias && u.guardias > 0) return false
      if (!term) return true
      return sinTildes(`${u.apellido ?? ''} ${u.nombre ?? ''} ${u.legajo ?? ''} ${u.email}`).includes(term)
    })
  }, [users, q, dep, soloSinGuardias])

  const resumen = useMemo(() => {
    const all = users ?? []
    return {
      total: all.length,
      admins: all.filter((u) => u.rol === 'admin').length,
      supers: all.filter((u) => u.rol === 'super').length,
      sinGuardias: all.filter((u) => u.guardias === 0).length,
    }
  }, [users])

  async function cambiarRol(u: Usuario, rol: Rol) {
    if (rol === u.rol) return
    setBusy(u.id)
    try {
      await api.setRole(u.id, rol)
      setUsers((prev) => prev?.map((x) => (x.id === u.id ? { ...x, rol } : x)) ?? null)
      const quien = `${cap(u.nombre)} ${cap(u.apellido)}`.trim() || u.email
      setToast({ kind: 'ok', text: `${quien} ahora es ${ROL_NOMBRE[rol].toLowerCase()}.` })
    } catch (e) {
      setToast({ kind: 'error', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="users">
      <header className="users-head">
        <button className="link" onClick={onBack}>Volver a mis guardias</button>
        <h1>Usuarios</h1>
        {users && (
          <p className="muted">
            {resumen.total} personas registradas. {resumen.supers} {resumen.supers === 1 ? 'superusuario' : 'superusuarios'},{' '}
            {resumen.admins} {resumen.admins === 1 ? 'administrador' : 'administradores'}.{' '}
            {resumen.sinGuardias === 1 && '1 persona todavía no confirmó guardias este mes.'}
            {resumen.sinGuardias > 1 && `${resumen.sinGuardias} personas todavía no confirmaron guardias este mes.`}
          </p>
        )}
        <details className="roles-help">
          <summary>Qué puede hacer cada rol</summary>
          <dl>
            <dt>Usuario</dt>
            <dd>Carga y confirma sus guardias. Todos arrancan con este rol.</dd>
            <dt>Administrador</dt>
            <dd>Además ve este listado e imprime el calendario del mes.</dd>
            <dt>Superusuario</dt>
            <dd>Además nombra y quita administradores. Es el rol del programador.</dd>
          </dl>
          {!esSuper && <p className="muted small">Para cambiar el rol de alguien, pedíselo al superusuario.</p>}
        </details>
      </header>

      <div className="users-filters">
        <input
          id="buscar"
          type="search"
          placeholder="Buscar por apellido, nombre, legajo o mail"
          aria-label="Buscar usuarios"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chips" role="group" aria-label="Dependencia">
          {(['todas', ...DEPENDENCIAS] as const).map((d) => (
            <button key={d} className="chip" aria-pressed={dep === d} onClick={() => setDep(d)}>
              {d === 'todas' ? 'Todas' : d}
            </button>
          ))}
          <button className="chip" aria-pressed={soloSinGuardias} onClick={() => setSoloSinGuardias((v) => !v)}>
            Sin guardias este mes
          </button>
        </div>
      </div>

      {error && <p className="msg error">{error}</p>}
      {!users && !error && <p className="muted">Cargando usuarios…</p>}
      {users && visibles.length === 0 && <p className="muted">Nadie coincide con la búsqueda.</p>}

      {users && visibles.length > 0 && (
        <ul className="user-list">
          {visibles.map((u) => {
            const yo = u.email.toLowerCase() === miEmail.toLowerCase()
            const incompleto = !u.legajo || !u.dependencia
            return (
              <li key={u.id} className={`user rol-${u.rol}`}>
                <div className="u-name">
                  <strong>{u.apellido ? `${cap(u.apellido)}, ${cap(u.nombre)}` : 'Sin nombre cargado'}</strong>
                  {yo && <span className="tag">Vos</span>}
                  <span className="u-meta">
                    {incompleto ? <span className="warn">Datos incompletos</span> : <>Legajo {u.legajo}, {u.dependencia}</>}
                  </span>
                </div>
                <span className="u-mail">{u.email}</span>
                <span className={`u-guardias ${u.guardias ? '' : 'none'}`}>
                  {u.guardias ? `${u.guardias} ${u.guardias === 1 ? 'guardia' : 'guardias'}` : 'Sin guardias'}
                </span>
                <span className="u-rol">
                  {esSuper && !yo ? (
                    <select
                      id={`rol-${u.id}`}
                      aria-label={`Rol de ${u.apellido ?? u.email}`}
                      value={u.rol}
                      disabled={busy === u.id}
                      onChange={(e) => cambiarRol(u, e.target.value as Rol)}
                    >
                      {(Object.keys(ROL_NOMBRE) as Rol[]).map((r) => <option key={r} value={r}>{ROL_NOMBRE[r]}</option>)}
                    </select>
                  ) : (
                    <span className="rol-badge">{ROL_NOMBRE[u.rol]}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {toast && (
        <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`} role="status" onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  )
}
