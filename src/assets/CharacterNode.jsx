import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { motion as Motion, MotionConfig } from 'framer-motion'
import { photoPaths } from '../utils/imagePaths.js'
import { photoSource } from './photoImages.js'
import './CharacterNode.css'
import TN_NodeTip from '../Components/TNDesignSystem/TN_NodeTip.jsx'

export default function CharacterNode({ name = '', summary = '', theme, tooltipMaxLength = 120, tooltip = true, imagePath: singleImagePath = '', imagePaths = [], previousImagePath: suppliedPreviousImagePath = '', imageTransitionKey: suppliedTransitionKey = 0, width = 200, height = Number(width) * 489 / 311, interactive = true, hoverLift = false, hoverStroke = true, style, ...props }) {
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
  const innerShadowId = `${id}-inner-shadow`
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
      if (text.getComputedTextLength() <= 244) return
      const characters = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name), ({ segment }) => segment)
      let low = 0
      let high = characters.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        text.textContent = `${characters.slice(0, middle).join('')}...`
        if (text.getComputedTextLength() <= 244) low = middle
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
        className="character-node"
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
        <svg width={width} height={height} viewBox="0 0 311 489" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={name || 'Character'} style={{ display: 'block', maxWidth: '100%', height: 'auto', overflow: 'visible', ...style }} {...props}>

<g filter={`url(#${shadowId})`}>
<path d="M0 8.80556C0 3.94238 3.94238 0 8.80556 0H291.194C296.058 0 300 3.94238 300 8.80556V468.972C300 473.835 296.058 477.778 291.194 477.778H8.80555C3.94237 477.778 0 473.835 0 468.972V8.80556Z" fill="#D4CFBF"/>
<g filter={`url(#${innerShadowId})`}>
<path d="M22.2223 50.0002C22.2223 40.7954 29.6842 33.3335 38.889 33.3335H261.111C270.316 33.3335 277.778 40.7954 277.778 50.0002V361.111C277.778 370.316 270.316 377.778 261.111 377.778H38.889C29.6842 377.778 22.2223 370.316 22.2223 361.111V50.0002Z" fill="#222221"/>
</g>
<g visibility={imagePath ? 'hidden' : 'visible'}>
<path d="M106.984 154.099C115.629 143.291 128.719 137 142.56 137H157.922C171.762 137 184.852 143.291 193.498 154.099C199.961 162.177 203.481 172.214 203.481 182.56V213.903C203.481 239.932 179.819 267.144 150.241 267.144C120.663 267.144 97 239.932 97 213.903V182.56C97 172.214 100.521 162.177 106.984 154.099Z" fill="#D4CFBF"/>
<path d="M92.4566 269.829C104.513 264.47 118.654 267.586 127.342 277.515C139.337 291.224 160.663 291.224 172.658 277.515C181.346 267.586 195.487 264.47 207.544 269.829L219.496 275.141C229.639 279.649 237.9 287.542 242.864 297.47L248.271 308.284C253.67 319.084 256.482 330.992 256.482 343.067V356.188C256.482 362.324 251.507 367.299 245.371 367.299H54.6299C48.4934 367.299 43.5188 362.324 43.5188 356.188V343.067C43.5188 330.992 46.3301 319.084 51.73 308.284L57.1369 297.47C62.1008 287.542 70.3613 279.649 80.5043 275.141L92.4566 269.829Z" fill="#D4CFBF"/>
</g>
</g>
{imagePath && (
  <g clipPath={`url(#${imageClipId})`} style={{ pointerEvents: 'none', '--photo-slide-distance': '344.4445px' }}>
    {previousImagePath && <image key={`outgoing-${imageTransitionKey}`} className="character-photo__outgoing" href={photoSource(previousImagePath)} x="22.2223" y="33.3335" width="255.5557" height="344.4445" preserveAspectRatio="xMidYMid slice" />}
    <image key={`${imagePath}-${imageTransitionKey}`} className={imageTransitionKey ? 'character-photo__incoming' : undefined} href={photoSource(imagePath)} x="22.2223" y="33.3335" width="255.5557" height="344.4445" preserveAspectRatio="xMidYMid slice" />
  </g>
)}
<text ref={textRef} x="150" y="431" textAnchor="middle" dominantBaseline="middle" fill="#222221" fontFamily={fontFamily} fontSize={fontSize} fontWeight="500" clipPath={`url(#${nameClipId})`} style={{ whiteSpace: 'pre', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }}>{name}</text>
<defs>
<clipPath id={imageClipId}><rect x="22.2223" y="33.3335" width="255.5557" height="344.4445" rx="16.6667" /></clipPath>
<clipPath id={nameClipId}><rect x="22" y="391" width="256" height="72" /></clipPath>
<filter id={shadowId} x="0" y="0" width="310.8" height="488.578" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
<feFlood floodOpacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="10" dy="10"/>
<feGaussianBlur stdDeviation="0.4"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_306_99"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_306_99" result="shape"/>
</filter>
<filter id={innerShadowId} x="22.2223" y="33.3335" width="256.556" height="345.444" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
<feFlood floodOpacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="4" dy="4"/>
<feGaussianBlur stdDeviation="0.5"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="shape" result="effect1_innerShadow_306_99"/>
</filter>
</defs>
        </svg>
        {interactive && hoverStroke && <span className="character-node__stroke" aria-hidden="true" />}
      </Motion.div>
      </TN_NodeTip>
    </MotionConfig>
  )
}
