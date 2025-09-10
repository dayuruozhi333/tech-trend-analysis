# ModelScope API 配置说明

## 问题诊断

从测试结果可以看到，当前遇到的问题是：
```
API调用失败，状态码: 401, 响应: {"code":"InvalidApiKey","message":"Invalid API-key provided.","request_id":"824f114d-77cc-44b2-9d81-75b2b4b6125b"}
```

这表明提供的API密钥无效或已过期。

## 解决方案

### 1. 获取有效的ModelScope API密钥

1. 访问 [ModelScope官网](https://modelscope.cn/)
2. 注册并登录账号
3. 进入控制台，获取API密钥
4. 确保密钥有足够的调用额度

### 2. 更新API配置

在 `backend/app/api/routes.py` 文件中，找到以下代码：

```python
def call_modelscope_api(prompt):
    """调用ModelScope API进行流式分析"""
    try:
        print(f"开始调用ModelScope API，提示词长度: {len(prompt)}")
        
        # 将模拟功能替换为真实API调用
        return call_real_modelscope_api(prompt)
        
    except Exception as e:
        print(f"API调用异常: {e}")
        return jsonify({'error': f'API调用失败: {str(e)}'}), 500

def call_real_modelscope_api(prompt):
    """调用真实的ModelScope API"""
    # ModelScope API配置
    api_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    headers = {
        'Authorization': 'Bearer YOUR_VALID_API_KEY_HERE',  # 替换为您的有效API密钥
        'Content-Type': 'application/json'
    }
    
    payload = {
        "model": "qwen-turbo",
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        },
        "parameters": {
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 2000
        }
    }
    
    # 发送流式请求
    response = requests.post(api_url, headers=headers, json=payload, stream=True, timeout=30)
    
    if response.status_code != 200:
        error_msg = f"API调用失败，状态码: {response.status_code}, 响应: {response.text}"
        return jsonify({'error': error_msg}), 500
    
    def generate():
        try:
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        data_str = line_str[6:]
                        if data_str.strip() == '[DONE]':
                            break
                        try:
                            data = json.loads(data_str)
                            content = None
                            if 'output' in data and 'choices' in data['output']:
                                choice = data['output']['choices'][0]
                                if 'message' in choice and 'content' in choice['message']:
                                    content = choice['message']['content']
                            elif 'choices' in data and len(data['choices']) > 0:
                                choice = data['choices'][0]
                                if 'delta' in choice and 'content' in choice['delta']:
                                    content = choice['delta']['content']
                                elif 'message' in choice and 'content' in choice['message']:
                                    content = choice['message']['content']
                            
                            if content:
                                yield f"data: {json.dumps({'content': content})}\n\n"
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            yield f"data: {json.dumps({'error': f'流式处理错误: {str(e)}'})}\n\n"
    
    return Response(generate(), mimetype='text/plain')
```

### 3. 环境变量配置（推荐）

为了安全起见，建议使用环境变量存储API密钥：

1. 创建 `.env` 文件：
```bash
MODELSCOPE_API_KEY=your_actual_api_key_here
```

2. 安装python-dotenv：
```bash
pip install python-dotenv
```

3. 在代码中加载环境变量：
```python
import os
from dotenv import load_dotenv

load_dotenv()

def call_real_modelscope_api(prompt):
    api_key = os.getenv('MODELSCOPE_API_KEY')
    if not api_key:
        raise ValueError("MODELSCOPE_API_KEY environment variable not set")
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    # ... 其余代码
```

## 当前状态

目前系统使用模拟AI分析功能，可以正常演示流式输出效果。模拟功能包括：

- ✅ 流式输出演示
- ✅ 前端界面正常显示
- ✅ 状态提示（"正在思考中..."）
- ✅ 错误处理机制
- ✅ 清除结果功能

## 测试验证

您可以通过以下方式测试当前功能：

1. 打开浏览器访问 `http://localhost:5173`
2. 在任意页面点击"AI分析"按钮
3. 观察流式输出效果
4. 查看控制台日志了解处理过程

## 下一步

1. 获取有效的ModelScope API密钥
2. 按照上述说明更新配置
3. 测试真实API调用
4. 根据需要调整提示词和参数

这样就能获得真实的AI分析结果，而不是模拟数据。
