// 商品保质期临期提醒系统 - 前端脚本
// 版本: 2.0.0 (Vercel优化版)

class ShelfLifeSystem {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.initState();
  }

  initElements() {
    // 查询页面元素
    this.skuInput = document.getElementById('skuInput');
    this.productName = document.getElementById('productName');
    this.shelfLife = document.getElementById('shelfLife');
    this.reminderDays = document.getElementById('reminderDays');
    this.productionDate = document.getElementById('productionDate');
    this.expiryDate = document.getElementById('expiryDate');
    this.reminderDate = document.getElementById('reminderDate');
    this.remainingDays = document.getElementById('remainingDays');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.saveBtn = document.getElementById('saveBtn');

    // 新增商品页面元素
    this.newSku = document.getElementById('newSku');
    this.newName = document.getElementById('newName');
    this.newShelfLife = document.getElementById('newShelfLife');
    this.newReminderDays = document.getElementById('newReminderDays');
    this.newLocation = document.getElementById('newLocation');
    this.addProductBtn = document.getElementById('addProductBtn');

    // 表格元素
    this.expiringTable = document.getElementById('expiringTable');
    this.allTable = document.getElementById('allTable');
    this.productDatabaseTable = document.getElementById('productDatabaseTable');

    // 模态框
    this.confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    this.modalBody = document.getElementById('modalBody');
    this.editModal = new bootstrap.Modal(document.getElementById('editModal'));
    this.editSku = document.getElementById('editSku');
    this.editName = document.getElementById('editName');
    this.editShelfLife = document.getElementById('editShelfLife');
    this.editReminderDays = document.getElementById('editReminderDays');
    this.editLocation = document.getElementById('editLocation');
    this.saveEditBtn = document.getElementById('saveEditBtn');
    this.duplicateModal = new bootstrap.Modal(document.getElementById('duplicateModal'));

    // 状态变量
    this.currentSelectedItem = null;
    this.deleteType = '';
    this.duplicateCheckResult = null;
  }

  initEventListeners() {
    // SKU输入监听
    this.skuInput.addEventListener('input', () => this.handleSkuInput());
    this.skuInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && this.skuInput.value.length === 5) {
        this.lookupProduct();
      }
    });

    // 生产日期变化监听
    this.productionDate.addEventListener('change', () => this.calculateDates());

    // 按钮点击监听
    this.saveBtn.addEventListener('click', () => this.saveProductRecord());
    this.addProductBtn.addEventListener('click', () => this.addNewProduct());
    this.confirmDeleteBtn.addEventListener('click', () => this.deleteItem());
    this.saveEditBtn.addEventListener('click', () => this.saveEditedProduct());

    // 刷新按钮
    document.querySelectorAll('.refresh-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tableType = e.target.closest('.refresh-btn').dataset.table;
        this.refreshTable(tableType);
      });
    });

    // 表单验证
    document.querySelectorAll('input[required]').forEach(input => {
      input.addEventListener('blur', () => this.validateInput(input));
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        this.handleRefreshShortcut();
      }
    });
  }

  initState() {
    // 设置生产日期范围
    const today = new Date();
    const minDate = new Date(today);
    minDate.setFullYear(today.getFullYear() - 2);
    this.productionDate.min = this.formatDate(minDate);
    this.productionDate.max = this.formatDate(today);

    // 检查系统状态
    this.checkSystemStatus();
  }

  async checkSystemStatus() {
    try {
      const response = await this.apiRequest('/api/health');
      console.log('✅ 系统状态:', response);
      
      // 显示欢迎消息
      setTimeout(() => {
        this.showAlert('系统已就绪，请输入5位SKU编码开始查询', 'info');
        this.skuInput.focus();
      }, 500);

      // 初始化表格
      await Promise.all([
        this.renderExpiringTable(),
        this.renderAllTable(),
        this.renderProductDatabaseTable()
      ]);
    } catch (error) {
      console.error('❌ 系统检查失败:', error);
      this.showAlert('系统连接中，请稍候...', 'warning');
      
      // 重试
      setTimeout(() => this.checkSystemStatus(), 2000);
    }
  }

  // API请求封装
  async apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(endpoint, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ API请求失败 ${endpoint}:`, error);
      throw error;
    }
  }

  // ============ 商品查询功能 ============

  handleSkuInput() {
    const sku = this.skuInput.value.trim();
    if (sku.length === 5) {
      this.lookupProduct();
    } else if (sku.length > 5) {
      this.skuInput.value = sku.substring(0, 5);
    }
  }

  async lookupProduct() {
    const sku = this.skuInput.value.trim();
    
    if (sku.length !== 5) {
      this.clearForm();
      return;
    }

    try {
      const product = await this.apiRequest(`/api/products/${sku}`);
      
      if (product) {
        // 商品存在
        this.productName.value = product.name;
        this.shelfLife.value = product.shelf_life;
        this.reminderDays.value = product.reminder_days;
        this.productionDate.disabled = false;
        
        // 设置默认生产日期为今天
        const today = new Date();
        this.productionDate.value = this.formatDate(today);
        
        // 自动聚焦
        setTimeout(() => {
          this.productionDate.focus();
          if ('showPicker' in HTMLInputElement.prototype) {
            try {
              this.productionDate.showPicker();
            } catch (err) {}
          }
        }, 100);
        
        this.calculateDates();
        this.showAlert(`找到商品: ${product.name}`, 'success');
      } else {
        // 商品不存在
        this.clearForm();
        this.showProductNotFoundAlert(sku);
      }
    } catch (error) {
      console.error('查询商品失败:', error);
      this.clearForm();
      
      if (error.message.includes('404')) {
        this.showProductNotFoundAlert(sku);
      } else {
        this.showAlert(`查询失败: ${error.message}`, 'danger');
      }
    }
  }

  showProductNotFoundAlert(sku) {
    const alertHTML = `
      <div>
        <h5 class="mb-2"><i class="bi bi-info-circle"></i> 商品未找到</h5>
        <p>SKU "<strong>${sku}</strong>" 不在商品数据库中。</p>
        <div class="mt-3">
          <button class="btn btn-sm btn-primary me-2" onclick="shelfLifeSystem.switchToAddProductTab('${sku}')">
            <i class="bi bi-plus-circle"></i> 添加新商品
          </button>
          <button class="btn btn-sm btn-secondary" onclick="shelfLifeSystem.focusSkuInput()">
            <i class="bi bi-arrow-left"></i> 重新输入
          </button>
        </div>
      </div>
    `;
    this.showAlert(alertHTML, 'info');
  }

  focusSkuInput() {
    this.skuInput.focus();
    this.skuInput.select();
  }

  switchToAddProductTab(sku) {
    // 切换到新增商品标签页
    const addTabButton = document.getElementById('add-tab');
    const addTabPane = document.getElementById('add');
    
    // 移除激活状态
    document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('show', 'active'));
    
    // 激活新增商品标签
    addTabButton.classList.add('active');
    addTabPane.classList.add('show', 'active');
    
    // 填充SKU
    if (this.newSku) {
      this.newSku.value = sku;
      setTimeout(() => {
        this.newName.focus();
        this.showAlert(`已切换到新增商品页面，请完善商品信息`, 'info');
      }, 300);
    }
  }

  // ============ 日期计算 ============

  calculateDates() {
    if (!this.productionDate.value || !this.shelfLife.value) {
      return;
    }

    try {
      const prodDate = new Date(this.productionDate.value);
      const shelfLifeDays = parseInt(this.shelfLife.value) || 0;
      const reminderDaysValue = parseInt(this.reminderDays.value) || 0;

      if (shelfLifeDays <= 0) {
        this.clearResults();
        return;
      }

      // 计算到期日期
      const expiryDateValue = new Date(prodDate);
      expiryDateValue.setDate(prodDate.getDate() + shelfLifeDays);

      // 计算提醒日期
      const reminderDateValue = new Date(expiryDateValue);
      reminderDateValue.setDate(expiryDateValue.getDate() - reminderDaysValue);

      // 计算剩余天数
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const remainingDaysValue = Math.ceil((expiryDateValue - today) / (1000 * 60 * 60 * 24));

      // 显示结果
      this.expiryDate.textContent = this.formatDate(expiryDateValue);
      this.reminderDate.textContent = this.formatDate(reminderDateValue);
      this.remainingDays.textContent = remainingDaysValue > 0 ? `${remainingDaysValue}天` : '已过期';

      // 更新状态指示器
      this.updateStatusIndicator(remainingDaysValue, shelfLifeDays);
    } catch (error) {
      console.error('日期计算错误:', error);
      this.clearResults();
    }
  }

  updateStatusIndicator(remainingDaysVal, shelfLifeVal) {
    if (remainingDaysVal <= 0) {
      this.statusIndicator.innerHTML = `
        <div class="text-center text-danger" style="font-size: 0.9rem;">
          <i class="bi bi-exclamation-triangle"></i> 已过期
        </div>
      `;
      return;
    }

    const percentage = Math.min(100, Math.max(0, (remainingDaysVal / shelfLifeVal) * 100));
    const reminderDaysVal = parseInt(this.reminderDays.value) || 0;
    
    let statusClass, statusText, statusIcon;
    
    if (remainingDaysVal <= reminderDaysVal) {
      statusClass = 'text-warning';
      statusText = '临期';
      statusIcon = 'bi-exclamation-triangle';
    } else {
      statusClass = 'text-success';
      statusText = '正常';
      statusIcon = 'bi-check-circle';
    }

    this.statusIndicator.innerHTML = `
      <div style="height: 15px; border-radius: 8px; background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%); position: relative;">
        <div style="position: absolute; top: -5px; left: ${percentage}%; width: 8px; height: 25px; background-color: #343a40; transform: translateX(-50%); border-radius: 4px;"></div>
      </div>
      <div class="text-center mt-2 ${statusClass}" style="font-size: 0.9rem;">
        <i class="bi ${statusIcon}"></i> ${statusText}
      </div>
    `;
  }

  // ============ 保存功能 ============

  async saveProductRecord() {
    const sku = this.skuInput.value.trim();
    const prodDate = this.productionDate.value;

    // 验证
    if (!sku || sku.length !== 5) {
      this.showAlert('请输入有效的5位SKU编码', 'warning');
      return;
    }

    if (!prodDate) {
      this.showAlert('请选择生产日期', 'warning');
      return;
    }

    if (!this.productName.value || !this.shelfLife.value) {
      this.showAlert('请先查询商品信息', 'warning');
      return;
    }

    try {
      // 检查重复记录
      const records = await this.apiRequest(`/api/records?sku=${sku}`);
      const duplicate = records.find(record => record.production_date === prodDate);

      if (duplicate) {
        this.showDuplicateModal(duplicate);
        return;
      }

      // 保存记录
      await this.saveRecord();
    } catch (error) {
      this.showAlert(`保存失败: ${error.message}`, 'danger');
    }
  }

  async saveRecord() {
    try {
      const sku = this.skuInput.value.trim();
      const location = await this.getProductLocation(sku);
      
      const record = {
        sku: sku,
        name: this.productName.value,
        production_date: this.productionDate.value,
        shelf_life: parseInt(this.shelfLife.value),
        reminder_days: parseInt(this.reminderDays.value),
        location: location
      };

      const result = await this.apiRequest('/api/records', 'POST', record);
      
      this.showAlert('商品已成功保存到库存', 'success');
      
      // 清空表单
      this.skuInput.value = '';
      this.clearForm();
      
      // 刷新表格
      await Promise.all([
        this.renderExpiringTable(),
        this.renderAllTable()
      ]);
      
    } catch (error) {
      if (error.message.includes('重复记录')) {
        this.showAlert(error.message, 'warning');
      } else {
        this.showAlert(`保存失败: ${error.message}`, 'danger');
      }
    }
  }

  async getProductLocation(sku) {
    try {
      const product = await this.apiRequest(`/api/products/${sku}`);
      return product ? product.location : '默认位置';
    } catch (error) {
      return '默认位置';
    }
  }

  showDuplicateModal(duplicate) {
    this.duplicateCheckResult = duplicate;
    
    const duplicateBody = document.getElementById('duplicateBody');
    duplicateBody.innerHTML = `
      <div class="alert alert-warning mb-0">
        <h5><i class="bi bi-exclamation-triangle"></i> 发现重复记录</h5>
        <p>相同SKU和生产日期的商品已存在于库存中：</p>
        <ul class="mb-2">
          <li><strong>商品名称：</strong>${duplicate.name}</li>
          <li><strong>SKU：</strong>${duplicate.sku}</li>
          <li><strong>生产日期：</strong>${duplicate.production_date}</li>
          <li><strong>当前位置：</strong>${duplicate.location}</li>
        </ul>
        <p class="mb-0 text-danger">是否继续添加？这将创建完全重复的记录。</p>
      </div>
    `;
    
    this.duplicateModal.show();
  }

  confirmDuplicate() {
    this.duplicateModal.hide();
    if (this.duplicateCheckResult) {
      this.saveRecord();
    }
    this.duplicateCheckResult = null;
  }

  cancelDuplicate() {
    this.duplicateModal.hide();
    this.duplicateCheckResult = null;
    this.productionDate.value = '';
    this.productionDate.focus();
  }

  // ============ 新增商品功能 ============

  async addNewProduct() {
    const sku = this.newSku.value.trim();
    const name = this.newName.value.trim();
    const shelfLifeVal = this.newShelfLife.value.trim();
    const reminderVal = this.newReminderDays.value.trim();
    const location = this.newLocation.value.trim();

    // 验证
    if (!sku || !name || !shelfLifeVal || !reminderVal || !location) {
      this.showAlert('请填写所有商品信息', 'warning');
      return;
    }

    if (sku.length !== 5) {
      this.showAlert('SKU必须为5位编码', 'warning');
      return;
    }

    const shelfLifeNum = parseInt(shelfLifeVal);
    const reminderNum = parseInt(reminderVal);

    if (isNaN(shelfLifeNum) || shelfLifeNum <= 0) {
      this.showAlert('请输入有效的保质期天数', 'warning');
      return;
    }

    if (isNaN(reminderNum) || reminderNum < 0) {
      this.showAlert('请输入有效的提醒天数', 'warning');
      return;
    }

    if (reminderNum > shelfLifeNum) {
      this.showAlert('临期提醒天数不能大于保质期天数', 'warning');
      return;
    }

    try {
      const product = {
        sku: sku,
        name: name,
        shelf_life: shelfLifeNum,
        reminder_days: reminderNum,
        location: location
      };

      const result = await this.apiRequest('/api/products', 'POST', product);
      
      this.showAlert('商品已成功添加到数据库', 'success');
      
      // 清空表单
      this.newSku.value = '';
      this.newName.value = '';
      this.newShelfLife.value = '';
      this.newReminderDays.value = '';
      this.newLocation.value = '';
      this.newSku.focus();
      
      // 刷新商品数据库表格
      await this.renderProductDatabaseTable();
      
    } catch (error) {
      if (error.message.includes('已存在')) {
        this.showAlert(error.message, 'warning');
      } else {
        this.showAlert(`添加失败: ${error.message}`, 'danger');
      }
    }
  }

  // ============ 表格渲染 ============

  async renderExpiringTable() {
    try {
      const records = await this.apiRequest('/api/records/expiring');
      this.expiringTable.innerHTML = '';

      if (records.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" class="text-center py-4 text-muted">暂无临期商品</td>';
        this.expiringTable.appendChild(row);
        return;
      }

      records.forEach(record => {
        const remainingDays = Math.floor(record.remaining_days || this.calculateRemainingDays(record.production_date, record.shelf_life));
        const row = this.createExpiringTableRow(record, remainingDays);
        this.expiringTable.appendChild(row);
      });
    } catch (error) {
      console.error('加载临期商品失败:', error);
      this.expiringTable.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">加载失败，请刷新页面</td></tr>';
    }
  }

  async renderAllTable() {
    try {
      const records = await this.apiRequest('/api/records');
      
      if (records.length === 0) {
        this.allTable.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">暂无库存商品</td></tr>';
        return;
      }

      // 按剩余天数排序
      records.sort((a, b) => {
        const aRemaining = this.calculateRemainingDays(a.production_date, a.shelf_life);
        const bRemaining = this.calculateRemainingDays(b.production_date, b.shelf_life);
        return aRemaining - bRemaining;
      });

      this.allTable.innerHTML = '';
      records.forEach(record => {
        const row = this.createAllTableRow(record);
        this.allTable.appendChild(row);
      });
    } catch (error) {
      console.error('加载所有商品失败:', error);
      this.allTable.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">加载失败，请刷新页面</td></tr>';
    }
  }

  async renderProductDatabaseTable() {
    try {
      const products = await this.apiRequest('/api/products');
      this.productDatabaseTable.innerHTML = '';

      if (products.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center py-4 text-muted">暂无商品数据</td>';
        this.productDatabaseTable.appendChild(row);
        return;
      }

      products.forEach(product => {
        const row = this.createProductTableRow(product);
        this.productDatabaseTable.appendChild(row);
      });
    } catch (error) {
      console.error('加载商品数据库失败:', error);
      this.productDatabaseTable.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">加载失败，请刷新页面</td></tr>';
    }
  }

  createExpiringTableRow(record, remainingDays) {
    const isExpired = remainingDays <= 0;
    const row = document.createElement('tr');
    
    if (isExpired) {
      row.classList.add('table-danger');
    } else {
      row.classList.add('table-warning');
    }

    const expiryDate = this.formatDate(new Date(
      new Date(record.production_date).getTime() + record.shelf_life * 24 * 60 * 60 * 1000
    ));

    row.innerHTML = `
      <td><code>${record.sku}</code></td>
      <td>${record.name}</td>
      <td><span class="badge bg-secondary">${record.location}</span></td>
      <td>${record.production_date}</td>
      <td>${expiryDate}</td>
      <td>
        <span class="${isExpired ? 'text-danger' : 'text-warning'}">
          <i class="bi ${isExpired ? 'bi-x-circle' : 'bi-exclamation-triangle'}"></i>
          ${isExpired ? '已过期' : `${remainingDays}天`}
        </span>
      </td>
      <td>
        <span class="badge ${isExpired ? 'bg-danger' : 'bg-warning'}">
          ${isExpired ? '已过期' : '临期'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="shelfLifeSystem.showDeleteConfirm(${JSON.stringify(record).replace(/"/g, '&quot;')}, 'record')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;

    return row;
  }

  createAllTableRow(record) {
    const remainingDays = this.calculateRemainingDays(record.production_date, record.shelf_life);
    const isExpired = remainingDays <= 0;
    const isExpiring = !isExpired && remainingDays <= record.reminder_days;
    
    const row = document.createElement('tr');
    if (isExpired) row.classList.add('table-danger');
    else if (isExpiring) row.classList.add('table-warning');

    const expiryDate = this.formatDate(new Date(
      new Date(record.production_date).getTime() + record.shelf_life * 24 * 60 * 60 * 1000
    ));

    row.innerHTML = `
      <td><code>${record.sku}</code></td>
      <td>${record.name}</td>
      <td><span class="badge bg-secondary">${record.location}</span></td>
      <td>${record.production_date}</td>
      <td>${expiryDate}</td>
      <td>
        <span class="${isExpired ? 'text-danger' : isExpiring ? 'text-warning' : 'text-success'}">
          ${isExpired ? '已过期' : `${remainingDays}天`}
          ${isExpiring ? '<span class="badge bg-warning ms-1">临期</span>' : ''}
        </span>
      </td>
      <td>
        <span class="badge ${isExpired ? 'bg-danger' : isExpiring ? 'bg-warning' : 'bg-success'}">
          ${isExpired ? '已过期' : isExpiring ? '临期' : '正常'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="shelfLifeSystem.showDeleteConfirm(${JSON.stringify(record).replace(/"/g, '&quot;')}, 'record')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;

    return row;
  }

  createProductTableRow(product) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><code>${product.sku}</code></td>
      <td>${product.name}</td>
      <td><span class="badge bg-info">${product.shelf_life}天</span></td>
      <td><span class="badge ${product.reminder_days > 0 ? 'bg-warning' : 'bg-secondary'}">${product.reminder_days}天</span></td>
      <td><span class="badge bg-secondary">${product.location}</span></td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-warning" onclick="shelfLifeSystem.showEditModal(${JSON.stringify(product).replace(/"/g, '&quot;')})">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger" onclick="shelfLifeSystem.showDeleteConfirm(${JSON.stringify(product).replace(/"/g, '&quot;')}, 'product')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    return row;
  }

  // ============ 工具方法 ============

  calculateRemainingDays(productionDate, shelfLife) {
    try {
      const prodDate = new Date(productionDate);
      if (isNaN(prodDate.getTime())) return 0;
      
      const expiryDate = new Date(prodDate);
      expiryDate.setDate(prodDate.getDate() + shelfLife);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    } catch (error) {
      return 0;
    }
  }

  formatDate(date) {
    if (!date) return '-';
    if (!(date instanceof Date)) date = new Date(date);
    if (isNaN(date.getTime())) return '-';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  clearForm() {
    this.productName.value = '';
    this.shelfLife.value = '';
    this.reminderDays.value = '';
    this.productionDate.value = '';
    this.productionDate.disabled = true;
    this.clearResults();
  }

  clearResults() {
    this.expiryDate.textContent = '-';
    this.reminderDate.textContent = '-';
    this.remainingDays.textContent = '-';
    this.statusIndicator.innerHTML = '';
  }

  validateInput(input) {
    if (input.value.trim() === '') {
      input.classList.remove('is-valid');
      input.classList.add('is-invalid');
    } else {
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
    }
  }

  showAlert(message, type = 'info') {
    const alertTypes = {
      'info': 'alert-info',
      'success': 'alert-success',
      'warning': 'alert-warning',
      'danger': 'alert-danger'
    };

    // 移除现有提示
    const existingAlert = document.querySelector('.global-alert');
    if (existingAlert) existingAlert.remove();

    // 创建新提示
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertTypes[type]} alert-dismissible fade show global-alert position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.cssText = 'min-width: 300px; max-width: 90%; z-index: 1060;';
    alertDiv.innerHTML = `
      <div class="d-flex align-items-center">
        <div class="flex-grow-1">${message}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;

    document.body.appendChild(alertDiv);

    // 5秒后自动消失
    setTimeout(() => {
      if (alertDiv.parentNode) alertDiv.remove();
    }, 5000);
  }

  refreshTable(tableType) {
    switch(tableType) {
      case 'expiring':
        this.renderExpiringTable();
        break;
      case 'all':
        this.renderAllTable();
        break;
      case 'database':
        this.renderProductDatabaseTable();
        break;
    }
    this.showAlert('表格已刷新', 'info');
  }

  handleRefreshShortcut() {
    const activeTab = document.querySelector('.nav-link.active').id;
    switch(activeTab) {
      case 'expiring-tab':
        this.renderExpiringTable();
        this.showAlert('临期商品列表已刷新', 'info');
        break;
      case 'all-tab':
        this.renderAllTable();
        this.showAlert('所有商品列表已刷新', 'info');
        break;
      case 'add-tab':
        this.renderProductDatabaseTable();
        this.showAlert('商品数据库已刷新', 'info');
        break;
    }
  }

  // ============ 编辑和删除功能 ============

  showDeleteConfirm(item, type) {
    this.currentSelectedItem = item;
    this.deleteType = type;

    let title, content;
    
    if (type === 'product') {
      title = '删除商品确认';
      content = this.createProductDeleteContent(item);
    } else {
      title = '删除库存记录确认';
      content = this.createRecordDeleteContent(item);
    }

    document.getElementById('modalTitle').textContent = title;
    this.modalBody.innerHTML = content;
    this.confirmModal.show();
  }

  createProductDeleteContent(item) {
    const remaining = this.calculateRemainingDays(item.production_date, item.shelf_life);
    const statusText = remaining <= 0 ? '已过期' : remaining <= item.reminder_days ? '临期' : '正常';
    
    return `
      <div class="alert alert-danger">
        <h5><i class="bi bi-exclamation-triangle"></i> 确定要删除库存记录吗？</h5>
        <p>以下商品将从库存中永久删除：</p>
        <ul class="mb-2">
          <li><strong>商品名称：</strong>${item.name}</li>
          <li><strong>SKU编码：</strong>${item.sku}</li>
          <li><strong>生产日期：</strong>${item.production_date}</li>
          <li><strong>保质期：</strong>${item.shelf_life}天</li>
          <li><strong>存放位置：</strong>${item.location}</li>
          <li><strong>状态：</strong>${statusText}</li>
        </ul>
        <div class="alert alert-warning mt-3">
          <i class="bi bi-info-circle"></i>
          <strong>注意：</strong>
          <ul class="mb-0 mt-1">
            <li>删除后无法恢复</li>
            <li>只会删除库存记录，商品信息仍保留</li>
          </ul>
        </div>
      </div>
    `;
  }

  createRecordDeleteContent(item) {
    return `
      <div class="alert alert-danger">
        <h5><i class="bi bi-exclamation-triangle"></i> 确定要删除商品吗？</h5>
        <p>以下商品将从商品数据库中永久删除：</p>
        <ul>
          <li><strong>商品名称：</strong>${item.name}</li>
          <li><strong>SKU编码：</strong>${item.sku}</li>
          <li><strong>保质期：</strong>${item.shelf_life}天</li>
          <li><strong>临期提醒：</strong>${item.reminder_days}天</li>
          <li><strong>存放位置：</strong>${item.location}</li>
        </ul>
        <div class="alert alert-warning mt-3">
          <i class="bi bi-info-circle"></i>
          <strong>注意：</strong>
          <ul class="mb-0 mt-1">
            <li>删除后无法恢复</li>
            <li>库存中已存在的该商品记录不会自动删除</li>
            <li>下次添加该商品时需要重新配置</li>
          </ul>
        </div>
      </div>
    `;
  }

  async deleteItem() {
    try {
      if (this.deleteType === 'product') {
        await this.apiRequest(`/api/products/${this.currentSelectedItem.sku}`, 'DELETE');
        this.showAlert('商品已从数据库删除', 'success');
        await this.renderProductDatabaseTable();
      } else {
        await this.apiRequest(`/api/records/${this.currentSelectedItem.sku}/${this.currentSelectedItem.production_date}`, 'DELETE');
        this.showAlert('库存记录已删除', 'success');
        await Promise.all([
          this.renderExpiringTable(),
          this.renderAllTable()
        ]);
      }
      this.confirmModal.hide();
    } catch (error) {
      this.showAlert(`删除失败: ${error.message}`, 'danger');
    }
  }

  showEditModal(product) {
    this.currentSelectedItem = product;
    this.editSku.value = product.sku;
    this.editName.value = product.name;
    this.editShelfLife.value = product.shelf_life;
    this.editReminderDays.value = product.reminder_days;
    this.editLocation.value = product.location;
    this.editModal.show();
  }

  async saveEditedProduct() {
    const name = this.editName.value.trim();
    const shelfLifeVal = this.editShelfLife.value.trim();
    const reminderVal = this.editReminderDays.value.trim();
    const location = this.editLocation.value.trim();

    if (!name || !shelfLifeVal || !reminderVal || !location) {
      this.showAlert('请填写所有商品信息', 'warning');
      return;
    }

    const shelfLifeNum = parseInt(shelfLifeVal);
    const reminderNum = parseInt(reminderVal);

    if (isNaN(shelfLifeNum) || shelfLifeNum <= 0) {
      this.showAlert('请输入有效的保质期天数', 'warning');
      return;
    }

    if (isNaN(reminderNum) || reminderNum < 0) {
      this.showAlert('请输入有效的提醒天数', 'warning');
      return;
    }

    if (reminderNum > shelfLifeNum) {
      this.showAlert('临期提醒天数不能大于保质期天数', 'warning');
      return;
    }

    try {
      const product = {
        name: name,
        shelf_life: shelfLifeNum,
        reminder_days: reminderNum,
        location: location
      };

      await this.apiRequest(`/api/products/${this.editSku.value}`, 'PUT', product);
      this.showAlert('商品信息已更新', 'success');
      this.editModal.hide();
      await this.renderProductDatabaseTable();
    } catch (error) {
      this.showAlert(`更新失败: ${error.message}`, 'danger');
    }
  }
}

// ============ 初始化 ============

// 创建全局实例
const shelfLifeSystem = new ShelfLifeSystem();

// 导出全局方法
window.shelfLifeSystem = shelfLifeSystem;
window.showDeleteConfirm = (item, type) => shelfLifeSystem.showDeleteConfirm(item, type);
window.showEditModal = (product) => shelfLifeSystem.showEditModal(product);
window.confirmDuplicate = () => shelfLifeSystem.confirmDuplicate();
window.cancelDuplicate = () => shelfLifeSystem.cancelDuplicate();