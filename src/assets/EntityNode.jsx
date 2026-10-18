import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { motion as Motion, MotionConfig } from 'framer-motion'
import { photoPaths } from '../utils/imagePaths.js'
import { photoSource } from './photoImages.js'
import './EntityNode.css'
import TN_NodeTip from '../Components/TNDesignSystem/TN_NodeTip.jsx'

export default function EntityNode({ name = '', summary = '', theme, tooltipMaxLength = 120, tooltip = true, imagePath: singleImagePath = '', imagePaths = [], previousImagePath: suppliedPreviousImagePath = '', imageTransitionKey: suppliedTransitionKey = 0, width = 240, height = Number(width) * 472 / 411, interactive = true, hoverLift = false, hoverStroke = true, style, ...props }) {
  const paths = photoPaths(imagePaths)
  const pathsKey = JSON.stringify(paths)
  const [photo, setPhoto] = useState(null)
  const activePhoto = photo?.pathsKey === pathsKey ? photo : null
  const imagePath = paths.length ? paths[activePhoto?.index ?? 0] : singleImagePath
  const previousImagePath = paths.length ? activePhoto?.previous || '' : suppliedPreviousImagePath
  const imageTransitionKey = paths.length ? activePhoto?.revision || 0 : suppliedTransitionKey

  useEffect(() => {
    const sequence = JSON.parse(pathsKey)
    if (sequence.length < 2) return
    let index = 0
    let revision = 0
    let timer
    const schedule = () => {
      // 12 seconds, with a fresh random offset between -4 and +4 seconds.
      timer = setTimeout(() => {
        const previous = sequence[index]
        index = (index + 1) % sequence.length
        revision += 1
        setPhoto({ pathsKey, index, previous, revision })
        schedule()
      }, (12 + (Math.random() * 8 - 4)) * 1000)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [pathsKey])

  const id = useId()
  const textRef = useRef(null)
  const nameClipId = `${id}-name-clip`
  const imageClipId = `${id}-image-clip`
  const shadowId = `${id}-shadow`
  const fontFamily = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(name)
    ? "'M PLUS 1p', sans-serif"
    : /^[\x20-\x7E\s]*$/.test(name) ? "'Caveat', sans-serif" : 'sans-serif'
  const fontSize = fontFamily.includes('Caveat') ? 36 : 24

  useLayoutEffect(() => {
    const text = textRef.current
    let active = true
    const fitName = () => {
      if (!active) return
      text.textContent = name
      if (text.getComputedTextLength() <= 300) return
      const characters = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name), ({ segment }) => segment)
      let low = 0
      let high = characters.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        text.textContent = `${characters.slice(0, middle).join('')}...`
        if (text.getComputedTextLength() <= 300) low = middle
        else high = middle - 1
      }
      text.textContent = `${characters.slice(0, low).join('')}...`
    }
    fitName()
    document.fonts.ready.then(fitName)
    document.fonts.addEventListener('loadingdone', fitName)
    return () => {
      active = false
      document.fonts.removeEventListener('loadingdone', fitName)
    }
  }, [name, fontFamily, fontSize])

  return (
    <MotionConfig reducedMotion="never">
      <TN_NodeTip name={name} summary={summary} theme={theme} maxLength={tooltipMaxLength} disabled={!interactive || !tooltip}>
      <Motion.div
        className="entity-node"
        initial="rest"
        animate="rest"
        whileHover={interactive && hoverLift ? 'hover' : undefined}
        whileTap={interactive ? 'tap' : undefined}
        variants={{
          rest: { transform: 'translateY(0px) scale(1)', filter: 'drop-shadow(0px 3px 2px rgba(0, 0, 0, 0.12))' },
          hover: { transform: 'translateY(-6px) scale(1.03)', filter: 'drop-shadow(0px 12px 8px rgba(0, 0, 0, 0.24))' },
          tap: {
            transform: 'translateY(2px) scale(0.97)',
            filter: 'drop-shadow(1px 2px 1px rgba(0, 0, 0, 0.18))',
            transition: { duration: 0.12, ease: [0.2, 0.8, 0.2, 1] },
          },
        }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'inline-block', width, maxWidth: '100%', flexShrink: 0, position: 'relative', transformOrigin: '50% 50%', willChange: interactive ? 'transform' : undefined, cursor: interactive ? 'pointer' : 'default' }}
      >
        <svg width={width} height={height} viewBox="0 0 411 472" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={name || 'Entity'} style={{ display: 'block', maxWidth: '100%', height: 'auto', overflow: 'visible', ...style }} {...props}>

