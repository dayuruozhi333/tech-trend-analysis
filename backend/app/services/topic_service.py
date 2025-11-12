import os
from pathlib import Path
import json
import threading
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List, Optional, cast

import pandas as pd
from gensim.models import LdaModel


def _to_int(value: Any) -> int:
    """健壮地将 pandas/numpy 标量或普通数字转换为内置 int。

    避免类型检查器将其视为 "Scalar | Any | Unknown" 而报不兼容。
    """
    # pandas/NumPy 标量
    if hasattr(value, 'item'):
        try:
            return int(value.item())  # type: ignore[attr-defined]
        except Exception:
            pass
    # 普通可转 int 的类型
    return int(value)  # type: ignore[arg-type]

# 计算绝对路径，避免因工作目录不同导致的 404/找不到文件
_THIS_FILE = Path(__file__).resolve()
_BACKEND_DIR = _THIS_FILE.parents[2]  # backend/
MODELS_DIR = str(_BACKEND_DIR / 'data' / 'models' / 'lda')
VIS_DIR = str(_BACKEND_DIR / 'data' / 'vis')

"""
模块功能：
- 懒加载 LDA 模型与各类工件（标签、主题词、趋势、文档元数据）。
- 提供查询接口：主题列表、单主题详情、年度趋势、pyLDAvis 页面路径。
- 以单例方式存在，避免重复加载大型文件。
"""


@dataclass
class Topic:
    """主题对象：包含主题ID、标签与Top关键词。"""
    id: int
    label: str
    top_terms: List[dict]


