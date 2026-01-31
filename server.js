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

// ============ 1. 首先注册API路由 ============

// 健康检查端点 - 必须放在最前面
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'connected'
  });
});

// 测试端点
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API工作正常', 
    timestamp: new Date().toISOString(),
    endpoints: {
      products: '/api/products',
      records: '/api/records',
      expiring: '/api/records/expiring',
      health: '/api/health',
      stats: '/api/stats'
    }
  });
});

// ... 其他API路由（保持你原有的所有API路由代码） ...

// ============ 2. 然后处理静态文件 ============

// 简单的静态文件服务
app.use(express.static(__dirname));

// 专门处理script.js
app.get('/script.js', (req, res) => {
  const filePath = path.join(__dirname, 'script.js');
  if (fs.existsSync(filePath)) {
    res.type('application/javascript');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

// 专门处理CSS
app.get('/css/bootstrap.min.css', (req, res) => {
  const filePath = path.join(__dirname, 'css', 'bootstrap.min.css');
  if (fs.existsSync(filePath)) {
    res.type('text/css');
    res.sendFile(filePath);
  } else {
    // 如果本地没有，使用CDN后备
    res.redirect('https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css');
  }
});

// ============ 3. 最后处理首页 ============

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 404处理
app.use((req, res) => {
  console.log('404 - 未找到:', req.method, req.url);
  res.status(404).json({ 
    error: '未找到资源',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      '/api/health',
      '/api/test',
      '/api/products',
      '/api/records',
      '/api/records/expiring'
    ]
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
🚀 商品保质期临期提醒系统 v2.0
📅 ${new Date().toLocaleString('zh-CN')}
📍 本地地址: http://localhost:${PORT}
📊 数据库: ${process.env.VERCEL ? 'Vercel /tmp' : '本地 data.db'}
📈 健康检查: http://localhost:${PORT}/api/health
✅ 测试接口: http://localhost:${PORT}/api/test
🛑 按 Ctrl+C 停止
    `);
  });
}
