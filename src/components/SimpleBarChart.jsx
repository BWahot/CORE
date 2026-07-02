export function SimpleBarChart({ data, title }) {
  if (!data || data.length === 0) {
    return <div className="bar-chart empty">No data available</div>;
  }

  const max = Math.max(...data.map((d) => Number(d.total || 0)), 1);
  const width = Math.max(300, data.length * 50);
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 60, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / data.length;

  return (
    <div className="bar-chart-container">
      <h4>{title}</h4>
      <svg width={width} height={height} className="bar-chart">
        {/* Y-axis */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#ddd" strokeWidth="1" />
        
        {/* X-axis */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#ddd" strokeWidth="1" />

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight - ratio * chartHeight;
          const value = Math.round(max * ratio);
          return (
            <g key={ratio}>
              <line x1={padding.left - 5} y1={y} x2={padding.left} y2={y} stroke="#999" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                {value}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, index) => {
          const x = padding.left + index * barWidth + barWidth / 2;
          const value = Number(item.total || 0);
          const barHeight = (value / max) * chartHeight;
          const y = height - padding.bottom - barHeight;

          return (
            <g key={index}>
              <rect
                x={x - barWidth / 2 + 5}
                y={y}
                width={barWidth - 10}
                height={barHeight}
                fill="#0f766e"
                opacity="0.8"
              />
              <text
                x={x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                fontSize="12"
                fill="#333"
                className="bar-label"
              >
                {item.label}
              </text>
              {value > 0 && (
                <text
                  x={x}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="bold"
                  fill="#0f766e"
                >
                  {value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
