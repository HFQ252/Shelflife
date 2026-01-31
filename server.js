const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 优先服务public目录
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // 后备

// 智能请求日志（开发环境显示，生产环境简化）
app.use((req, res, next) => {
  // 过滤掉favicon.ico和robots.txt等静态文件请求
  const ignorePaths = ['/favicon.ico', '/robots.txt', '/sitemap.xml'];
  if (!ignorePaths.includes(req.url)) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    
    // 只在开发环境显示请求体
    if (process.env.NODE_ENV !== 'production' && Object.keys(req.body).length > 0) {
      console.log('📦 Request Body:', req.body);
    }
  }
  next();
});

// ============ API路由 ============

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
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
      expiring: '/api/records/expiring'
    }
  });
});

// 1. 商品数据库管理
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getAllProducts();
    res.json(products);
  } catch (error) {
    console.error('获取商品列表失败:', error);
    res.status(500).json({ error: '获取商品列表失败', details: error.message });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  const sku = req.params.sku;
  try {
    const product = await db.getProductBySku(sku);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json(null);
    }
  } catch (error) {
    console.error(`查找商品 ${sku} 失败:`, error);
    res.status(500).json({ error: '查找商品失败', details: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = req.body;
    
    // 验证
    if (!product.sku || !product.name || !product.shelf_life || !product.reminder_days || !product.location) {
      return res.status(400).json({ error: '缺少必要字段: sku, name, shelf_life, reminder_days, location' });
    }
    
    if (product.sku.length !== 5) {
      return res.status(400).json({ error: 'SKU必须为5位编码' });
    }
    
    const shelfLife = parseInt(product.shelf_life);
    const reminderDays = parseInt(product.reminder_days);
    
    if (isNaN(shelfLife) || shelfLife <= 0) {
      return res.status(400).json({ error: '保质期必须是大于0的数字' });
    }
    
    if (isNaN(reminderDays) || reminderDays < 0) {
      return res.status(400).json({ error: '提醒天数必须是非负数字' });
    }
    
    if (reminderDays > shelfLife) {
      return res.status(400).json({ error: '临期提醒天数不能大于保质期天数' });
    }
    
    const result = await db.addProduct(product);
    res.json({ 
      success: true, 
      id: result.id,
      message: '商品添加成功',
      sku: product.sku
    });
  } catch (error) {
    console.error('添加商品失败:', error);
    
    if (error.code === 'SQLITE_CONSTRAINT') {
      if (error.message.includes('UNIQUE constraint failed: products.sku')) {
        return res.status(409).json({ 
          error: `SKU "${req.body.sku}" 已存在，请使用不同的SKU编码` 
        });
      }
    }
    
    res.status(500).json({ error: '添加商品失败', details: error.message });
  }
});

app.put('/api/products/:sku', async (req, res) => {
  try {
    const product = req.body;
    const sku = req.params.sku;
    
    if (!product.name || !product.shelf_life || !product.reminder_days || !product.location) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    if (parseInt(product.reminder_days) > parseInt(product.shelf_life)) {
      return res.status(400).json({ error: '临期提醒天数不能大于保质期天数' });
    }
    
    const result = await db.updateProduct(sku, product);
    res.json({ 
      success: true, 
      changes: result.changes,
      message: '商品更新成功'
    });
  } catch (error) {
    console.error(`更新商品 ${req.params.sku} 失败:`, error);
    res.status(500).json({ error: '更新商品失败', details: error.message });
  }
});

app.delete('/api/products/:sku', async (req, res) => {
  try {
    const result = await db.deleteProduct(req.params.sku);
    res.json({ 
      success: true, 
      changes: result.changes,
      message: '商品删除成功'
    });
  } catch (error) {
    console.error(`删除商品 ${req.params.sku} 失败:`, error);
    res.status(500).json({ error: '删除商品失败', details: error.message });
  }
});

// 2. 库存记录管理
app.get('/api/records', async (req, res) => {
  try {
    const sku = req.query.sku;
    const records = sku ? await db.getRecordsBySku(sku) : await db.getAllProductRecords();
    res.json(records);
  } catch (error) {
    console.error('获取库存记录失败:', error);
    res.status(500).json({ error: '获取库存记录失败', details: error.message });
  }
});

