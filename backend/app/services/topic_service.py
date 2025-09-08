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

        - 文献总数：基于 doc_topics + doc_meta（或 trends 近似）。
        - 词汇占比：使用该主题的词-权重并归一化为百分比（Top 30）。
        """
        # 主题 id 转为 0 起始
        topic_idx = topic_id_1based - 1
        self._load_labels()
        self._load_topic_terms()
        # 1) 计算词汇占比（Top 30）
        assert self._topic_terms is not None
        group = self._topic_terms[self._topic_terms['topic_id'] == topic_idx]
        if group.empty:
            terms: List[Dict[str, Any]] = []
        else:
            # 使用 nlargest 选择 Top 30 词汇
            group_sorted = cast(Any, group).nlargest(30, 'weight')
            total = float(group_sorted['weight'].sum()) or 1.0
            terms = [
                {
                    'term': str(row['term']),
                    'weight': float(row['weight']),
                    'percent': float(row['weight']) / total,
                }
                for _, row in group_sorted.iterrows()
            ]

        # 2) 估算文献总数
        doc_count = 0
        self._load_meta()
        self._load_doc_topics()
        if self._meta is not None and self._doc_topics is not None:
            # 期望结构：_meta 含 year 列，_doc_topics 含 topic_0..topic_n 列，行对齐
            try:
                dfm = self._meta.copy()
                dft = self._doc_topics.copy()
                if len(dfm) == len(dft) and 'year' in dfm.columns:
                    mask_year = dfm['year'].astype(int) == int(year)
                    topic_cols = [c for c in dft.columns if str(c).startswith('topic_')]
                    if topic_cols:
                        # 取每行最大主题
                        argmax_col = cast(pd.Series, dft[topic_cols].astype(float).idxmax(axis=1))
                        argmax_topic = argmax_col.astype(str).str.replace('topic_', '').astype(int)
                        doc_count = int(((argmax_topic == topic_idx) & mask_year).sum())
            except Exception:
                doc_count = 0
        if not doc_count:
            # 回退：使用 trends 数值的相对强度近似（非精确计数）
            self._load_trends()
            if self._trends is not None:
                col = f'topic_{topic_idx}'
                rows = self._trends[self._trends['year'].astype(int) == int(year)]
                if col in self._trends.columns and not rows.empty:
                    val = float(rows.iloc[0][col])
                    doc_count = int(round(max(val, 0)))

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