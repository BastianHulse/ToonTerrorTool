import { useEffect, useMemo, useState } from 'react';
import DDBHelper from './components/DDBHelper';
import DataEditor from './components/DataEditor';
import GeneratorForm from './components/GeneratorForm';
import MonsterLibrary from './components/MonsterLibrary';
import StatblockPreview from './components/StatblockPreview';
import TabBar from './components/TabBar';
import { normalizeDataPackage } from './lib/dataTransforms';
import { createExportPackage, generateMonster, updateMonster } from './lib/generator';
import { loadSession, saveSession } from './lib/storage';

const defaultInputs = {
  cr: 1,
  rarity: 'Normal',
  country: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Generate');
  const [darkMode, setDarkMode] = useState(true);
  const [dataPackage, setDataPackage] = useState(null);
  const [inputs, setInputs] = useState(defaultInputs);
  const [currentMonster, setCurrentMonster] = useState(null);
  const [monsters, setMonsters] = useState([]);

  useEffect(() => {
    document.body.dataset.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  useEffect(() => {
    const session = loadSession();
    if (session?.dataPackage) {
      setDataPackage(session.dataPackage);
      setMonsters(session.monsters || []);
      setInputs(session.inputs || defaultInputs);
      return;
    }

    fetch('./data/monster_generator_data.json')
      .then((res) => res.json())
      .then((pkg) => {
        const normalized = normalizeDataPackage(pkg);
        setDataPackage(normalized);
        setInputs((prev) => ({ ...prev, country: normalized.content.countries[0]?.name || '' }));
      });
  }, []);

  useEffect(() => {
    if (!dataPackage) return;
    saveSession({ dataPackage, monsters, inputs });
  }, [dataPackage, monsters, inputs]);

  const countries = useMemo(() => dataPackage?.content.countries || [], [dataPackage]);

  useEffect(() => {
    if (!inputs.country && countries.length) {
      setInputs((prev) => ({ ...prev, country: countries[0].name }));
    }
  }, [countries, inputs.country]);

  const handleGenerate = () => {
    if (!dataPackage) return;
    const monster = generateMonster(dataPackage, inputs);
    setCurrentMonster(monster);
    setActiveTab('Generate');
  };

  const handleSaveMonster = () => {
    if (!currentMonster) return;
    setMonsters((prev) => {
      if (prev.some((monster) => monster.id === currentMonster.id)) {
        return updateMonster(prev, currentMonster.id, currentMonster);
      }
      return [...prev, currentMonster];
    });
  };

  const handleOpenMonster = (monsterId) => {
    const monster = monsters.find((entry) => entry.id === monsterId);
    if (!monster) return;
    setCurrentMonster(monster);
    setInputs({ cr: monster.cr, rarity: monster.rarity, country: monster.country });
    setActiveTab('Generate');
  };

  const handleToggleFavorite = (monsterId) => {
    setMonsters((prev) => prev.map((monster) => monster.id === monsterId ? { ...monster, favorite: !monster.favorite, updatedAt: new Date().toISOString() } : monster));
  };

  const handleDelete = (monsterId) => {
    setMonsters((prev) => prev.filter((monster) => monster.id !== monsterId));
    if (currentMonster?.id === monsterId) setCurrentMonster(null);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    const normalized = normalizeDataPackage(parsed);
    setDataPackage(normalized);
    setMonsters(normalized.monsters || []);
    setCurrentMonster(null);
    setInputs((prev) => ({ ...prev, country: normalized.content.countries[0]?.name || prev.country }));
  };

  const handleExport = () => {
    if (!dataPackage) return;
    const exportPkg = createExportPackage(dataPackage, monsters);
    const blob = new Blob([JSON.stringify(exportPkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'monster-generator-export.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!dataPackage) return <div className="app-shell"><div className="card">Loading data package…</div></div>;

  return (
    <div className="app-shell">
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} darkMode={darkMode} toggleDarkMode={() => setDarkMode((prev) => !prev)} />

      {activeTab === 'Generate' && (
        <div className="grid-layout">
          <GeneratorForm
            inputs={inputs}
            setInputs={setInputs}
            countries={countries}
            onGenerate={handleGenerate}
            onSave={handleSaveMonster}
            canSave={Boolean(currentMonster)}
          />
          <StatblockPreview monster={currentMonster} />
        </div>
      )}

      {activeTab === 'Monster Library' && (
        <MonsterLibrary monsters={monsters} onOpen={handleOpenMonster} onToggleFavorite={handleToggleFavorite} onDelete={handleDelete} />
      )}

      {activeTab === 'Data Editor' && (
        <DataEditor dataPackage={dataPackage} onImport={handleImport} onExport={handleExport} />
      )}

      {activeTab === 'D&D Beyond Helper' && <DDBHelper monster={currentMonster} />}
    </div>
  );
}
