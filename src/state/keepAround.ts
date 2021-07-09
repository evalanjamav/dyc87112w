import { logger } from "../api/logger";

let globalShouldKeepAround = false;
let requested: { [key: string]: boolean } = {};

export function coscriptKeepAround(requestID) {
    if (!requestID) throw 'requestID is needed for setShouldKeepAround';
    if (!globalShouldKeepAround) {
        coscript.setShouldKeepAround(true);
        globalShouldKeepAround = true;
        logger.debug('coscript.setShouldKeepAround(true)')
    }
    requested[requestID] = true;
}


export function coscriptNotKeepAround(requestID) {
    if (!requestID) throw 'requestID is needed for setShouldKeepAround';
    if (!requested[requestID]) return;
    delete requested[requestID];
    if (!Object.keys(requested).length && globalShouldKeepAround) {
        coscript.setShouldKeepAround(false);
        globalShouldKeepAround = false;
        logger.debug('coscript.setShouldKeepAround(false)')
    }
}

// https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}