import { BookClose_TN, Page, Search } from "../../assets/IconList";
import TabStory from "../Tab_view/Tab_Story/tab_story";
import TabWork from "../Tab_view/Tab_Work/tab_work";
import TabSearch from "../Tab_view/Tab_Search/tab_search";

// Add future dynamic tab renderers here. Fixed views never enter this registry.
export const workspaceTabTypes = {
    story: { component: TabStory, icon: BookClose_TN },
    work: { component: TabWork, icon: Page },
    search: { component: TabSearch, icon: Search, keepMounted: true },
};
