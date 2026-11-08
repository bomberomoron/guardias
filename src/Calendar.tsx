import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './lib/api'
import type { CalEntry, ShiftType } from './lib/types'
import { dayNumber, key, monthDays, monthName, weekdayIndex } from './lib/dates'
import { MAX_POR_GUARDIA } from './config'

// Filas fijas de cada semana, igual que la planilla de Excel.
// Por ahora se completan a mano; las guardias elegidas van en "Personal de Guardia".
const ROLES = [
  { label: 'Of. De Semana', cls: 'r-of' },
  { label: 'Enc. Guardia', cls: 'r-enc' },
  { label: 'Ayte. Guardia', cls: 'r-ayte' },
  { label: 'Chofer', cls: 'r-chofer' },
]
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TYPES: ShiftType[] = ['dia', 'noche']

const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Calendar({ onBack }: { onBack: () => void }) {
  const [month, setMonth] = useState<string | null>(null)
  const [entries, setEntries] = useState<CalEntry[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (m: string) => {
    setEntries(null)
    setError('')
    try {
      setEntries(await api.loadCalendar(m))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    api.targetMonth().then((m) => setMonth(m)).catch((e) => setError((e as Error).message))
  }, [])
  useEffect(() => {
    if (month) load(month)
  }, [month, load])

  // guardia -> nombres
  const byShift = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of entries ?? []) {
      const k = key(e.shift_date, e.shift_type)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(e.nombre)
    }
    return map
  }, [entries])

  // Semanas de domingo a sábado
  const weeks = useMemo(() => {
    if (!month) return []
    const days = monthDays(month)
    const cells: (string | null)[] = [...Array(weekdayIndex(days[0])).fill(null), ...days]
    while (cells.length % 7) cells.push(null)
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
  }, [month])

  const stats = useMemo(() => {
    if (!month || !entries) return null
    const slots = monthDays(month).length * 2
    const ocupados = entries.length
    const personas = new Set(entries.map((e) => e.nombre)).size
    const sinCubrir = monthDays(month).flatMap((d) => TYPES.map((t) => byShift.get(key(d, t))?.length ?? 0)).filter((n) => n === 0).length
    return { slots, ocupados, personas, libres: slots * MAX_POR_GUARDIA - ocupados, sinCubrir }
  }, [month, entries, byShift])

  const filasPersonal = (week: (string | null)[]) =>
    Math.max(MAX_POR_GUARDIA, ...week.flatMap((d) => (d ? TYPES.map((t) => byShift.get(key(d, t))?.length ?? 0) : [0])))

  const totalFilas = 3 + weeks.reduce((n, w) => n + 1 + ROLES.length + filasPersonal(w), 0)
  // Alto de fila para que todo entre en una hoja A4 apaisada (≈196 mm útiles)
  const rowMm = Math.min(5, 196 / Math.max(totalFilas, 1))

  const mes = month ? monthName(month).toUpperCase() : ''
  const anio = month?.slice(0, 4) ?? ''

  return (
    <div className="cal-shell" style={{ ['--rh' as string]: `${rowMm.toFixed(2)}mm` }}>
      <header className="cal-bar no-print">
        <button className="link" onClick={onBack}>Volver a mis guardias</button>
        <div className="cal-month">
          <button className="btn icon-btn" aria-label="Mes anterior" onClick={() => month && setMonth(shiftMonth(month, -1))}>‹</button>
          <h1>
            Calendario de <span>{month ? monthName(month) : ''} {anio}</span>
          </h1>
          <button className="btn icon-btn" aria-label="Mes siguiente" onClick={() => month && setMonth(shiftMonth(month, 1))}>›</button>
        </div>
        <div className="cal-actions">
          <button className="btn" onClick={() => month && load(month)}>Actualizar</button>
          <button className="btn primary" onClick={() => window.print()} disabled={!entries}>Imprimir</button>
        </div>
        {stats && (
          <p className="muted small cal-stats">
            {stats.ocupados} lugares ocupados por {stats.personas} personas. Quedan {stats.libres} libres
            {stats.sinCubrir > 0 && <>, y <strong className="warn">{stats.sinCubrir === 1 ? '1 guardia sin nadie' : `${stats.sinCubrir} guardias sin nadie`}</strong></>}.
            Solo aparecen las guardias confirmadas.
          </p>
        )}
        {api.demo && <p className="muted small">En la demostración los nombres son inventados.</p>}
      </header>

      {error && <p className="msg error no-print">{error}</p>}
      {!entries && !error && <p className="muted no-print">Cargando el calendario…</p>}

      {entries && (
        <div className="sheet-scroll">
          <table className="planilla">
            <colgroup>
              <col className="c-label" />
              {DIAS.flatMap((d) => [
                <col key={d + 'a'} className="c-name" />, <col key={d + 'b'} className="c-side" />,
                <col key={d + 'c'} className="c-name" />, <col key={d + 'd'} className="c-side" />,
              ])}
            </colgroup>
            <thead>
              <tr className="p-title">
                <th className="blank" />
                <th colSpan={28}>PLANILLA DE GUARDIA CORRESPONDIENTE AL MES DE {mes} {anio}</th>
              </tr>
              <tr className="p-days">
                <th className="blank" />
                {DIAS.map((d) => <th key={d} colSpan={4}>{d.toUpperCase()}</th>)}
              </tr>
              <tr className="p-shifts">
                <th className="blank" />
                {DIAS.flatMap((d) => [<th key={d + 'd'} colSpan={2}>DIA</th>, <th key={d + 'n'} colSpan={2}>NOCHE</th>])}
              </tr>
            </thead>
            {weeks.map((week, wi) => {
              const n = filasPersonal(week)
              return (
                <tbody key={wi}>
                  <tr className="p-num">
                    <td className="blank" />
                    {week.map((d, i) => d
                      ? <td key={i} colSpan={4}>{dayNumber(d)}</td>
                      : <td key={i} colSpan={4} className="out" />)}
                  </tr>
                  {[...ROLES.map((r) => ({ ...r, idx: -1 })), ...Array.from({ length: n }, (_, idx) => ({ label: 'Personal de Guardia', cls: 'r-pers', idx }))].map((row, ri) => (
                    <tr key={ri} className={row.cls}>
                      <th scope="row" className="p-label">{row.label}</th>
                      {week.flatMap((d, i) =>
                        TYPES.flatMap((t) => {
                          const name = d && row.idx >= 0 ? byShift.get(key(d, t))?.[row.idx] ?? '' : ''
                          const cls = d ? '' : 'out'
                          return [
                            <td key={`${i}${t}n`} className={`p-name ${cls}`}>{name}</td>,
                            <td key={`${i}${t}s`} className={`p-side ${cls}`} />,
                          ]
                        }),
                      )}
                    </tr>
                  ))}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
    </div>
  )
}
