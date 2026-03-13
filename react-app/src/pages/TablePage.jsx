import { useState } from 'react'
import TableComponent from '../component/TableComponent'
import './TablePage.css'

function TablePage() {
  const [activeTab, setActiveTab] = useState('users')

  const mockData = {
    users: [
      { id: '001', name: '张三', role: '管理员', status: '完成', email: 'zhangsan@example.com', lastLogin: '2024-03-10' },
      { id: '002', name: '李四', role: '用户', status: '进行中', email: 'lisi@example.com', lastLogin: '2024-03-09' },
      { id: '003', name: '王五', role: '用户', status: '失败', email: 'wangwu@example.com', lastLogin: '2024-03-08' },
      { id: '004', name: '赵六', role: '管理员', status: '完成', email: 'zhaoliu@example.com', lastLogin: '2024-03-11' },
      { id: '005', name: '孙七', role: '用户', status: '进行中', email: 'sunqi@example.com', lastLogin: '2024-03-07' },
      { id: '006', name: '周八', role: '用户', status: '完成', email: 'zhouba@example.com', lastLogin: '2024-03-06' },
      { id: '007', name: '吴九', role: '管理员', status: '失败', email: 'wujiu@example.com', lastLogin: '2024-03-05' },
      { id: '008', name: '郑十', role: '用户', status: '进行中', email: 'zhengshi@example.com', lastLogin: '2024-03-04' },
    ],
    products: [
      { id: 'P001', name: '高级订阅', price: '¥299', status: '完成', users: 1234, revenue: '¥368,766' },
      { id: 'P002', name: '标准订阅', price: '¥99', status: '进行中', users: 5678, revenue: '¥562,122' },
      { id: 'P003', name: '基础订阅', price: '¥29', status: '完成', users: 12345, revenue: '¥358,005' },
      { id: 'P004', name: '企业版', price: '¥999', status: '失败', users: 234, revenue: '¥233,766' },
      { id: 'P005', name: '开发者版', price: '¥199', status: '进行中', users: 890, revenue: '¥177,110' },
    ],
    orders: [
      { id: 'ORD-001', customer: '腾讯科技', amount: '¥45,000', status: '完成', date: '2024-03-10', items: 5 },
      { id: 'ORD-002', customer: '阿里巴巴', amount: '¥32,000', status: '进行中', date: '2024-03-09', items: 3 },
      { id: 'ORD-003', customer: '字节跳动', amount: '¥67,000', status: '完成', date: '2024-03-08', items: 8 },
      { id: 'ORD-004', customer: '美团', amount: '¥23,000', status: '失败', date: '2024-03-07', items: 2 },
      { id: 'ORD-005', customer: '京东', amount: '¥54,000', status: '进行中', date: '2024-03-06', items: 6 },
    ],
  }

  const tabs = [
    { id: 'users', label: '用户管理', icon: '👥' },
    { id: 'products', label: '产品列表', icon: '📦' },
    { id: 'orders', label: '订单记录', icon: '📋' },
  ]

  return (
    <div className="table-page">
      <div className="page-background">
        <div className="grid-pattern"></div>
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
        <div className="glow-orb orb-3"></div>
      </div>

      <div className="page-content">
        <header className="page-header">
          <div className="header-content">
            <h1 className="page-title">
              <span className="title-icon">⚡</span>
              数据中心
            </h1>
            <p className="page-subtitle">实时监控与数据分析平台</p>
          </div>
          <div className="header-stats">
            <div className="stat-card">
              <div className="stat-value">2,847</div>
              <div className="stat-label">总记录</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">94.2%</div>
              <div className="stat-label">成功率</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">128</div>
              <div className="stat-label">活跃用户</div>
            </div>
          </div>
        </header>

        <nav className="tab-navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {activeTab === tab.id && <span className="tab-indicator"></span>}
            </button>
          ))}
        </nav>

        <main className="page-main">
          <TableComponent
            data={mockData[activeTab]}
            title={tabs.find(t => t.id === activeTab)?.label}
          />
        </main>

        <footer className="page-footer">
          <div className="footer-content">
            <span className="footer-text">数据实时更新 · 自动同步 · 安全加密</span>
            <div className="footer-indicator">
              <span className="indicator-dot"></span>
              <span className="indicator-text">系统运行正常</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default TablePage