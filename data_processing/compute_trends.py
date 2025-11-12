import os
import pickle
import numpy as np
import pandas as pd
from typing import List

from gensim.corpora import Dictionary
from gensim.models.ldamodel import LdaModel
from gensim.corpora import MmCorpus 

from .config import paths, ensure_dirs

"""
模块功能：
- 计算每篇文档的主题分布（doc-topic 概率向量）。
- 按年份聚合，得到每年每个主题的平均概率（主题强度）。
- 输出 doc_topics.parquet 与 yearly_trends.parquet。
"""


def load_dictionary() -> Dictionary:
    """加载过滤后的词典。"""
    with open(os.path.join(paths.artifacts_dir, 'dictionary_filtered.pkl'), 'rb') as f:
        return pickle.load(f)


def load_corpus():
    """加载 BoW 语料。"""
    # gensim.corpora.MmCorpus 用于加载 Matrix Market 格式的语料
    return MmCorpus(os.path.join(paths.artifacts_dir, 'corpus_bow.mm'))


def load_meta() -> pd.DataFrame:
    """加载文档元数据（article_id, year）。"""
    return pd.read_parquet(os.path.join(paths.artifacts_dir, 'doc_meta.parquet'))


def load_model() -> LdaModel:
    """加载已训练的 LDA 模型。"""
    return LdaModel.load(os.path.join(paths.artifacts_dir, 'lda_model.gensim'))


def compute_doc_topic() -> str:
    """计算每篇文档的主题概率分布并输出到 Parquet。"""
    ensure_dirs()
    corpus = load_corpus()
    meta = load_meta()
    model = load_model()

    num_docs = len(meta)
    num_topics = model.num_topics
    dt = np.zeros((num_docs, num_topics), dtype=np.float32)

    for i, bow in enumerate(corpus):
        # minimum_probability=0.0 以便得到完整的稠密分布（包含所有主题）
        for topic_id, prob in model.get_document_topics(bow, minimum_probability=0.0):
            dt[i, topic_id] = prob

    df_dt = pd.DataFrame(dt, columns=[f'topic_{i}' for i in range(num_topics)])
    df_out = pd.concat([meta.reset_index(drop=True), df_dt], axis=1)
    out = os.path.join(paths.artifacts_dir, 'doc_topics.parquet')
    df_out.to_parquet(out, index=False)
    return out


def compute_yearly_trends(doc_topics_parquet: str | None = None) -> str:
    """按年对 doc-topic 概率取平均，得到主题年度强度曲线。"""
    fp = doc_topics_parquet or os.path.join(paths.artifacts_dir, 'doc_topics.parquet')
    df = pd.read_parquet(fp)
    topic_cols = [c for c in df.columns if c.startswith('topic_')]
    trends = df.groupby('year')[topic_cols].mean().reset_index()
    out = os.path.join(paths.artifacts_dir, 'yearly_trends.parquet')
    trends.to_parquet(out, index=False)
    return out


if __name__ == '__main__':
    print(compute_doc_topic())
    print(compute_yearly_trends()) 