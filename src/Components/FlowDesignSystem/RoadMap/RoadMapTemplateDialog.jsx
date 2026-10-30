import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EyeOff_TN } from '../../../assets/IconList'
import { BACKGROUND_PALETTE_COLORS, backgroundContentColor } from '../../../Constants/colors.js'
import TN_Dialog from '../../TNDesignSystem/TN_Dialog.jsx'
import TN_Button from '../../TNDesignSystem/TN_Button.jsx'
import paletteStyles from '../../Dialog/ColorPalette.module.css'

export default function RoadMapTemplateDialog({ theme, value, onClose, onConfirm }) {
  const { t } = useTranslation()
  const [selectedColor, setSelectedColor] = useState(value)
  const colorsId = useId()
  const specialId = useId()

  return <TN_Dialog isOpen theme={theme} title="背景を変更" maxWidth="860px" onClose={onClose}>
    <form className="roadmap-template-dialog" onSubmit={event => {
      event.preventDefault()
      onConfirm(selectedColor)
    }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    }}>
      <p id={colorsId}>{t('background.chooseColor')}</p>
      <div className={paletteStyles.palette} role="group" aria-labelledby={colorsId}>
        {['', ...BACKGROUND_PALETTE_COLORS].map(color => <button type="button" key={color}
          className={`${paletteStyles.swatch} roadmap-template-dialog__swatch`}
          aria-label={color || t('settings.backgroundDialog.noColor')} title={color || t('settings.backgroundDialog.noColor')}
          aria-pressed={selectedColor === color} autoFocus={value === color}
          style={{ backgroundColor: color ? backgroundContentColor(color) : 'var(--flow-base)' }}
          onClick={() => setSelectedColor(color)}>
          {!color && <EyeOff_TN size={18} />}
        </button>)}
      </div>
      <section className="roadmap-template-dialog__special" aria-labelledby={specialId}>
        <h3 id={specialId}>特殊ロードマップを選択</h3>
        <div className="roadmap-template-dialog__special-space" />
      </section>
      <div className="roadmap-text-dialog__actions">
        <TN_Button type="button" theme={theme} variant="secondary" onClick={onClose}>{t('common.cancel')}</TN_Button>
        <TN_Button type="submit" theme={theme} variant="proceed" disabled={selectedColor === value}>適用</TN_Button>
      </div>
    </form>
  </TN_Dialog>
}
