import { createClient } from '@supabase/supabase-js'
import type { Api, CalEntry, Count, Funcion, MiPerfil, Mine, Rol, Shift, ShiftType, Usuario } from './types'
import { MAX_POR_GUARDIA, MAX_POR_PERSONA, MINUTOS_RETENCION } from '../config'
import { key, monthDays, monthEndISO, nextMonthISO } from './dates'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Dirección de la app (incluye la carpeta del repo en GitHub Pages)
const SITE = location.origin + import.meta.env.BASE_URL

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message)
}

// ---------------------------------------------------------------------------
// Versión real: Supabase
// ---------------------------------------------------------------------------
function supabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey)

  return {
    demo: false,
    async getEmail() {
      const { data } = await sb.auth.getSession()
      return data.session?.user.email ?? null
    },
    onAuth(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) =>
        cb({ email: session?.user.email ?? null, recovery: event === 'PASSWORD_RECOVERY' }),
      )
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Mail o clave incorrectos' : error.message)
    },
    async signUp(email, password, perfil) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: SITE, data: { ...perfil } },
      })
      fail(error)
      return { needsConfirm: !data.session }
    },
    async resetPassword(email) {
      fail((await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE })).error)
    },
    async updatePassword(password) {
      fail((await sb.auth.updateUser({ password })).error)
    },
    async signOut() {
      await sb.auth.signOut()
    },

    async targetMonth() {
      const { data, error } = await sb.rpc('target_month')
      fail(error)
      return data as string
    },
    async cleanup() {
      await sb.rpc('cleanup_expired')
    },
    async loadCounts(month) {
      const { data, error } = await sb
        .from('slot_counts')
        .select('shift_date, shift_type, taken')
        .gte('shift_date', month)
        .lt('shift_date', monthEndISO(month))
      fail(error)
      return (data ?? []) as Count[]
    },
    async loadMine(month) {
      const { data, error } = await sb
        .from('reservations')
        .select('shift_date, shift_type, status, held_until, funcion')
        .gte('shift_date', month)
        .lt('shift_date', monthEndISO(month))
        .order('shift_date')
      fail(error)
      return (data ?? []) as Mine[]
    },
    subscribeCounts(cb) {
      const ch = sb
        .channel('ocupacion')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'slot_counts' }, (p) => {
          if (p.new && 'shift_date' in p.new) cb(p.new as Count)
        })
        .subscribe()
      return () => {
        sb.removeChannel(ch)
      }
    },
    async hold(date, type) {
      const { data, error } = await sb.rpc('hold_shift', { p_date: date, p_type: type })
      fail(error)
      return data as string
    },
    async release(date, type) {
      fail((await sb.rpc('release_shift', { p_date: date, p_type: type })).error)
    },
    async confirm() {
      const { data, error } = await sb.rpc('confirm_shifts')
      fail(error)
      return (data ?? []) as Shift[]
    },
    async sendReport() {
      const { error } = await sb.functions.invoke('enviar-reporte')
      fail(error)
    },
    async legajoDisponible(legajo) {
      const { data, error } = await sb.rpc('legajo_disponible', { p_legajo: legajo })
      fail(error)
      return data === true
    },
    async myProfile() {
      const { data, error } = await sb.rpc('my_profile')
      fail(error)
      const row = (data as Record<string, string | null>[] | null)?.[0]
      if (!row) throw new Error('No se encontró tu perfil. Cerrá sesión y volvé a ingresar.')
      return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as unknown as MiPerfil
    },
    async updateMyProfile(p) {
      fail((await sb.rpc('update_my_profile', {
        p_nombre: p.nombre, p_apellido: p.apellido, p_legajo: p.legajo, p_dependencia: p.dependencia,
      })).error)
    },
    async listUsers() {
      const { data, error } = await sb.rpc('list_users')
      fail(error)
      return ((data ?? []) as Record<string, unknown>[]).map(
        (r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null)) as unknown as Usuario,
      )
    },
    async setRole(userId, rol) {
      fail((await sb.rpc('set_role', { p_user: userId, p_rol: rol })).error)
    },
    async loadCalendar(month) {
      const { data, error } = await sb.rpc('calendar_month', { p_month: month })
      fail(error)
      return (data ?? []) as CalEntry[]
    },
    async setFuncion(date, type, funcion, userId) {
      fail((await sb.rpc('set_funcion', { p_date: date, p_type: type, p_funcion: funcion, p_user: userId })).error)
    },
  }
}

