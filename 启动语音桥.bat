@echo off
chcp 65001 >nul
title 小棉袄语音桥
cd /d "%~dp0bridge"

echo ================================================
echo   🌸 小棉袄 · 语音桥（真人语音模式）
echo ================================================
echo.
echo   作用：让网页通话使用千问真人语音
echo   需要和 npm run dev 同时开着
echo.
echo   停止：直接关掉本窗口
echo.

if not exist node_modules (
    echo 首次运行，正在安装依赖...
    call npm install
    echo.
)

node server.js
pause
