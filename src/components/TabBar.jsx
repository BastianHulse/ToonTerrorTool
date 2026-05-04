export default function TabBar({ activeTab, setActiveTab, darkMode, toggleDarkMode }) {
  const tabs = ['Generate', 'Monster Library', 'Data Editor', 'D&D Beyond Helper'];

  return (
    <div className="topbar card">
      <div className="tabbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <button className="ghost-button" onClick={toggleDarkMode}>
        {darkMode ? 'Light mode' : 'Dark mode'}
      </button>
    </div>
  );
}
