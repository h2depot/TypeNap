import React, { memo, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const GhostImageOption = memo(function GhostImageOption({
  image,
  selected,
  onSelect,
  width = 120,
  height = 105,
  showName = false,
}) {
  const { t } = useTranslation();
  const imageSrc = useMemo(() => image.path ? convertFileSrc(image.path) : "", [image.path]);

  return (
    <button
      type="button"
      onClick={() => onSelect(image.path)}
      aria-pressed={selected}
      aria-label={image.name}
      style={{
        position: "relative",
        width,
        height,
        display: "flex",
        flexDirection: "column",
        flex: "0 0 auto",
        padding: 0,
        border: 0,
        cursor: "pointer",
        borderRadius: "8px",
        overflow: "hidden",
        color: "var(--ghost-text)",
        background: "var(--ghost-option-bg)",
      }}
    >
      <AnimatePresence>
        {selected && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "8px",
              padding: "2px",
              background: "var(--ghost-gradient, linear-gradient(135deg, #a777e3, #6e8efb))",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
        )}
      </AnimatePresence>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
          style={{ width: "100%", flex: 1, objectFit: "cover", minHeight: 0 }}
        />
      ) : (
        <span style={{ padding: "8px", fontSize: "12px" }}>{t("common.imageLoadFailed")}</span>
      )}
      {showName && (
        <span style={{
          width: "100%",
          boxSizing: "border-box",
          fontSize: "12px",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          padding: "4px",
        }}>
          {image.name}
        </span>
      )}
    </button>
  );
});

export default GhostImageOption;
