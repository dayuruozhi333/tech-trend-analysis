import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTopics, getTrends, getTopicYearDetail, Topic, Trends, TopicYearDetail, getAllTopicsDocCounts, getTopicAllYears, getYearAllTopics, TopicDocCount, TopicAllYearsData, getKeywordsAllTopicsAllYears, getKeywordsAllTopicsYear, getKeywordsTopicAllYears, getKeywordsTopicYear, Keyword } from '../services/api';
import { AIAnalysis } from '../components/AIAnalysis';

// 中文说明：
// - 本页面集成：健康检查、主题列表、趋势折线图、pyLDAvis 内嵌
// - 仅使用原生 SVG 绘制简单折线图，减少依赖

export const App: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'list' | 'basic' | 'trend' | 'map' | 'keywords'>('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedTopicYearDetail, setSelectedTopicYearDetail] = useState<{ topicId: number; year: number } | null>(null);
  const [topicYearDetail, setTopicYearDetail] = useState<TopicYearDetail | null>(null);
  // 基本数据界面的选择状态
  const [basicDataTopicId, setBasicDataTopicId] = useState<number | 'all'>('all');
  const [basicDataYear, setBasicDataYear] = useState<number | 'all'>('all');
  // 文献关键词界面的选择状态
  const [keywordsTopicId, setKeywordsTopicId] = useState<number | 'all'>('all');
  const [keywordsYear, setKeywordsYear] = useState<number | 'all'>('all');
  // 身份模式：'all' 全部可见，'technical' 技术使用者，'management' 管理使用者
  const [userMode, setUserMode] = useState<'all' | 'technical' | 'management'>('all');

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

  // 定义各身份可见的导航项
  const visibleTabs = useMemo(() => {
    if (userMode === 'all') {
      return ['list', 'basic', 'trend', 'map', 'keywords'];
    } else if (userMode === 'technical') {
      return ['trend', 'map', 'keywords'];
    } else {
      return ['list', 'basic'];
    }
  }, [userMode]);

  // 如果当前activeTab不在可见列表中，切换到第一个可见的tab
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] as typeof activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>AI 文献主题分析</div>
        {/* 身份模式切换开关 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#6b7280', marginRight: 4 }}>身份模式：</span>
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
            <button
              onClick={() => setUserMode('all')}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: userMode === 'all' ? 600 : 400,
                background: userMode === 'all' ? '#2563eb' : '#fff',
                color: userMode === 'all' ? '#fff' : '#6b7280',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRight: '1px solid #e5e7eb'
              }}
              onMouseEnter={(e) => {
                if (userMode !== 'all') {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (userMode !== 'all') {
                  e.currentTarget.style.background = '#fff';
                }
              }}
            >
              全部
            </button>
            <button
              onClick={() => setUserMode('technical')}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: userMode === 'technical' ? 600 : 400,
                background: userMode === 'technical' ? '#2563eb' : '#fff',
                color: userMode === 'technical' ? '#fff' : '#6b7280',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRight: '1px solid #e5e7eb'
              }}
              onMouseEnter={(e) => {
                if (userMode !== 'technical') {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (userMode !== 'technical') {
                  e.currentTarget.style.background = '#fff';
                }
              }}
            >
              研究者
            </button>
            <button
              onClick={() => setUserMode('management')}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: userMode === 'management' ? 600 : 400,
                background: userMode === 'management' ? '#2563eb' : '#fff',
                color: userMode === 'management' ? '#fff' : '#6b7280',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (userMode !== 'management') {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (userMode !== 'management') {
                  e.currentTarget.style.background = '#fff';
                }
              }}
            >
              管理者
            </button>
          </div>
        </div>
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
              {visibleTabs.includes('list') && (
                <button
                  onClick={() => {
                    setActiveTab('list');
                    setSelectedTopicYearDetail(null);
                    setTopicYearDetail(null);
                  }}
                  style={navBtnStyle(activeTab === 'list')}
                >
                  主题列表
                </button>
              )}
              {visibleTabs.includes('basic') && (
                <button
                  onClick={() => {
                    setActiveTab('basic');
                    setSelectedTopicYearDetail(null);
                    setTopicYearDetail(null);
                    setBasicDataTopicId('all');
                    setBasicDataYear('all');
                  }}
                  style={navBtnStyle(activeTab === 'basic')}
                >
                  基本数据
                </button>
              )}
              {visibleTabs.includes('trend') && (
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
              )}
              {visibleTabs.includes('map') && (
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
              )}
              {visibleTabs.includes('keywords') && (
                <button
                  onClick={() => {
                    setActiveTab('keywords');
                    setSelectedTopicYearDetail(null);
                    setTopicYearDetail(null);
                    setKeywordsTopicId('all');
                    setKeywordsYear('all');
                  }}
                  style={navBtnStyle(activeTab === 'keywords')}
                >
                  文献关键词
                </button>
              )}
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
              <h2>主题列表</h2>
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  {topics.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTab('basic');
                        setBasicDataTopicId(t.id);
                        setBasicDataYear('all');
                      }}
                      style={{
                        textAlign: 'left',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 20,
                        background: '#fff',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        height: 320,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* 主题名称 - 固定高度区域 */}
                      <div style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#111827',
                        marginBottom: 12,
                        lineHeight: 1.4,
                        height: 50,
                        display: 'flex',
                        alignItems: 'flex-start',
                        overflow: 'hidden'
                      }}>
                        {t.label}
                      </div>

                      {/* 代表学者 - 固定高度区域 */}
                      <div style={{
                        marginBottom: 12,
                        height: 60,
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <div style={{
                          fontSize: 12,
                          color: '#6b7280',
                          marginBottom: 6,
                          fontWeight: 500,
                          height: 18
                        }}>
                          代表学者
                        </div>
                        <div style={{
                          fontSize: 13,
                          color: '#374151',
                          lineHeight: 1.5,
                          height: 36,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {t.representativeAuthors && t.representativeAuthors.length > 0
                            ? t.representativeAuthors.slice(0, 5).join('; ')
                            : '暂无数据'}
                        </div>
                      </div>

                      {/* 关键词标签 - 固定高度区域 */}
                      <div style={{
                        marginBottom: 12,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        height: 60,
                        overflow: 'hidden',
                        alignContent: 'flex-start'
                      }}>
                        {t.topTerms.slice(0, 6).map((tt, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              background: '#e0f2fe',
                              color: '#0369a1',
                              borderRadius: 12,
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              height: 'fit-content'
                            }}
                          >
                            {tt.term}
                          </span>
                        ))}
                      </div>

                      {/* 主题说明 - 固定高度区域，使用剩余空间 */}
                      <div style={{
                        fontSize: 13,
                        color: '#6b7280',
                        lineHeight: 1.6,
                        flex: 1,
                        paddingTop: 12,
                        borderTop: '1px solid #f3f4f6',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {t.description || '暂无描述'}
                      </div>
                    </button>
                  ))}
                </div>
                <AIAnalysis
                  content={topics.map(t => `${t.id}. ${t.label}\n关键词: ${t.topTerms.slice(0, 6).map(tt => tt.term).join(' · ')}`).join('\n\n')}
                  type="topics"
                />
              </>
            </section>
          )}
          {activeTab === 'basic' && (
            <section>
              <h2>基本数据</h2>
              <BasicDataView
                topics={topics}
                trends={trends}
                selectedTopicId={basicDataTopicId}
                selectedYear={basicDataYear}
                onTopicChange={setBasicDataTopicId}
                onYearChange={setBasicDataYear}
                colors={colors}
              />
            </section>
          )}
          {activeTab === 'trend' && !selectedTopicYearDetail && (
            <section>
              <h2>年度趋势</h2>
              {trends && topics && (
                <>
                  <InteractiveTrends
                    trends={trends}
                    topics={topics}
                    colors={colors}
                    onPointClick={(topicId, year) => setSelectedTopicYearDetail({ topicId, year })}
                  />
                  <AIAnalysis
                    content={`年度趋势分析:\n\n各主题发展趋势:\n${trends.topics.map(topic => `${topic.id}. ${topic.label}\n${trends.years.map((year, index) => `${year}: ${topic.series[index]?.toFixed(3) || '0'}`).join(', ')}`).join('\n\n')}`}
                    type="trends"
                  />
                </>
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
              <AIAnalysis
                content={`主题关系地图分析:\n\n主题分布和关系:\n${topics.map(t => `${t.id}. ${t.label}\n关键词: ${t.topTerms.slice(0, 5).map(tt => tt.term).join(', ')}`).join('\n\n')}\n\n注: 此分析基于pyLDAvis生成的多维主题关系图，展示了各主题在语义空间中的位置和关联性。`}
                type="map"
              />
            </section>
          )}
          {activeTab === 'keywords' && (
            <section>
              <h2>文献关键词</h2>
              <KeywordsView
                topics={topics}
                trends={trends}
                selectedTopicId={keywordsTopicId}
                selectedYear={keywordsYear}
                onTopicChange={setKeywordsTopicId}
                onYearChange={setKeywordsYear}
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

const InteractiveTrends: React.FC<{ trends: Trends; topics: Topic[]; colors: string[]; onPointClick?: (topicId: number, year: number) => void }> = ({ trends, topics, colors, onPointClick }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  // 默认选择"全部"（所有主题）
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<number>>(
    new Set(trends.topics.map(t => t.id))
  );

  // 当 trends 数据更新时，同步更新选中的主题ID
  useEffect(() => {
    const allTopicIds = new Set(trends.topics.map(t => t.id));
    setSelectedTopicIds(prev => {
      // 如果之前的选择中有不存在的主题ID，则更新
      const validIds = Array.from(prev).filter(id => allTopicIds.has(id));
      if (validIds.length === 0 || validIds.length !== prev.size) {
        return allTopicIds; // 默认选择全部
      }
      return prev;
    });
  }, [trends]);

  // 清空所有选择
  const handleClear = () => {
    setSelectedTopicIds(new Set());
  };

  // 处理主题选择
  const handleTopicToggle = (topicId: number | 'all') => {
    setSelectedTopicIds(prev => {
      if (topicId === 'all') {
        // 如果点击"全部"
        if (prev.size === trends.topics.length) {
          // 当前显示全部，则清空所有选择
          return new Set();
        } else {
          // 当前不是全部，则显示全部
          return new Set(trends.topics.map(t => t.id));
        }
      } else {
        // 切换单个主题
        const newSet = new Set(prev);
        if (newSet.has(topicId)) {
          // 如果已选中，移除
          if (newSet.size === 1) {
            // 如果只剩一个，则清空所有选择
            return new Set();
          } else {
            newSet.delete(topicId);
          }
        } else {
          // 如果未选中，添加
          newSet.add(topicId);
        }
        return newSet;
      }
    });
  };

  useEffect(() => {
    if (!ref.current) return;
    // 动态加载 Plotly 以避免打包体积过大
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      const x = trends.years;

      // 根据选中的主题过滤数据
      const filteredTopics = trends.topics.filter(t => selectedTopicIds.has(t.id));

      // 如果没有选中任何主题，显示空白图表，但保持x轴范围
      const data = filteredTopics.length === 0 ? [] : filteredTopics.map((t, i) => {
        const originalIndex = trends.topics.findIndex(tt => tt.id === t.id);
        const topicColor = colors[originalIndex % colors.length];
        const topicLabel = (t.label || '').split(' / ')[0];
        return {
          x,
          y: t.series,
          type: 'scatter',
          mode: 'lines+markers',
          name: topicLabel,
          marker: { size: 6 },
          line: { width: 2, color: topicColor },
          hovertemplate: `${topicLabel}<br>%{x}: %{y}<extra></extra>`,
          customdata: x.map((year) => ({ topicId: t.id, year })),
        };
      });

      // 计算Y轴范围，当显示的折线不多时自动缩放
      let yMin = 0;
      let yMax = 0.2;

      if (filteredTopics.length === 0) {
        // 如果没有选中任何主题，使用默认范围
        yMin = 0;
        yMax = 0.2;
      } else if (filteredTopics.length > 0 && filteredTopics.length <= 5) {
        // 当显示的折线不超过5条时，自动调整Y轴范围
        const allValues = filteredTopics.flatMap(t => t.series);
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const range = maxValue - minValue;

        // 如果数据范围很小，使用固定边距；否则使用百分比边距
        const padding = range > 0.01 ? range * 0.15 : 0.01; // 15%的边距，最小0.01
        yMin = Math.max(0, minValue - padding);
        yMax = maxValue + padding;

        // 确保最小值不为负，最大值不超过合理范围
        if (yMax > 0.3) yMax = 0.3;
        // 如果数据范围很小，确保Y轴至少有一定的显示范围
        if (yMax - yMin < 0.02) {
          const center = (yMin + yMax) / 2;
          yMin = Math.max(0, center - 0.01);
          yMax = center + 0.01;
        }
      }

      const layout: any = {
        margin: { l: 56, r: 16, t: 16, b: 40 },
        hovermode: 'closest',
        showlegend: false, // 不在图表内显示图例，我们在上方自定义显示
        xaxis: {
          title: '年份',
          rangeslider: { visible: true },
          // 确保x轴范围始终显示完整年份范围
          range: [Math.min(...x) - 0.5, Math.max(...x) + 0.5]
        },
        yaxis: {
          title: '强度',
          range: [yMin, yMax]
        },
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
  }, [trends, colors, selectedTopicIds]);

  // 检查是否选择了所有主题
  const isAllSelected = selectedTopicIds.size === trends.topics.length;

  return (
    <div>
      {/* 主题筛选器 */}
      <div style={{
        marginBottom: 16,
        padding: '12px 16px',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#fff',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center'
        }}>
          <span style={{
            fontSize: 14,
            color: '#6b7280',
            marginRight: 8,
            fontWeight: 500
          }}>
            主题筛选：
          </span>
          <button
            onClick={() => handleTopicToggle('all')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid ' + (isAllSelected ? '#2563eb' : '#e5e7eb'),
              background: isAllSelected ? '#2563eb' : '#fff',
              color: isAllSelected ? '#fff' : '#111827',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: isAllSelected ? 500 : 400,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isAllSelected) {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAllSelected) {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }
            }}
          >
            全部
          </button>
          {trends.topics.map((topic) => {
            const isSelected = selectedTopicIds.has(topic.id);
            const topicLabel = (topic.label || '').split(' / ')[0];
            return (
              <button
                key={topic.id}
                onClick={() => handleTopicToggle(topic.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid ' + (isSelected ? '#2563eb' : '#e5e7eb'),
                  background: isSelected ? '#2563eb' : '#fff',
                  color: isSelected ? '#fff' : '#111827',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isSelected ? 500 : 400,
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}
              >
                {topicLabel}
              </button>
            );
          })}
        </div>
        {/* 清空按钮 - 位于最右下角 */}
        <button
          onClick={handleClear}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 16,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #dc2626',
            background: '#fff',
            color: '#dc2626',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 400,
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fef2f2';
            e.currentTarget.style.borderColor = '#b91c1c';
            e.currentTarget.style.color = '#b91c1c';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.borderColor = '#dc2626';
            e.currentTarget.style.color = '#dc2626';
          }}
        >
          清空
        </button>
      </div>
      {/* 图例区域 - 显示在趋势图上方 */}
      {selectedTopicIds.size > 0 && (
        <div style={{
          marginBottom: 12,
          padding: '8px 12px',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fff'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 10px',
            alignItems: 'center',
            justifyContent: 'flex-start',
            maxHeight: 'none'
          }}>
            {trends.topics
              .filter(t => selectedTopicIds.has(t.id))
              .map((topic) => {
                const originalIndex = trends.topics.findIndex(tt => tt.id === topic.id);
                const topicColor = colors[originalIndex % colors.length];
                const topicLabel = (topic.label || '').split(' / ')[0];
                // 根据选中的主题数量调整字体大小
                const totalSelected = selectedTopicIds.size;
                const fontSize = totalSelected > 10 ? 10 : totalSelected > 8 ? 11 : 12;
                return (
                  <div
                    key={topic.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: fontSize,
                      color: '#374151',
                      lineHeight: '1.4'
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 2.5,
                        backgroundColor: topicColor,
                        borderRadius: 1,
                        flexShrink: 0
                      }}
                    />
                    <span style={{ whiteSpace: 'nowrap' }}>{topicLabel}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: 520 }} />
    </div>
  );
};

const BasicDataView: React.FC<{
  topics: Topic[];
  trends: Trends | null;
  selectedTopicId: number | 'all';
  selectedYear: number | 'all';
  onTopicChange: (topicId: number | 'all') => void;
  onYearChange: (year: number | 'all') => void;
  colors: string[];
}> = ({ topics, trends, selectedTopicId, selectedYear, onTopicChange, onYearChange, colors }) => {
  const [allTopicsData, setAllTopicsData] = useState<TopicDocCount[] | null>(null);
  const [topicAllYearsData, setTopicAllYearsData] = useState<TopicAllYearsData | null>(null);
  const [yearAllTopicsData, setYearAllTopicsData] = useState<TopicDocCount[] | null>(null);
  const [topicYearDetail, setTopicYearDetail] = useState<TopicYearDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // 根据选择加载不同数据
  useEffect(() => {
    setLoading(true);

    if (selectedTopicId === 'all' && selectedYear === 'all') {
      // 情况1: 全部主题+全部年份
      getAllTopicsDocCounts()
        .then(data => {
          setAllTopicsData(data);
          setTopicAllYearsData(null);
          setYearAllTopicsData(null);
          setTopicYearDetail(null);
          setLoading(false);
        })
        .catch(() => {
          setAllTopicsData(null);
          setLoading(false);
        });
    } else if (selectedTopicId !== 'all' && selectedYear === 'all') {
      // 情况2: 某一主题+全部年份
      getTopicAllYears(selectedTopicId)
        .then(data => {
          setTopicAllYearsData(data);
          setAllTopicsData(null);
          setYearAllTopicsData(null);
          setTopicYearDetail(null);
          setLoading(false);
        })
        .catch(() => {
          setTopicAllYearsData(null);
          setLoading(false);
        });
    } else if (selectedTopicId === 'all' && selectedYear !== 'all') {
      // 情况3: 全部主题+某一年份
      getYearAllTopics(selectedYear)
        .then(data => {
          setYearAllTopicsData(data);
          setAllTopicsData(null);
          setTopicAllYearsData(null);
          setTopicYearDetail(null);
          setLoading(false);
        })
        .catch(() => {
          setYearAllTopicsData(null);
          setLoading(false);
        });
    } else if (selectedTopicId !== 'all' && selectedYear !== 'all') {
      // 情况4: 某一主题+某一年份
      getTopicYearDetail(selectedTopicId, selectedYear)
        .then(data => {
          setTopicYearDetail(data);
          setAllTopicsData(null);
          setTopicAllYearsData(null);
          setYearAllTopicsData(null);
          setLoading(false);
        })
        .catch(() => {
          setTopicYearDetail(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [selectedTopicId, selectedYear]);

  const availableYears = trends?.years || [];

  return (
    <div>
      {/* 选择器区域 */}
      <div style={{
        marginBottom: 24,
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#fff'
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 14, color: '#6b7280', marginBottom: 4, display: 'block' }}>
              选择主题：
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => onTopicChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                minWidth: 200
              }}
            >
              <option value="all">全部主题</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label.split(' / ')[0]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 14, color: '#6b7280', marginBottom: 4, display: 'block' }}>
              选择年份：
            </label>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                minWidth: 120
              }}
            >
              <option value="all">全部年份</option>
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 详情显示区域 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          加载中...
        </div>
      )}

      {!loading && selectedTopicId === 'all' && selectedYear === 'all' && allTopicsData && (
        <AllTopicsAllYearsView data={allTopicsData} colors={colors} />
      )}

      {!loading && selectedTopicId !== 'all' && selectedYear === 'all' && topicAllYearsData && (
        <TopicAllYearsView data={topicAllYearsData} colors={colors} />
      )}

      {!loading && selectedTopicId === 'all' && selectedYear !== 'all' && yearAllTopicsData && (
        <YearAllTopicsView data={yearAllTopicsData} year={selectedYear} colors={colors} />
      )}

      {!loading && selectedTopicId !== 'all' && selectedYear !== 'all' && topicYearDetail && (
        <TopicYearDetailView detail={topicYearDetail} />
      )}

      {!loading && !allTopicsData && !topicAllYearsData && !yearAllTopicsData && !topicYearDetail && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          暂无数据
        </div>
      )}
    </div>
  );
};

// 全部主题+全部年份视图
const AllTopicsAllYearsView: React.FC<{ data: TopicDocCount[]; colors: string[] }> = ({ data, colors }) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const pieRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!barRef.current || !pieRef.current) return;
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      // 柱形图
      const maxValue = Math.max(...data.map(d => d.docCount));
      const yAxisMax = maxValue * 1.15; // 增加15%的上边距，确保最高值不被遮挡
      const barData = [{
        x: data.map(d => d.label.split(' / ')[0]),
        y: data.map(d => d.docCount),
        type: 'bar',
        marker: { color: colors.slice(0, data.length) },
        text: data.map(d => d.docCount.toLocaleString()),
        textposition: 'outside',
        hovertemplate: '<b>%{x}</b><br>文献数量: %{y}<extra></extra>'
      }];
      const barLayout = {
        title: '各主题文献数量',
        xaxis: { title: '主题' },
        yaxis: { title: '文献数量', range: [0, yAxisMax] },
        margin: { l: 60, r: 20, t: 60, b: 100 },
      };
      Plotly.newPlot(barRef.current, barData, barLayout, { responsive: true, displaylogo: false });

      // 饼图
      const pieData = [{
        values: data.map(d => d.docCount),
        labels: data.map(d => d.label.split(' / ')[0]),
        type: 'pie',
        textinfo: 'label+percent',
        textposition: 'outside',
        hovertemplate: '<b>%{label}</b><br>文献数量: %{value}<br>占比: %{percent}<extra></extra>',
        marker: { colors: colors.slice(0, data.length) }
      }];
      const pieLayout = {
        title: '各主题文献数量分布',
        margin: { l: 50, r: 200, t: 40, b: 50 },
        showlegend: true,
        legend: { orientation: 'v', x: 1.05, y: 0.5 }
      };
      Plotly.newPlot(pieRef.current, pieData, pieLayout, { responsive: true, displaylogo: false });
    });
  }, [data, colors]);

  const totalDocs = data.reduce((sum, d) => sum + d.docCount, 0);

  return (
    <div>
      {/* 统计信息 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>总主题数</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{data.length}</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>总文献数</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{totalDocs.toLocaleString()}</div>
        </div>
      </div>

      {/* 文献数量列表 */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        marginBottom: 24
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>各主题文献数量</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 16px' }}>
          {data.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: index % 2 === 0 ? '#f9fafb' : '#fff',
                borderRadius: 4
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label.split(' / ')[0]}</span>
              <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>{item.docCount.toLocaleString()} 篇</span>
            </div>
          ))}
        </div>
      </div>

      {/* 柱形图 */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        marginBottom: 24
      }}>
        <div ref={barRef} style={{ width: '100%', height: 500 }} />
      </div>

      {/* 饼图 */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        marginBottom: 24
      }}>
        <div ref={pieRef} style={{ width: '100%', height: 500 }} />
      </div>

      {/* AI分析 */}
      <AIAnalysis
        content={`全部主题文献数量分析:\n\n各主题文献数量:\n${data.map(d => `${d.id}. ${d.label.split(' / ')[0]}: ${d.docCount.toLocaleString()} 篇`).join('\n')}\n\n总主题数: ${data.length}\n总文献数: ${totalDocs.toLocaleString()} 篇`}
        type="general"
      />
    </div>
  );
};