app.get('/api/records/expiring', async (req, res) => {
  try {
    const records = await db.getExpiringProducts();
    res.json(records);
  } catch (error) {
    console.error('获取临期商品失败:', error);
    res.status(500).json({ error: '获取临期商品失败', details: error.message });
  }
});

app.post('/api/records', async (req, res) => {
  try {
    const record = req.body;
    
    if (!record.sku || !record.name || !record.production_date || 
        !record.shelf_life || !record.reminder_days || !record.location) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    // 检查重复记录
    const existingRecords = await db.getRecordsBySku(record.sku);
    const duplicate = existingRecords.find(r => r.production_date === record.production_date);
    
    if (duplicate) {
      return res.status(409).json({ 
        error: '重复记录',
        message: `相同SKU(${record.sku})和生产日期(${record.production_date})的记录已存在`,
        duplicate: duplicate
      });
    }
    
    const result = await db.addProductRecord(record);
    res.json({ 
      success: true, 
      id: result.id,
      message: '库存记录添加成功'
    });
  } catch (error) {
    console.error('添加库存记录失败:', error);
    
    if (error.code === 'SQLITE_CONSTRAINT') {
      if (error.message.includes('UNIQUE constraint failed: product_records.sku')) {
        return res.status(409).json({ 
          error: '重复记录',
          message: '相同SKU和生产日期的记录已存在'
        });
      }
    }
    
    res.status(500).json({ error: '添加库存记录失败', details: error.message });
  }
});

app.delete('/api/records/:sku/:productionDate', async (req, res) => {
  try {
    const { sku, productionDate } = req.params;
    const result = await db.deleteProductRecord(sku, productionDate);
    res.json({ 
      success: true, 
      changes: result.changes,
      message: '库存记录删除成功'
    });
  } catch (error) {
    console.error(`删除库存记录 ${sku}/${productionDate} 失败:`, error);
    res.status(500).json({ error: '删除库存记录失败', details: error.message });
  }
});

// 3. 系统管理
app.post('/api/initialize-demo', async (req, res) => {
  try {
    const demoProducts = [
      { sku: '10001', name: '纯牛奶', shelf_life: 180, reminder_days: 7, location: '冷藏区1排' },
      { sku: '10002', name: '酸奶', shelf_life: 21, reminder_days: 3, location: '冷藏区2排' },
      { sku: '20001', name: '饼干', shelf_life: 365, reminder_days: 30, location: '干货区2排' },
      { sku: '30001', name: '矿泉水', shelf_life: 540, reminder_days: 60, location: '饮料区1排' },
      { sku: '40001', name: '巧克力', shelf_life: 365, reminder_days: 30, location: '零食区3排' }
    ];
    
    let added = 0;
    for (const product of demoProducts) {
      try {
        await db.addProduct(product);
        added++;
      } catch (e) {
        // 忽略重复添加
      }
    }
    
    res.json({ 
      success: true, 
      message: `已初始化 ${added} 个示例商品`,
      products: demoProducts
    });
  } catch (error) {
    console.error('初始化示例数据失败:', error);
    res.status(500).json({ error: '初始化失败', details: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [products, records, expiring] = await Promise.all([
      db.getAllProducts(),
      db.getAllProductRecords(),
      db.getExpiringProducts()
    ]);
    
    res.json({
      products: products.length,
      records: records.length,
      expiring: expiring.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ error: '获取统计失败', details: error.message });
  }
});

// 静态文件路由 - 避免404
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/robots.txt', (req, res) => res.type('text').send('User-agent: *\nDisallow:'));

// 首页路由 - 最后处理
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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

// 错误处理中间件
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
🌐 手机访问: http://${require('os').networkInterfaces().en0?.[0]?.address || 'localhost'}:${PORT}
📊 数据库: ${process.env.VERCEL ? 'Vercel /tmp' : '本地 data.db'}
📈 健康检查: http://localhost:${PORT}/api/health
🛑 按 Ctrl+C 停止
    `);
  });
}