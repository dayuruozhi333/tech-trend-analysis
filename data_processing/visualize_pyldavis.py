import os
import pickle

import pyLDAvis
import pyLDAvis.gensim_models as gensimvis
from gensim import matutils
from gensim.corpora import Dictionary
from gensim.models import LdaModel
from gensim.corpora import MmCorpus  # 导入 MmCorpus（中文注释：用于加载 Matrix Market 格式的语料）

from .config import paths, ensure_dirs

"""
模块功能：
- 基于训练完成的 LDA 模型、词典与语料生成 pyLDAvis 可交互可视化。
- 输出 HTML 文件，可由后端静态服务直接提供访问。
"""


def load_dictionary() -> Dictionary:
    """加载过滤后的词典。"""
    with open(os.path.join(paths.artifacts_dir, 'dictionary_filtered.pkl'), 'rb') as f:
        return pickle.load(f)


def load_corpus():
    """加载 BoW 语料。"""
    # MmCorpus 实际应从 gensim.corpora 导入，而不是 matutils
    return MmCorpus(os.path.join(paths.artifacts_dir, 'corpus_bow.mm'))


def load_model() -> LdaModel:
    """加载 LDA 模型。"""
    return LdaModel.load(os.path.join(paths.artifacts_dir, 'lda_model.gensim'))


def build_pyldavis_html() -> str:
    """生成 pyLDAvis HTML 并返回文件路径。"""
    ensure_dirs()
    dictionary = load_dictionary()
    corpus = load_corpus()
    model = load_model()

    # prepare 会计算主题间距离与关键词相关度，用于可视化
    vis = gensimvis.prepare(model, corpus, dictionary)
    out = os.path.join(paths.artifacts_dir, 'pyldavis.html')
    pyLDAvis.save_html(vis, out)
    return out


if __name__ == '__main__':
    print(build_pyldavis_html()) 