// 某一主题+全部年份视图
const TopicAllYearsView: React.FC<{ data: TopicAllYearsData; colors: string[] }> = ({ data, colors }) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const pieRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!barRef.current || !pieRef.current) return;
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      // 各年份文献数量柱形图
      const barData = [{
        x: data.years,
        y: data.docCounts,
        type: 'bar',
        marker: { color: colors[0] },
        text: data.docCounts.map(c => c.toLocaleString()),
        textposition: 'outside',
        hovertemplate: '<b>%{x}年</b><br>文献数量: %{y}<extra></extra>'
      }];
      const barLayout = {
        title: `${data.label.split(' / ')[0]} - 各年份文献数量`,
        xaxis: { title: '年份' },
        yaxis: { title: '文献数量' },
        margin: { l: 60, r: 20, t: 40, b: 50 },
      };
      Plotly.newPlot(barRef.current, barData, barLayout, { responsive: true, displaylogo: false });

      // 关键词饼图
      if (data.keywords.length > 0) {
        const totalCount = data.keywords.reduce((sum, k) => sum + k.count, 0);
        const pieData = [{
          values: data.keywords.map(k => k.count),
          labels: data.keywords.map(k => k.term),
          type: 'pie',
          textinfo: 'label+percent',
          textposition: 'outside',
          hovertemplate: '<b>%{label}</b><br>出现次数: %{value}<br>占比: %{percent}<extra></extra>',
          marker: { colors: colors.slice(0, data.keywords.length) }
        }];
        const pieLayout = {
          title: `${data.label.split(' / ')[0]} - 关键词分布`,
          margin: { l: 50, r: 200, t: 40, b: 50 },
          showlegend: true,
          legend: { orientation: 'v', x: 1.05, y: 0.5 }
        };
        Plotly.newPlot(pieRef.current, pieData, pieLayout, { responsive: true, displaylogo: false });
      }
    });
  }, [data, colors]);

  const totalDocs = data.docCounts.reduce((sum, c) => sum + c, 0);

  return (
    <div>
      {/* 统计信息 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>主题</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{data.label.split(' / ')[0]}</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>总文献数</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{totalDocs.toLocaleString()}</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>年份范围</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
            {data.years[0]} - {data.years[data.years.length - 1]}
          </div>
        </div>
      </div>

      {/* 关键词统计 */}
      {data.keywords.length > 0 && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          background: '#fff',
          marginBottom: 24
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>关键词统计 (2020-2025) - Top{data.keywords.length}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 16px' }}>
            {(() => {
              // 计算所有关键词的总出现次数
              const totalKeywordCount = data.keywords.reduce((sum, k) => sum + k.count, 0);
              return data.keywords.map((keyword, index) => {
                // 计算该关键词在所有关键词中的相对百分比
                const percent = totalKeywordCount > 0 ? (keyword.count / totalKeywordCount * 100) : 0;
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 12px',
                      background: index % 2 === 0 ? '#f9fafb' : '#fff',
                      borderRadius: 4
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{keyword.term}</span>
                    <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {keyword.count} 次 ({percent.toFixed(1)}%)
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 各年份文献数量柱形图 */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        marginBottom: 24
      }}>
        <div ref={barRef} style={{ width: '100%', height: 400 }} />
      </div>

      {/* 关键词饼图 */}
      {data.keywords.length > 0 && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          background: '#fff',
          marginBottom: 24
        }}>
          <div ref={pieRef} style={{ width: '100%', height: 500 }} />
        </div>
      )}

      {/* AI分析 */}
      <AIAnalysis
        content={`${data.label.split(' / ')[0]} - 各年份文献数量分析:\n\n年份范围: ${data.years[0]} - ${data.years[data.years.length - 1]}\n总文献数: ${totalDocs.toLocaleString()} 篇\n\n各年份文献数量:\n${data.years.map((year, idx) => `${year}年: ${data.docCounts[idx].toLocaleString()} 篇`).join('\n')}\n\n关键词统计:\n${data.keywords.slice(0, 10).map(k => `${k.term}: ${k.count} 次`).join('\n')}`}
        type="general"
      />
    </div>
  );
};

