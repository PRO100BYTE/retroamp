import React, { useEffect, useState } from 'react'

export default function TitleBar({ track, onOpenFiles, onOpenFolder, onClear, onOpenSettings, onOpenAbout, t }) {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const unsub = window.electronAPI.onMaximized((val) => setMaximized(val))
    return unsub
  }, [])

  const trackName = track ? track.title : null

  return (
    <div className="titlebar">
      <span className="titlebar__logo">▓▓ RETROAMP ▓▓</span>

      <div className="titlebar__menu">
        <button onClick={onOpenFiles}>{t('menuFile')}</button>
        <button onClick={onOpenFolder}>{t('menuFolder')}</button>
        <button onClick={onOpenSettings}>{t('menuSettings')}</button>
        <button onClick={onOpenAbout}>{t('menuAbout')}</button>
        <button onClick={onClear}>{t('menuClear')}</button>
      </div>

      <span className="titlebar__track">
        {trackName ? `♪ ${trackName}${track?.artist ? ` — ${track.artist}` : ''}` : t('appSubtitle')}
      </span>

      <div className="titlebar__wctrl">
        <button
          className="wctrl wctrl--min"
          onClick={() => window.electronAPI.minimize()}
          title="Minimise"
        >─</button>
        <button
          className="wctrl wctrl--max"
          onClick={() => window.electronAPI.maximize()}
          title={maximized ? 'Restore' : 'Maximise'}
        >{maximized ? '❐' : '□'}</button>
        <button
          className="wctrl wctrl--close"
          onClick={() => window.electronAPI.close()}
          title="Close"
        >✕</button>
      </div>
    </div>
  )
}
