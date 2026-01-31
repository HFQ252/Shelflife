const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ 静态文件服务 ============

// 1. 首先尝试服务静态文件
app.use((req, res, next) => {
  // 检查是否是静态文件请求
  const staticExtensions = ['.js', '.css', '.html', '.ico', '.png', '.jpg', '.svg'];
  const isStaticFile = staticExtensions.some(ext => req.path.endsWith(ext));
  
  if (isStaticFile) {
    let filePath;
    
    // 处理不同路径的静态文件
    if (req.path === '/script.js') {
      filePath = path.join(__dirname, 'script.js');
    } else if (req.path.startsWith('/css/')) {
      filePath = path.join(__dirname, req.path);
    } else {
      filePath = path.join(__dirname, req.path);
    }
    
    // 检查文件是否存在
    if (fs.existsSync(filePath)) {
      // 设置正确的Content-Type
      if (req.path.endsWith('.js')) {
        res.type('application/javascript');
      } else if (req.path.endsWith('.css')) {
        res.type('text/css');
      } else if (req.path.endsWith('.html')) {
        res.type('text/html');
      }
      res.sendFile(filePath);
      return;
    }
  }
  next();
});

// 2. 日志中间件（过滤静态文件日志）
app.use((req, res, next) => {
  const ignorePaths = ['/favicon.ico', '/script.js', '/css/', '/api/health'];
  const shouldLog = !ignorePaths.some(path => req.url.startsWith(path));
  
  if (shouldLog) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
  }
  next();
});

// ============ API路由 ============
// ... (保持原有的API路由代码不变) ...

// ============ 前端路由 ============

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 确保script.js能被访问
app.get('/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'), {
    headers: {
      'Content-Type': 'application/javascript'
    }
  });
});

// 确保CSS能被访问
app.get('/css/bootstrap.min.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'css', 'bootstrap.min.css'), {
    headers: {
      'Content-Type': 'text/css'
    }
  });
});

// favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ 
    error: '未找到资源',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'production' ? '请稍后重试' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 导出app供Vercel使用
module.exports = app;

// 本地开发时启动服务器
if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, () => {
    console.log(`
🚀 商品保质期临期提醒系统
📅 ${new Date().toLocaleString('zh-CN')}
📍 本地地址: http://localhost:${PORT}
📊 数据库: ${process.env.VERCEL ? 'Vercel /tmp' : '本地 data.db'}
📈 健康检查: http://localhost:${PORT}/api/health
🛑 按 Ctrl+C 停止
    `);
  });
}