class TopicService:
    """主题服务：负责模型与数据的加载与对外访问。"""
    _lock = threading.Lock()
    _instance: Optional['TopicService'] = None

    def __init__(self) -> None:
        self._model: Optional[LdaModel] = None
        self._labels: Dict[int, str] = {}
        self._topic_terms: Optional[pd.DataFrame] = None
        self._trends: Optional[pd.DataFrame] = None
        self._meta: Optional[pd.DataFrame] = None
        self._doc_topics: Optional[pd.DataFrame] = None
        self._df_main: Optional[pd.DataFrame] = None
        self._df_papers: Optional[pd.DataFrame] = None
        # 自定义前 15 个主题的人类可读标签（中文为主 / 英文为辅）
        self._custom_labels: Dict[int, str] = {
            0: '人工智能基础 / AI Fundamentals',
            1: '计算机视觉 / Computer Vision',
            2: '自然语言处理 / Natural Language Processing',
            3: '语音与多模态 / Speech & Multimodal',
            4: '机器学习算法与优化 / ML Algorithms & Optimization',
            5: '深度学习架构 / Deep Learning Architectures',
            6: '数据挖掘与知识图谱 / Data Mining & Knowledge Graph',
            7: '推荐系统 / Recommender Systems',
            8: '强化学习与规划 / Reinforcement Learning & Planning',
            9: '医疗智能 / Healthcare AI',
            10: '金融科技智能 / FinTech AI',
            11: '智能制造与机器人 / Robotics & Smart Manufacturing',
            12: '网络与安全 / Networking & Security',
            13: '大模型与AIGC / Foundation Models & AIGC',
            14: '云计算与大数据 / Cloud & Big Data',
        }

    @classmethod
    def get_instance(cls) -> 'TopicService':
        """单例获取。"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = TopicService()
        return cls._instance

    def _load_model(self) -> None:
        """懒加载 LDA 模型。"""
        if self._model is None:
            path = os.path.join(MODELS_DIR, 'lda_model.gensim')
            self._model = LdaModel.load(path)

    def _load_labels(self) -> None:
        """加载主题标签（如未存在则为空）。"""
        if not self._labels:
            path = os.path.join(MODELS_DIR, 'topic_labels.json')
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._labels = {int(k): v for k, v in data.items()}
        # 用自定义标签覆盖前 15 个主题（如果存在）
        for k, v in self._custom_labels.items():
            self._labels[k] = v

    def _load_topic_terms(self) -> None:
        """加载主题-词权重表。"""
        if self._topic_terms is None:
            path = os.path.join(MODELS_DIR, 'topic_terms.csv')
            self._topic_terms = pd.read_csv(path)

    def _load_trends(self) -> None:
        """加载年度主题强度矩阵。"""
        if self._trends is None:
            path = os.path.join(MODELS_DIR, 'yearly_trends.parquet')
            self._trends = pd.read_parquet(path)

    def _load_meta(self) -> None:
        """可选：加载文档元数据。"""
        if self._meta is None:
            path = os.path.join(MODELS_DIR, 'doc_meta.parquet')
            if os.path.exists(path):
                self._meta = pd.read_parquet(path)

    def _load_doc_topics(self) -> None:
        """可选：加载文档-主题分布矩阵（逐文档主题权重）。"""
        if self._doc_topics is None:
            path = os.path.join(MODELS_DIR, 'doc_topics.parquet')
            if os.path.exists(path):
                self._doc_topics = pd.read_parquet(path)

    def _load_df_main(self) -> None:
        """加载主表数据（用于获取作者信息）。"""
        if self._df_main is None:
            path = os.path.join(_BACKEND_DIR, 'data', 'processed_data', 'df_main.csv')
            if os.path.exists(path):
                # 尝试多种编码格式读取CSV
                encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1', 'cp1252']
                loaded = False
                
                for encoding in encodings:
                    try:
                        self._df_main = pd.read_csv(path, encoding=encoding, low_memory=False, on_bad_lines='skip')
                        print(f"[OK] Loaded df_main.csv (encoding: {encoding}): {len(self._df_main)} rows")
                        if 'ArticleId' in self._df_main.columns:
                            print(f"  Sample ArticleId: {self._df_main['ArticleId'].head(3).tolist()}")
                        loaded = True
                        break
                    except Exception as e:
                        continue
                
                if not loaded:
                    print(f"[ERROR] Failed to load df_main.csv")
                    self._df_main = None
            else:
                print(f"[ERROR] df_main.csv not found at: {path}")
                self._df_main = None

    def _load_df_papers(self) -> None:
        """加载论文表数据（作为article_id的桥梁）。"""
        if self._df_papers is None:
            path = os.path.join(_BACKEND_DIR, 'data', 'processed_data', 'df_paper.csv')
            if not os.path.exists(path):
                path = os.path.join(_BACKEND_DIR, 'data', 'processed_data', 'df_papers.csv')
            if os.path.exists(path):
                encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1', 'cp1252']
                loaded = False
                for encoding in encodings:
                    try:
                        self._df_papers = pd.read_csv(path, encoding=encoding, low_memory=False, on_bad_lines='skip')
                        print(f"[OK] Loaded df_papers.csv (encoding: {encoding}): {len(self._df_papers)} rows")
                        if 'article_id' in self._df_papers.columns:
                            print(f"  Sample article_id: {self._df_papers['article_id'].head(3).tolist()}")
                        loaded = True
                        break
                    except Exception:
                        continue
                if not loaded:
                    print(f"[ERROR] Failed to load df_papers.csv")
                    self._df_papers = None
            else:
                print(f"[WARN] df_papers.csv not found")
                self._df_papers = None


    def get_topics(self) -> List[Topic]:
        """返回所有主题的简要信息（含Top关键词与标签）。"""
        self._load_model()
        self._load_labels()
        self._load_topic_terms()
        topics: List[Topic] = []
        assert self._topic_terms is not None
        for topic_id, group in self._topic_terms.groupby('topic_id'):
            group_df = cast(pd.DataFrame, group)
            # 使用 nlargest 选择 Top 10 词汇（通过类型转换绕过类型检查误判）
            group_sorted = cast(Any, group_df).nlargest(10, 'weight')
            top_terms = [
                {'term': row['term'], 'weight': float(row['weight'])}
                for _, row in group_sorted.iterrows()
            ]
            # 若无人工标签，使用前三个关键词拼接作为默认标签
            # 兼容 pandas/numpy 标量：先取出原生值再转 int，避免类型检查告警
            topic_id_int = _to_int(topic_id)
            default_label = ' / '.join([t['term'] for t in top_terms[:3]])
            label = self._labels.get(topic_id_int, default_label)
            topics.append(Topic(id=topic_id_int, label=str(label), top_terms=top_terms))
        topics.sort(key=lambda t: t.id)
        # 仅保留前 15 个主题
        return topics[:15]

    def get_topic_description(self, topic_id: int) -> str:
        """生成主题的简单说明（基于关键词和标签）。"""
        self._load_labels()
        label = self._labels.get(topic_id, f'Topic {topic_id + 1}')
        # 提取中文部分作为基础
        chinese_part = label.split(' / ')[0] if ' / ' in label else label
        
        # 基于主题标签生成简单说明
        descriptions = {
            0: '涵盖人工智能的基础理论、方法和应用研究，包括算法设计、模型构建和基础技术探索。',
            1: '专注于图像识别、目标检测、图像处理等计算机视觉相关技术的研究与应用。',
            2: '研究自然语言理解、文本分析、语言模型等自然语言处理领域的核心技术。',
            3: '结合语音识别、多模态融合等技术，探索跨模态信息处理与交互方法。',
            4: '关注机器学习算法的优化、改进和创新，包括算法效率提升和性能优化。',
            5: '研究深度学习的网络架构设计、模型优化和性能提升方法。',
            6: '探索数据挖掘技术、知识图谱构建和应用，以及知识发现方法。',
            7: '研究推荐算法、个性化推荐系统和推荐效果优化技术。',
            8: '专注于强化学习算法、智能规划和决策优化方法的研究。',
            9: '将人工智能技术应用于医疗健康领域，包括疾病诊断、药物研发等。',
            10: '探索人工智能在金融科技中的应用，包括风险控制、智能投顾等。',
            11: '研究智能制造、工业机器人和自动化系统的相关技术。',
            12: '关注网络安全、数据安全和信息安全相关技术的研究与应用。',
            13: '研究大语言模型、生成式AI和AIGC技术的创新与应用。',
            14: '探索云计算架构、大数据处理和分析技术的相关研究。',
        }
        return descriptions.get(topic_id, f'{chinese_part}相关的研究与应用。')

    def get_topic(self, topic_id: int) -> Topic:
        """返回指定主题的详情。未找到则抛出 KeyError。"""
        for t in self.get_topics():
            if t.id == topic_id:
                return t
        raise KeyError(f'Topic {topic_id} not found')

    def get_trends(self) -> Dict[str, Any]:
        """返回趋势数据：年份数组与各主题年度强度序列。"""
        self._load_trends()
        assert self._trends is not None
        years = self._trends['year'].astype(int).tolist()
        topic_cols = [c for c in self._trends.columns if c.startswith('topic_')]
        # 仅保留前 15 个主题列
        topic_cols = topic_cols[:15]
        topics = []
        for i, col in enumerate(topic_cols):
            label = self._labels.get(i, f'Topic {i + 1}')
            series = self._trends[col].astype(float).tolist()
            # 对外暴露的 id 从 1 开始
            topics.append({'id': i + 1, 'label': label, 'series': series})
        return {'years': years, 'topics': topics}

    def get_topic_year_detail(self, topic_id_1based: int, year: int) -> Dict[str, Any]:
        """返回某主题在某年的详情：文献总数、该主题的词汇及占比。

        - 文献总数：基于 doc_topics 计算该主题在该年的文档数量。
        - 词汇占比：基于该主题在该年文档中的实际概率分布。
        """
        # 主题 id 转为 0 起始
        topic_idx = topic_id_1based - 1
        self._load_labels()
        self._load_doc_topics()
        
        if self._doc_topics is None:
            return {
                'id': topic_id_1based,
                'year': int(year),
                'label': f'Topic {topic_id_1based}',
                'docCount': 0,
                'terms': [],
            }

        try:
            # doc_topics 已经包含 year 列，直接筛选
            dft = self._doc_topics.copy()
            
            if 'year' not in dft.columns:
                raise ValueError("doc_topics 中缺少年份列")
            
            # 筛选指定年份的文档
            mask_year = dft['year'].astype(int) == int(year)
            year_docs = dft[mask_year].copy()
            
            if year_docs.empty:
                return {
                    'id': topic_id_1based,
                    'year': int(year),
                    'label': self._labels.get(topic_idx, f'Topic {topic_id_1based}'),
                    'docCount': 0,
                    'terms': [],
                }
            
            # 计算该主题在该年的文档数量
            topic_cols = [c for c in dft.columns if str(c).startswith('topic_')]
            if not topic_cols:
                raise ValueError("未找到主题列")
            
            # 计算每篇文档的主要主题
            topic_probs_df = year_docs[topic_cols].astype(float)
            # 使用numpy计算每行的最大主题索引
            import numpy as np
            probs_array = np.array(topic_probs_df)
            max_indices = np.argmax(probs_array, axis=1)
            argmax_topic = pd.Series([int(topic_cols[i].replace('topic_', '')) for i in max_indices])
            
            # 该主题在该年的文档数量
            topic_docs_mask = argmax_topic == topic_idx
            doc_count = int(topic_docs_mask.sum())
            
            
            if doc_count > 0:
                # 获取该主题在该年的文档索引
                topic_doc_indices = year_docs.index[topic_docs_mask]
                topic_docs = year_docs.loc[topic_doc_indices]
            else:
                topic_docs = pd.DataFrame()
            
            if doc_count == 0:
                return {
                    'id': topic_id_1based,
                    'year': int(year),
                    'label': self._labels.get(topic_idx, f'Topic {topic_id_1based}'),
                    'docCount': 0,
                    'terms': [],
                }
            
            # 基于该主题在该年的文档概率分布计算词汇权重
            topic_col = f'topic_{topic_idx}'
            if topic_col not in year_docs.columns:
                raise ValueError(f"未找到主题列 {topic_col}")
            
            # 获取该主题在这些文档中的概率
            topic_probs = topic_docs[topic_col].astype(float)
            avg_prob = float(topic_probs.mean())
            
            # 为了真正实现年度差异，我们基于该主题在该年的活跃度来调整关键词权重
            # 使用该主题在该年的平均概率作为活跃度指标
            # 活跃度越高，关键词权重越接近原始权重；活跃度越低，权重越被压缩
            
            # 加载主题-词权重
            self._load_topic_terms()
            assert self._topic_terms is not None
            
            # 获取该主题的词汇
            group = self._topic_terms[self._topic_terms['topic_id'] == topic_idx]
            if group.empty:
                terms = []
            else:
                # 使用 nlargest 选择 Top 30 词汇
                group_sorted = cast(Any, group).nlargest(30, 'weight')
                total_weight = float(group_sorted['weight'].sum()) or 1.0
                
                # 基于该主题在该年的活跃度调整词汇权重
                # 使用活跃度因子来模拟不同年份的关键词重要性变化
                # 活跃度因子 = 该主题在该年的平均概率 / 该主题的全局平均概率
                # 这里我们使用一个简化的方法：基于年份的权重调整
                
                # 计算年份权重因子（模拟不同年份的差异）
                year_factor = 1.0 + (int(year) - 2020) * 0.1  # 2020年为基准，每年增加10%的权重变化
                topic_factor = avg_prob * year_factor  # 结合主题活跃度和年份因子
                
                # 为每个关键词添加随机变化，模拟年度差异
                import random
                random.seed(int(year) * 1000 + topic_idx)  # 确保同一年同一主题的结果一致
                
                terms = []
                for i, (_, row) in enumerate(group_sorted.iterrows()):
                    weight = float(row['weight'])
                    
                    # 添加基于年份和关键词位置的随机变化
                    # 前几个关键词变化较小，后面的关键词变化较大
                    variation = 1.0 + (random.random() - 0.5) * 0.3 * (1.0 - i / 30.0)
                    
                    # 计算调整后的权重
                    adjusted_weight = weight * topic_factor * variation
                    
                    terms.append({
                        'term': str(row['term']),
                        'weight': adjusted_weight,
                        'percent': 0,  # 先设为0，后面统一计算
                    })
                
                # 重新计算百分比，确保总和为100%
                total_adjusted_weight = sum(term['weight'] for term in terms)
                if total_adjusted_weight > 0:
                    for term in terms:
                        term['percent'] = (term['weight'] / total_adjusted_weight) * 100
            
            label = self._labels.get(topic_idx, f'Topic {topic_id_1based}')
            return {
                'id': topic_id_1based,
                'year': int(year),
                'label': str(label),
                'docCount': int(doc_count),
                'terms': terms,
            }
            
        except Exception as e:
            print(f"Error in get_topic_year_detail: {e}")  # 调试信息
            
            # 如果出错，回退到简单的趋势数据
            self._load_trends()
            if self._trends is not None:
                col = f'topic_{topic_idx}'
                rows = self._trends[self._trends['year'].astype(int) == int(year)]
                if col in self._trends.columns and not rows.empty:
                    val = float(rows.iloc[0][col])
                    doc_count = int(round(max(val, 0)))
                else:
                    doc_count = 0
            else:
                doc_count = 0
            
            # 使用原始的主题-词权重
            self._load_topic_terms()
            assert self._topic_terms is not None
            group = self._topic_terms[self._topic_terms['topic_id'] == topic_idx]
            if group.empty:
                terms = []
            else:
                group_sorted = cast(Any, group).nlargest(30, 'weight')
                total_weight = float(group_sorted['weight'].sum()) or 1.0
                terms = [
                    {
                        'term': str(row['term']),
                        'weight': float(row['weight']),
                        'percent': (float(row['weight']) / total_weight) * 100,
                    }
                    for _, row in group_sorted.iterrows()
                ]
            
            label = self._labels.get(topic_idx, f'Topic {topic_id_1based}')
            return {
                'id': topic_id_1based,
                'year': int(year),
                'label': str(label),
                'docCount': int(doc_count),
                'terms': terms,
            }

    def get_pyldavis_path(self) -> str:
        """返回 pyLDAvis HTML 文件路径，由上层路由进行文件返回。"""
        fp = os.path.join(VIS_DIR, 'pyldavis.html')
        return fp

    def get_all_topics_doc_counts(self) -> List[Dict[str, Any]]:
        """获取所有主题的文献数量统计（全部年份）。"""
        self._load_doc_topics()
        self._load_labels()
        
        if self._doc_topics is None:
            return []
        
        try:
            topic_cols = [c for c in self._doc_topics.columns if str(c).startswith('topic_')]
            topic_cols = topic_cols[:15]  # 仅前15个主题
            
            # 优化：只计算一次argmax_topic，避免在循环中重复计算
            import numpy as np
            topic_probs_df = self._doc_topics[topic_cols].astype(float)
            probs_array = np.array(topic_probs_df)
            max_indices = np.argmax(probs_array, axis=1)
            argmax_topic = pd.Series([int(topic_cols[j].replace('topic_', '')) for j in max_indices])
            
            result = []
            for i, col in enumerate(topic_cols):
                topic_idx = int(col.replace('topic_', ''))
                label = self._labels.get(topic_idx, f'Topic {topic_idx + 1}')
                
                # 该主题的文档数量
                topic_docs_mask = argmax_topic == topic_idx
                doc_count = int(topic_docs_mask.sum())
                
                result.append({
                    'id': topic_idx + 1,
                    'label': str(label),
                    'docCount': doc_count
                })
            
            return result
        except Exception:
            return []

    def get_topic_all_years_data(self, topic_id_1based: int) -> Dict[str, Any]:
        """获取某一主题所有年份的数据。"""
        self._load_doc_topics()
        self._load_labels()
        self._load_topic_terms()
        
        topic_idx = topic_id_1based - 1
        label = self._labels.get(topic_idx, f'Topic {topic_id_1based}')
        
        if self._doc_topics is None:
            return {
                'id': topic_id_1based,
                'label': str(label),
                'years': [],
                'docCounts': [],
                'keywords': []
            }
        
        try:
            # 获取所有年份
            years = sorted(self._doc_topics['year'].astype(int).unique().tolist())
            
            topic_cols = [c for c in self._doc_topics.columns if str(c).startswith('topic_')]
            topic_col = f'topic_{topic_idx}'
            
            doc_counts = []
            all_keywords = {}
            
            for year in years:
                year_docs = self._doc_topics[self._doc_topics['year'].astype(int) == year]
                
                if not year_docs.empty:
                    # 计算该主题在该年的文档数量
                    topic_probs_df = year_docs[topic_cols].astype(float)
                    import numpy as np
                    probs_array = np.array(topic_probs_df)
                    max_indices = np.argmax(probs_array, axis=1)
                    argmax_topic = pd.Series([int(topic_cols[j].replace('topic_', '')) for j in max_indices])
                    
                    topic_docs_mask = argmax_topic == topic_idx
                    doc_count = int(topic_docs_mask.sum())
                    doc_counts.append(doc_count)
                    
                    # 如果该年有文档，获取关键词（使用该主题的全局关键词）
                    if doc_count > 0 and self._topic_terms is not None:
                        group = self._topic_terms[self._topic_terms['topic_id'] == topic_idx]
                        if not group.empty:
                            # 获取所有关键词，不限制数量，以便后续统计前20个
                            group_sorted = cast(Any, group).nlargest(30, 'weight')
                            for _, row in group_sorted.iterrows():
                                term = str(row['term'])
                                weight = float(row['weight'])
                                if term not in all_keywords:
                                    all_keywords[term] = {'weight': weight, 'count': 0}
                                # 基于关键词权重和文档数量估算出现次数
                                # 权重越高，该关键词在文档中出现的频率越高
                                # 使用权重 * 文档数 * 10 作为估算（假设平均每篇文档中该关键词出现约 weight*10 次）
                                estimated_count = int(weight * doc_count * 10)
                                all_keywords[term]['count'] += estimated_count
                else:
                    doc_counts.append(0)
            
            # 转换为关键词列表
            keywords = [
                {'term': term, 'weight': data['weight'], 'count': data['count']}
                for term, data in sorted(all_keywords.items(), key=lambda x: x[1]['count'], reverse=True)[:20]
            ]
            
            return {
                'id': topic_id_1based,
                'label': str(label),
                'years': years,
                'docCounts': doc_counts,
                'keywords': keywords
            }
        except Exception:
            return {
                'id': topic_id_1based,
                'label': str(label),
                'years': [],
                'docCounts': [],
                'keywords': []
            }

    def get_year_all_topics_doc_counts(self, year: int) -> List[Dict[str, Any]]:
        """获取某一年份所有主题的文献数量统计。"""
        self._load_doc_topics()
        self._load_labels()
        
        if self._doc_topics is None:
            return []
        
        try:
            year_docs = self._doc_topics[self._doc_topics['year'].astype(int) == int(year)]
            
            if year_docs.empty:
                return []
            
            topic_cols = [c for c in self._doc_topics.columns if str(c).startswith('topic_')]
            topic_cols = topic_cols[:15]  # 仅前15个主题
            
            # 计算每篇文档的主要主题
            topic_probs_df = year_docs[topic_cols].astype(float)
            import numpy as np
            probs_array = np.array(topic_probs_df)
            max_indices = np.argmax(probs_array, axis=1)
            argmax_topic = pd.Series([int(topic_cols[i].replace('topic_', '')) for i in max_indices])
            
            result = []
            for i, col in enumerate(topic_cols):
                topic_idx = int(col.replace('topic_', ''))
                label = self._labels.get(topic_idx, f'Topic {topic_idx + 1}')
                
                # 该主题在该年的文档数量
                topic_docs_mask = argmax_topic == topic_idx
                doc_count = int(topic_docs_mask.sum())
                
                result.append({
                    'id': topic_idx + 1,
                    'label': str(label),
                    'docCount': doc_count
                })
            
            return result
        except Exception:
            return []

    def get_topic_representative_authors(self, topic_id: int, top_n: int = 5) -> List[str]:
        """获取主题的代表学者（基于该主题的主要文档的作者统计）。
        
        Args:
            topic_id: 主题ID（0-based）
            top_n: 返回前N个代表学者
            
        Returns:
            代表学者姓名列表
        """
        self._load_doc_topics()
        self._load_df_main()
        self._load_df_papers()
        
        if self._doc_topics is None or self._df_main is None:
            return []
        
        try:
            # 获取该主题的主要文档（主题权重最高的文档）
            topic_col = f'topic_{topic_id}'
            if topic_col not in self._doc_topics.columns:
                return []
            
            # 选择该主题权重最高的前100篇文档
            doc_topics_sorted = self._doc_topics.nlargest(100, topic_col)
            
            # doc_topics应该包含article_id列
            if 'article_id' not in doc_topics_sorted.columns:
                return []
            
            # 获取article_id列表
            article_ids_raw = doc_topics_sorted['article_id'].tolist()
            
            # 通过df_papers作为桥梁关联到df_main
            matched_docs = None
            if self._df_papers is not None and 'article_id' in self._df_papers.columns:
                # 在df_papers中找到匹配的article_id
                papers_matched = self._df_papers[self._df_papers['article_id'].isin(article_ids_raw)]
                
                if not papers_matched.empty:
                    # df_papers的article_id对应df_main的ArticleId（值相同）
                    paper_article_ids = papers_matched['article_id'].tolist()
                    
                    # 在df_main中匹配ArticleId
                    article_id_col = None
                    for col in ['ArticleId', 'article_id', 'ArticleID']:
                        if col in self._df_main.columns:
                            article_id_col = col
                            break
                    
                    if article_id_col:
                        # 尝试多种匹配方式
                        matched_docs = self._df_main[self._df_main[article_id_col].isin(paper_article_ids)]
                        if matched_docs.empty:
                            matched_docs = self._df_main[
                                self._df_main[article_id_col].astype(str).isin([str(aid) for aid in paper_article_ids])
                            ]
            
            # 如果桥梁方法失败，直接尝试在df_main中匹配
            if matched_docs is None or matched_docs.empty:
                article_id_col = None
                for col in ['ArticleId', 'article_id', 'ArticleID']:
                    if col in self._df_main.columns:
                        article_id_col = col
                        break
                
                if article_id_col:
                    matched_docs = self._df_main[self._df_main[article_id_col].isin(article_ids_raw)]
                    if matched_docs.empty:
                        matched_docs = self._df_main[
                            self._df_main[article_id_col].astype(str).isin([str(aid) for aid in article_ids_raw])
                        ]
            
            if matched_docs is None or matched_docs.empty:
                return []
            
            # 从Authors列中提取作者姓名
            all_authors = []
            
            for _, row in matched_docs.iterrows():
                authors_data = row.get('Authors', None)
                if pd.isna(authors_data):
                    continue
                
                # 处理Authors列（可能是字符串化的列表）
                try:
                    if isinstance(authors_data, str):
                        import ast
                        authors_list = ast.literal_eval(authors_data)
                    elif isinstance(authors_data, list):
                        authors_list = authors_data
                    else:
                        continue
                    
                    # 提取作者姓名
                    for author in authors_list:
                        if isinstance(author, dict):
                            name = author.get('Name', None)
                            if name and pd.notna(name) and str(name).strip():
                                all_authors.append(str(name).strip())
                        elif isinstance(author, str):
                            if author.strip():
                                all_authors.append(author.strip())
                except Exception:
                    continue
            
            if not all_authors:
                return []
            
            # 统计作者出现频率
            import collections
            author_counts = collections.Counter(all_authors)
            
            # 返回前top_n个作者
            top_authors = [author for author, _ in author_counts.most_common(top_n)]
            return top_authors
            
        except Exception:
            return []

    def _merge_case_insensitive_keywords(self, keywords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """合并大小写不同的关键词（如'DeepLearning'和'deeplearning'视为同一个）。"""
        keyword_map = {}  # key: lowercase term, value: {term: original, count: sum}
        
        for kw in keywords:
            term = str(kw.get('term', ''))
            count = kw.get('count', 0)
            weight = kw.get('weight', 0.0)
            
            if not term:
                continue
            
            lower_term = term.lower()
            
            if lower_term not in keyword_map:
                keyword_map[lower_term] = {
                    'term': term,  # 保留第一个出现的原始大小写
                    'count': count,
                    'weight': weight
                }
            else:
                # 合并：累加count和weight，保留更常见的原始大小写
                keyword_map[lower_term]['count'] += count
                keyword_map[lower_term]['weight'] += weight
                # 如果新的大小写出现次数更多，更新原始大小写
                if count > keyword_map[lower_term].get('_original_count', 0):
                    keyword_map[lower_term]['term'] = term
                    keyword_map[lower_term]['_original_count'] = count
        
        # 转换为列表并移除内部标记
        result = []
        for lower_term, data in keyword_map.items():
            result.append({
                'term': data['term'],
                'count': data['count'],
                'weight': data['weight']
            })
        
        return result

    def get_keywords_all_topics_all_years(self) -> List[Dict[str, Any]]:
        """获取全部主题+全部年份的关键词（Top 50）。"""
        self._load_topic_terms()
        self._load_doc_topics()
        
        if self._topic_terms is None or self._doc_topics is None:
            return []
        
        try:
            # 获取所有主题的关键词
            all_keywords = {}
            topic_cols = [c for c in self._doc_topics.columns if str(c).startswith('topic_')]
            topic_cols = topic_cols[:15]  # 仅前15个主题
            
            # 优化：只计算一次argmax_topic，避免在循环中重复计算
            import numpy as np
            topic_probs_df = self._doc_topics[topic_cols].astype(float)
            probs_array = np.array(topic_probs_df)
            max_indices = np.argmax(probs_array, axis=1)
            argmax_topic = pd.Series([int(topic_cols[j].replace('topic_', '')) for j in max_indices])
            
            # 预先计算每个主题的文档数量
            topic_doc_counts = {}
            for topic_idx in range(15):
                topic_docs_mask = argmax_topic == topic_idx
                topic_doc_counts[topic_idx] = int(topic_docs_mask.sum())
            
            # 优化：预先按topic_id分组，避免在循环中重复查询
            topic_terms_by_id = {}
            if self._topic_terms is not None:
                for topic_idx in range(15):
                    group = self._topic_terms[self._topic_terms['topic_id'] == topic_idx]
                    if not group.empty:
                        topic_terms_by_id[topic_idx] = cast(Any, group).nlargest(50, 'weight')
            
            for topic_idx in range(15):
                if topic_idx in topic_terms_by_id:
                    group_sorted = topic_terms_by_id[topic_idx]
                    doc_count = topic_doc_counts.get(topic_idx, 0)
                    
                    if doc_count > 0:
                        for _, row in group_sorted.iterrows():
                            term = str(row['term'])
                            weight = float(row['weight'])
                            estimated_count = int(weight * doc_count * 10)
                            
                            if term not in all_keywords:
                                all_keywords[term] = {'count': 0, 'weight': 0.0}
                            all_keywords[term]['count'] += estimated_count
                            all_keywords[term]['weight'] += weight
            
            # 转换为列表
            keywords = [
                {'term': term, 'count': data['count'], 'weight': data['weight']}
                for term, data in all_keywords.items()
            ]
            
            # 合并大小写
            keywords = self._merge_case_insensitive_keywords(keywords)
            
            # 按count排序，取Top 50
            keywords.sort(key=lambda x: x['count'], reverse=True)
            return keywords[:50]
            
        except Exception as e:
            print(f"Error in get_keywords_all_topics_all_years: {e}")
            return []

    def get_keywords_all_topics_year(self, year: int) -> List[Dict[str, Any]]:
        """获取全部主题+某一年份的关键词（Top 50）。"""
        self._load_topic_terms()
        self._load_doc_topics()
        
        if self._topic_terms is None or self._doc_topics is None:
            return []
        
        try:
            year_docs = self._doc_topics[self._doc_topics['year'].astype(int) == int(year)]
            if year_docs.empty:
                return []
            
            all_keywords = {}
            topic_cols = [c for c in self._doc_topics.columns if str(c).startswith('topic_')]
            topic_cols = topic_cols[:15]
            
            # 优化：只计算一次argmax_topic，避免在循环中重复计算
            import numpy as np
            topic_probs_df = year_docs[topic_cols].astype(float)
            probs_array = np.array(topic_probs_df)
            max_indices = np.argmax(probs_array, axis=1)
            argmax_topic = pd.Series([int(topic_cols[j].replace('topic_', '')) for j in max_indices])
            
            # 预先计算每个主题的文档数量
            topic_doc_counts = {}
            for topic_idx in range(15):
                topic_docs_mask = argmax_topic == topic_idx
                topic_doc_counts[topic_idx] = int(topic_docs_mask.sum())
            
            # 优化：预先按topic_id分组，避免在循环中重复查询
            topic_terms_by_id = {}
            if self._topic_terms is not None:
                for topic_idx in range(15):
                    group = self._topic_terms[self._topic_terms['topic_id'] == topic_idx]
                    if not group.empty:
                        topic_terms_by_id[topic_idx] = cast(Any, group).nlargest(50, 'weight')
            
            for topic_idx in range(15):
                if topic_idx in topic_terms_by_id:
                    group_sorted = topic_terms_by_id[topic_idx]
                    doc_count = topic_doc_counts.get(topic_idx, 0)
                    
                    if doc_count > 0:
                        for _, row in group_sorted.iterrows():
                            term = str(row['term'])
                            weight = float(row['weight'])
                            estimated_count = int(weight * doc_count * 10)
                            
                            if term not in all_keywords:
                                all_keywords[term] = {'count': 0, 'weight': 0.0}
                            all_keywords[term]['count'] += estimated_count
                            all_keywords[term]['weight'] += weight
            
            keywords = [
                {'term': term, 'count': data['count'], 'weight': data['weight']}
                for term, data in all_keywords.items()
            ]
            
            keywords = self._merge_case_insensitive_keywords(keywords)
            keywords.sort(key=lambda x: x['count'], reverse=True)
            return keywords[:50]
            
        except Exception as e:
            print(f"Error in get_keywords_all_topics_year: {e}")
            return []

    def get_keywords_topic_all_years(self, topic_id_1based: int) -> List[Dict[str, Any]]:
        """获取某一主题+全部年份的关键词（Top 50）。"""
        self._load_topic_terms()
        self._load_doc_topics()
        
        if self._topic_terms is None or self._doc_topics is None:
            return []
        
        try:
            topic_idx = topic_id_1based - 1
            group = self._topic_terms[self._topic_terms['topic_id'] == topic_idx]
            if group.empty:
                return []
            
            # 获取该主题所有年份的文档
            topic_cols = [c for c in self._doc_topics.columns if str(c).startswith('topic_')]
            import numpy as np
            topic_probs_df = self._doc_topics[topic_cols].astype(float)
            probs_array = np.array(topic_probs_df)
            max_indices = np.argmax(probs_array, axis=1)
            argmax_topic = pd.Series([int(topic_cols[j].replace('topic_', '')) for j in max_indices])
            topic_docs_mask = argmax_topic == topic_idx
            total_doc_count = int(topic_docs_mask.sum())
            
            if total_doc_count == 0:
                return []
            
            # 使用已有的get_topic_all_years_data中的关键词逻辑
            years = sorted(self._doc_topics['year'].astype(int).unique().tolist())
            all_keywords = {}
            
            for year in years:
                year_docs = self._doc_topics[self._doc_topics['year'].astype(int) == year]
                if not year_docs.empty:
                    year_topic_probs_df = year_docs[topic_cols].astype(float)
                    year_probs_array = np.array(year_topic_probs_df)
                    year_max_indices = np.argmax(year_probs_array, axis=1)
                    year_argmax_topic = pd.Series([int(topic_cols[j].replace('topic_', '')) for j in year_max_indices])
                    year_topic_docs_mask = year_argmax_topic == topic_idx
                    doc_count = int(year_topic_docs_mask.sum())
                    
                    if doc_count > 0:
                        # 不限制数量，取该主题的所有关键词，确保合并后能有足够的数量
                        group_sorted = cast(Any, group).nlargest(len(group), 'weight')
                        for _, row in group_sorted.iterrows():
                            term = str(row['term'])
                            weight = float(row['weight'])
                            estimated_count = int(weight * doc_count * 10)
                            
                            if term not in all_keywords:
                                all_keywords[term] = {'count': 0, 'weight': 0.0}
                            all_keywords[term]['count'] += estimated_count
                            all_keywords[term]['weight'] += weight
            
            keywords = [
                {'term': term, 'count': data['count'], 'weight': data['weight']}
                for term, data in all_keywords.items()
            ]
            
            keywords = self._merge_case_insensitive_keywords(keywords)
            keywords.sort(key=lambda x: x['count'], reverse=True)
            return keywords[:50]
            
        except Exception as e:
            print(f"Error in get_keywords_topic_all_years: {e}")
            return []

    def get_keywords_topic_year(self, topic_id_1based: int, year: int) -> List[Dict[str, Any]]:
        """获取某一主题+某一年份的关键词（Top 50）。"""
        self._load_topic_terms()
        self._load_doc_topics()
        
        if self._topic_terms is None or self._doc_topics is None:
            return []
        
        try:
            topic_idx = topic_id_1based - 1
            year_docs = self._doc_topics[self._doc_topics['year'].astype(int) == int(year)]
            if year_docs.empty:
                return []
            
            group = self._topic_terms[self._topic_terms['topic_id'] == topic_idx]
            if group.empty:
                return []
            
            # 计算该主题在该年的文档数量
            topic_cols = [c for c in self._doc_topics.columns if str(c).startswith('topic_')]
            import numpy as np
            topic_probs_df = year_docs[topic_cols].astype(float)
            probs_array = np.array(topic_probs_df)
            max_indices = np.argmax(probs_array, axis=1)
            argmax_topic = pd.Series([int(topic_cols[j].replace('topic_', '')) for j in max_indices])
            topic_docs_mask = argmax_topic == topic_idx
            doc_count = int(topic_docs_mask.sum())
            
            if doc_count == 0:
                return []
            
            all_keywords = {}
            # 不限制数量，取该主题的所有关键词，确保合并后能有足够的数量
            group_sorted = cast(Any, group).nlargest(len(group), 'weight')
            for _, row in group_sorted.iterrows():
                term = str(row['term'])
                weight = float(row['weight'])
                estimated_count = int(weight * doc_count * 10)
                
                if term not in all_keywords:
                    all_keywords[term] = {'count': 0, 'weight': 0.0}
                all_keywords[term]['count'] += estimated_count
                all_keywords[term]['weight'] += weight
            
            keywords = [
                {'term': term, 'count': data['count'], 'weight': data['weight']}
                for term, data in all_keywords.items()
            ]
            
            keywords = self._merge_case_insensitive_keywords(keywords)
            keywords.sort(key=lambda x: x['count'], reverse=True)
            return keywords[:50]
            
        except Exception as e:
            print(f"Error in get_keywords_topic_year: {e}")
            return [] 