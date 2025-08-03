import { AIModel, config } from './config/config';


function getAdminPermission(userId: number): boolean {
    return config.ADMIN_USERS_TELEGRAM.includes(userId);
}

function getSuperUserPermission(userId: number): boolean {
    return config.SUPER_USERS_TELEGRAM.includes(userId);
}

function getModelList(userId: number): { modelList: AIModel[], modelKeyList: string[] } {
    const isSuperUser = getSuperUserPermission(userId);
    const allModelList = Object.values(config.MODELS_CONFIG).filter(({ off, superUser }) => {
        if (isSuperUser) {
            return !off;
        }
        return !off && !superUser;
    });

    return {
        modelList: allModelList,
        modelKeyList: allModelList.map(({ key }) => key),
    };
}

function getModelPermissionStatus(userId: number, model: string): boolean {
    return getModelList(userId).modelKeyList.includes(model);
}

function getAllowedModelsLabels(userId: number): string {
    return getModelList(userId).modelList.map(({ text }) => text).join(", ");
}

function getModelPermissionSelected(userId: number, model: string): AIModel | undefined {
    return getModelList(userId).modelList.find(({ key }) => key === model);
}

export interface AllowedService {
    getAdminPermission: (userId: number) => boolean;
    getSuperUserPermission: (userId: number) => boolean;
    getModelPermissionStatus: (userId: number, model: string) => boolean;
    getAllowedModelsLabels: (userId: number) => string;
    getModelPermissionSelected: (userId: number, model: string) => AIModel | undefined;
    getModelList: (userId: number) => { modelList: AIModel[], modelKeyList: string[] };
}

export const allowedService: AllowedService = {
    getAdminPermission,
    getSuperUserPermission,
    getModelPermissionStatus,
    getAllowedModelsLabels,
    getModelPermissionSelected,
    getModelList,
};