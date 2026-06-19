/**
 * src/services/store.js - Store reativa baseada em EventTarget
 */
const STORAGE_KEYS = {
    USER_NAME: 'sgdm_userName',
    USER_ROLE: 'sgdm_userRole'
};

class AppStore extends EventTarget {
    constructor() {
        super();
        this.state = {
            userRole: sessionStorage.getItem(STORAGE_KEYS.USER_ROLE) || null,
            userName: sessionStorage.getItem(STORAGE_KEYS.USER_NAME) || null,
            notifications: []
        };
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        
        if (newState.userRole !== undefined) {
            if (newState.userRole === null) {
                sessionStorage.removeItem(STORAGE_KEYS.USER_ROLE);
            } else {
                sessionStorage.setItem(STORAGE_KEYS.USER_ROLE, newState.userRole);
            }
        }
        if (newState.userName !== undefined) {
            if (newState.userName === null) {
                sessionStorage.removeItem(STORAGE_KEYS.USER_NAME);
            } else {
                sessionStorage.setItem(STORAGE_KEYS.USER_NAME, newState.userName);
            }
        }

        this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
}

window.globalStore = new AppStore();

