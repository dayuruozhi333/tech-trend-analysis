import os
import re
import json
from typing import Iterable, Iterator, List, Tuple

import pandas as pd
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk import download as nltk_download

from .config import paths, nlp, ensure_dirs

"""
模块功能：
- 读取大规模论文 CSV（article_id, abstract_cleaned/abstract, year）。
- 使用 NLTK 对摘要进行规范化：小写化、去停用词、正则保留字母、词形还原。
- 以生成器形式按行产出 tokens，最终以分片 Parquet 写入目录，避免一次性占用内存。
"""


_word_re = re.compile(r"[a-zA-Z]+")  # 仅保留字母，过滤数字与符号


def _bootstrap_nltk() -> None:
    """确保 NLTK 所需资源可用（停用词与词形还原词典）。"""
    try:
        stopwords.words('english')
    except LookupError:
        nltk_download('stopwords')
    try:
        WordNetLemmatizer()
        nltk_download('wordnet')
        nltk_download('omw-1.4')
    except LookupError:
        nltk_download('wordnet')
        nltk_download('omw-1.4')


def normalize_text(text: str, lemmatizer: WordNetLemmatizer, stop_words: set) -> List[str]:
    """将文本规范化并切分为 tokens。"""
    if not isinstance(text, str):
        return []
    text = text.lower()
    tokens = _word_re.findall(text)
    result: List[str] = []
    for t in tokens:
        if len(t) < nlp.min_token_length:  # 过滤过短词
            continue
        if t in stop_words:  # 去停用词
            continue
        if nlp.enable_lemmatize:
            t = lemmatizer.lemmatize(t)  # 词形还原
        result.append(t)
    return result


def iter_tokens_from_csv(csv_path: str, chunksize: int = 10000) -> Iterator[Tuple[int, int, List[str]]]:
    """分块读取 CSV，逐行输出 (article_id, year, tokens)。

    兼容两种摘要列名：
    - abstract_cleaned（优先）
    - abstract（若未提供 cleaned 列）
    """
    _bootstrap_nltk()
    stop_words = set(stopwords.words('english'))
    if nlp.extra_stopwords:
        stop_words.update(nlp.extra_stopwords)
    lemmatizer = WordNetLemmatizer()

    # 先探测列名，选择摘要列
    header = pd.read_csv(csv_path, nrows=0)
    abstract_col = 'abstract_cleaned' if 'abstract_cleaned' in header.columns else (
        'abstract' if 'abstract' in header.columns else None
    )
    if abstract_col is None:
        raise ValueError("Input CSV must contain 'abstract_cleaned' or 'abstract' column")

    cols = ['article_id', abstract_col, 'year']
    for chunk in pd.read_csv(csv_path, usecols=cols, chunksize=chunksize):
        for _, row in chunk.iterrows():
            article_id = int(row['article_id'])
            year = int(row['year'])
            tokens = normalize_text(row[abstract_col], lemmatizer, stop_words)
            yield article_id, year, tokens


def build_normalized_text_parquet(csv_path: str | None = None, batch_size: int = 200000) -> str:
    """将 tokens 以分片 Parquet 写入目录，返回目录路径。
    目录结构：artifacts/lda/normalized_tokens/part_000001.parquet 等。
    """
    ensure_dirs()
    src = csv_path or paths.input_csv
    out_dir = os.path.join(paths.artifacts_dir, 'normalized_tokens')
    os.makedirs(out_dir, exist_ok=True)

    buffer: List[dict] = []
    part = 0
    for article_id, year, tokens in iter_tokens_from_csv(src):
        buffer.append({'article_id': article_id, 'year': year, 'tokens': tokens})
        if len(buffer) >= batch_size:
            part += 1
            fp = os.path.join(out_dir, f'part_{part:06d}.parquet')
            pd.DataFrame.from_records(buffer).to_parquet(fp, index=False)
            buffer.clear()
    if buffer:
        part += 1
        fp = os.path.join(out_dir, f'part_{part:06d}.parquet')
        pd.DataFrame.from_records(buffer).to_parquet(fp, index=False)
        buffer.clear()

    return out_dir


if __name__ == '__main__':
    out = build_normalized_text_parquet()
    print(out) 