import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api'
import type { MiPerfil } from './lib/types'
import Login from './Login'
import Roster from './Roster'
import Calendar from './Calendar'
import Users from './Users'
import MyData from './MyData'

type Page = 'guardias' | 'calendario' | 'usuarios' | 'datos'

const completo = (p: MiPerfil) => Boolean(p.nombre && p.apellido && p.legajo && p.dependencia)

export default function App() {
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [recovery, setRecovery] = useState(false)
  const [perfil, setPerfil] = useState<MiPerfil | null>(null)
  const [perfilError, setPerfilError] = useState('')
  const [page, setPage] = useState<Page>('guardias')

  useEffect(() => {
    api.getEmail().then(setEmail)
    return api.onAuth((s) => {
      setEmail(s.email)
      if (s.recovery) setRecovery(true)
    })
  }, [])

  const cargarPerfil = useCallback(() => {
    setPerfilError('')
    api.myProfile().then(setPerfil).catch((e) => setPerfilError((e as Error).message))
  }, [])

  useEffect(() => {
    setPerfil(null)
    setPage('guardias')
    if (email) cargarPerfil()
  }, [email, cargarPerfil])

  const esAdmin = perfil?.rol === 'admin' || perfil?.rol === 'super'
  const volver = () => setPage('guardias')

  let body
  if (email === undefined) body = <div className="boot" aria-busy="true" />
  else if (!email || recovery) body = <Login recovery={recovery} onRecovered={() => setRecovery(false)} />
  else if (perfilError)
    body = (
      <main className="center">
        <p className="msg error">{perfilError}</p>
        <button className="btn" onClick={cargarPerfil}>Volver a intentar</button>
        <button className="link" onClick={() => api.signOut()}>Salir</button>
      </main>
    )
  else if (!perfil) body = <div className="boot" aria-busy="true" />
  else if (!completo(perfil)) body = <MyData perfil={perfil} modo="completar" onSaved={setPerfil} />
  else if (page === 'datos') body = <MyData perfil={perfil} modo="editar" onSaved={setPerfil} onBack={volver} />
  else if (page === 'calendario' && esAdmin) body = <Calendar onBack={volver} />
  else if (page === 'usuarios' && esAdmin) body = <Users miRol={perfil.rol} miEmail={perfil.email} onBack={volver} />
  else
    body = (
      <Roster
        email={email}
        links={[
          ...(esAdmin
            ? [
                { label: 'Calendario', onClick: () => setPage('calendario') },
                { label: 'Usuarios', onClick: () => setPage('usuarios') },
              ]
            : []),
          { label: 'Mis datos', onClick: () => setPage('datos') },
        ]}
      />
    )

  return (
    <>
      {api.demo && (
        <p className="demo-banner no-print">
          Modo demostración: nada se guarda y no se envían mails. Entrás como superusuario para ver todas las pantallas.
        </p>
      )}
      {body}
    </>
  )
}
