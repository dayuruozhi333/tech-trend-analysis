import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTopics, getTrends, getTopicYearDetail, Topic, Trends, TopicYearDetail } from '../services/api';

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
  const [selectedTopicYearDetail, setSelectedTopicYearDetail] = useState<{ topicId: number; year: number } | null>(null);
  const [topicYearDetail, setTopicYearDetail] = useState<TopicYearDetail | null>(null);

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

  // 获取主题某年详情
  useEffect(() => {
    if (selectedTopicYearDetail) {
      (async () => {
        try {
          const detail = await getTopicYearDetail(selectedTopicYearDetail.topicId, selectedTopicYearDetail.year);
          setTopicYearDetail(detail);
        } catch (e: any) {
          setError(e?.message || '获取详情失败');
        }
      })();
    }
  }, [selectedTopicYearDetail]);

  const colors = useMemo(() => [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
    '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#ff9896', '#98df8a',
    '#c5b0d5', '#c49c94', '#aec7e8'
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>AI 技术趋势分析</div>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!sidebarCollapsed && (
          <aside style={{ width: 220, borderRight: '1px solid #eee', padding: '40px 16px 16px 16px', position: 'relative' }}>
            <button
              onClick={() => setSidebarCollapsed(true)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 24,
                height: 24,
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#374151',
                transition: 'all 0.2s ease'
              }}
              title="隐藏侧边栏"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.borderColor = '#9ca3af';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
            >
              ←
            </button>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => {
                  setActiveTab('list');
                  setSelectedTopicId(null);
                  setSelectedTopicYearDetail(null);
                  setTopicYearDetail(null);
                }}
                style={navBtnStyle(activeTab === 'list')}
              >
                主题列表
              </button>
              <button
                onClick={() => {
                  setActiveTab('trend');
                  setSelectedTopicYearDetail(null);
                  setTopicYearDetail(null);
                }}
                style={navBtnStyle(activeTab === 'trend')}
              >
                年度趋势总图
              </button>
              <button
                onClick={() => {
                  setActiveTab('map');
                  setSelectedTopicYearDetail(null);
                  setTopicYearDetail(null);
                }}
                style={navBtnStyle(activeTab === 'map')}
              >
                交互式主题地图
              </button>
            </nav>
            {error && <p style={{ color: 'red', marginTop: 12 }}>错误：{error}</p>}
          </aside>
        )}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            style={{
              position: 'fixed',
              top: '50%',
              left: 8,
              transform: 'translateY(-50%)',
              width: 24,
              height: 24,
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#374151',
              zIndex: 1000,
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
            title="展开侧边栏"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            →
          </button>
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
              {selectedTopicId && trends && !selectedTopicYearDetail && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>
                      {topics.find(t => t.id === selectedTopicId)?.label || `主题 ${selectedTopicId}`} 年度趋势
                    </h2>
                    <button onClick={() => setSelectedTopicId(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>返回列表</button>
                  </div>
                  <SingleTopicTrend
                    trends={trends}
                    topicId={selectedTopicId}
                    onPointClick={(topicId, year) => setSelectedTopicYearDetail({ topicId, year })}
                  />
                </div>
              )}
              {selectedTopicYearDetail && topicYearDetail && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>
                      {topicYearDetail.label} - {topicYearDetail.year}年详情
                    </h2>
                    <button
                      onClick={() => {
                        setSelectedTopicYearDetail(null);
                        setTopicYearDetail(null);
                      }}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}
                    >
                      返回趋势图
                    </button>
                  </div>
                  <TopicYearDetailView detail={topicYearDetail} />
                </div>
              )}
            </section>
          )}
          {activeTab === 'trend' && !selectedTopicYearDetail && (
            <section>
              <h2>年度趋势</h2>
              {trends && (
                <InteractiveTrends
                  trends={trends}
                  colors={colors}
                  onPointClick={(topicId, year) => setSelectedTopicYearDetail({ topicId, year })}
                />
              )}
            </section>
          )}
          {activeTab === 'trend' && selectedTopicYearDetail && topicYearDetail && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>
                  {topicYearDetail.label} - {topicYearDetail.year}年详情
                </h2>
                <button
                  onClick={() => {
                    setSelectedTopicYearDetail(null);
                    setTopicYearDetail(null);
                  }}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}
                >
                  返回趋势图
                </button>
              </div>
              <TopicYearDetailView detail={topicYearDetail} />
            </section>
          )}
          {activeTab === 'map' && (
            <section>
              <h2>交互式主题地图</h2>
              <iframe
                src="/api/vis/pyldavis_cn"
                style={{
                  width: '100%',
                  height: 600,
                  border: '1px solid #ddd',
                  borderRadius: 8
                }}
                title="pyLDAvis"
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

const InteractiveTrends: React.FC<{ trends: Trends; colors: string[]; onPointClick?: (topicId: number, year: number) => void }> = ({ trends, colors, onPointClick }) => {
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
        if (onPointClick) {
          onPointClick(topicId, year);
        }
      });
    });
  }, [trends, colors]);
  return <div ref={ref} style={{ width: '100%', height: 520 }} />;
};

