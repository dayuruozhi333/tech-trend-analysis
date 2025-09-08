import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTopics, getTrends, Topic, Trends } from '../services/api';

// 中文说明：
// - 本页面集成：健康检查、主题列表、趋势折线图、pyLDAvis 内嵌
// - 仅使用原生 SVG 绘制简单折线图，减少依赖

export const App: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const [ts, tr] = await Promise.all([getTopics(), getTrends()]);
        setTopics(ts);
        setTrends(tr);
      } catch (e: any) {
        setError(e?.message || '请求失败');
      }
    })();
  }, []);

  const colors = useMemo(() => [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
    '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#ff9896', '#98df8a',
    '#c5b0d5', '#c49c94', '#aec7e8'
  ], []);

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>AI 技术趋势分析平台</h1>
      {error && <p style={{ color: 'red' }}>错误：{error}</p>}

      <section>
        <h2>主题列表（1 ~ 15）</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {topics.map(t => (
            <div key={t.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.id}. {t.label}</div>
              <div style={{ fontSize: 12, color: '#555' }}>
                {t.topTerms.slice(0, 6).map(tt => tt.term).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>年度趋势（15 个主题，可交互）</h2>
        {trends && <InteractiveTrends trends={trends} colors={colors} />}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>pyLDAvis 可视化</h2>
        <iframe
          src="/api/vis/pyldavis"
          style={{ width: '100%', height: 600, border: '1px solid #ddd', borderRadius: 8 }}
          title="pyLDAvis"
        />
      </section>
    </div>
  );
};

const margin = { top: 20, right: 20, bottom: 24, left: 36 };

const InteractiveTrends: React.FC<{ trends: Trends; colors: string[] }> = ({ trends, colors }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    // 动态加载 Plotly 以避免打包体积过大
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      const x = trends.years;
      const data = trends.topics.map((t, i) => ({
        x,
        y: t.series,
        type: 'scatter',
        mode: 'lines+markers',
        name: t.label,
        marker: { size: 6 },
        line: { width: 2, color: colors[i % colors.length] },
        hovertemplate: `${t.label}<br>%{x}: %{y}<extra></extra>`,
        customdata: x.map((year) => ({ topicId: t.id, year })),
      }));
      const layout: any = {
        margin: { l: 48, r: 24, t: 8, b: 36 },
        hovermode: 'closest',
        legend: { orientation: 'v' },
        xaxis: { title: '年份', rangeslider: { visible: true } },
        yaxis: { title: '强度' },
      };
      const config: any = {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['select2d', 'lasso2d'],
      };
      Plotly.newPlot(ref.current as any, data as any, layout, config);

      // 点击数据点跳转到详情
      (ref.current as any).on('plotly_click', (event: any) => {
        const pt = event.points && event.points[0];
        if (!pt || !pt.customdata) return;
        const { topicId, year } = pt.customdata;
        const url = `/topic/${topicId}/${year}`;
        window.history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
    });
  }, [trends, colors]);
  return <div ref={ref} style={{ width: '100%', height: 420 }} />;
};

