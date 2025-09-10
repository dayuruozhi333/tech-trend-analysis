// 直接访问后端以规避开发代理/WS干扰
export const apiBase = 'http://127.0.0.1:5000/api';

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${apiBase}/health`);
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

// 中文说明：
// - 获取主题列表（包含 id、label、topTerms）
export type Topic = {
  id: number;
  label: string;
  topTerms: { term: string; weight: number }[];
};

export async function getTopics(): Promise<Topic[]> {
  const res = await fetch(`${apiBase}/topics`);
  if (!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

// 中文说明：
// - 获取年度趋势数据：years 数组与每个主题的 series
export type Trends = {
  years: number[];
  topics: { id: number; label: string; series: number[] }[];
};

export async function getTrends(): Promise<Trends> {
  const res = await fetch(`${apiBase}/trends`);
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}

// 主题-年份详情：文献数与词汇占比
export type TopicYearDetail = {
  id: number;
  year: number;
  label: string;
  docCount: number;
  terms: { term: string; weight: number; percent: number }[];
};

export async function getTopicYearDetail(topicId: number, year: number): Promise<TopicYearDetail> {
  const res = await fetch(`${apiBase}/topic-year-detail/${topicId}/${year}`);
  if (!res.ok) throw new Error('Failed to fetch topic-year detail');
  return res.json();
}

// AI分析相关类型和函数
export type AIAnalysisRequest = {
  content: string;
  type: 'topics' | 'trends' | 'map' | 'general';
};

export async function requestAIAnalysis(request: AIAnalysisRequest): Promise<ReadableStream<Uint8Array> | null> {
  const res = await fetch(`${apiBase}/ai-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error('Failed to request AI analysis');
  }

  return res.body;
}
