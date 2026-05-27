'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '@/types/dashboard';
import { formatDateShort } from '@/lib/utils/dates';
import { BRAND_COLORS } from '@/lib/constants/brand';

/**
 * TrendChart - LineChart recharts d'une serie temporelle (Client
 * Component, recharts utilise des hooks et un ResizeObserver).
 *
 * Propriete cle de la charte Maison Givre : couleur or par defaut, fond
 * blanc, gridlines tres legeres (mg-noir/5). Axe X en `JJ/MM` court via
 * `formatDateShort`.
 *
 * a11y : `aria-label` resume le contenu (titre + nb points + total),
 * `role="img"` car le canvas SVG n'est pas semantique. Une legende
 * textuelle complementaire pourrait etre ajoutee si besoin.
 */

interface TrendChartProps {
  readonly data: readonly TrendPoint[];
  readonly title: string;
  /** Couleur de la ligne, hex (defaut : or Maison Givre). */
  readonly color?: string;
  /** `data-testid` du wrapper (defaut : trend-chart). */
  readonly testId?: string;
}

interface ChartDatum {
  readonly dateISO: string;
  readonly label: string;
  readonly value: number;
}

const WRAPPER_CLASSES =
  'flex flex-col gap-3 rounded-lg border border-mg-noir/10 bg-white p-6';
const TITLE_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const CHART_HEIGHT = 'h-64';

function toChartData(data: readonly TrendPoint[]): readonly ChartDatum[] {
  return data.map((point) => ({
    dateISO: point.dateISO,
    label: formatDateShort(point.dateISO).slice(0, 5),
    value: point.value,
  }));
}

function sumValues(data: readonly TrendPoint[]): number {
  return data.reduce((acc, point) => acc + point.value, 0);
}

export function TrendChart({
  data,
  title,
  color = BRAND_COLORS.or,
  testId,
}: TrendChartProps) {
  const chartData = toChartData(data);
  const total = sumValues(data);
  const ariaLabel = `${title} : ${total} sur ${data.length} jours.`;
  return (
    <div
      className={WRAPPER_CLASSES}
      data-testid={testId ?? 'trend-chart'}
      role="img"
      aria-label={ariaLabel}
    >
      <p className={TITLE_CLASSES}>{title}</p>
      <div className={CHART_HEIGHT}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={[...chartData]}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,13,13,0.05)" />
            <XAxis
              dataKey="label"
              stroke="rgba(13,13,13,0.4)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(13,13,13,0.4)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: BRAND_COLORS.ivoire,
                border: `1px solid ${BRAND_COLORS.or}`,
                borderRadius: 4,
                fontSize: 12,
              }}
              labelStyle={{ color: BRAND_COLORS.noir }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
