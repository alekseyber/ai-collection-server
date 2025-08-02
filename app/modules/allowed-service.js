import { config } from './config/config.js';


function getAdminPermission(userId) {
    return config.ADMIN_USERS_TELEGRAM.includes(userId)
}


function getSuperUserPermission(userId) {
    return config.SUPER_USERS_TELEGRAM.includes(userId)
}

function getModelList(userId) {
    const isSuperUser = getSuperUserPermission(userId);
    const allModelList = Object.values(config.MODELS_CONFIG).filter(({ off, superUser }) => {
        if (isSuperUser) {
            return !off
        }
        return !off && superUser
    });

    return {
        modelList: allModelList,
        modelKeyList: allModelList.map(({ key }) => key),
    }
}

function getModelPermissionStatus(userId, model) {
    return getModelList(userId).modelKeyList.includes(model);
}

function getAllowedModelsLabels(userId) {
    return getModelList(userId).modelList.map(({ text }) => text).join(", ");
}
function getModelPermissionSelected(userId, model) {
    return getModelList(userId).modelList.find(({ key }) => key === model);
}

export const allowedService = {
    getAdminPermission,
    getSuperUserPermission,
    getModelPermissionStatus,
    getAllowedModelsLabels,
    getModelPermissionSelected,
    getModelList,
}