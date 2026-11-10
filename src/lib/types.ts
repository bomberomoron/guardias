export type ShiftType = 'dia' | 'noche'

export type Funcion = 'encargado' | 'ayudante'

export interface Mine {
  shift_date: string // YYYY-MM-DD
  shift_type: ShiftType
  status: 'held' | 'confirmed'
  held_until: string | null
  funcion?: Funcion | null
}

export interface Count {
  shift_date: string
  shift_type: ShiftType
  taken: number
}

export interface Shift {
  shift_date: string
  shift_type: ShiftType
}

export interface CalEntry {
  shift_date: string
  shift_type: ShiftType
  user_id: string
  nombre: string // "Apellido I."
  funcion: Funcion | null
}

export type Dependencia = 'CM' | 'Dto 1' | 'Dto 2'
export type Rol = 'usuario' | 'admin' | 'super'

/** Datos que carga cada persona al registrarse */
export interface Perfil {
  nombre: string
  apellido: string
  legajo: string // "147/123"
  dependencia: Dependencia
}

export interface MiPerfil extends Partial<Perfil> {
  email: string
  rol: Rol
}

export interface Usuario extends Partial<Perfil> {
  id: string
  email: string
  rol: Rol
  guardias: number // confirmadas en el mes que se está cargando
  created_at: string
}

export interface AuthState {
  email: string | null
  recovery: boolean
}

/** Todo lo que la app necesita del backend. Hay una versión real (Supabase) y una de demostración. */
export interface Api {
  demo: boolean
  getEmail(): Promise<string | null>
  onAuth(cb: (s: AuthState) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, perfil: Perfil): Promise<{ needsConfirm: boolean }>
  resetPassword(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>

  targetMonth(): Promise<string> // YYYY-MM-01
  cleanup(): Promise<void>
  loadCounts(month: string): Promise<Count[]>
  loadMine(month: string): Promise<Mine[]>
  subscribeCounts(cb: (c: Count) => void): () => void
  hold(date: string, type: ShiftType): Promise<string>
  release(date: string, type: ShiftType): Promise<void>
  confirm(): Promise<Shift[]>
  sendReport(): Promise<void>

  legajoDisponible(legajo: string): Promise<boolean>
  myProfile(): Promise<MiPerfil>
  updateMyProfile(p: Perfil): Promise<void>
  listUsers(): Promise<Usuario[]>
  setRole(userId: string, rol: Rol): Promise<void>
  loadCalendar(month: string): Promise<CalEntry[]>
  /** userId null quita esa función de la guardia */
  setFuncion(date: string, type: ShiftType, funcion: Funcion, userId: string | null): Promise<void>
}
