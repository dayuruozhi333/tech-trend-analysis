import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTopics, getTrends, Topic, Trends } from '../services/api';

// 中文说明：
// - 本页面集成：健康检查、主题列表、趋势折线图、pyLDAvis 内嵌
// - 仅使用原生 SVG 绘制简单折线图，减少依赖

export const App: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'list' | 'trend' | 'map'>('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>AI 技术趋势分析</div>
        <div>
          <button onClick={() => setSidebarCollapsed(v => !v)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
            {sidebarCollapsed ? '显示侧边栏' : '隐藏侧边栏'}
          </button>
        </div>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!sidebarCollapsed && (
          <aside style={{ width: 220, borderRight: '1px solid #eee', padding: 16 }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { setActiveTab('list'); setSelectedTopicId(null); }} style={navBtnStyle(activeTab === 'list')}>主题列表</button>
              <button onClick={() => setActiveTab('trend')} style={navBtnStyle(activeTab === 'trend')}>年度趋势</button>
              <button onClick={() => setActiveTab('map')} style={navBtnStyle(activeTab === 'map')}>交互式主题地图</button>
            </nav>
            {error && <p style={{ color: 'red', marginTop: 12 }}>错误：{error}</p>}
          </aside>
        )}
        <main style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          {activeTab === 'list' && (
            <section>
              {!selectedTopicId && <h2>主题列表</h2>}
              {!selectedTopicId && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {topics.map(t => (
                    <button key={t.id} onClick={() => setSelectedTopicId(t.id)} style={{ textAlign: 'left', border: '1px solid #ddd', borderRadius: 8, padding: 12, background: '#fff', cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.id}. {t.label}</div>
                      <div style={{ fontSize: 12, color: '#555' }}>
                        {t.topTerms.slice(0, 6).map(tt => tt.term).join(' · ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedTopicId && trends && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>主题 {selectedTopicId} 年度趋势</h2>
                    <button onClick={() => setSelectedTopicId(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>返回列表</button>
                  </div>
                  <SingleTopicTrend trends={trends} topicId={selectedTopicId} />
                </div>
              )}
            </section>
          )}
          {activeTab === 'trend' && (
            <section>
              <h2>年度趋势</h2>
              {trends && <InteractiveTrends trends={trends} colors={colors} />}
            </section>
          )}
          {activeTab === 'map' && (
            <section>
              <h2>交互式主题地图</h2>
              <iframe
                src="/api/vis/pyldavis_cn"
                style={{ width: '100%', height: 700, border: '1px solid #ddd', borderRadius: 8 }}
                title="topic-map"
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

const margin = { top: 20, right: 20, bottom: 24, left: 36 };

function navBtnStyle(active: boolean): React.CSSProperties {
  return {
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid ' + (active ? '#2563eb' : '#e5e7eb'),
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1d4ed8' : '#111827',
    cursor: 'pointer'
  };
}

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
        name: (t.label || '').split(' / ')[0],
        marker: { size: 6 },
        line: { width: 2, color: colors[i % colors.length] },
        hovertemplate: `${(t.label || '').split(' / ')[0]}<br>%{x}: %{y}<extra></extra>`,
        customdata: x.map((year) => ({ topicId: t.id, year })),
      }));
      const layout: any = {
        margin: { l: 56, r: 16, t: 16, b: 40 },
        hovermode: 'closest',
        legend: { orientation: 'v', font: { size: 10 } },
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
  return <div ref={ref} style={{ width: '100%', height: 520 }} />;
};

const SingleTopicTrend: React.FC<{ trends: Trends; topicId: number }> = ({ trends, topicId }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      const x = trends.years;
      const t = trends.topics.find(tt => tt.id === topicId);
      if (!t) return;
      const data: any = [{
        x,
        y: t.series,
        type: 'scatter',
        mode: 'lines+markers',
        name: (t.label || '').split(' / ')[0],
        marker: { size: 7 },
        line: { width: 3, color: '#2563eb' },
        hovertemplate: `${(t.label || '').split(' / ')[0]}<br>%{x}: %{y}<extra></extra>`,
      }];
      const layout: any = {
        margin: { l: 56, r: 24, t: 8, b: 40 },
        xaxis: { title: '年份', rangeslider: { visible: true } },
        yaxis: { title: '强度' },
        showlegend: false,
      };
      const config: any = { responsive: true, displaylogo: false };
      Plotly.newPlot(ref.current as any, data, layout, config);
    });
  }, [trends, topicId]);
  return <div ref={ref} style={{ width: '100%', height: 520 }} />;
};

