import { useTNTheme } from './theme';
import React from 'react';
import './TN_ListView.css';
import { RightGraterThan } from '../../assets/IconList';

/**
 * TN_ListView - Minimal list with separators between rows.
 */
export const TN_ListView = ({ children, theme: themeOverride, width = '100%', maxWidth = '800px', gap = '0px', style, ...props }) => {
  const theme = useTNTheme(themeOverride);
  // React.Children を使用して、すべての子要素 (TN_ListItem) に theme を自動で伝搬させる
  const childrenWithTheme = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { theme });
    }
    return child;
  });

  return (
    <div
      data-tn-list-view
      style={{
        width: width,
        maxWidth: maxWidth,
        display: 'flex',
        flexDirection: 'column',
        gap: gap,
        margin: '16px auto',
        ...style,
      }}
      {...props}
    >
      {childrenWithTheme}
    </div>
  );
};

/**
 * TN_ListItem - Flat settings row.
 */
export const TN_ListItem = ({ icon, title, description, control, onClick, disabled = false, theme: themeOverride, ...props }) => {
  const theme = useTNTheme(themeOverride);
  const isClickable = !!onClick && !disabled;

  const textColor = theme === 'light' ? '#303030' : '#F5F5F5';
  const subTextColor = theme === 'light' ? 'rgba(48, 48, 48, 0.65)' : 'rgba(245, 245, 245, 0.65)';

  return (
    <div
      data-tn-list-item
      data-clickable={isClickable ? 'true' : undefined}
      data-theme={theme}
      onClick={isClickable ? onClick : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderRadius: 0,
        cursor: isClickable ? 'pointer' : 'default',
        opacity: disabled ? 0.45 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        userSelect: 'none',
        gap: '20px',
        ...props.style,
      }}
      {...Object.keys(props).reduce((acc, key) => {
        if (key !== 'style') acc[key] = props[key];
        return acc;
      }, {})}
    >
      {/* 左側: アイコン + テキスト領域 */}
      <div
        data-tn-list-content
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flex: 1,
          minWidth: 0,
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* アイコンスロット */}
        {icon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              color: textColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}

        {/* テキストスロット (タイトル & サブタイトル) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          {title && (
            <span style={{
              fontSize: '16px',
              fontWeight: 'var(--font-weight-ui, 800)',
              color: textColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {title}
            </span>
          )}
          {description && (
            <span style={{
              fontSize: '13px',
              color: subTextColor,
              lineHeight: 1.6,
            }}>
              {description}
            </span>
          )}
        </div>
      </div>

      {/* 右側: コントロールまたはアクション矢印 */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, position: 'relative', zIndex: 11 }}
        onClick={(e) => {
          // コントロール内の操作がアイテム全体のクリックイベントを発火させないように防ぐ
          if (control) {
            e.stopPropagation();
          }
        }}
      >
        {control && (
          <div data-tn-list-control style={{ display: 'flex', alignItems: 'center' }}>
            {control}
          </div>
        )}

        {isClickable && (
          <div
            data-tn-list-chevron
            style={{ color: textColor, display: 'flex', alignItems: 'center' }}
          >
            <RightGraterThan size={18} />
          </div>
        )}
      </div>
    </div>
  );
};
