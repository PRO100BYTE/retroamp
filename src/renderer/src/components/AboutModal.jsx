import React from 'react'

export default function AboutModal({ t, onClose }) {
  const year = new Date().getFullYear()
  return (
    <div className="settings" onClick={onClose}>
      <div className="settings__panel about" onClick={(e) => e.stopPropagation()}>
        <div className="settings__head">
          <span>{t('aboutTitle')}</span>
          <button onClick={onClose} title={t('aboutClose')}>✕</button>
        </div>

        <div className="about__section">
          <div className="about__name">{t('aboutName')}</div>
          <div className="about__desc">{t('aboutDesc')}</div>
        </div>

        <div className="about__section">
          <div className="about__title">{t('aboutFeatures')}</div>
          <div>• {t('aboutFeature1')}</div>
          <div>• {t('aboutFeature2')}</div>
          <div>• {t('aboutFeature3')}</div>
          <div>• {t('aboutFeature4')}</div>
        </div>

        <div className="about__section">
          <div className="about__title">{t('aboutAuthors')}</div>
          <div>{t('aboutAuthorMain')}</div>
          <div>{t('aboutCopyright')} {year} PRO100BYTE Team</div>
        </div>

        <div className="settings__footer">
          <button onClick={onClose}>{t('aboutClose')}</button>
        </div>
      </div>
    </div>
  )
}
