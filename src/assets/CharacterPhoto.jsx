import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CharacterNode from './CharacterNode.jsx'
import { photoPaths } from '../utils/imagePaths.js'
import { LeftGraterThan, RightGraterThan } from './IconList'
import './CharacterPhoto.css'

export default function CharacterPhoto({ name = '', imagePaths = [], width = 200, onClick, ariaLabel, ...props }) {
  const { t } = useTranslation()
  const paths = photoPaths(imagePaths)
  const pathsKey = JSON.stringify(paths)
  const [photo, setPhoto] = useState(null)
  const active = photo?.pathsKey === pathsKey ? photo : null
  const count = paths.length
  const currentIndex = active?.index ?? 0
  const move = step => setPhoto(current => {
    const index = current?.pathsKey === pathsKey ? current.index : 0
    return { pathsKey, index: count ? (index + step + count) % count : 0,
      previous: paths[index] || '', revision: (current?.revision || 0) + 1 }
  })

  return (
    <div className="character-photo" style={{ width }} role="group" aria-label={t('objectImages.open', { name: name || 'Character' })}>
      <button type="button" className="character-photo__open" onClick={onClick} aria-label={ariaLabel || t('objectImages.open', { name: name || 'Character' })}>
        <CharacterNode {...props} tooltip={false} name={name} width={width} imagePath={paths[currentIndex] || ''} previousImagePath={active?.previous || ''} imageTransitionKey={active?.revision || 0} interactive hoverLift={false} hoverStroke />
      </button>
      <div className="character-photo__controls">
        <button type="button" onClick={() => move(-1)} disabled={count < 2} aria-label={t('objectImages.previous')}><LeftGraterThan size={16} aria-hidden="true" /></button>
        <span className="character-photo__position" role="status" aria-live="polite" aria-atomic="true">
          {count ? currentIndex + 1 : 0} / {count}
        </span>
        <button type="button" onClick={() => move(1)} disabled={count < 2} aria-label={t('objectImages.next')}><RightGraterThan size={16} aria-hidden="true" /></button>
      </div>
    </div>
  )
}
