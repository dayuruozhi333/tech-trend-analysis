@echo off
setlocal enabledelayedexpansion

REM 中文说明：这是 Windows 下的一键启动封装脚本
REM 作用：调用同目录下的 start.py 启动后端与前端服务
REM 检查 python 是否可用
where python >nul 2>nul
if errorlevel 1 (
  echo [error] 未检测到 Python（或未加入 PATH）。
  pause
  exit /b 1
)

REM 调用 Python 启动器
python "%~dp0start.py"

if errorlevel 1 (
  echo [error] 启动器执行失败。
  pause
  exit /b 1
)

endlocal

