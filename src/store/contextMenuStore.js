import { create } from "zustand";

export const useContextMenuStore = create((set) => ({
    isOpen: false,
    x: 0,
    y: 0,
    options: [],
    showMenu: (x, y, options) => set({ isOpen: true, x, y, options }),
    closeMenu: () => set({ isOpen: false }),
}));
