import {QuickActions} from './QuickActions'
import {fromHistorical} from '../../domain/shortlist'
import type { OpportunityRow } from '../../api/types'
import { competitionLabel } from '../../domain/competitions'
import { dateLabel, eurCompact, eurFull, num, pctPoints } from '../../domain/format'
import { positionLabel, subLabel } from '../../domain/positions'
import { useMode } from '../../state/prefs'
import { IconBookmark, IconColumns } from '../icons'
import { ValueChart } from '../charts/ValueChart'
import { Badge, Button, Drawer, KeyValue, Notice } from '../ui/primitives'

/** Ficha de una fila del catálogo histórico (sólo campos devueltos por la API). */
export function RowDetail({
  row,
  open,
  corte,
  modelo,
  onClose,
  onSave,
  onCompare,
  saved,
  inCompare,
}: {
  row: OpportunityRow | null
  open: boolean
  corte: string
  modelo: string
  onClose: () => void
  onSave: () => void
  onCompare: () => void
  saved: boolean
  inCompare: boolean
}) {
  const { advanced } = useMode()
  if (!row) return null
  const market=fromHistorical(row)
  return (
    <Drawer
      open={open}
      onClose={onClose}
      kicker="Ficha de catálogo histórico"
      title={row.name ?? 'Sin nombre'}
      footer={
        <>
          <Button variant="secondary" className="flex-1" icon={<IconBookmark size={15} fill={saved ? 'currentColor' : 'none'} />} disabled={saved} onClick={onSave}>
            {saved ? 'En seguimiento' : 'Guardar'}
          </Button>
          <Button variant="ghost" className="flex-1" icon={<IconColumns size={15} />} disabled={inCompare} onClick={onCompare}>
            {inCompare ? 'En comparador' : 'Comparar'}
          </Button>
        </>
      }
    >
      <p className="-mt-3 text-[0.82rem] text-salvia">
        {positionLabel(row.position)} · {subLabel(row.sub_position)} · {competitionLabel(row.competition_id)}
      </p>
      <div className="flex flex-wrap gap-2">
        {row.vigente_en_corte === true ? <Badge tone="lime">Vigente en el corte</Badge> : row.vigente_en_corte === false ? <Badge tone="gold">Histórico</Badge> : null}
        <Badge tone="lime">Alerta P95</Badge>
      </div>
      <ValueChart
        caption="Escala común desde 0 €."
        bars={[
          { key: 'obs', label: 'Observado', value: row.market_value_in_eur, color: 'var(--color-gold)' },
          { key: 'est', label: 'Estimado', sublabel: modelo, value: row.valor_estimado, color: 'var(--color-lime)' },
        ]}
      />
      <p className="text-[0.86rem] leading-relaxed text-salvia-2">
        En su fecha de valoración, el modelo estimó <span className="font-mono text-lime">{eurCompact(row.valor_estimado)}</span> frente a{' '}
        <span className="font-mono text-gold">{eurCompact(row.market_value_in_eur)}</span> observados ({pctPoints(row.diferencia_pct, 0)}).
      </p>
      <KeyValue
        items={[
          { k: 'Edad en la valoración', v: num(row.age) },
          { k: 'Minutos', v: num(row.minutos) },
          { k: 'Fecha de valoración', v: dateLabel(row.valuation_date) },
          { k: 'Cierre de temporada', v: dateLabel(row.fin_temporada) },
          ...(advanced
            ? [
                { k: 'Valor observado', v: eurFull(row.market_value_in_eur) },
                { k: 'Valor estimado', v: eurFull(row.valor_estimado) },
                { k: 'Exceso de residuo sobre P95', v: num(row.exceso_residuo, 3) },
                { k: 'Identificador', v: String(row.player_id) },
              ]
            : []),
          { k: 'Corte del dataset', v: dateLabel(corte) },
        ]}
      />
      {market&&<QuickActions row={market}/>}
      <Notice>
        El catálogo no incluye goles, asistencias, altura ni pie: no se puede calcular perfil GMM ni mapa táctico para esta ficha. Tampoco hay club,
        nacionalidad, contrato ni disponibilidad.
      </Notice>
    </Drawer>
  )
}
