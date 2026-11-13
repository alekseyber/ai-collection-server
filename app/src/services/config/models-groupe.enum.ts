// Типы для моделей AI
export enum ModelsGroupe {
  OLLAMA = 'ollama',
  LLAMA_CPP = 'llama_cpp',
  /** Любой OpenAI-совместимый сервер по своему api_url из конфига (llama-server, vLLM). */
  OPENAI_COMPAT = 'openai_compat',
  OPEN_ROUTER = 'open_router',
  OTHER = 'other',
  TIMEWEB_CLOUD_AI = 'timeweb_cloud_ai',
  SILICON_CLOUD_AI = 'silicon_cloud_ai',
}
