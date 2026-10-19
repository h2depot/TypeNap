// Google Fonts publishes Caveat for Latin/Latin Extended and Cyrillic/Cyrillic Extended.
// Check the name itself so the application locale does not affect its typography.
export function photoNameFont(name) {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(name)) {
    return "'M PLUS 1p', sans-serif"
  }
  return /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Mark}\p{Number}\p{Punctuation}\p{Separator}\s]*$/u.test(name)
    ? "'Caveat', sans-serif"
    : 'sans-serif'
}
