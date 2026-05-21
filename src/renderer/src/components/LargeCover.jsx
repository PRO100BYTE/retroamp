import React from 'react'

export default function LargeCover({ track, t, onContextMenu }) {
  if (!track) {
    return (
      <div className="large-cover-wrap" onContextMenu={onContextMenu}>
        <div className="large-cover large-cover--empty">
          <div className="large-cover__placeholder">{t('noTrackLoaded')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="large-cover-wrap" onContextMenu={onContextMenu}>
      {track.cover ? (
        <img src={track.cover} alt="Album cover" className="large-cover" />
      ) : (
        <div className="large-cover large-cover--empty">
          <div className="large-cover__placeholder">{t('noCover')}</div>
        </div>
      )}
      <div className="large-cover__info">
        <div className="large-cover__title">{track.title}</div>
        <div className="large-cover__artist">{track.artist || t('unknownArtist')}</div>
        <div className="large-cover__album">{track.album || t('unknownAlbum')}</div>
      </div>
    </div>
  )
}
