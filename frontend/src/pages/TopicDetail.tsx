import React, { useEffect, useMemo, useState } from 'react';
import { getTopicYearDetail, TopicYearDetail } from '../services/api';

export const TopicDetail: React.FC<{ topicId: number; year: number }> = ({ topicId, year }) => {
  const [data, setData] = useState<TopicYearDetail | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const d = await getTopicYearDetail(topicId, year);
        setData(d);
      } catch (e: any) {
        setError(e?.message || '请求失败');
      }
    })();
  }, [topicId, year]);

  const pieData = useMemo(() => {
    if (!data) return null;
    const labels = data.terms.map(t => t.term);
    const values = data.terms.map(t => Math.max(t.percent, 0));
    return { labels, values };
  }, [data]);

  useEffect(() => {
    if (!pieData) return;
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      const plotData: any = [{ type: 'pie', labels: pieData.labels, values: pieData.values, hole: 0.35 }];
      const layout: any = { margin: { l: 24, r: 24, t: 24, b: 24 } };
      const config: any = { displaylogo: false, responsive: true };
      Plotly.newPlot('topic-pie', plotData, layout, config);
    });
  }, [pieData]);

  if (error) return <div style={{ color: 'red' }}>错误：{error}</div>;
  if (!data) return <div>加载中...</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ textAlign: 'center' }}>{data.label}（{data.year}）</h2>
      <p style={{ textAlign: 'center' }}>该年份文献总数（估算）：{data.docCount}</p>

      <div id="topic-pie" style={{ width: '100%', height: 360 }} />

      <h3 style={{ marginTop: 16 }}>词汇列表（Top 30，含占比）</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {data.terms.map((t, i) => (
          <div key={i} style={{ fontSize: 13, border: '1px solid #eee', padding: 8, borderRadius: 8 }}>
            <div style={{ fontWeight: 600 }}>{t.term}</div>
            <div style={{ color: '#666' }}>{(t.percent * 100).toFixed(2)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
};


