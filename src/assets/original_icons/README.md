# Original icons

`svg.txt` の27個のアイコンと、`../svg.txt` の通知用4個のアイコンを分割しています。

通知用の追加アイコン（`../svg.txt` の順序）は TriangleAlert, Bell, Info, Skull。
TN_Toast では warning, success, info, error にそれぞれ対応します。

- `svg/`: 個別の SVG ファイル（24 × 24）
- `icons/`: 個別の React コンポーネント
- `index.js`: 名前付き export（`Settings` / `SettingsIcon` の両方に対応）

## React / Tauri で使う

```jsx
import { Settings, Search, Check } from './assets/original_icons';

<Settings size={20} />
<Search size={24} color="#cb6ce6" aria-label="検索" />
<TN_IconButton icon={<Check />} theme="light" />
```

`size` の既定値は24。`color` の既定値は `currentColor` なので、親の CSS `color` とライト／ダークテーマを継承します。`className`、`style`、`ref`、イベント、その他の SVG 属性も渡せます。ラベルのないアイコンは装飾扱いです。アイコンだけのボタンにはボタン側に `aria-label` を付けてください。

元の塗り・穴抜き・線幅を保持しています。`strokeWidth` は線のある部分だけを変更し、塗りで描かれた部分の太さは変更しません。`absoluteStrokeWidth` は数値の `size` に対して線幅を一定に保ちます。クリップの ID は React の各インスタンスで一意になります。

SVG を `<img src={...} />` で読むと親の文字色は継承されません。テーマに追従させる場合は React コンポーネントを使用してください。外部通信や Tauri の追加権限は不要です。

## 元データの順序

Settings, Trash2, Check, Plus, X, EllipsisVertical, Search, Lock,
ArrowDownWideNarrow, ArrowUpWideNarrow, Copy, History, Sunset, Moon,
Keyboard, Palette, Languages, Wrench, Speaker, Scale, User, Monitor,
Map, Type, Images, Bot, Library

名前は形状に基づいて付けています。元データは `svg.txt` に保持しています。
SVG を修正した場合は対応する `icons/*.js` の描画データも更新してください。
