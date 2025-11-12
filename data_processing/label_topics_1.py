import os
import json
import pandas as pd

from .config import paths, ensure_dirs

"""
模块功能：
- 基于已导出的 topic_terms.csv 生成主题标签建议（取若干高权重关键词拼接）。
- 支持从 overrides JSON 文件读取人工标注并覆盖建议标签。
- 最终输出 topic_labels.json，供服务端加载使用。
"""


def generate_labels_suggestion(top_terms_csv: str | None = None, topk: int = 3) -> dict:
    """从主题-词权重表生成默认标签，取每个主题前 topk 个关键词拼接。"""
    ensure_dirs()
    fp = top_terms_csv or os.path.join(paths.artifacts_dir, 'topic_terms.csv')
    df = pd.read_csv(fp)
    labels = {}
    for topic_id, group in df.groupby('topic_id'):
        terms = group.sort_values('weight', ascending=False)['term'].tolist()[:topk]
        labels[int(topic_id)] = ' / '.join(terms)
    return labels


def persist_labels(labels: dict, overrides_path: str | None = None) -> str:
    """保存标签到 artifacts；若提供 overrides 则按键覆盖默认标签。"""
    out = os.path.join(paths.artifacts_dir, 'topic_labels.json')
    final_labels = labels.copy()
    if overrides_path and os.path.exists(overrides_path):
        with open(overrides_path, 'r', encoding='utf-8') as f:
            overrides = json.load(f)
        for k, v in overrides.items():
            final_labels[int(k)] = v
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(final_labels, f, ensure_ascii=False, indent=2)
    return out


if __name__ == '__main__':
    labels = generate_labels_suggestion()
    print(persist_labels(labels)) 