# 🛒 商品保质期临期提醒系统

一个基于Web的商品保质期管理和临期提醒系统，支持Vercel一键部署。

## 🌐 在线演示
访问部署地址查看演示

## ✨ 功能特点

### 核心功能
- ✅ **商品查询**：输入SKU自动匹配商品信息
- ✅ **日期计算**：自动计算到期日期、提醒日期和剩余天数
- ✅ **库存管理**：添加、查看、删除库存记录
- ✅ **临期提醒**：自动检测和显示临期/过期商品
- ✅ **商品数据库**：管理商品基本信息（SKU、名称、保质期等）

### 高级功能
- 🔄 **重复检查**：防止添加相同SKU和生产日期的重复记录
- 📱 **响应式设计**：适配电脑、平板和手机
- ⚡ **实时计算**：输入生产日期后实时更新计算结果
- 🔍 **智能搜索**：按SKU快速查询商品
- 🗑️ **安全删除**：删除前需要确认，防止误操作

## 🚀 快速部署到Vercel

### 方法一：一键部署
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=你的仓库地址)

### 方法二：手动部署
1. **上传到GitHub**
   - 创建新仓库
   - 上传所有文件
   - 提交更改

2. **在Vercel部署**
   - 访问 [vercel.com](https://vercel.com)
   - 导入GitHub仓库
   - 点击"Deploy"

3. **访问应用**
   - 部署完成后会获得一个URL
   - 例如：`https://shelf-life-system.vercel.app`

## 🛠️ 本地开发

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装步骤
```bash
# 克隆项目
git clone 你的仓库地址
cd shelf-life-system

# 安装依赖
npm install

# 启动开发服务器
npm start

# 访问应用
打开 http://localhost:8000