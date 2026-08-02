import type { AIModel, LoadConfig } from './config/config';

export class AllowedService {
  private config: LoadConfig;
  constructor(config: LoadConfig) {
    this.config = config;
  }
  public getAdminPermission(userId: number): boolean {
    return this.config.ADMIN_USERS_TELEGRAM.includes(userId);
  }
  public getSuperUserPermission(userId: number): boolean {
    return this.config.SUPER_USERS_TELEGRAM.includes(userId);
  }
  public getModelList(userId: number): { modelList: AIModel[]; modelKeyList: string[] } {
    const isSuperUser = this.getSuperUserPermission(userId);
    const allModelList: AIModel[] = Object.values(this.config.MODELS_CONFIG).filter(
      (model: unknown) => {
        const { off, superUser } = model as AIModel;
        if (isSuperUser) {
          return !off;
        }
        return !off && !superUser;
      },
    );

    return {
      modelList: allModelList,
      modelKeyList: allModelList.map(({ key }) => key),
    };
  }
  public getModelPermissionStatus(userId: number, model: string): boolean {
    return this.getModelList(userId).modelKeyList.includes(model);
  }
  public getAllowedModelsLabels(userId: number): string {
    return this.getModelList(userId)
      .modelList.map(({ text }) => text)
      .join(', ');
  }
  public getModelPermissionSelected(userId: number, model: string): AIModel | undefined {
    return this.getModelList(userId).modelList.find(({ key }) => key === model);
  }
}