// 全部主题+某一年份视图
const YearAllTopicsView: React.FC<{ data: TopicDocCount[]; year: number; colors: string[] }> = ({ data, year, colors }) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const pieRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!barRef.current || !pieRef.current) return;
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      // 柱形图
      const maxValue = Math.max(...data.map(d => d.docCount));
      const yAxisMax = maxValue * 1.15; // 增加15%的上边距，确保最高值不被遮挡
      const barData = [{
        x: data.map(d => d.label.split(' / ')[0]),
        y: data.map(d => d.docCount),
        type: 'bar',
        marker: { color: colors.slice(0, data.length) },
        text: data.map(d => d.docCount.toLocaleString()),
        textposition: 'outside',
        hovertemplate: '<b>%{x}</b><br>文献数量: %{y}<extra></extra>'
      }];
      const barLayout = {
        title: `${year}年各主题文献数量`,
        xaxis: { title: '主题' },
        yaxis: { title: '文献数量', range: [0, yAxisMax] },
        margin: { l: 60, r: 20, t: 60, b: 100 },
      };
      Plotly.newPlot(barRef.current, barData, barLayout, { responsive: true, displaylogo: false });

      // 饼图
      const pieData = [{
        values: data.map(d => d.docCount),
        labels: data.map(d => d.label.split(' / ')[0]),
        type: 'pie',
        textinfo: 'label+percent',
        textposition: 'outside',
        hovertemplate: '<b>%{label}</b><br>文献数量: %{value}<br>占比: %{percent}<extra></extra>',
        marker: { colors: colors.slice(0, data.length) }
      }];
      const pieLayout = {
        title: `${year}年各主题文献数量分布`,
        margin: { l: 50, r: 200, t: 40, b: 50 },
        showlegend: true,
        legend: { orientation: 'v', x: 1.05, y: 0.5 }
      };
      Plotly.newPlot(pieRef.current, pieData, pieLayout, { responsive: true, displaylogo: false });
    });
  }, [data, year, colors]);

  const totalDocs = data.reduce((sum, d) => sum + d.docCount, 0);

  return (
    <div>
      {/* 统计信息 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>年份</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{year}</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>主题数</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{data.length}</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>总文献数</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{totalDocs.toLocaleString()}</div>
        </div>
      </div>

      {/* 文献数量列表 */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        marginBottom: 24
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>{year}年各主题文献数量</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 16px' }}>
          {data.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: index % 2 === 0 ? '#f9fafb' : '#fff',
                borderRadius: 4
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label.split(' / ')[0]}</span>
              <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>{item.docCount.toLocaleString()} 篇</span>
            </div>
          ))}
        </div>
      </div>

      {/* 柱形图 */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        marginBottom: 24
      }}>
        <div ref={barRef} style={{ width: '100%', height: 500 }} />
      </div>

      {/* 饼图 */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        marginBottom: 24
      }}>
        <div ref={pieRef} style={{ width: '100%', height: 500 }} />
      </div>

      {/* AI分析 */}
      <AIAnalysis
        content={`${year}年各主题文献数量分析:\n\n各主题文献数量:\n${data.map(d => `${d.id}. ${d.label.split(' / ')[0]}: ${d.docCount.toLocaleString()} 篇`).join('\n')}\n\n总文献数: ${totalDocs.toLocaleString()} 篇`}
        type="general"
      />
    </div>
  );
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
      <div style={{ gridColumn: '1 / -1', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginTop: 16, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>关键词分布饼图 (Top 20)</h3>
        <div ref={ref} style={{ width: '100%', height: 600 }} />
      </div>

      {/* AI分析 */}
      <div style={{ gridColumn: '1 / -1' }}>
        <AIAnalysis
          content={`${detail.label} - ${detail.year}年详情分析:\n\n主题ID: ${detail.id}\n年份: ${detail.year}\n文献数量: ${detail.docCount.toLocaleString()} 篇\n\n关键词分布:\n${detail.terms.slice(0, 20).map(t => `${t.term}: ${t.percent.toFixed(1)}%`).join('\n')}`}
          type="general"
        />
      </div>
    </div>
  );
};

