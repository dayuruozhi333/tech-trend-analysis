from flask import jsonify, request, redirect
from .. import app

@app.get('/api/health')
def health():
    return jsonify({'status': 'ok'})

# 访问后端根路径时，重定向到前端站点，避免 Not Found 误解
@app.get('/')
def root_redirect():
    return redirect('http://localhost:5173', code=302)
