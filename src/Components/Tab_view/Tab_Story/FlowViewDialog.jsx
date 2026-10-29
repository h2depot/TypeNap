import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TN_Button, TN_Dialog, TN_TextField } from '../../TNDesignSystem'
import { flowViewNameError } from '../../FlowDesignSystem/flowViewState.js'
import styles from './tab_story.module.css'

export default function FlowViewDialog({ dialog, views, onClose, onConfirm }) {
  const { t } = useTranslation()
  const [name, setName] = useState(dialog.name)
  const deleting = dialog.mode === 'delete'
  const error = deleting ? null : flowViewNameError(views, name, dialog.type, dialog.id)
  const submit = () => onConfirm({ ...dialog, name: deleting ? dialog.name : name.trim() })
  return <TN_Dialog isOpen onClose={onClose} title={t(`story.views.${dialog.mode}Title`)}>
    {deleting ? <div className={styles.flowViewDialogBody}>
      <p>{t('story.views.deleteMessage', { name: dialog.name })}</p>
      <p className={styles.flowViewDialogHint}>{t('story.views.deleteHint')}</p>
      <div className={styles.createDialogActions}>
        <TN_Button variant="secondary" onClick={onClose} autoFocus>{t('common.cancel')}</TN_Button>
        <TN_Button variant="danger" onClick={submit}>{t('common.delete')}</TN_Button>
      </div>
    </div> : <form className={styles.createDialogForm} onSubmit={event => { event.preventDefault(); if (!error) submit() }}>
      <div className={styles.flowViewDialogField}>
        <label htmlFor="flow-view-name">{t('story.views.nameLabel')} · {dialog.type === 'graph' ? 'GraphMap' : 'Tabular'}</label>
        <TN_TextField id="flow-view-name" value={name} onChange={event => setName(event.target.value)}
          aria-label={t('story.views.nameLabel')} placeholder={t('story.views.namePlaceholder')}
          autoFocus maxLength={100} aria-invalid={!!error}
          aria-describedby={error ? 'flow-view-name-error' : undefined} />
        {error && <span id="flow-view-name-error" className={styles.flowViewDialogHint} role="status">{t(`story.views.${error}`)}</span>}
      </div>
      <div className={styles.createDialogActions}>
        <TN_Button variant="secondary" onClick={onClose}>{t('common.cancel')}</TN_Button>
        <TN_Button variant="proceed" type="submit" disabled={!!error}>{t(dialog.mode === 'create' ? 'story.views.createSubmit' : 'story.views.renameSubmit')}</TN_Button>
      </div>
    </form>}
  </TN_Dialog>
}
