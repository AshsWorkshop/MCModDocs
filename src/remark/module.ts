import type { ClientModule } from '@docusaurus/types';
import { loadTabDisplays, switchTab } from './hidden';

const module: ClientModule = {
    onRouteDidUpdate({location, previousLocation}) {
        // Reload tab displays on page change
        if (!previousLocation || location.pathname !== previousLocation.pathname) {
            loadTabDisplays(new URLSearchParams(location.search));
        }

        // Add console method for switching tabs
        if (!Object.hasOwn(window, 'switchTab')) {
            (window as any).switchTab = switchTab;
        }
    },
};
export default module;
