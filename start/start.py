import os
import sys
import time
import socket
import subprocess
import webbrowser
import shutil
from pathlib import Path


# 当前脚本文件路径与仓库根路径推断
CURRENT_FILE = Path(__file__).resolve()
REPO_ROOT = CURRENT_FILE.parent.parent

# 后端与前端目录
BACKEND_DIR = REPO_ROOT / "backend"
FRONTEND_DIR = REPO_ROOT / "frontend"

BACKEND_PORT = 5000
FRONTEND_PORT = 5173


def is_port_open(host: str, port: int) -> bool:
    """检测给定 host:port 是否可连接（端口是否已开放）。

    返回 True 表示端口已被进程占用且可连接，通常意味着服务已就绪。
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        try:
            sock.connect((host, port))
            return True
        except Exception:
            return False


def wait_for_port(host: str, port: int, timeout_seconds: int) -> bool:
    """轮询等待端口在超时时间内变为可连接。

    用于等待后端或前端服务启动完成。
    """
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if is_port_open(host, port):
            return True
        time.sleep(0.5)
    return False


def run_command(cmd: list[str], cwd: Path | None = None, env: dict | None = None) -> subprocess.Popen:
    """以子进程方式启动命令，返回进程句柄并将输出重定向到管道。

    在 Windows 上创建新的进程组，提升 Ctrl+C 等信号处理的稳定性。
    """
    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    process = subprocess.Popen(
        cmd,
        cwd=str(cwd) if cwd else None,
        env=env or os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        creationflags=creationflags,
    )
    return process


def stream_output(name: str, process: subprocess.Popen) -> None:
    """将子进程输出带前缀地持续打印到主控制台。"""
    assert process.stdout is not None
    try:
        for line in process.stdout:
            sys.stdout.write(f"[{name}] {line}")
    except Exception:
        pass


def ensure_python_deps() -> None:
    """安装后端 Python 依赖（若未安装）。"""
    requirements = BACKEND_DIR / "requirements.txt"
    if not requirements.exists():
        print("[setup] backend/requirements.txt not found, skipping Python deps install")
        return
    print("[setup] Installing backend Python dependencies (pip) ...")
    cmd = [sys.executable, "-m", "pip", "install", "-r", str(requirements)]
    result = subprocess.run(cmd, cwd=str(BACKEND_DIR))
    if result.returncode != 0:
        raise RuntimeError("pip install failed for backend requirements")


def ensure_node_deps() -> None:
    """安装前端 npm 依赖（若未安装）。"""
    node_modules = FRONTEND_DIR / "node_modules"
    # 若已存在也进行一次轻量校验，确保新增依赖被安装
    if node_modules.exists():
        print("[setup] frontend node_modules found, running npm install to sync deps ...")
    else:
        print("[setup] Installing frontend dependencies (npm) ...")
    npm_cmd = resolve_npm_command()
    cmd = [npm_cmd, "install", "--no-audit", "--silent"]
    try:
        result = subprocess.run(cmd, cwd=str(FRONTEND_DIR))
    except FileNotFoundError:
        raise RuntimeError("未检测到 npm（或未加入 PATH）。请先安装 Node.js（包含 npm）。")
    if result.returncode != 0:
        raise RuntimeError("npm install failed in frontend")


def start_backend() -> subprocess.Popen:
    """启动 Flask 后端（默认 5000 端口）。"""
    print("[backend] Starting Flask server on http://localhost:5000 ...")
    return run_command([sys.executable, "run.py"], cwd=BACKEND_DIR)


def start_frontend() -> subprocess.Popen:
    """启动 Vite 前端（默认 5173 端口），--host 便于局域网访问。"""
    print("[frontend] Starting Vite dev server on http://localhost:5173 ...")
    npm_cmd = resolve_npm_command()
    # 指定 host 与 HMR 配置与 vite.config.ts 保持一致
    return run_command([npm_cmd, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], cwd=FRONTEND_DIR)


def resolve_npm_command() -> str:
    """在不同平台解析 npm 可执行文件名称/路径。

    Windows 上优先使用 npm.cmd；其他平台使用 npm。
    如果未找到，抛出清晰的错误，提示安装 Node.js。
    """
    if os.name == "nt":
        for candidate in ("npm.cmd", "npm.exe", "npm"):
            path = shutil.which(candidate)
            if path:
                return path
        raise RuntimeError("未找到 npm 可执行文件。请安装 Node.js 并确保 npm 在 PATH 中。")
    else:
        path = shutil.which("npm")
        if path:
            return path
        raise RuntimeError("未找到 npm。请安装 Node.js（含 npm）并加入 PATH。")


def main() -> int:
    """总入口：安装依赖 -> 启动后端 -> 等待 -> 启动前端 -> 打开浏览器。"""
    os.chdir(REPO_ROOT)
    print("[info] Repository root:", REPO_ROOT)

    try:
        ensure_python_deps()
        ensure_node_deps()

        # 1) 启动后端
        backend_proc = start_backend()
        import threading

        threading.Thread(target=stream_output, args=("backend", backend_proc), daemon=True).start()

        if not wait_for_port("127.0.0.1", BACKEND_PORT, timeout_seconds=60):
            print("[warn] Backend not ready after 60s, continuing anyway ...")

        # 2) 启动前端
        frontend_proc = start_frontend()
        threading.Thread(target=stream_output, args=("frontend", frontend_proc), daemon=True).start()

        # 3) 等待前端就绪并打开浏览器
        if wait_for_port("127.0.0.1", FRONTEND_PORT, timeout_seconds=60):
            url = f"http://localhost:{FRONTEND_PORT}"
            print(f"[open] Opening browser: {url}")
            try:
                webbrowser.open(url)
            except Exception:
                print("[warn] Failed to open browser automatically. Please open it manually.")
        else:
            print("[warn] Frontend not ready after 60s. Please open http://localhost:5173 manually once it's up.")

        # 4) 主线程保活，保持子进程运行
        print("[info] Press Ctrl+C to stop both servers.")
        while True:
            time.sleep(1.0)

    except KeyboardInterrupt:
        print("\n[info] Shutting down ...")
    except Exception as exc:
        print(f"[error] {exc}")
        return 1
    finally:
        # 5) 退出与清理：尽力终止仍在运行的子进程
        for proc_name, proc in (('frontend', locals().get('frontend_proc')), ('backend', locals().get('backend_proc'))):
            if proc and proc.poll() is None:
                try:
                    proc.terminate()
                except Exception:
                    pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


