from flask import jsonify, request, redirect, Response, stream_template
from .. import app
import requests
import json

@app.get('/api/health')
def health():
    return jsonify({'status': 'ok'})

# 访问后端根路径时，重定向到前端站点，避免 Not Found 误解
@app.get('/')
def root_redirect():
    return redirect('http://localhost:5173', code=302)

@app.post('/api/ai-analysis')
def ai_analysis():
    """AI分析接口：接收页面内容，调用ModelScope API进行分析"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': '请求数据为空'}), 400
        
        page_content = data.get('content', '')
        analysis_type = data.get('type', 'general')  # general, topics, trends, map
        
        # 构建分析提示词
        prompt = build_analysis_prompt(page_content, analysis_type)
        
        # 调用ModelScope API
        return call_modelscope_api(prompt)
        
    except Exception as e:
        return jsonify({'error': f'AI分析失败: {str(e)}'}), 500

def build_analysis_prompt(content, analysis_type):
    """构建分析提示词"""
    base_prompt = """你是一个专业的技术趋势分析专家。请对以下内容进行深度分析，并提供有价值的洞察。"""
    
    if analysis_type == 'topics':
        prompt = f"""{base_prompt}
        
请分析以下技术主题列表，重点关注：
1. 主题间的关联性和发展趋势
2. 各主题的技术成熟度和应用前景
3. 新兴技术热点和潜在机会
4. 技术发展的时间脉络和演进规律

内容：
{content}

请提供结构化的分析报告。"""
    
    elif analysis_type == 'trends':
        prompt = f"""{base_prompt}
        
请分析以下技术趋势数据，重点关注：
1. 各技术领域的发展轨迹和周期性变化
2. 技术热点的兴起和衰落规律
3. 技术融合和交叉发展的趋势
4. 未来3-5年的技术发展预测

内容：
{content}

请提供详细的技术趋势分析报告。"""
    
    elif analysis_type == 'map':
        prompt = f"""{base_prompt}
        
请分析以下技术主题关系图，重点关注：
1. 主题间的距离和关联强度
2. 技术集群的形成和特征
3. 核心技术和边缘技术的关系
4. 技术生态系统的结构特征

内容：
{content}

请提供技术关系分析报告。"""
    
    else:
        prompt = f"""{base_prompt}
        
请对以下技术内容进行全面分析，重点关注：
1. 技术发展的整体态势
2. 关键技术和创新点
3. 技术应用场景和商业价值
4. 发展建议和未来展望

内容：
{content}

请提供综合分析报告。"""
    
    return prompt

def call_modelscope_api(prompt):
    """调用ModelScope API进行流式分析"""
    try:
        print(f"开始调用ModelScope API，提示词长度: {len(prompt)}")
        
        # 使用正确的ModelScope API端点（OpenAI兼容接口）
        api_url = "https://api-inference.modelscope.cn/v1/chat/completions"
        headers = {
            'Authorization': 'Bearer ms-e03db55d-e68f-4e0f-abbd-f136b02103f1',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "model": "Qwen/Qwen2.5-7B-Instruct",  # 使用ModelScope的模型ID
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        print(f"发送请求到: {api_url}")
        print(f"请求载荷: {json.dumps(payload, ensure_ascii=False, indent=2)}")
        
        # 发送流式请求
        response = requests.post(api_url, headers=headers, json=payload, stream=True, timeout=30)
        print(f"响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code != 200:
            error_msg = f"API调用失败，状态码: {response.status_code}, 响应: {response.text}"
            print(error_msg)
            return jsonify({'error': error_msg}), 500
        
        def generate():
            try:
                line_count = 0
                for line in response.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        line_count += 1
                        print(f"收到第{line_count}行: {line_str[:200]}...")
                        
                        if line_str.startswith('data: '):
                            data_str = line_str[6:]  # 移除 'data: ' 前缀
                            if data_str.strip() == '[DONE]':
                                print("收到结束标记")
                                break
                            try:
                                data = json.loads(data_str)
                                print(f"解析JSON成功: {json.dumps(data, ensure_ascii=False)[:200]}...")
                                
                                # 处理OpenAI兼容的响应格式
                                content = None
                                if 'choices' in data and len(data['choices']) > 0:
                                    choice = data['choices'][0]
                                    if 'delta' in choice and 'content' in choice['delta']:
                                        content = choice['delta']['content']
                                    elif 'message' in choice and 'content' in choice['message']:
                                        content = choice['message']['content']
                                
                                if content:
                                    print(f"提取到内容: {content[:100]}...")
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                                else:
                                    print("未找到内容字段")
                            except json.JSONDecodeError as e:
                                print(f"JSON解析错误: {e}, 原始数据: {data_str}")
                                # 如果JSON解析失败，尝试直接输出文本
                                if data_str.strip() and data_str.strip() != '[DONE]':
                                    yield f"data: {json.dumps({'content': data_str})}\n\n"
                                continue
                        else:
                            print(f"非data行: {line_str}")
            except Exception as e:
                print(f"流式处理异常: {e}")
                yield f"data: {json.dumps({'error': f'流式处理错误: {str(e)}'})}\n\n"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        print(f"API调用异常: {e}")
        return jsonify({'error': f'API调用失败: {str(e)}'}), 500

def simulate_ai_analysis(prompt):
    """模拟AI分析功能，用于演示和测试"""
    def generate():
        try:
            # 模拟流式输出
            analysis_parts = [
                "## AI技术趋势分析报告\n\n",
                "基于您提供的数据，我进行了以下分析：\n\n",
                "### 1. 技术发展态势\n",
                "从数据中可以看出，人工智能技术正在快速发展，各个子领域都呈现出不同的发展轨迹。\n\n",
                "### 2. 关键技术识别\n",
                "- **机器学习**：作为AI的基础技术，持续保持高热度\n",
                "- **深度学习**：在计算机视觉和自然语言处理领域应用广泛\n",
                "- **大模型技术**：近年来发展迅速，成为新的技术热点\n\n",
                "### 3. 发展趋势预测\n",
                "预计未来3-5年，AI技术将朝着以下方向发展：\n",
                "1. 模型规模继续扩大，能力不断增强\n",
                "2. 多模态融合技术将成为主流\n",
                "3. 边缘计算和AI芯片技术快速发展\n",
                "4. AI应用场景进一步拓展\n\n",
                "### 4. 建议与展望\n",
                "建议关注以下技术方向：\n",
                "- 大语言模型的应用创新\n",
                "- 多模态AI技术\n",
                "- AI安全与伦理\n",
                "- 产业数字化转型\n\n",
                "**注意**：当前使用的是模拟AI分析功能。在实际部署时，请配置有效的ModelScope API密钥以获得真实的AI分析结果。"
            ]
            
            for i, part in enumerate(analysis_parts):
                # 模拟流式输出延迟
                import time
                time.sleep(0.1)
                yield f"data: {json.dumps({'content': part})}\n\n"
                
        except Exception as e:
            yield f"data: {json.dumps({'error': f'模拟分析错误: {str(e)}'})}\n\n"
    
    return Response(generate(), mimetype='text/plain')
