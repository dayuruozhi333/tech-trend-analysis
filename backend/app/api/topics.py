from flask import jsonify, send_from_directory, abort, Response

from . import routes  # ensure package init
from .. import app
from ..services.topic_service import TopicService

"""
模块功能：
- 提供主题相关 API：主题列表、主题详情、年度趋势，以及 pyLDAvis 页面访问。
"""


@app.get('/api/topics')
def list_topics():
    """返回所有主题的基本信息（ID、标签、Top 关键词）。"""
    svc = TopicService.get_instance()
    topics = svc.get_topics()
    # 注意：服务层 get_topics() 已返回 0-based id。这里保持与 /trends 一致：1 起始
    data = []
    for t in topics:
        data.append({
            'id': t.id + 1,
            'label': t.label,
            'topTerms': t.top_terms,
        })
    return jsonify(data)


@app.get('/api/topics/<int:topic_id>')
def topic_detail(topic_id: int):
    """返回指定主题的详情，未找到则 404。"""
    svc = TopicService.get_instance()
    try:
        t = svc.get_topic(topic_id)
    except KeyError:
        abort(404)
    return jsonify({'id': t.id, 'label': t.label, 'topTerms': t.top_terms})


@app.get('/api/trends')
def topic_trends():
    """返回主题年度强度：years 数组与每个主题的 series。"""
    svc = TopicService.get_instance()
    return jsonify(svc.get_trends())


@app.get('/api/topic-year-detail/<int:topic_id>/<int:year>')
def topic_year_detail(topic_id: int, year: int):
    """返回某主题在某年的详情：文献总数、词汇及占比。"""
    svc = TopicService.get_instance()
    try:
        data = svc.get_topic_year_detail(topic_id, year)
    except Exception:
        abort(404)
    return jsonify(data)


@app.get('/api/vis/pyldavis')
def pyldavis_page():
    """返回 pyLDAvis HTML 文件内容（由 send_from_directory 提供）。"""
    svc = TopicService.get_instance()
    fp = svc.get_pyldavis_path()
    import os
    if not os.path.exists(fp):  # 文件未生成或未同步
        abort(404)
    directory, filename = os.path.split(fp)
    return send_from_directory(directory, filename) 


@app.get('/api/vis/pyldavis_cn')
def pyldavis_page_cn():
    """返回“中文本地化 + 图例”的 pyLDAvis HTML。

    - 将常见英文 UI 文案替换为中文
    - 基于服务层的前 15 个主题，注入一份图例列表，确保分类与 15 个主题一一对应
    """
    svc = TopicService.get_instance()
    fp = svc.get_pyldavis_path()
    import os
    if not os.path.exists(fp):
        abort(404)

    # 读取原始 HTML
    with open(fp, 'r', encoding='utf-8') as f:
        html = f.read()

    # 基础文本替换（仅替换出现概率高的固定文案，不影响交互脚本）
    replacements = {
        'Selected Topic:': '选择主题：',
        'Previous Topic': '上一个主题',
        'Next Topic': '下一个主题',
        'Clear Topic': '清除选择',
        'Intertopic Distance Map (via multidimensional scaling)': '主题间距离图（多维尺度分析）',
        'Slide to adjust relevance metric:': '拖动以调整相关性指标：',
        'Top-30 Most Salient Terms': '最显著术语 Top-30',
        'Most Relevant Terms': '最相关术语',
        'Overall Term Frequency': '整体术语频率',
        'Term Relevance': '术语相关性',
    }
    for k, v in replacements.items():
        html = html.replace(k, v)

    # 进一步覆盖/补充更多内置英文文案
    extra_replacements = {
        'Selected Topic': '选择主题',
        'Marginal topic distribution': '主题边际分布',
        'Estimated term frequency within the selected topic': '所选主题内的估计词频',
        'Overall term frequency': '整体词频',
        'saliency(term w)': '显著性(词 w)',
        'relevance(term w | topic t)': '相关性(词 w | 主题 t)',
        'for topics t; see Chuang et al. (2012)': '参考 Chuang 等 (2012)',
        'see Sievert & Shirley (2014)': '参考 Sievert 与 Shirley (2014)',
        'PC1': '主成分1',
        'PC2': '主成分2',
        'λ = 1': 'λ = 1',  # 保持符号
    }
    for k, v in extra_replacements.items():
        html = html.replace(k, v)

    # 注入 DOM 级别翻译脚本，处理由 JS 动态插入的英文文案
    translate_script = (
        """
<script>(function(){
  function replaceTextInNode(node, mapping){
    if(node.nodeType === Node.TEXT_NODE){
      var text = node.nodeValue;
      if(!text) return;
      Object.keys(mapping).forEach(function(k){
        var v = mapping[k];
        try{
          // 精确匹配与常见变体（去除前后空格）
          if(text.trim() === k){ node.nodeValue = text.replace(k, v); }
          text = node.nodeValue;
          node.nodeValue = text.split(k).join(v);
        }catch(e){}
      });
    } else if(node.nodeType === Node.ELEMENT_NODE){
      // 替换常见控件的 value/aria-label/title
      var el = node;
      ['value','title','aria-label'].forEach(function(attr){
        if(el.hasAttribute && el.hasAttribute(attr)){
          var val = el.getAttribute(attr);
          if(val){
            Object.keys(window.__PYLDAVIS_CN_MAP__).forEach(function(k){
              el.setAttribute(attr, val.split(k).join(window.__PYLDAVIS_CN_MAP__[k]));
            });
          }
        }
      });
      for(var i=0;i<node.childNodes.length;i++){
        replaceTextInNode(node.childNodes[i], mapping);
      }
    }
  }
  function translate(){
    var mapping = {
      'Selected Topic:': '选择主题：',
      'Previous Topic': '上一个主题',
      'Next Topic': '下一个主题',
      'Clear Topic': '清除选择',
      'Intertopic Distance Map (via multidimensional scaling)': '主题间距离图（多维尺度分析）',
      'Slide to adjust relevance metric:': '拖动以调整相关性指标：',
      'Top-30 Most Salient Terms': '最显著术语 Top-30',
      'Most Relevant Terms': '最相关术语',
      'Overall Term Frequency': '整体术语频率',
      'Term Relevance': '术语相关性',
      'Marginal topic distribution': '主题边际分布',
      'Estimated term frequency within the selected topic': '所选主题内的估计词频',
      'PC1': '主成分1',
      'PC2': '主成分2'
    };
    window.__PYLDAVIS_CN_MAP__ = mapping;
    replaceTextInNode(document.body, mapping);
  }
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(translate, 0);
  } else {
    document.addEventListener('DOMContentLoaded', translate);
  }
  // 监听滑块等交互后 DOM 变化
  var obs = new MutationObserver(function(){ translate(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();</script>
        """
    )
    insert_pos = html.rfind('</body>')
    if insert_pos != -1:
        html = html[:insert_pos] + translate_script + html[insert_pos:]
    else:
        html = html + translate_script

    return Response(html, mimetype='text/html; charset=utf-8')