const nombrePlanilla = (apellido: string, nombre: string) => {
  const ap = apellido.trim()
  return ap.charAt(0).toUpperCase() + ap.slice(1) + (nombre.trim() ? ` ${nombre.trim()[0].toUpperCase()}.` : '')
}

// ---------------------------------------------------------------------------
// Versión de demostración: funciona sin backend, para probar la interfaz.
// Simula a otros bomberos (nombres inventados) reservando cada pocos segundos.
// ---------------------------------------------------------------------------
const DEMO_PERSONAL = (
  'Acosta M.,Benítez L.,Bravo S.,Cabral D.,Castro P.,Correa J.,Díaz A.,Domínguez F.,Duarte R.,Escobar N.,' +
  'Farías G.,Ferreyra C.,Flores M.,Gallo E.,Giménez T.,Godoy L.,Gómez R.,Herrera V.,Ibarra J.,Juárez S.,' +
  'Ledesma P.,Luna A.,Maidana H.,Medina C.,Molina D.,Moreno F.,Navarro I.,Núñez B.,Ojeda M.,Ortiz L.,' +
  'Paz G.,Peralta R.,Ponce A.,Quiroga E.,Ramos N.,Ríos J.,Rojas T.,Romero C.,Ruiz M.,Sánchez P.,' +
  'Sosa F.,Suárez L.,Torres D.,Vallejos S.,Vega R.,Vera A.,Villalba G.,Zalazar M.,Aguirre J.,Blanco E.'
).split(',')

const NOMBRES_DEMO: Record<string, string> = {
  A: 'Alberto', B: 'Bruno', C: 'Carla', D: 'Daniel', E: 'Esteban', F: 'Florencia', G: 'Gustavo', H: 'Hernán',
  I: 'Iván', J: 'Julieta', L: 'Lucas', M: 'Martín', N: 'Natalia', P: 'Pablo', R: 'Rodrigo', S: 'Sofía', T: 'Tomás', V: 'Valeria',
}

