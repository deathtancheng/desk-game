interface RadarChartProps {
  data: { label: string; value: number }[];
}

export default function RadarChart({ data }: RadarChartProps) {
  const size = 220;
  const center = size / 2;
  const radius = 62;

  const point = (value: number, index: number) => {
    const angle = (Math.PI * 2 * index) / data.length - Math.PI / 2;
    const r = (value / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  const polygon = data.map((item, index) => point(item.value, index).join(",")).join(" ");
  const rings = [0.33, 0.66, 1].map((factor) =>
    data.map((_, index) => point(factor * 100, index).join(",")).join(" "),
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="群聊人格雷达图">
      {rings.map((ring) => (
        <polygon key={ring} points={ring} fill="none" stroke="rgba(36,31,26,0.10)" strokeWidth="1" />
      ))}
      {data.map((_, index) => {
        const [x, y] = point(100, index);
        return <line key={index} x1={center} y1={center} x2={x} y2={y} stroke="rgba(36,31,26,0.10)" strokeWidth="1" />;
      })}
      <polygon points={polygon} fill="rgba(180,85,47,0.16)" stroke="#b4552f" strokeWidth="1.5" />
      {data.map((item, index) => {
        const [x, y] = point(item.value, index);
        return <circle key={item.label} cx={x} cy={y} r="2.4" fill="#b4552f" />;
      })}
      {data.map((item, index) => {
        const angle = (Math.PI * 2 * index) / data.length - Math.PI / 2;
        const labelRadius = 88;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        return (
          <text
            key={`label-${item.label}`}
            x={x}
            y={y}
            fill="#7a6d5f"
            fontSize="9"
            fontFamily='"Songti SC", "STSong", serif'
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {item.label}
          </text>
        );
      })}
    </svg>
  );
}
