import { Entity, Map, Memo, Page, User } from '../../../assets/IconList.js'
import { photoSource } from '../../../assets/photoImages.js'

const icons = { character: User, world: Map, entity: Entity, note: Memo, memo: Memo }

export function RowTypeIcon({ type, ...props }) {
  const Icon = icons[type] ?? Page
  return <Icon size={18} aria-hidden="true" {...props} />
}

export default function TabularElement({ element }) {
  const path = element.data.imagePaths?.[0] || element.data.imagePath
  return <span className="tabular__element-icon">
    <RowTypeIcon type={element.type} size={16} />
    {path && <img key={path} src={photoSource(path)} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}
  </span>
}
