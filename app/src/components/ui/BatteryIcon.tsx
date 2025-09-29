// components/ui/BatteryIcon.tsx
import clsx from 'clsx';

type Props = {
  level?: number | null; // 0~100
  size?: number; // px, 정사각형
  className?: string;
  showPercentText?: boolean; // 옆에 "85%" 같은 텍스트 표시
};

export default function BatteryIcon({
  level,
  size = 20,
  className,
  showPercentText = false,
}: Props) {
  // 값 보정
  const pct = typeof level === 'number' ? Math.max(0, Math.min(100, Math.round(level))) : null;

  // 4단계 색상(1=빨강, 2=주황, 3=초록, 4=초록)
  // 0~30, 31~60, 61~90, 91~100
  const tier = pct === null ? 0 : pct <= 30 ? 1 : pct <= 60 ? 2 : pct <= 90 ? 3 : 4;

  const color =
    tier === 1
      ? '#ef4444' // red-500
      : tier === 2
        ? '#f59e0b' // amber-500
        : '#10b981'; // emerald-500 (3,4 공통)

  // SVG 크기
  const W = 24; // 전체 너비 (단자 포함)
  const H = 14; // 전체 높이
  const bodyX = 1.5,
    bodyY = 2; // 본체 좌표
  const bodyW = 20,
    bodyH = 10; // 본체 크기
  const capX = bodyX + bodyW + 0.5; // 단자 시작 x
  const capW = 1.5,
    capH = 6;
  const capY = (H - capH) / 2;

  // 채움 너비(본체 내부에 여백 1px씩)
  const innerX = bodyX + 1;
  const innerY = bodyY + 1;
  const innerW = bodyW - 2;
  const innerH = bodyH - 2;
  const fillW = pct === null ? 0 : (innerW * pct) / 100;

  return (
    <span className={clsx('inline-flex items-center gap-1', className)}>
      <svg
        width={size}
        height={(size * H) / W}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={pct === null ? 'Battery: unknown' : `Battery: ${pct}%`}
      >
        {/* 배경(투명), 필요시 다크모드 대비 */}
        {/* <rect x="0" y="0" width={W} height={H} fill="red" /> */}

        {/* 본체 외곽선 */}
        <rect
          x={bodyX}
          y={bodyY}
          width={bodyW}
          height={bodyH}
          rx="2"
          ry="2"
          fill="#ffffff" // slate-900 같은 어두운 테두리 배경 (테마에 맞게 바꿔도 됨)
          stroke="#D1D5DB"
          strokeWidth="1.2"
        />
        {/* 단자 */}
        <rect x={capX} y={capY} width={capW} height={capH} rx="0.8" ry="0.8" fill="#D1D5DB" />
        {/* 내부 바탕(빈 배터리 영역) */}
        <rect
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          rx="1.2"
          ry="1.2"
          fill="#F1F5F9" // gray-200
        />
        {/* 채워지는 부분 */}
        {pct !== null && (
          <rect
            x={innerX}
            y={innerY}
            width={Math.max(0, Math.min(innerW, fillW))}
            height={innerH}
            rx="1.2"
            ry="1.2"
            fill={color}
          />
        )}
      </svg>

      {showPercentText && <span className="text-xs text-gray-600">{pct ?? '-'}%</span>}
    </span>
  );
}
