import os
import pickle
from typing import List

import pandas as pd
from gensim.corpora import Dictionary
from gensim import matutils

from .config import paths, vectorize, ensure_dirs

"""
模块功能：
- 从 normalized_tokens 目录读取分片 Parquet，合并为单个 DataFrame（仅内存不足时可分批处理）。
- 构建 gensim Dictionary 并进行频次/比例过滤。
- 生成 BoW 语料，持久化词典、语料与文档元数据。
"""


def load_tokens_frame() -> pd.DataFrame:
    """读取 normalized_tokens 目录下的所有分片并合并。"""
    dir_path = os.path.join(paths.artifacts_dir, 'normalized_tokens')
    if not os.path.isdir(dir_path):
        # 兼容旧版：如果是单文件
        fp = os.path.join(paths.artifacts_dir, 'normalized_tokens.parquet')
        return pd.read_parquet(fp)
    parts = [os.path.join(dir_path, f) for f in os.listdir(dir_path) if f.endswith('.parquet')]
    parts.sort()
    frames = [pd.read_parquet(p) for p in parts]
    return pd.concat(frames, ignore_index=True)


def build_dictionary(tokens_series: List[List[str]]) -> Dictionary:
    """根据 tokens 列表构建词典并进行过滤。"""
    dictionary = Dictionary(tokens_series)
    dictionary.filter_extremes(no_below=vectorize.no_below,
                               no_above=vectorize.no_above,
                               keep_n=vectorize.keep_n)
    return dictionary


def create_corpus(tokens_series: List[List[str]], dictionary: Dictionary):
    """将每篇文档的 tokens 映射为 BoW 向量。"""
    return [dictionary.doc2bow(tokens) for tokens in tokens_series]


def persist_dictionary(dictionary: Dictionary) -> str:
    """保存过滤后的词典到 artifacts 目录。"""
    ensure_dirs()
    out = os.path.join(paths.artifacts_dir, 'dictionary_filtered.pkl')
    with open(out, 'wb') as f:
        pickle.dump(dictionary, f)
    return out


def persist_corpus_mm(corpus, name: str = 'corpus_bow.mm') -> str:
    """以 Matrix Market 格式写出 BoW 语料，便于后续按需加载。"""
    ensure_dirs()
    out = os.path.join(paths.artifacts_dir, name)
    matutils.MmWriter.write_corpus(out, corpus)
    return out


def run_vectorize() -> dict:
    """主流程：读取 tokens，构建词典与语料，保存产物。"""
    ensure_dirs()
    df = load_tokens_frame()
    tokens_series = df['tokens'].tolist()
    dictionary = build_dictionary(tokens_series)
    corpus = create_corpus(tokens_series, dictionary)

    dict_path = persist_dictionary(dictionary)
    corpus_path = persist_corpus_mm(corpus, 'corpus_bow.mm')

    # 保存文档元数据，用于后续拼接主题分布
    meta_path = os.path.join(paths.artifacts_dir, 'doc_meta.parquet')
    df[['article_id', 'year']].to_parquet(meta_path, index=False)

    return {
        'dictionary': dict_path,
        'corpus': corpus_path,
        'meta': meta_path,
    }


if __name__ == '__main__':
    print(run_vectorize()) 