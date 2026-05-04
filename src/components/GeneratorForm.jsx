export default function GeneratorForm({ inputs, setInputs, countries, onGenerate, onSave, canSave }) {
  const rarities = ['Normal', 'Rare', 'Unique', 'Miniboss', 'Boss', 'Mythic'];
  const crOptions = [0, 0.25, 0.5, ...Array.from({ length: 20 }, (_, i) => i + 1)];

  return (
    <div className="card stack">
      <h2>Generate monster</h2>
      <label>
        CR
        <select value={inputs.cr} onChange={(e) => setInputs((prev) => ({ ...prev, cr: e.target.value }))}>
          {crOptions.map((cr) => (
            <option key={cr} value={cr}>{cr}</option>
          ))}
        </select>
      </label>
      <label>
        Rarity
        <select value={inputs.rarity} onChange={(e) => setInputs((prev) => ({ ...prev, rarity: e.target.value }))}>
          {rarities.map((rarity) => (
            <option key={rarity} value={rarity}>{rarity}</option>
          ))}
        </select>
      </label>
      <label>
        Country
        <select value={inputs.country} onChange={(e) => setInputs((prev) => ({ ...prev, country: e.target.value }))}>
          {countries.map((country) => (
            <option key={country.id} value={country.name}>{country.name}</option>
          ))}
        </select>
      </label>
      <div className="button-row">
        <button onClick={onGenerate}>Generate</button>
        <button className="secondary-button" onClick={onSave} disabled={!canSave}>Save</button>
      </div>
    </div>
  );
}