const SingleTopicTrend: React.FC<{ trends: Trends; topicId: number; onPointClick?: (topicId: number, year: number) => void }> = ({ trends, topicId, onPointClick }) => {
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
        customdata: x.map((year) => ({ topicId: t.id, year })),
      }];
      const layout: any = {
        margin: { l: 56, r: 24, t: 8, b: 40 },
        xaxis: { title: '年份', rangeslider: { visible: true } },
        yaxis: { title: '强度' },
        showlegend: false,
      };
      const config: any = { responsive: true, displaylogo: false };
      Plotly.newPlot(ref.current as any, data, layout, config);

      // 添加点击事件
      if (onPointClick) {
        (ref.current as any).on('plotly_click', (event: any) => {
          const pt = event.points && event.points[0];
          if (!pt || !pt.customdata) return;
          const { topicId, year } = pt.customdata;
          onPointClick(topicId, year);
        });
      }
    });
  }, [trends, topicId, onPointClick]);
  return <div ref={ref} style={{ width: '100%', height: 520 }} />;
};

const TopicYearDetailView: React.FC<{ detail: TopicYearDetail }> = ({ detail }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  // 计算饼图数据
  const pieData = detail.terms.map(term => ({
    label: term.term,
    value: term.percent,
    docCount: Math.round((term.percent / 100) * detail.docCount)
  }));

  useEffect(() => {
    if (!ref.current) return;
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      const data = [{
        values: pieData.map(d => d.value),
        labels: pieData.map(d => d.label),
        type: 'pie',
        textinfo: 'label+percent',
        textposition: 'outside',
        hovertemplate: '<b>%{label}</b><br>占比: %{percent}<br>文献数: %{customdata}<extra></extra>',
        customdata: pieData.map(d => d.docCount.toLocaleString()),
        marker: {
          colors: [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
            '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#ff9896', '#98df8a',
            '#c5b0d5', '#c49c94', '#aec7e8', '#ffbb78', '#98df8a', '#d62728',
            '#ff9896', '#c5b0d5', '#c49c94', '#aec7e8', '#ffbb78', '#98df8a',
            '#d62728', '#ff9896', '#c5b0d5', '#c49c94', '#aec7e8', '#ffbb78',
            '#98df8a', '#d62728'
          ]
        }
      }];

      const layout = {
        margin: { l: 50, r: 200, t: 30, b: 50 },
        showlegend: true,
        legend: {
          orientation: 'v',
          x: 1.05,
          y: 0.5
        },
        autosize: true
      };

      const config = { responsive: true, displaylogo: false };
      Plotly.newPlot(ref.current, data, layout, config);
    });
  }, [detail]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
      {/* 基本信息 */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>基本信息</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280' }}>主题ID:</span>
            <span style={{ fontWeight: 500 }}>{detail.id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280' }}>年份:</span>
            <span style={{ fontWeight: 500 }}>{detail.year}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280' }}>文献数量:</span>
            <span style={{ fontWeight: 500 }}>{detail.docCount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 关键词统计 */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>关键词统计</h3>
          <span style={{ fontSize: 12, color: '#6b7280' }}>进度条显示相对比例</span>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {detail.terms.map((term, index) => {
              const docCount = Math.round((term.percent / 100) * detail.docCount);
              // 计算相对比例，以最大值为100%
              const maxPercent = Math.max(...detail.terms.map(t => t.percent));
              const relativePercent = maxPercent > 0 ? (term.percent / maxPercent) * 100 : 0;

              return (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: index % 2 === 0 ? '#f9fafb' : '#fff', borderRadius: 4 }}>
                  <span style={{ fontSize: 14 }}>{term.term}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      {docCount.toLocaleString()}篇 ({term.percent.toFixed(1)}%)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 60, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.max(relativePercent, 2)}%`, // 最小显示2%宽度，确保可见
                          height: '100%',
                          background: term.percent === maxPercent ? '#ef4444' : '#3b82f6' // 最高值用红色突出显示
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 20 }}>
                        {relativePercent.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 关键词饼图 */}
      <div style={{ gridColumn: '1 / -1', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>关键词分布饼图 (Top 20)</h3>
        <div ref={ref} style={{ width: '100%', height: 600 }} />
      </div>
    </div>
  );
};

