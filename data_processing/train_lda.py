import os
import json
import pickle
from typing import Any

from gensim.corpora import Dictionary
from gensim.models.ldamodel import LdaModel
from gensim.corpora import MmCorpus  

from .config import paths, lda, ensure_dirs

"""
模块功能：
- 从 artifacts 目录加载 BoW 语料与词典。
- 训练可配置主题数的 LDA 模型，保存模型与训练配置。
- 导出每个主题的 Top-N 关键词与权重。
"""


def load_dictionary() -> Dictionary:
    """加载过滤后的词典。"""
    with open(os.path.join(paths.artifacts_dir, 'dictionary_filtered.pkl'), 'rb') as f:
        return pickle.load(f)


def load_corpus():
    """加载 BoW 语料（Matrix Market 格式）。"""
    # 注意：MmCorpus 应从 gensim.corpora 导入，而不是 matutils
    return MmCorpus(os.path.join(paths.artifacts_dir, 'corpus_bow.mm'))


def train_model() -> str:
    """训练 LDA 模型并保存产物与配置。返回模型路径。"""
    ensure_dirs()
    dictionary = load_dictionary()
    corpus = load_corpus()

    # 关键训练超参：主题数、passes/iterations、alpha/eta
    model = LdaModel(
        corpus=corpus,
        id2word=dictionary,
        num_topics=lda.num_topics,
        random_state=lda.random_state,
        passes=lda.passes,
        iterations=lda.iterations,
        # alpha 需要为 str 或 list，若为 float 或 int 需转为 str
        alpha=str(lda.alpha) if isinstance(lda.alpha, (float, int)) else lda.alpha,
        # eta 需要为 str 或 list，若为 float 或 int 需转为 str
        eta=str(lda.eta) if isinstance(lda.eta, (float, int)) else lda.eta,
        chunksize=lda.chunksize
    )

    model_path = os.path.join(paths.artifacts_dir, 'lda_model.gensim')
    model.save(model_path)

    # 记录本次训练配置，便于复现
    with open(os.path.join(paths.artifacts_dir, 'lda_config.json'), 'w', encoding='utf-8') as f:
        json.dump({
            'num_topics': lda.num_topics,
            'random_state': lda.random_state,
            'passes': lda.passes,
            'iterations': lda.iterations,
            'alpha': lda.alpha,
            'eta': lda.eta,
            'chunksize': lda.chunksize,
        }, f, ensure_ascii=False, indent=2)

    # 导出主题-词表
    export_topic_terms(model)

    return model_path


def export_topic_terms(model: LdaModel, topn: int = 20) -> str:
    """导出每个主题的 Top-N 关键词及其权重为 CSV。"""
    import pandas as pd
    rows = []
    for topic_id in range(model.num_topics):
        for term, weight in model.show_topic(topic_id, topn=topn):
            rows.append({'topic_id': topic_id, 'term': term, 'weight': float(weight)})
    out = os.path.join(paths.artifacts_dir, 'topic_terms.csv')
    pd.DataFrame(rows).to_csv(out, index=False)
    return out


if __name__ == '__main__':
    print(train_model()) 