<g filter={`url(#${shadowId})`}>
<path d="M0 18C0 8.05887 8.05888 0 18 0H382C391.941 0 400 8.05887 400 18V442.629C400 453.793 389.942 462.265 378.94 460.367L203.06 430.028C201.035 429.679 198.965 429.679 196.94 430.028L21.0598 460.367C10.0581 462.265 0 453.793 0 442.629V18Z" fill="#D4CFBF"/>
</g>
<rect x="40" y="40" width="320" height="320" rx="15" fill="#222221"/>
<g visibility={imagePath ? 'hidden' : 'visible'}>
<path d="M127.071 112.929C128.946 111.054 131.49 110 134.142 110H265.858C268.51 110 271.054 111.054 272.929 112.929L297.071 137.071C298.946 138.946 300 141.49 300 144.142V170C300 175.523 295.523 180 290 180H235C229.477 180 225 175.523 225 170C225 164.477 220.523 160 215 160H185C179.477 160 175 164.477 175 170C175 175.523 170.523 180 165 180H110C104.477 180 100 175.523 100 170V144.142C100 141.49 101.054 138.946 102.929 137.071L127.071 112.929Z" fillRule="evenodd" clipRule="evenodd" fill="#D4CFBF"/>
<path d="M100 210C100 204.477 104.477 200 110 200H171C173.209 200 175 201.791 175 204V236C175 238.209 176.791 240 179 240H215C220.523 240 225 235.523 225 230V210C225 204.477 229.477 200 235 200H290C295.523 200 300 204.477 300 210V275.858C300 278.51 298.946 281.054 297.071 282.929L287.929 292.071C286.054 293.946 283.51 295 280.858 295H119.142C116.49 295 113.946 293.946 112.071 292.071L102.929 282.929C101.054 281.054 100 278.51 100 275.858V210Z" fillRule="evenodd" clipRule="evenodd" fill="#D4CFBF"/>
<path d="M190 181C190 177.686 192.686 175 196 175H204C207.314 175 210 177.686 210 181V219C210 222.314 207.314 225 204 225H196C192.686 225 190 222.314 190 219V181Z" fill="#D4CFBF"/>
</g>
{imagePath && (
  <g clipPath={`url(#${imageClipId})`} style={{ pointerEvents: 'none', '--photo-slide-distance': '320px' }}>
    {previousImagePath && <image key={`outgoing-${imageTransitionKey}`} className="entity-photo__outgoing" href={photoSource(previousImagePath)} x="40" y="40" width="320" height="320" preserveAspectRatio="xMidYMid slice" />}
    <image key={`${imagePath}-${imageTransitionKey}`} className={imageTransitionKey ? 'entity-photo__incoming' : undefined} href={photoSource(imagePath)} x="40" y="40" width="320" height="320" preserveAspectRatio="xMidYMid slice" />
  </g>
)}
<text ref={textRef} x="200" y="397" textAnchor="middle" dominantBaseline="middle" fill="#222221" fontFamily={fontFamily} fontSize={fontSize} fontWeight="500" clipPath={`url(#${nameClipId})`} style={{ whiteSpace: 'pre', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }}>{name}</text>
<defs>
<clipPath id={imageClipId}><rect x="40" y="40" width="320" height="320" rx="15" /></clipPath>
<clipPath id={nameClipId}><rect x="40" y="367" width="320" height="57" /></clipPath>
<filter id={shadowId} x="0" y="0" width="410.8" height="471.434" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
<feFlood floodOpacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="10" dy="10"/>
<feGaussianBlur stdDeviation="0.4"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_306_99"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_306_99" result="shape"/>
</filter>
</defs>
        </svg>
        {interactive && hoverStroke && <svg className="entity-node__stroke" viewBox="0 0 411 472" fill="none" aria-hidden="true"><path d="M0 18C0 8.05887 8.05888 0 18 0H382C391.941 0 400 8.05887 400 18V442.629C400 453.793 389.942 462.265 378.94 460.367L203.06 430.028C201.035 429.679 198.965 429.679 196.94 430.028L21.0598 460.367C10.0581 462.265 0 453.793 0 442.629V18Z" vectorEffect="non-scaling-stroke" /></svg>}
      </Motion.div>
      </TN_NodeTip>
    </MotionConfig>
  )
}
