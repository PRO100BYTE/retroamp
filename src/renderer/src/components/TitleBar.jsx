import React, { useEffect, useState } from 'react'
import appIcon from '../assets/icon.png'

export default function TitleBar({
  track,
  onOpenFiles,
  onOpenFolder,
  onImportM3U,
  onExportM3U,
  onClear,
  onOpenSettings,
  onOpenAbout,
  t,
}) {
  const [maximized, setMaximized] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)

  useEffect(() => {
    const unsub = window.electronAPI.onMaximized((val) => setMaximized(val))
    return unsub
  }, [])

  useEffect(() => {
    const close = () => setFileMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const trackName = track ? track.title : null

  return (
    <div className="titlebar">
      <span className="titlebar__logo">
        <img src={appIcon} alt="RetroAmp" className="titlebar__logo-icon" />
        <span className="titlebar__logo-text">RETROAMP</span>
      </span>

      <div className="titlebar__menu">
        <div className="titlebar__filemenu" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setFileMenuOpen((v) => !v)}>{t('menuFile')}</button>
          {fileMenuOpen && (
            <div className="titlebar__filemenu-popup">
              <button className="menu-item" onClick={() => { setFileMenuOpen(false); onOpenFiles() }}>{t('fileOpenFiles')}</button>
              <button className="menu-item" onClick={() => { setFileMenuOpen(false); onOpenFolder() }}>{t('fileOpenFolder')}</button>
              <button className="menu-item" onClick={() => { setFileMenuOpen(false); onImportM3U() }}>{t('fileImportM3U')}</button>
              <button className="menu-item" onClick={() => { setFileMenuOpen(false); onExportM3U() }}>{t('fileExportM3U')}</button>
              <div className="titlebar__filemenu-sep" />
              <button className="menu-item" onClick={() => { setFileMenuOpen(false); onClear() }}>{t('fileClear')}</button>
            </div>
          )}
        </div>
        <button onClick={onOpenSettings}>{t('menuSettings')}</button>
        <button onClick={onOpenAbout}>{t('menuAbout')}</button>
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