// 词云组件
const WordCloud: React.FC<{ keywords: Keyword[] }> = ({ keywords }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null);
  const wordBoundsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());

  useEffect(() => {
    if (!canvasRef.current || keywords.length === 0) return;

    // 动态导入wordcloud库
    import('wordcloud').then((wordcloud) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // 清空画布和词边界
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      wordBoundsRef.current.clear();

      // 准备数据：将关键词转换为wordcloud需要的格式 [text, size]
      const maxCount = Math.max(...keywords.map(k => k.count));
      const data = keywords.map(k => [k.term, Math.max(10, (k.count / maxCount) * 100 + 20)] as [string, number]);

      // 配置wordcloud
      const options: any = {
        list: data,
        gridSize: 8,
        weightFactor: 1,
        fontFamily: 'Arial, sans-serif',
        color: (word: string, weight: number, fontSize: number, distance: number, theta: number) => {
          // 如果被悬停，使用更亮的颜色并稍微放大
          if (hoveredKeyword === word) {
            return '#2563eb';
          }
          
          // 根据出现次数设置颜色深浅
          const keyword = keywords.find(k => k.term === word);
          if (!keyword) return '#333';
          
          const ratio = keyword.count / maxCount;
          if (ratio > 0.7) return '#1e40af';
          if (ratio > 0.4) return '#3b82f6';
          if (ratio > 0.2) return '#60a5fa';
          return '#93c5fd';
        },
        rotateRatio: 0.3,
        rotationSteps: 2,
        backgroundColor: '#ffffff',
        drawOutOfBound: false,
        shrinkToFit: true,
        minSize: 10,
        // 记录每个词的位置和大小
        draw: (item: any, dimensions: any, isHover: boolean, ctx: CanvasRenderingContext2D) => {
          // wordcloud库会在绘制时调用这个函数
          // 我们可以在这里记录词的位置信息
          const word = item[0];
          const x = item.x;
          const y = item.y;
          const size = item.size;
          
          // 估算词的边界框（简化处理）
          const width = size * word.length * 0.6;
          const height = size * 1.2;
          
          wordBoundsRef.current.set(word, {
            x: x - width / 2,
            y: y - height / 2,
            width: width,
            height: height
          });
        }
      };

      wordcloud.default(canvas, options);
    }).catch(err => {
      console.error('Failed to load wordcloud:', err);
    });
  }, [keywords, hoveredKeyword]);

  // 处理鼠标移动，检测悬停的关键词
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // 检查鼠标是否在某个词的边界框内
    let found = false;
    for (const [word, bounds] of wordBoundsRef.current.entries()) {
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        setHoveredKeyword(word);
        found = true;
        break;
      }
    }
    
    if (!found) {
      setHoveredKeyword(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredKeyword(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 16 }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ width: '100%', height: '100%', cursor: 'pointer' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {hoveredKeyword && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          borderRadius: 6,
          fontSize: 14,
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          {hoveredKeyword}: {keywords.find(k => k.term === hoveredKeyword)?.count} 次
        </div>
      )}
    </div>
  );
};

