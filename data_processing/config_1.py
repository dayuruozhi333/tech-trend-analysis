import os
from dataclasses import dataclass, field
from typing import List

"""
模块功能：
- 定义数据处理与训练过程所需的路径与参数配置。
- 提供 ensure_dirs 方法以确保产物输出目录存在。
"""


@dataclass
class Paths:
    """路径配置：输入文件与各类产物输出位置"""
    input_csv: str = os.path.join('backend', 'data', 'processed_data', 'df_papers.csv')  # 输入论文CSV
    artifacts_dir: str = os.path.join('data_processing', 'artifacts', 'lda')  # 离线训练产物目录
    backend_models_dir: str = os.path.join('backend', 'data', 'models', 'lda')  # 后端可加载的模型目录
    backend_vis_dir: str = os.path.join('backend', 'data', 'vis')  # 可视化产物目录（pyLDAvis等）


@dataclass
class NLPConfig:
    """NLP 预处理参数配置"""
    language: str = 'english'  # 语言（用于停用词等）
    min_token_length: int = 2  # 过滤过短token
    enable_lemmatize: bool = True  # 是否启用词形还原
    # 使用 default_factory 避免 dataclass 可变默认值问题
    extra_stopwords: List[str] = field(default_factory=list)  # 额外停用词


@dataclass
class VectorizeConfig:
    """向量化（词典过滤）参数配置"""
    no_below: int = 5  # 词至少出现在 no_below 篇文档中
    no_above: float = 0.5  # 词出现在文档比例高于该阈值则过滤
    keep_n: int = 100000  # 词典最多保留的词数


@dataclass
class LDAConfig:
    """LDA 训练参数配置"""
    num_topics: int = 12  # 主题数
    random_state: int = 42  # 随机种子
    passes: int = 5  # 语料遍历轮数
    iterations: int = 200  # 迭代次数
    alpha: str | float = 'auto'  # 文档-主题稀疏度
    eta: str | float = 'auto'  # 主题-词稀疏度
    chunksize: int = 2000  # 每批训练文档数


paths = Paths()
nlp = NLPConfig()
vectorize = VectorizeConfig()
lda = LDAConfig()


def ensure_dirs() -> None:
    """确保各个输出目录存在。"""
    # 产物目录（训练中间文件、模型）
    os.makedirs(paths.artifacts_dir, exist_ok=True)
    # 后端模型加载目录（部署/服务用）
    os.makedirs(paths.backend_models_dir, exist_ok=True)
    # 可视化目录（pyLDAvis生成的HTML）
    os.makedirs(paths.backend_vis_dir, exist_ok=True) 