import { defineConfig } from 'vite';

// 中文说明：
// - 本配置将开发环境下的 /api 请求代理到后端 Flask 服务 http://localhost:5000
// - 这样前端代码里可以直接使用相对路径 /api 避免跨域问题

export default defineConfig({
    // 内联最小 PostCSS 配置，避免 Vite 在磁盘上搜索时误解析 package.json
    css: {
        postcss: {
            plugins: [],
        },
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        hmr: {
            protocol: 'ws',
            host: '127.0.0.1',
            port: 5173,
        },
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false,
            },
        },
    },
});


