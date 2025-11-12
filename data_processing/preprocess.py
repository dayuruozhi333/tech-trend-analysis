# data_preprocessing.py
"""
模块功能：
- 从指定目录批量读取 JSON 文献数据，抽取核心字段，构建三张表：主表、论文表、作者表。
- 对标题、摘要、关键词、期刊名等文本进行“超强清洗”（HTML 解码、去标签、多轮清理、前缀剔除、空白规整）。
- 清洗作者姓名与机构信息（去邮箱、联系方式等噪声），并进行缺失值过滤。
- 导出 CSV 与基础统计报告，可作为后续 LDA 主题建模、网络分析与趋势分析的数据基座。
"""

import os
import json
import pandas as pd
import numpy as np
import re
import html
import glob
from tqdm import tqdm



def ultra_clean_text(text):
    """
    超强文本清洗函数，处理 HTML 标签与空值并做多轮规整。
    步骤：
    1) 统一空值判定并提前返回 None
    2) HTML 实体解码（例如 &amp; → &）
    3) 多轮移除 HTML 标签（成对标签与单标签），尽可能消除残留
    4) 规整空白（多空格→单空格，去首尾空白）
    5) 去除摘要中常见无意义前缀（如 Abstract/Summary）
    6) 最终长度检查（<3 视为无效）
    返回：清洗后的字符串或 None
    """
    # 处理各种空值情况
    if (pd.isna(text) or
            text == '' or
            str(text).strip() == '' or
            str(text).lower() in ['nan', 'none', 'null']):
        return None

    text = str(text)

    # HTML 解码（将 &amp;、&lt; 等实体还原）
    text = html.unescape(text)

    # 彻底移除 HTML 标签 - 多轮清理，尽可能覆盖异常嵌套
    for _ in range(5):
        # 移除完整的 HTML 标签对
        text = re.sub(r'<[^>]*>.*?</[^>]*>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
        # 移除单独的 HTML 标签
        text = re.sub(r'<[^>]*>', ' ', text, flags=re.IGNORECASE)

    # 清理空白字符（多空格折叠为单空格）
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()

    # 移除常见的无意义前缀（对摘要）
    prefixes_to_remove = ['Abstract', 'ABSTRACT', 'Summary', 'SUMMARY']
    for prefix in prefixes_to_remove:
        if text.startswith(prefix):
            text = text[len(prefix):].strip()
            # 进一步去除紧随其后的分隔符
            if text.startswith(':') or text.startswith('-'):
                text = text[1:].strip()

    # 最终检查是否为空或过短
    if not text or len(text) < 3:  # 少于3个字符认为无意义
        return None

    return text



def clean_affiliation_text(affiliation):
    """
    清洗机构信息，去除邮箱、联系方式、无关标注等噪声。
    返回：清洗后的机构字符串或 None。
    """
    if pd.isna(affiliation) or affiliation == '' or str(affiliation).strip() == '':
        return None

    affiliation = str(affiliation)

    # 需要移除的典型噪声模式（邮箱、电话、通信作者说明等）
    patterns_to_remove = [
        r'\s*Electronic address:\s*[^\s;,\.]+',
        r'\s*E-mail:\s*[^\s;,\.]+',
        r'\s*Email:\s*[^\s;,\.]+',
        r'\s*Tel:\s*[^\s;,\.]+',
        r'\s*Phone:\s*[^\s;,\.]+',
        r'\s*Fax:\s*[^\s;,\.]+',
        r'\s*Corresponding author[^;,\.]*',
        r'\s*↑[^;,\.]*',
        r'\s*Author to whom correspondence should be addressed[^;,\.]*',
        r'\s*\*[^;,\.]*correspondence[^;,\.]*',
    ]

    for pattern in patterns_to_remove:
        affiliation = re.sub(pattern, '', affiliation, flags=re.IGNORECASE)

    # 规整分隔符与空白
    affiliation = re.sub(r'\s*;\s*', ';', affiliation)
    affiliation = re.sub(r'\s+', ' ', affiliation)
    affiliation = affiliation.strip().strip(';').strip()

    return affiliation if affiliation else None



def extract_and_process_data(json_dir):
    """
    一次性提取和处理所有 JSON 数据，返回三张 DataFrame：
    - df_main: 主表（原始字段清洗后）
    - df_papers: 论文表（article_id、title、abstract、year）
    - df_authors: 作者表（article_id、author_name、author_affiliation_raw）
    """
    print("开始处理JSON文件...")

    # 收集目录内所有 JSON 文件
    json_files = glob.glob(os.path.join(json_dir, "*.json"))
    print(f"找到 {len(json_files)} 个JSON文件")

    all_records = []

    # 逐个读取 JSON 文件
    for file_path in tqdm(json_files, desc="读取JSON文件"):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, list):
                for record in data:
                    # 提取关键信息，字段名按原始结构做兼容处理
                    extracted = {
                        'ArticleId': record.get('ArticleId'),
                        'Title': record.get('Title'),
                        'Abstract': record.get('Abstract'),
                        'PubYear': record.get('PubYear'),
                        'DOI': record.get('DOI'),
                        'JournalTitle': record.get('JournalTitle'),
                        'ISSN': record.get('ISSN'),
                        'EISSN': record.get('EISSN'),
                        'Authors': record.get('Authors', []),
                        'Keywords': record.get('Keywords')
                    }
                    all_records.append(extracted)

        except Exception as e:
            # 容错：单文件出错不影响整体流程
            print(f"处理文件 {file_path} 时出错: {str(e)}")
            continue

    print(f"总共提取了 {len(all_records):,} 条记录")

    # 创建主表 DataFrame
    df_main = pd.DataFrame(all_records)

    # 清洗主表文本字段（标题、摘要、关键词、期刊名）
    print("清洗主表文本字段...")
    for col in ['Title', 'Abstract', 'Keywords', 'JournalTitle']:
        if col in df_main.columns:
            print(f"清洗 {col}...")
            tqdm.pandas(desc=f"清洗{col}")
            df_main[col] = df_main[col].progress_apply(ultra_clean_text)

    # 生成论文表
    print("生成论文表...")
    df_papers = df_main[['ArticleId', 'Title', 'Abstract', 'PubYear']].copy()
    df_papers.columns = ['article_id', 'title', 'abstract', 'year']

    # 移除标题或摘要为空的记录
    original_count = len(df_papers)
    df_papers = df_papers.dropna(subset=['title', 'abstract'])
    print(f"论文表: 移除 {original_count - len(df_papers):,} 条空记录，剩余 {len(df_papers):,} 条")

    # 生成作者表
    print("生成作者表...")
    authors_records = []

    for _, row in tqdm(df_main.iterrows(), total=len(df_main), desc="处理作者数据"):
        article_id = row['ArticleId']
        authors_data = row['Authors']

        # 兼容字符串化的 list 表达形式
        if isinstance(authors_data, str):
            try:
                authors_list = eval(authors_data)  # 注意：若来源可靠可使用；否则建议更严格解析
            except:
                continue
        else:
            authors_list = authors_data

        if isinstance(authors_list, list):
            for author in authors_list:
                if isinstance(author, dict):
                    author_record = {
                        'article_id': article_id,
                        'author_name': author.get('Name', ''),
                        'author_affiliation_raw': author.get('Affiliation', '')
                    }
                    authors_records.append(author_record)

    df_authors = pd.DataFrame(authors_records)

    # 清洗作者表（姓名与机构）
    print("清洗作者表...")
    tqdm.pandas(desc="清洗作者姓名")
    df_authors['author_name'] = df_authors['author_name'].progress_apply(ultra_clean_text)

    tqdm.pandas(desc="清洗机构信息")
    df_authors['author_affiliation_raw'] = df_authors['author_affiliation_raw'].progress_apply(clean_affiliation_text)

    # 移除空值记录
    original_authors_count = len(df_authors)
    df_authors = df_authors.dropna(subset=['author_name', 'author_affiliation_raw'])
    print(f"作者表: 移除 {original_authors_count - len(df_authors):,} 条空记录，剩余 {len(df_authors):,} 条")

    # 删除主表中 Title 或 Abstract 为空的记录（与论文表一致）
    original_main_count = len(df_main)
    df_main = df_main.dropna(subset=['Title', 'Abstract'])
    print(f"主表: 移除 {original_main_count - len(df_main):,} 条空记录，剩余 {len(df_main):,} 条")

    return df_main, df_papers, df_authors



