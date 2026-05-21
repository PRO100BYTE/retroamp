import React from 'react'

const THEMES = [
  { value: 'matrix', label: 'Matrix Green' },
  { value: 'amber', label: 'Amber CRT' },
  { value: 'ice', label: 'Ice Terminal' },
]

export default function SettingsModal({ settings, onChange, onClose, t }) {
  const set = (key, value) => onChange({ ...settings, [key]: value })

  return (
    <div className="settings" onClick={onClose}>
      <div className="settings__panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings__head">
          <span>{t('settings')}</span>
          <button onClick={onClose} title="Close">✕</button>
        </div>

        <label className="settings__row">
          <span>{t('settingsTheme')}</span>
          <select value={settings.theme} onChange={(e) => set('theme', e.target.value)}>
            {THEMES.map((theme) => <option key={theme.value} value={theme.value}>{t(theme.value === 'matrix' ? 'themeMatrix' : theme.value === 'amber' ? 'themeAmber' : 'themeIce')}</option>)}
          </select>
        </label>

        <label className="settings__row">
          <span>{t('settingsLanguage')}</span>
          <select value={settings.language} onChange={(e) => set('language', e.target.value)}>
            <option value="ru">{t('langRu')}</option>
            <option value="en">{t('langEn')}</option>
          </select>
        </label>

        <label className="settings__row settings__row--check">
          <input
            type="checkbox"
            checked={settings.showCover}
            onChange={(e) => set('showCover', e.target.checked)}
          />
          <span>{t('settingsShowCover')}</span>
        </label>

        <label className="settings__row settings__row--check">
          <input
            type="checkbox"
            checked={settings.autoPlayOnAdd}
            onChange={(e) => set('autoPlayOnAdd', e.target.checked)}
          />
          <span>{t('settingsAutoPlay')}</span>
        </label>

        <label className="settings__row settings__row--check">
          <input
            type="checkbox"
            checked={!!settings.compactMode}
            onChange={(e) => set('compactMode', e.target.checked)}
          />
          <span>{t('settingsCompact')}</span>
        </label>

        <label className="settings__row">
          <span>{t('settingsViz')}</span>
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
          <button onClick={onClose}>{t('settingsOk')}</button>
        </div>
      </div>
    </div>
  )
}
