import { useState } from 'react'
import './TableComponent.css'

function TableComponent({ data = [], title = '数据表格' }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' })
  const [hoveredRow, setHoveredRow] = useState(null)

  if (!data.length) {
    return (
      <div className="table-container">
        <div className="table-empty-state">
          <div className="empty-icon">📊</div>
          <p>暂无数据</p>
        </div>
      </div>
    )
  }

  const columns = Object.keys(data[0])

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0
    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]
    if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1
    return 0
  })

  const handleSort = (column) => {
    let direction = 'ascending'
    if (sortConfig.key === column && sortConfig.direction === 'ascending') {
      direction = 'descending'
    }
    setSortConfig({ key: column, direction })
  }

  const getStatusClass = (value) => {
    if (typeof value === 'string' && (value.toLowerCase().includes('success') || value.toLowerCase().includes('完成'))) {
      return 'status-success'
    }
    if (typeof value === 'string' && (value.toLowerCase().includes('pending') || value.toLowerCase().includes('进行中'))) {
      return 'status-pending'
    }
    if (typeof value === 'string' && (value.toLowerCase().includes('error') || value.toLowerCase().includes('失败'))) {
      return 'status-error'
    }
    return ''
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2 className="table-title">{title}</h2>
        <div className="table-stats">
          <span className="stat-badge">
            <span className="stat-icon">⚡</span>
            {data.length} 条记录
          </span>
        </div>
      </div>

      <div className="table-container">
        <div className="table-scroll">
          <table className="cyber-table">
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column}
                    className={sortConfig.key === column ? 'active' : ''}
                    style={{ '--delay': `${index * 50}ms` }}
                  >
                    <button
                      className="sort-button"
                      onClick={() => handleSort(column)}
                      aria-label={`按 ${column} 排序`}
                    >
                      <span className="column-name">{column}</span>
                      {sortConfig.key === column && (
                        <span className="sort-indicator">
                          {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={hoveredRow === rowIndex ? 'hovered' : ''}
                  onMouseEnter={() => setHoveredRow(rowIndex)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ '--delay': `${rowIndex * 30}ms` }}
                >
                  {columns.map((column, cellIndex) => (
                    <td key={`${rowIndex}-${column}`} style={{ '--delay': `${(rowIndex * 30) + (cellIndex * 20)}ms` }}>
                      <span className={`cell-content ${getStatusClass(row[column])}`}>
                        {row[column]}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default TableComponent