function demoApi(): Api {
  const month = nextMonthISO()
  let email: string | null = null
  let miNombre = 'Demo U.'
  let miPerfil: MiPerfil = { email: '', rol: 'super' }
  const authSubs = new Set<(s: { email: string | null; recovery: boolean }) => void>()
  const countSubs = new Set<(c: Count) => void>()
  const others = new Map<string, string[]>() // guardia -> nombres
  const cupo = new Map<string, number>() // nombre -> guardias que tiene
  let mine: Mine[] = []
  const funciones = new Map<string, Partial<Record<Funcion, string>>>() // guardia -> función -> nombre (en la demo el id es el nombre)
  const MI_ID = 'demo-yo'

  let seed = 11
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const slots = monthDays(month).flatMap((d) => (['dia', 'noche'] as ShiftType[]).map((t) => key(d, t)))
  slots.forEach((k) => others.set(k, []))

  const taken = (k: string) => others.get(k)!.length + mine.filter((m) => key(m.shift_date, m.shift_type) === k).length
  const addTo = (k: string, n: string) => {
    if (taken(k) >= MAX_POR_GUARDIA || (cupo.get(n) ?? 0) >= MAX_POR_PERSONA || others.get(k)!.includes(n)) return false
    others.get(k)!.push(n)
    cupo.set(n, (cupo.get(n) ?? 0) + 1)
    return true
  }
  // Cada bombero inventado ya eligió entre 3 y 6 guardias
  for (const n of DEMO_PERSONAL) {
    const want = 3 + Math.floor(rnd() * 4)
    for (let tries = 0; (cupo.get(n) ?? 0) < want && tries < 40; tries++) addTo(slots[Math.floor(rnd() * slots.length)], n)
  }

  // En la demo, parte de las guardias ya tienen encargado (y algunas ayudante)
  for (const k of slots) {
    const list = others.get(k)!
    if (list.length >= 2 && rnd() < 0.6) {
      const i = Math.floor(rnd() * list.length)
      funciones.set(k, { encargado: list[i], ...(rnd() < 0.5 ? { ayudante: list[(i + 1) % list.length] } : {}) })
    }
  }

  const emit = (k: string) => {
    const [shift_date, shift_type] = k.split('|') as [string, ShiftType]
    countSubs.forEach((cb) => cb({ shift_date, shift_type, taken: taken(k) }))
  }
  const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))
  const expire = () => {
    const now = Date.now()
    const gone = mine.filter((m) => m.status === 'held' && m.held_until && Date.parse(m.held_until) < now)
    mine = mine.filter((m) => !gone.includes(m))
    gone.forEach((m) => emit(key(m.shift_date, m.shift_type)))
  }

  // De vez en cuando alguien suma o suelta una guardia
  setInterval(() => {
    const k = slots[Math.floor(Math.random() * slots.length)]
    const list = others.get(k)!
    if (Math.random() < 0.7) {
      const n = DEMO_PERSONAL[Math.floor(Math.random() * DEMO_PERSONAL.length)]
      if (!addTo(k, n)) return
    } else if (list.length) {
      const n = list.splice(Math.floor(Math.random() * list.length), 1)[0]
      cupo.set(n, (cupo.get(n) ?? 1) - 1)
      const f = funciones.get(k)
      if (f) for (const fn of ['encargado', 'ayudante'] as Funcion[]) if (f[fn] === n) delete f[fn]
    } else return
    emit(k)
  }, 2500)

  // Listado de usuarios inventado para la pantalla Usuarios
  const DEPS = ['CM', 'Dto 1', 'Dto 2'] as const
  const usuarios: Usuario[] = DEMO_PERSONAL.map((n, i) => {
    const [ap, ini] = n.split(' ')
    const sinTilde = ap.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return {
      id: `demo-${i}`,
      email: `${sinTilde}${100 + i}@ejemplo.com`,
      apellido: ap,
      nombre: NOMBRES_DEMO[ini[0]] ?? ini.replace('.', ''),
      legajo: `147/${(203 + i * 7) % 900}`,
      dependencia: DEPS[i % 3],
      rol: i === 4 || i === 17 ? 'admin' : 'usuario',
      guardias: 0,
      created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
    }
  })

  const login = (e: string) => {
    email = e
    if (miPerfil.email !== e) miPerfil = { email: e, rol: 'super', nombre: 'Demo', apellido: 'Usuario', legajo: '147/1', dependencia: 'CM' }
    authSubs.forEach((cb) => cb({ email, recovery: false }))
  }

  return {
    demo: true,
    async getEmail() {
      return email
    },
    onAuth(cb) {
      authSubs.add(cb)
      return () => authSubs.delete(cb)
    },
    async signIn(e) {
      await wait()
      login(e)
    },
    async signUp(e, _pw, perfil) {
      await wait()
      miPerfil = { email: e, rol: 'super', ...perfil }
      miNombre = nombrePlanilla(perfil.apellido, perfil.nombre)
      login(e)
      return { needsConfirm: false }
    },
    async resetPassword() {
      await wait()
    },
    async updatePassword() {
      await wait()
    },
    async signOut() {
      email = null
      mine = []
      authSubs.forEach((cb) => cb({ email: null, recovery: false }))
    },
    async targetMonth() {
      return month
    },
    async cleanup() {
      expire()
    },
    async loadCounts() {
      return slots.map((k) => {
        const [shift_date, shift_type] = k.split('|') as [string, ShiftType]
        return { shift_date, shift_type, taken: taken(k) }
      })
    },
    async loadMine() {
      expire()
      return mine.map((m) => {
        const f = funciones.get(key(m.shift_date, m.shift_type)) ?? {}
        const funcion = f.encargado === MI_ID ? 'encargado' : f.ayudante === MI_ID ? 'ayudante' : null
        return { ...m, funcion }
      })
    },
    subscribeCounts(cb) {
      countSubs.add(cb)
      return () => countSubs.delete(cb)
    },
    async hold(date, type) {
      await wait()
      expire()
      const k = key(date, type)
      if (mine.some((m) => m.status === 'confirmed')) throw new Error('Ya confirmaste tus guardias de este mes')
      if (mine.length >= MAX_POR_PERSONA) throw new Error(`Llegaste al máximo de ${MAX_POR_PERSONA} guardias`)
      if (taken(k) >= MAX_POR_GUARDIA) throw new Error('Esa guardia ya está completa')
      const until = mine[0]?.held_until ?? new Date(Date.now() + MINUTOS_RETENCION * 60_000).toISOString()
      mine.push({ shift_date: date, shift_type: type, status: 'held', held_until: until })
      emit(k)
      return until
    },
    async release(date, type) {
      await wait(150)
      mine = mine.filter((m) => !(m.shift_date === date && m.shift_type === type && m.status === 'held'))
      emit(key(date, type))
    },
    async confirm() {
      await wait(500)
      expire()
      if (!mine.length) throw new Error('No tenés guardias para confirmar (puede que se haya vencido el tiempo)')
      mine = mine.map((m) => ({ ...m, status: 'confirmed', held_until: null }))
      return mine.map(({ shift_date, shift_type }) => ({ shift_date, shift_type })).sort((a, b) =>
        (a.shift_date + a.shift_type).localeCompare(b.shift_date + b.shift_type),
      )
    },
    async sendReport() {
      await wait(900)
    },
    async legajoDisponible(legajo) {
      await wait(150)
      return !usuarios.some((u) => u.legajo === legajo)
    },
    async myProfile() {
      return { ...miPerfil } // en la demo sos superusuario para ver todas las pantallas
    },
    async updateMyProfile(p) {
      await wait()
      if (usuarios.some((u) => u.legajo === p.legajo)) throw new Error(`El legajo ${p.legajo} ya está registrado con otra cuenta`)
      miPerfil = { ...miPerfil, ...p }
      miNombre = nombrePlanilla(p.apellido, p.nombre)
    },
    async listUsers() {
      await wait(300)
      const cuenta = (n: string) => [...others.values()].filter((l) => l.includes(n)).length
      const yo: Usuario = {
        id: 'demo-yo', email: miPerfil.email, nombre: miPerfil.nombre, apellido: miPerfil.apellido,
        legajo: miPerfil.legajo, dependencia: miPerfil.dependencia, rol: miPerfil.rol,
        guardias: mine.filter((m) => m.status === 'confirmed').length, created_at: new Date().toISOString(),
      }
      return [yo, ...usuarios.map((u) => ({ ...u, guardias: cuenta(`${u.apellido} ${u.nombre![0]}.`) }))].sort((a, b) =>
        (a.apellido ?? '').localeCompare(b.apellido ?? '', 'es'),
      )
    },
    async setRole(id, rol: Rol) {
      await wait(200)
      if (id === 'demo-yo') {
        if (rol !== 'super' && !usuarios.some((u) => u.rol === 'super')) throw new Error('Tiene que quedar al menos un superusuario')
        miPerfil = { ...miPerfil, rol }
        return
      }
      const u = usuarios.find((x) => x.id === id)
      if (u) u.rol = rol
    },
    async loadCalendar() {
      await wait(300)
      const out: CalEntry[] = []
      for (const k of slots) {
        const [shift_date, shift_type] = k.split('|') as [string, ShiftType]
        const f = funciones.get(k) ?? {}
        const people = others.get(k)!.map((n) => ({ id: n, nombre: n }))
        if (mine.some((m) => m.status === 'confirmed' && key(m.shift_date, m.shift_type) === k)) people.push({ id: MI_ID, nombre: miNombre })
        people
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
          .forEach((p) =>
            out.push({
              shift_date, shift_type, user_id: p.id, nombre: p.nombre,
              funcion: f.encargado === p.id ? 'encargado' : f.ayudante === p.id ? 'ayudante' : null,
            }),
          )
      }
      return out
    },
    async setFuncion(date, type, funcion, userId) {
      await wait(200)
      const k = key(date, type)
      const anotado = userId === MI_ID
        ? mine.some((m) => m.status === 'confirmed' && key(m.shift_date, m.shift_type) === k)
        : !!userId && others.get(k)!.includes(userId)
      if (userId && !anotado) throw new Error('Esa persona no tiene esta guardia confirmada')
      const f = { ...(funciones.get(k) ?? {}) }
      delete f[funcion]
      if (userId) {
        for (const fn of ['encargado', 'ayudante'] as Funcion[]) if (f[fn] === userId) delete f[fn]
        f[funcion] = userId
      }
      funciones.set(k, f)
    },
  }
}

export const api: Api = URL && KEY ? supabaseApi(URL, KEY) : demoApi()
