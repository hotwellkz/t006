import { useState } from 'react'
import './App.css'
import VideoGeneration from './components/VideoGeneration'
import ChannelSettings from './components/ChannelSettings'

type Tab = 'generation' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('generation')

  return (
    <div className="app">
      <header className="app-header">
        <h1>WhiteCoding Studio</h1>
        <nav className="tabs">
          <button
            className={activeTab === 'generation' ? 'active' : ''}
            onClick={() => setActiveTab('generation')}
          >
            Генерация видео
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            Настройки каналов
          </button>
        </nav>
      </header>
      <main className="app-main">
        {activeTab === 'generation' && <VideoGeneration />}
        {activeTab === 'settings' && <ChannelSettings />}
      </main>
    </div>
  )
}

export default App

