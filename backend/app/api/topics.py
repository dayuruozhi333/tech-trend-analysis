from flask import jsonify, send_from_directory, abort

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