import React from 'react'

const THEMES = [
  { value: 'matrix', label: 'Matrix Green' },
  { value: 'amber', label: 'Amber CRT' },
  { value: 'ice', label: 'Ice Terminal' },
]

export default function SettingsModal({ settings, onChange, onClose }) {
  const set = (key, value) => onChange({ ...settings, [key]: value })

  return (
    <div className="settings" onClick={onClose}>
      <div className="settings__panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings__head">
          <span>SETTINGS</span>
          <button onClick={onClose} title="Close">✕</button>
        </div>

        <label className="settings__row">
          <span>Theme</span>
          <select value={settings.theme} onChange={(e) => set('theme', e.target.value)}>
            {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label className="settings__row settings__row--check">
          <input
            type="checkbox"
            checked={settings.showCover}
            onChange={(e) => set('showCover', e.target.checked)}
          />
          <span>Show album cover</span>
        </label>

        <label className="settings__row settings__row--check">
          <input
            type="checkbox"
            checked={settings.autoPlayOnAdd}
            onChange={(e) => set('autoPlayOnAdd', e.target.checked)}
          />
          <span>Auto play when first track is added</span>
        </label>

        <label className="settings__row">
          <span>Visualizer intensity</span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={settings.vizIntensity}
            onChange={(e) => set('vizIntensity', parseFloat(e.target.value))}
          />
        </label>

        <div className="settings__footer">
          <button onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}
