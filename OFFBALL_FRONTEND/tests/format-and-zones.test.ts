import { describe, expect, it } from 'vitest'
import { eurCompact, fractionLabel, fractionToPct, pctPoints, daysBetween, parseEuroInput, isoDay } from '../src/domain/format'
import { intensity, intensityColor, zoneSlot } from '../src/domain/zones'

describe('porcentajes: una sola conversión', () => {
  it('fracciones GMM/afinidad se multiplican por 100 una vez', () => {
    expect(fractionToPct(0.4123)).toBeCloseTo(41.23, 6)
    expect(fractionLabel(0.4123)).toBe('41,2 %')
    expect(fractionLabel(1)).toBe('100,0 %')
  })
  it('diferencia_pct ya viene en escala 0–100 y NO se multiplica', () => {
    expect(pctPoints(110.5)).toBe('+110,5 %')
    expect(pctPoints(-12.25, 1)).toBe('−12,3 %')
  })
  it('las cuatro afinidades suman 100 % tras la conversión', () => {
    const af = { DC: 0.41, EI: 0.22, ED: 0.17, MCO: 0.2 }
    const total = Object.values(af).reduce((a, v) => a + (fractionToPct(v) ?? 0), 0)
    expect(total).toBeCloseTo(100, 6)
  })
  it('N/D para ausentes, nunca 0', () => {
    expect(fractionLabel(null)).toBe('N/D')
    expect(pctPoints(null)).toBe('N/D')
    expect(eurCompact(null)).toBe('N/D')
  })
})

describe('formato de euros y fechas', () => {
  it('formato compacto', () => {
    expect(eurCompact(28_000_000)).toBe('28,0 M€')
    expect(eurCompact(750_000)).toBe('750 k€')
  })
  it('parseo de importes', () => {
    expect(parseEuroInput('')).toBeNull()
    expect(parseEuroInput('750.000')).toBe(750000)
    expect(Number.isNaN(parseEuroInput('7a'))).toBe(true)
  })
  it('días entre fechas ISO y fechas con hora', () => {
    expect(daysBetween('2025-05-25', '2025-06-10')).toBe(16)
    expect(isoDay('2024-06-30T00:00:00.000')).toBe('2024-06-30')
  })
})

describe('zonas y escala de intensidad', () => {
  it('reconoce alias y no inventa posiciones', () => {
    expect(zoneSlot('DC')).toBe('DC')
    expect(zoneSlot('Extremo izquierdo')).toBe('EI')
    expect(zoneSlot('ED')).toBe('ED')
    expect(zoneSlot('MCO')).toBe('MCO')
    expect(zoneSlot('Lateral')).toBeNull()
  })
  it('valores iguales → mismo color; escala monótona y fija', () => {
    expect(intensityColor(0.3)).toBe(intensityColor(0.3))
    expect(intensity(0.25)).toBeCloseTo(0.5, 9)
    expect(intensity(0.1)).toBeLessThan(intensity(0.2))
    expect(intensity(2)).toBe(1)
    expect(intensity(-1)).toBe(0)
  })
})
