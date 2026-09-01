import { convertFileSrc } from "@tauri-apps/api/core";
import "./GhostBookCard.css";

function GhostBookCard_Preview({ title, coverColor, onClick }) {
    const isImage = coverColor && !coverColor.startsWith("#") && !coverColor.startsWith("var(");
    const coverStyle = isImage
        ? { backgroundImage: `url(${convertFileSrc(coverColor)})`, backgroundSize: "cover", backgroundPosition: "center" }
        : (coverColor ? { backgroundColor: coverColor } : {});

    return (
        <div className="ghost-book-item">
            <div className="ghost-book-cover-button" style={{ cursor: 'pointer' }} onClick={onClick}>
                <div className="ghost-book-cover" style={coverStyle}>
                    <div className="ghost-book-border-glow" />
                    <div className="ghost-book-spine" />
                    <div className="ghost-book-edge" />
                    <div className="ghost-book-title">
                        {title}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GhostBookCard_Preview;
