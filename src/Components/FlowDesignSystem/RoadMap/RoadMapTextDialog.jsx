import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TN_Dialog from '../../TNDesignSystem/TN_Dialog.jsx'
import TN_TextField from '../../TNDesignSystem/TN_TextField.jsx'
import TN_Button from '../../TNDesignSystem/TN_Button.jsx'
import { roadMapTextNameError } from './roadMapText.js'

export default function RoadMapTextDialog({ dialog, stories, theme, onClose, onConfirm }) {
  const { t } = useTranslation()
  const [name, setName] = useState(dialog.mode === 'create' ? '' : dialog.name)
  const fieldId = useId()
  const errorId = useId()
  const deleting = dialog.mode === 'delete'
  const missing = dialog.mode !== 'create' && !stories.some(story => story.id === dialog.id)
  const error = deleting ? null : roadMapTextNameError(stories, name, dialog.id)
  const errorMessage = error === 'duplicate' ? t('story.files.duplicateName')
    : error === 'tooLong' ? '名前は100文字以内で入力してください。' : ''

  return <TN_Dialog isOpen theme={theme} onClose={onClose}
    title={deleting ? t('common.deleteConfirmation') : dialog.mode === 'create' ? 'Textを追加' : t('story.files.renameTitle')}>
    <form className="roadmap-text-dialog" onKeyDown={event => {
      if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    }} onSubmit={event => {
      event.preventDefault()
      if (missing || error) return
      onConfirm({ ...dialog, name: deleting ? dialog.name : name.trim() })
    }}>
      {deleting ? <p>{t('story.files.deleteMessage', { name: dialog.name })}</p> : <>
        <label htmlFor={fieldId}>{dialog.mode === 'create' ? 'Textの名前' : t('story.files.renameLabel')}</label>
        <TN_TextField id={fieldId} theme={theme} value={name} autoFocus maxLength={100}
          aria-label={dialog.mode === 'create' ? 'Textの名前' : t('story.files.renameLabel')}
          aria-invalid={!!errorMessage} aria-describedby={errorMessage ? errorId : undefined}
          placeholder={t('story.files.renamePlaceholder')} onChange={event => setName(event.target.value)} />
        {errorMessage && <p id={errorId} role="alert" className="roadmap-text-dialog__error">{errorMessage}</p>}
      </>}
      <div className="roadmap-text-dialog__actions">
        <TN_Button type="button" variant="secondary" theme={theme} onClick={onClose} autoFocus={deleting}>{t('common.cancel')}</TN_Button>
        <TN_Button type="submit" theme={theme} variant={deleting ? 'danger' : 'proceed'} disabled={missing || !!error}>
          {t(deleting ? 'common.delete' : dialog.mode === 'create' ? 'common.create' : 'common.change')}
        </TN_Button>
      </div>
    </form>
  </TN_Dialog>
}