// 文献关键词视图
const KeywordsView: React.FC<{
  topics: Topic[];
  trends: Trends | null;
  selectedTopicId: number | 'all';
  selectedYear: number | 'all';
  onTopicChange: (topicId: number | 'all') => void;
  onYearChange: (year: number | 'all') => void;
}> = ({ topics, trends, selectedTopicId, selectedYear, onTopicChange, onYearChange }) => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    const fetchKeywords = async () => {
      try {
        let data: Keyword[] = [];
        
        if (selectedTopicId === 'all' && selectedYear === 'all') {
          data = await getKeywordsAllTopicsAllYears();
        } else if (selectedTopicId === 'all' && selectedYear !== 'all') {
          data = await getKeywordsAllTopicsYear(selectedYear);
        } else if (selectedTopicId !== 'all' && selectedYear === 'all') {
          data = await getKeywordsTopicAllYears(selectedTopicId);
        } else {
          data = await getKeywordsTopicYear(selectedTopicId, selectedYear);
        }
        
        setKeywords(data);
      } catch (e: any) {
        console.error('Failed to fetch keywords:', e);
        setKeywords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchKeywords();
  }, [selectedTopicId, selectedYear]);

  const availableYears = trends?.years || [];

  // 生成AI分析内容
  const aiAnalysisContent = useMemo(() => {
    if (keywords.length === 0) return '';
    
    // 根据选择生成分析内容
    let title = '文献关键词分析';
    let context = '';
    
    if (selectedTopicId === 'all' && selectedYear === 'all') {
      title = '全部主题全部年份的文献关键词分析';
      context = '涵盖所有主题和所有年份的文献关键词';
    } else if (selectedTopicId === 'all' && selectedYear !== 'all') {
      title = `${selectedYear}年全部主题的文献关键词分析`;
      context = `涵盖所有主题在${selectedYear}年的文献关键词`;
    } else if (selectedTopicId !== 'all' && selectedYear === 'all') {
      const topic = topics.find(t => t.id === selectedTopicId);
      title = `${topic ? topic.label.split(' / ')[0] : '主题' + selectedTopicId} - 全部年份的文献关键词分析`;
      context = `涵盖该主题在所有年份的文献关键词`;
    } else {
      const topic = topics.find(t => t.id === selectedTopicId);
      title = `${topic ? topic.label.split(' / ')[0] : '主题' + selectedTopicId} - ${selectedYear}年的文献关键词分析`;
      context = `涵盖该主题在${selectedYear}年的文献关键词`;
    }
    
    // 准备关键词数据
    const topKeywords = keywords.slice(0, 50).map(k => `${k.term} (出现${k.count}次, 权重${k.weight.toFixed(3)})`).join('\n');
    
    return `${title}:\n\n${context}\n\n关键词总数: ${keywords.length}\n\nTop 50 关键词:\n${topKeywords}`;
  }, [keywords, selectedTopicId, selectedYear, topics]);

  return (
    <div>
      {/* 选择器区域 */}
      <div style={{
        marginBottom: 24,
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#fff'
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 14, color: '#6b7280', marginBottom: 4, display: 'block' }}>
              选择主题：
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => onTopicChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                minWidth: 200
              }}
            >
              <option value="all">全部主题</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label.split(' / ')[0]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 14, color: '#6b7280', marginBottom: 4, display: 'block' }}>
              选择年份：
            </label>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                minWidth: 120
              }}
            >
              <option value="all">全部年份</option>
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 词云显示区域 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          加载中...
        </div>
      )}

      {!loading && keywords.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            关键词词云 (Top {keywords.length})
          </h3>
          <WordCloud keywords={keywords} />
        </div>
      )}

      {!loading && keywords.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          暂无关键词数据
        </div>
      )}

      {/* AI分析功能 */}
      {!loading && keywords.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <AIAnalysis
            content={aiAnalysisContent}
            type="general"
          />
        </div>
      )}
    </div>
  );
};

