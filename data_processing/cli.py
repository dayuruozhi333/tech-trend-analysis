import argparse
import os
import shutil

"""
模块功能：
- 提供数据处理与LDA训练的一站式命令行入口。
- 子命令：
  preprocess  预处理文本，生成标准化 tokens 的 Parquet
  vectorize   构建词典与BoW语料，并保存文档元数据
  train       训练LDA模型并导出主题-词表
  label       依据top-terms生成主题标签，支持人工覆盖
  trends      计算文档-主题概率与年度主题强度
  vis         生成pyLDAvis交互可视化HTML
  all         串行执行以上各步（可指定输入与主题数）
  sync        将关键产物同步到后端可服务目录
"""

from .config import paths, lda, ensure_dirs
from .preprocess_nlp import build_normalized_text_parquet
from .vectorize import run_vectorize
from .train_lda import train_model
from .label_topics import generate_labels_suggestion, persist_labels
from .compute_trends import compute_doc_topic, compute_yearly_trends
from .visualize_pyldavis import build_pyldavis_html


def cmd_preprocess(args):
    """预处理：按需覆盖输入CSV路径，生成规范化 tokens 的 Parquet。"""
    if args.input:
        paths.input_csv = args.input  # 指定输入数据路径
    print(build_normalized_text_parquet(paths.input_csv))


def cmd_vectorize(args):
    """向量化：构建词典与BoW语料，保存文档元数据。"""
    print(run_vectorize())


def cmd_train(args):
    """训练：使用gensim LDA训练模型，可通过 --topics 指定主题数。"""
    if args.topics:
        lda.num_topics = args.topics  # 主题数超参
    print(train_model())


def cmd_label(args):
    """标注：基于top-terms生成建议标签，可通过 --overrides 提供人工覆盖JSON。"""
    labels = generate_labels_suggestion()
    overrides = args.overrides if args.overrides else None
    print(persist_labels(labels, overrides))


def cmd_trends(args):
    """趋势：计算文档-主题概率与年度主题强度并保存Parquet。"""
    print(compute_doc_topic())
    print(compute_yearly_trends())


def cmd_vis(args):
    """可视化：生成pyLDAvis HTML文件。"""
    print(build_pyldavis_html())


def cmd_all(args):
    """一键全流程：支持 --input 与 --topics 参数，串行执行所有步骤。"""
    if args.input:
        paths.input_csv = args.input
    if args.topics:
        lda.num_topics = args.topics
    print(build_normalized_text_parquet(paths.input_csv))
    print(run_vectorize())
    print(train_model())
    labels = generate_labels_suggestion()
    print(persist_labels(labels))
    print(compute_doc_topic())
    print(compute_yearly_trends())
    print(build_pyldavis_html())


def cmd_sync(args):
    """同步：将核心工件复制到后端服务目录，便于API与静态页面加载。"""
    ensure_dirs()
    # 源产物目录与目标目录
    src = paths.artifacts_dir
    dst_models = paths.backend_models_dir
    dst_vis = paths.backend_vis_dir
    os.makedirs(dst_models, exist_ok=True)
    os.makedirs(dst_vis, exist_ok=True)

    # 同步模型与数据工件
    # 注意：gensim 的 LDA 模型会生成多个伴随文件（如 .expElogbeta.npy 等），
    # 需将前缀为 lda_model.gensim* 的所有文件拷贝过去；同理 BoW 语料也有 .mm.index。
    import glob

    fixed_names = [
        'dictionary_filtered.pkl',
        'doc_meta.parquet',
        'doc_topics.parquet',
        'yearly_trends.parquet',
        'topic_terms.csv',
        'topic_labels.json',
    ]
    for name in fixed_names:
        s = os.path.join(src, name)
        if os.path.exists(s):
            shutil.copy2(s, os.path.join(dst_models, name))

    # 复制 LDA 模型前缀文件
    for fp in glob.glob(os.path.join(src, 'lda_model.gensim*')):
        shutil.copy2(fp, os.path.join(dst_models, os.path.basename(fp)))

    # 复制语料矩阵（如有）
    for fp in glob.glob(os.path.join(src, 'corpus_bow.mm*')):
        shutil.copy2(fp, os.path.join(dst_models, os.path.basename(fp)))
    # 同步pyLDAvis页面
    vis_src = os.path.join(src, 'pyldavis.html')
    if os.path.exists(vis_src):
        shutil.copy2(vis_src, os.path.join(dst_vis, 'pyldavis.html'))


def build_parser():
    """构建命令行参数解析器，注册各子命令与参数。"""
    p = argparse.ArgumentParser(description='Tech Trend LDA Pipeline')
    sub = p.add_subparsers(required=True)

    # 预处理
    sp = sub.add_parser('preprocess')
    sp.add_argument('--input', type=str, help='path to df_papers.csv')
    sp.set_defaults(func=cmd_preprocess)

    # 向量化
    sv = sub.add_parser('vectorize')
    sv.set_defaults(func=cmd_vectorize)

    # 训练
    st = sub.add_parser('train')
    st.add_argument('--topics', type=int, help='number of topics')
    st.set_defaults(func=cmd_train)

    # 标注
    sl = sub.add_parser('label')
    sl.add_argument('--overrides', type=str, help='path to overrides json')
    sl.set_defaults(func=cmd_label)

    # 趋势
    strd = sub.add_parser('trends')
    strd.set_defaults(func=cmd_trends)

    # 可视化
    svs = sub.add_parser('vis')
    svs.set_defaults(func=cmd_vis)

    # 全流程
    sa = sub.add_parser('all')
    sa.add_argument('--input', type=str, help='path to df_papers.csv')
    sa.add_argument('--topics', type=int, help='number of topics')
    sa.set_defaults(func=cmd_all)

    # 同步
    ss = sub.add_parser('sync')
    ss.set_defaults(func=cmd_sync)

    return p


def main():
    """程序入口：解析参数并分发至对应子命令处理函数。"""
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main() 