def save_data(df_main, df_papers, df_authors, output_dir="processed_data"):
    """
    保存处理后的数据到 CSV，并输出基本统计与质量检查结果。
    - 输出：df_main.csv, df_papers.csv, df_authors.csv
    - 报告：记录数、年份分布、文件大小、空值统计、HTML 标签残留检测
    """
    os.makedirs(output_dir, exist_ok=True)

    print("保存数据文件...")

    # 保存 CSV 文件
    df_main.to_csv(os.path.join(output_dir, "df_main.csv"), index=False, encoding='utf-8')
    df_papers.to_csv(os.path.join(output_dir, "df_papers.csv"), index=False, encoding='utf-8')
    df_authors.to_csv(os.path.join(output_dir, "df_authors.csv"), index=False, encoding='utf-8')

    # 生成报告
    print(f"\n=== 数据预处理完成 ===")
    print(f"主表: {len(df_main):,} 条记录")
    print(f"论文表: {len(df_papers):,} 条记录 (完整标题+摘要)")
    print(f"作者表: {len(df_authors):,} 条记录 (完整姓名+机构)")

    # 年份分布
    print(f"\n年份分布:")
    year_dist = df_papers['year'].value_counts().sort_index()
    for year, count in year_dist.items():
        print(f"  {year}: {count:,}")

    # 文件大小
    print(f"\n文件大小:")
    for filename in ['df_main.csv', 'df_papers.csv', 'df_authors.csv']:
        filepath = os.path.join(output_dir, filename)
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"  {filename}: {size_mb:.1f} MB")

    # 最终质量检查
    print(f"\n=== 数据质量检查 ===")
    print("空值统计:")
    print(f"  主表: {df_main.isnull().sum().sum()} 个空值")
    print(f"  论文表: {df_papers.isnull().sum().sum()} 个空值")
    print(f"  作者表: {df_authors.isnull().sum().sum()} 个空值")

    # 检查是否仍有 HTML 标签残留（保险起见）
    html_found = False
    for table_name, df_check, cols in [
        ("主表", df_main, ['Title', 'Abstract']),
        ("论文表", df_papers, ['title', 'abstract'])
    ]:
        for col in cols:
            if col in df_check.columns:
                html_count = df_check[col].str.contains('<[^>]*>', regex=True, na=False).sum()
                if html_count > 0:
                    print(f"  {table_name}.{col}: {html_count} 条包含HTML标签")
                    html_found = True

    if not html_found:
        print("  ✓ 无HTML标签残留")

    print(f"\n数据已保存到: {output_dir}/")
    print("可用于后续分析: LDA主题建模、合作网络分析、趋势分析")



def main():
    """
    主函数：
    - 指定 JSON 输入目录（默认 json_TX）
    - 执行提取、清洗与表构建
    - 保存 CSV 与报告
    """
    json_dir = "json_TX"

    if not os.path.exists(json_dir):
        print(f"错误: 目录 {json_dir} 不存在")
        return

    # 提取和处理数据
    df_main, df_papers, df_authors = extract_and_process_data(json_dir)

    # 保存数据
    save_data(df_main, df_papers, df_authors)

    print("\n数据预处理流程完成!")


if __name__ == "__main__":
    main()
