# 基于AI的技术趋势洞察与分析平台

- backend: Flask 后端
- frontend: React + TypeScript 前端
- data_processing: 离线数据处理脚本

按需补充依赖后即可开始开发。

## 一键启动（Windows）

在项目根目录双击运行 `start/start.bat`，或在命令行执行：

```bash
python start/start.py
```

脚本会自动：
- 安装后端依赖：`backend/requirements.txt`
- 安装前端依赖：在 `frontend/` 执行 `npm install`
- 启动后端：Flask（默认端口 `5000`）
- 启动前端：Vite 开发服务器（默认端口 `5173`）
- 当前端就绪后，自动打开浏览器跳转到 `http://localhost:5173`

注意：需要本地已安装 Python 3.10+ 与 Node.js（含 npm）。
·