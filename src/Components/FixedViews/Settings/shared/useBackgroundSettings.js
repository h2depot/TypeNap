import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBgImageStore } from "../../../../store/bgImageStore";

// Both background selection and image management support importing an image.
export function useBackgroundSettings(initialPath) {
    const addUserImage = useBgImageStore((state) => state.addUserImage);
    const deleteUserImage = useBgImageStore((state) => state.deleteUserImage);
    const fetchImageList = useBgImageStore((state) => state.fetchImageList);
    const wholeImageList = useBgImageStore((state) => state.wholeImageList);

    const [selectedBgImage, setSelectedBgImage] = useState(initialPath || "");

    const handleAddBackgroundImage = useCallback(async () => {
        const file = await open({
            multiple: false,
            directory: false,
            filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg"] }],
        });

        if (!file) {
            return;
        }

        await addUserImage(file);
        const imageList = await fetchImageList();
        const fileName = file.split(/[\\/]/).pop();
        const addedImage = imageList.find((image) => image.kind === "user" && image.name === fileName);
        setSelectedBgImage(addedImage?.path || file);
    }, [addUserImage, fetchImageList]);


    return { selectedBgImage, setSelectedBgImage, wholeImageList, fetchImageList, deleteUserImage, handleAddBackgroundImage };
}
