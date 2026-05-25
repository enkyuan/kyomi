import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type PreloadableLazy<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

export function lazyNamed<TModule, TName extends keyof TModule>(
  loadModule: () => Promise<TModule>,
  exportName: TName,
): PreloadableLazy<Extract<TModule[TName], ComponentType<any>>> {
  const loadComponent = async () => {
    const module = await loadModule();
    const component = module[exportName];

    if (!component) {
      throw new Error(`Missing lazy export: ${String(exportName)}`);
    }

    return { default: component as Extract<TModule[TName], ComponentType<any>> };
  };

  return Object.assign(lazy(loadComponent), { preload: loadComponent });
}
