const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class ShelfLifeDatabase {
  constructor() {
    this.db = null;
    this.dbPath = this.getDatabasePath();
    this.init();
  }

  getDatabasePath() {
    // Vercel环境使用/tmp目录，本地使用当前目录
    if (process.env.VERCEL) {
      return path.join('/tmp', 'shelf_life.db');
    } else {
      return path.join(__dirname, 'shelf_life.db');
    }
  }

  init() {
    console.log(`📊 数据库路径: ${this.dbPath}`);
    
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('❌ 数据库连接失败:', err.message);
      } else {
        console.log('✅ 数据库连接成功');
        this.createTables();
      }
    });
  }

  createTables() {
    const queries = [
      // 商品表
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        shelf_life INTEGER NOT NULL,
        reminder_days INTEGER NOT NULL,
        location TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 库存记录表
      `CREATE TABLE IF NOT EXISTS product_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        production_date DATE NOT NULL,
        shelf_life INTEGER NOT NULL,
        reminder_days INTEGER NOT NULL,
        location TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sku, production_date)
      )`,
      
      // 创建索引
      `CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`,
      `CREATE INDEX IF NOT EXISTS idx_records_sku ON product_records(sku)`,
      `CREATE INDEX IF NOT EXISTS idx_records_date ON product_records(production_date)`,
      `CREATE INDEX IF NOT EXISTS idx_records_expiry ON product_records(production_date, shelf_life)`
    ];

    queries.forEach((query, index) => {
      this.db.run(query, (err) => {
        if (err) {
          console.error(`❌ 创建表${index + 1}失败:`, err.message);
        }
      });
    });
  }

  // 通用查询方法
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未连接'));
        return;
      }
      
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ 查询失败:', err.message, 'SQL:', sql);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未连接'));
        return;
      }
      
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('❌ 查询单条失败:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未连接'));
        return;
      }
      
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('❌ 执行失败:', err.message);
          reject(err);
        } else {
          resolve({ 
            id: this.lastID, 
            changes: this.changes 
          });
        }
      });
    });
  }

  // 业务方法
  async getAllProducts() {
    try {
      return await this.query('SELECT * FROM products ORDER BY sku');
    } catch (error) {
      console.error('获取所有商品失败:', error);
      return [];
    }
  }

  async getProductBySku(sku) {
    try {
      return await this.get('SELECT * FROM products WHERE sku = ?', [sku]);
    } catch (error) {
      console.error(`获取商品 ${sku} 失败:`, error);
      return null;
    }
  }

  async addProduct(product) {
    const { sku, name, shelf_life, reminder_days, location } = product;
    const sql = 'INSERT INTO products (sku, name, shelf_life, reminder_days, location) VALUES (?, ?, ?, ?, ?)';
    return await this.run(sql, [sku, name, shelf_life, reminder_days, location]);
  }

  async updateProduct(sku, product) {
    const { name, shelf_life, reminder_days, location } = product;
    const sql = 'UPDATE products SET name = ?, shelf_life = ?, reminder_days = ?, location = ? WHERE sku = ?';
    return await this.run(sql, [name, shelf_life, reminder_days, location, sku]);
  }

  async deleteProduct(sku) {
    return await this.run('DELETE FROM products WHERE sku = ?', [sku]);
  }

  async getAllProductRecords() {
    try {
      return await this.query('SELECT * FROM product_records ORDER BY production_date DESC, sku');
    } catch (error) {
      console.error('获取所有记录失败:', error);
      return [];
    }
  }

  async getRecordsBySku(sku) {
    try {
      return await this.query('SELECT * FROM product_records WHERE sku = ? ORDER BY production_date DESC', [sku]);
    } catch (error) {
      console.error(`获取SKU ${sku} 记录失败:`, error);
      return [];
    }
  }

  async getExpiringProducts() {
    try {
      const sql = `
        SELECT 
          r.*,
          julianday(date(r.production_date, '+' || r.shelf_life || ' days')) - julianday('now') as remaining_days,
          date(r.production_date, '+' || r.shelf_life || ' days') as expiry_date
        FROM product_records r
        WHERE julianday(date(r.production_date, '+' || r.shelf_life || ' days')) <= julianday('now', '+' || r.reminder_days || ' days')
           OR julianday(date(r.production_date, '+' || r.shelf_life || ' days')) < julianday('now')
        ORDER BY remaining_days ASC, r.production_date DESC
      `;
      
      const rows = await this.query(sql);
      return rows.map(row => ({
        ...row,
        remaining_days: Math.floor(row.remaining_days || 0)
      }));
    } catch (error) {
      console.error('获取临期商品失败:', error);
      return [];
    }
  }

  async addProductRecord(record) {
    const { sku, name, production_date, shelf_life, reminder_days, location } = record;
    const sql = 'INSERT INTO product_records (sku, name, production_date, shelf_life, reminder_days, location) VALUES (?, ?, ?, ?, ?, ?)';
    return await this.run(sql, [sku, name, production_date, shelf_life, reminder_days, location]);
  }

  async deleteProductRecord(sku, productionDate) {
    return await this.run('DELETE FROM product_records WHERE sku = ? AND production_date = ?', [sku, productionDate]);
  }

  async resetAllData() {
    try {
      await this.run('DELETE FROM products');
      await this.run('DELETE FROM product_records');
      await this.run('DELETE FROM sqlite_sequence WHERE name IN ("products", "product_records")');
      return { message: '所有数据已重置' };
    } catch (error) {
      console.error('重置数据失败:', error);
      throw error;
    }
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('关闭数据库失败:', err.message);
        } else {
          console.log('数据库连接已关闭');
        }
      });
    }
  }
}

// 创建单例实例
const database = new ShelfLifeDatabase();

// 导出方法
module.exports = {
  getAllProducts: () => database.getAllProducts(),
  getProductBySku: (sku) => database.getProductBySku(sku),
  addProduct: (product) => database.addProduct(product),
  updateProduct: (sku, product) => database.updateProduct(sku, product),
  deleteProduct: (sku) => database.deleteProduct(sku),
  getAllProductRecords: () => database.getAllProductRecords(),
  getRecordsBySku: (sku) => database.getRecordsBySku(sku),
  getExpiringProducts: () => database.getExpiringProducts(),
  addProductRecord: (record) => database.addProductRecord(record),
  deleteProductRecord: (sku, productionDate) => database.deleteProductRecord(sku, productionDate),
  resetAllData: () => database.resetAllData(),
  close: () => database.close()
};