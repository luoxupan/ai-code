import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import TablePage from './pages/TablePage.jsx'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="app-nav">
        <div className="nav-logo">
          <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
        </div>
        <nav className="nav-links">
          <Link to="/" className="nav-link">首页</Link>
          <Link to="/table" className="nav-link">数据表格</Link>
        </nav>
      </div>

      <Routes>
        <Route path="/" element={
          <div className="home-page">
            <h1>Vite + React</h1>
            <div className="card">
              <button onClick={() => setCount((count) => count + 1)}>
                count is {count}
              </button>
              <p>
                Edit <code>src/App.jsx</code> and save to test HMR
              </p>
            </div>
            <p className="read-the-docs">
              Click on the Vite and React logos to learn more
            </p>
          </div>
        } />
        <Route path="/table" element={<TablePage />} />
      </Routes>
    </>
  )
}

export default App
