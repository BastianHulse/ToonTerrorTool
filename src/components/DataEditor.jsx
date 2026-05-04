export default function DataEditor({ dataPackage, onImport, onExport }) {
  return (
    <div className="card stack">
      <h2>Data Editor</h2>
      <p className="muted">This starter build keeps the editor lightweight: review counts, import a replacement JSON package, or export your current working data.</p>
      <div className="stats-grid">
        <div className="mini-card"><strong>{dataPackage.content.moves.length}</strong><span>Moves</span></div>
        <div className="mini-card"><strong>{dataPackage.content.spells.length}</strong><span>Spells</span></div>
        <div className="mini-card"><strong>{dataPackage.content.randomAbilities.length}</strong><span>Random abilities</span></div>
        <div className="mini-card"><strong>{dataPackage.content.countryAbilities.length}</strong><span>Country abilities</span></div>
        <div className="mini-card"><strong>{dataPackage.content.countries.length}</strong><span>Countries</span></div>
      </div>
      <div className="button-row">
        <label className="button file-button">
          Import JSON
          <input type="file" accept="application/json" onChange={onImport} hidden />
        </label>
        <button onClick={onExport}>Export JSON</button>
      </div>
    </div>
  );
}
