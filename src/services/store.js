/**
 * js/store.js - Store simples baseada em Event Target
 */
class AppStore extends EventTarget {
    constructor() {
        super();
        this.state = {
            userRole: localStorage.getItem('sgdm_userRole') || null,
            userName: localStorage.getItem('sgdm_userName') || null,
            notifications: []
        };
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
}

window.globalStore = new AppStore();
